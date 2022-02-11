///<reference path="../js/jquery.d.ts"/>
///<reference path="../js/jquery.biscuit.d.ts"/>
'use strict';

declare var wsAmeProAdminHelperData: Record<string, any>;

(function ($) {
	let isHeadingStateRestored = false;

	function setCollapsedState($heading: JQuery, isCollapsed: boolean) {
		$heading.toggleClass('ame-is-collapsed-heading', isCollapsed);

		//Show/hide all menu items between this heading and the next one.
		const containedItems = $heading.nextUntil('li.ame-menu-heading-item, #collapse-menu', 'li.menu-top');
		containedItems.toggle(!isCollapsed);
	}

	/**
	 * Save the collapsed/expanded state of menu headings.
	 */
	function saveCollapsedHeadings($adminMenu: JQuery) {
		let collapsedHeadings = loadCollapsedHeadings();
		const currentTime = Date.now();

		$adminMenu.find('li[id].ame-collapsible-heading').each(function () {
			const $heading = $(this), id = $heading.attr('id');
			if (id) {
				if ($heading.hasClass('ame-is-collapsed-heading')) {
					collapsedHeadings[id] = currentTime;
				} else if (collapsedHeadings.hasOwnProperty(id)) {
					delete collapsedHeadings[id];
				}
			}
		});

		//Discard stored data associated with headings that haven't been seen in a long time.
		//It's likely that the headings no longer exist.
		if (Object.keys) {
			const threshold = currentTime - (90 * 24 * 3600 * 1000);
			let headingIds = Object.keys(collapsedHeadings);
			for (let i = 0; i < headingIds.length; i++) {
				const id = headingIds[i];
				if (!collapsedHeadings.hasOwnProperty(id)) {
					continue;
				}
				if (collapsedHeadings[id] < threshold) {
					delete collapsedHeadings[id];
				}
			}
		}

		$.cookie('ame-collapsed-menu-headings', JSON.stringify(collapsedHeadings), {expires: 90});
	}

	function loadCollapsedHeadings(): Record<string, number> {
		let defaultValue = {};
		if (!$.cookie) {
			return defaultValue;
		}

		try {
			let settings = JSON.parse($.cookie('ame-collapsed-menu-headings'));
			if (typeof settings === 'object') {
				return settings;
			}
			return defaultValue;
		} catch {
			return defaultValue;
		}
	}

	/**
	 * Restore the previous collapsed/expanded state of menu headings.
	 */
	function restoreCollapsedHeadings() {
		isHeadingStateRestored = true;

		const previouslyCollapsedHeadings = loadCollapsedHeadings();
		const $adminMenu = $('#adminmenumain #adminmenu');
		for (let id in previouslyCollapsedHeadings) {
			if (!previouslyCollapsedHeadings.hasOwnProperty(id)) {
				continue;
			}
			const $heading = $adminMenu.find('#' + id);
			if ($heading.length > 0) {
				setCollapsedState($heading, true);
			}
		}
	}

	$(document).on('restoreCollapsedHeadings.adminMenuEditor', function () {
		if (!isHeadingStateRestored) {
			restoreCollapsedHeadings();
		}
	});

	jQuery(function ($) {
		//Menu headings: Handle clicks.
		const $adminMenu = $('#adminmenumain #adminmenu');

		$adminMenu.find('li.ame-menu-heading-item a').on('click', function () {
			const $heading = $(this).closest('li');
			const canBeCollapsed = $heading.hasClass('ame-collapsible-heading');

			if (!canBeCollapsed) {
				//By default, do nothing. The heading is implemented as a link due to how the admin menu
				//works, but we don't want it to go to a different URL on click.
				return false;
			}

			let isCollapsed = !$heading.hasClass('ame-is-collapsed-heading');
			setCollapsedState($heading, isCollapsed);

			//Remember the collapsed/expanded state.
			if ($.cookie) {
				setTimeout(saveCollapsedHeadings.bind(window, $adminMenu), 50);
			}

			return false;
		});

		if (!isHeadingStateRestored) {
			restoreCollapsedHeadings();
		}

		if (typeof wsAmeProAdminHelperData === 'undefined') {
			return;
		}

		//Menu headings: If the user hasn't specified a custom text color, make sure the color
		//doesn't change on hover/focus.
		if (wsAmeProAdminHelperData.setHeadingHoverColor && Array.prototype.map) {
			let baseTextColor;

			//Look at the first N menu items to discover the default text color.
			const $menus = $('#adminmenumain #adminmenu li.menu-top')
				.not('.wp-menu-separator')
				.not('.ame-menu-heading-item')
				.slice(0, 10)
				.find('> a .wp-menu-name');

			let mostCommonColor = '#eeeeee', seenColors = {};
			seenColors[mostCommonColor] = 0;

			$menus.each(function () {
				const color = $(this).css('color');
				if (color) {
					if (seenColors.hasOwnProperty(color)) {
						seenColors[color] = seenColors[color] + 1;
					} else {
						seenColors[color] = 1;
					}

					if (seenColors[color] > seenColors[mostCommonColor]) {
						mostCommonColor = color;
					}
				}
			});

			baseTextColor = mostCommonColor;

			//We want to override the default menu colors, but not per-item styles.
			const parentSelector = '#adminmenu li.ame-menu-heading-item';
			let selectors = [':hover', ':active', ':focus', ' a:hover', ' a:active', ' a:focus'].map(function (suffix) {
				return parentSelector + suffix;
			});

			const $newStyle = $('<style type="text/css">')
				.text(selectors.join(',\n') + ' { color: ' + baseTextColor + '; }');
			const $adminCssNode = $('link#admin-menu-css').first();
			if ($adminCssNode.length === 1) {
				$newStyle.insertAfter($adminCssNode);
			} else {
				$newStyle.appendTo('head');
			}
		}
	});
})(jQuery);