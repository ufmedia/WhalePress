//Multi-level admin menu support.
(function ($) {
	let hasInitStarted = false;

	let $window;
	let $wpwrap;
	let $adminMenu;
	let $adminBar;

	function init() {
		if (hasInitStarted) {
			return;
		}
		hasInitStarted = true;

		$window = $(window);
		$wpwrap = $('#wpwrap');
		$adminMenu = $('#adminmenu');
		$adminBar = $('#wpadminbar');

		//Adjust the colors of the current deep submenu's parent(s) to match the active admin color scheme.
		//Find a highlighted top-level menu.
		const $highlightedMenuLink = $adminMenu.find('li.menu-top.wp-has-current-submenu,li.menu-top.current')
			.find('> a').first();
		if ($highlightedMenuLink.length > 0) {
			//Get the background and text color from that menu.
			const background = $highlightedMenuLink.css('backgroundColor');
			const textColor = $highlightedMenuLink.css('color');
			if (background && textColor) {
				//Create a new style block that will apply these colors to deep submenu parents.
				let selectors = [
					'#adminmenu li.ame-has-deep-submenu.ame-has-highlighted-item > a:first-of-type',
					'#adminmenu li.ame-has-deep-submenu.ame-has-current-deep-submenu > a:first-of-type'
				];
				const $newStyle = $('<style>')
					.text(selectors.join(',\n') + ' { background: ' + background + '; color: ' + textColor + '; }');
				const $proStylesheetNode = $('link#ame-pro-admin-styles-css').first();
				if ($proStylesheetNode.length === 1) {
					$newStyle.insertAfter($proStylesheetNode);
				} else {
					$newStyle.appendTo('head');
				}
			}
		}

		/*
		 * Known issue: When a submenu item is highlighted as the current item and it has a nested
		 * submenu, all of its children will inherit the "current item" style. This happens because
		 * all admin color schemes that I've seen use an "all children" selector ("li.current a") when
		 * setting submenu colors, not an "immediate children" selector ("li.current > a").
		 *
		 * I've investigated several ways to fix that, but found no practical solution.
		 *  - Overriding menu styles doesn't work due to selector specificity problems.
		 *  - Editing the loaded admin-menu.css stylesheet with JS isn't reliable because the user
		 *    might use a custom admin color scheme that has its own stylesheet(s).
		 *  - Searching through all loaded stylesheets for rules that apply to submenu items seems
		 *    too slow to do it on every page load.
		 */

		//Find all items that have deep submenus and move the submenus to the items.
		const $deepParents = $adminMenu.find('li.ame-has-deep-submenu');
		//The parent item should have a unique class that has the prefix "ame-ds-m".
		const dsClassPrefix = 'ame-ds-m';

		$deepParents.each(function () {
			const $deepParent = $(this)
			const $deepLink = $deepParent.find('> a').first();

			const parentElement = $deepParent.get(0);
			if (!parentElement || (typeof parentElement.classList === 'undefined')) {
				return;
			}

			const classes = parentElement.classList;
			let uniqueClass = null;
			for (let i = 0; i < classes.length; i++) {
				if (classes[i].substr(0, dsClassPrefix.length) === dsClassPrefix) {
					uniqueClass = classes[i];
					break;
				}
			}

			if (!uniqueClass) {
				return;
			}

			const $tempContainer = $adminMenu.find('li.ame-ds-child-of-' + uniqueClass).first();
			if ($tempContainer.length < 1) {
				//The submenu doesn't exist, bail.
				$deepParent.removeClass('ame-has-deep-submenu');
				return;
			}

			const $deepSubmenu = $tempContainer.find('> ul.wp-submenu').first();

			//Move the submenu into the parent item.
			$deepLink.after($deepSubmenu);
			$deepParent.css({
				position: 'relative',
				overflow: 'visible'
			});
			$deepSubmenu.addClass('ame-deep-submenu');

			//Remove the temporary container, we don't need it any more.
			$tempContainer.remove();

			$deepParent.hoverIntent({
				over: function () {
					let $menuItem = $(this),
						$submenu = $menuItem.find('.wp-submenu'),
						top = parseInt($submenu.css('top'), 10);

					if (isNaN(top) || top > -5) { //The submenu is already visible, don't try to open it again.
						return;
					}

					if ($adminMenu.data('wp-responsive')) {
						return;
					}

					//console.log('AME: Open menu on hover');
					//Close any sibling menus.
					$menuItem.closest('ul').find('li.opensub').removeClass('opensub');
					//Open this menu.
					$menuItem.addClass('opensub');
					readjustSubmenu($menuItem, true);
				},
				out: function () {
					if ($adminMenu.data('wp-responsive')) {
						return;
					}

					//console.log('AME: Close menu on hover out');
					$(this).removeClass('opensub').find('.ame-deep-submenu').first().css('margin-top', '');
				},
				timeout: 200,
				sensitivity: 7,
				interval: 90
			});
		});

		//The current menu item might be in a deeply nested submenu. Let's highlight it right now
		//to reduce the risk that menus will visibly jump around and change as the page loads.
		$(document).trigger('adminMenuEditor:highlightCurrentMenu');
	}

	/**
	 * Ensure a deeply nested admin submenu is within the visual viewport.
	 * Based on the adjustSubmenu function found in /wp-admin/js/common.js.
	 *
	 * @param {JQuery} $menuItem The parent menu item containing the submenu(s).
	 * @param {Boolean} [onlyIncludeOpen] Set to true to include only submenus that are currently open.
	 */
	function readjustSubmenu($menuItem, onlyIncludeOpen) {
		let bottomOffset, adjustment, minTop, maxBottomOffset, maxPageBottomOffset, maxWindowBottomOffset,
			$submenus,
			adminBarHeight = (Math.ceil($adminBar.height()) || 32),
			submenuSelector = '.wp-submenu.ame-deep-submenu';

		//These constraints were chosen to emulate WordPress 5.6.1 behaviour.
		const minDistance = {
			fromWindowTop: adminBarHeight,
			fromWindowBottom: 36,
			fromPageBottom: 78
		};

		//Optimization: Adjust only open submenus.
		if (onlyIncludeOpen) {
			$submenus = $menuItem.find('.opensub > ' + submenuSelector);
			if ($menuItem.hasClass('opensub')) {
				$submenus = $submenus.add('> ' + submenuSelector, $menuItem.get(0));
			}
		} else {
			$submenus = $menuItem.find(submenuSelector);
		}

		//Keep the menu below the top edge of the window and below the admin bar.
		minTop = $window.scrollTop() + minDistance.fromWindowTop;
		//Keep the menu above the bottom edge of the window/page.
		maxPageBottomOffset = ($wpwrap.height() + Math.ceil($wpwrap.offset().top)) - minDistance.fromPageBottom;
		maxWindowBottomOffset = $window.scrollTop() + $window.height() - minDistance.fromWindowBottom;
		maxBottomOffset = Math.min(maxWindowBottomOffset, maxPageBottomOffset);

		$submenus.each(function () {
			const $submenu = $(this),
				$directParentMenuItem = $submenu.closest('.ame-has-deep-submenu'),
				parentItemTop = $directParentMenuItem.offset().top,
				parentItemWidth = $directParentMenuItem.outerWidth(),
				$firstSubmenuItem = $submenu.find('> li').not('.wp-submenu-head').first(),
				submenuHeight = $submenu.outerHeight();

			let submenuTop = parseInt($submenu.css('top'), 10);
			if (isNaN(submenuTop) || (submenuTop < -50)) {
				submenuTop = -1;
			}

			const menuTop = parentItemTop + submenuTop; //Top offset of the menu.
			bottomOffset = menuTop + submenuHeight + 1; //Bottom offset of the menu. I don't know why the +1 is required.
			adjustment = 0;

			if ($firstSubmenuItem.length === 1) {
				//Align the first item of the submenu with the parent item. This is the default adjustment
				//when the submenu isn't close to either the top or the bottom of the window.
				const firstItemDistance = $firstSubmenuItem.position().top;
				if (Math.abs(firstItemDistance) < 200) { //Sanity check. The largest value I've seen is 38.
					adjustment = -firstItemDistance - submenuTop;
				}
			}
			if ((bottomOffset + adjustment) > maxBottomOffset) {
				adjustment = maxBottomOffset - bottomOffset;
			}
			if ((menuTop + adjustment) < minTop) {
				adjustment = minTop - menuTop;
			}

			if (adjustment !== 0) {
				$submenu.css('margin-top', adjustment + 'px');
			} else {
				$submenu.css('margin-top', '');
			}

			/*console.log({
				menuTop: menuTop,
				submenuTop: submenuTop,
				submenuHeight: submenuHeight,
				itemOffset: $directParentMenuItem.offset()
			});*/

			//Align the submenu with the right edge of its parent. In addition to simplifying CSS styles (fewer
			//special cases for the folded state), this also improves compatibility with non-standard menu widths.
			const submenuLeft = $submenu.position().left;
			if (Math.abs(submenuLeft - parentItemWidth) > 1) {
				$submenu.css('left', Math.ceil(parentItemWidth) + 'px');
			}
		});
	}

	//Process the menu as soon as possible to reduce the risk that the user will see the submenu containers
	//in the top level before they're moved to the right places. This is similar to the FOUC problem.
	$(document).one('adminMenuEditor:menuDomReady', init);

	$(function () {
		//In case our custom event wasn't triggered for some reason, let's call the init function again.
		//The function should be designed to avoid duplicate initialisation.
		init();

		window.setTimeout(function () {
			$adminMenu.on('focus.adminmenueditor', '.ame-deep-submenu a, li.ame-has-deep-submenu > a', function (event) {
				if ($adminMenu.data('wp-responsive')) {
					return;
				}

				const $self = $(event.target);
				//If this submenu is already visible because it contains the currently highlighted item, do nothing.
				const $immediateParentItem = $self.closest('li.ame-has-deep-submenu');
				if ($immediateParentItem.hasClass('ame-has-highlighted-item')) {
					return;
				}

				//Expand all parents of this item.
				const parentItems = $self.parentsUntil($adminMenu, 'li.ame-has-deep-submenu, li.menu-top');
				parentItems.addClass('opensub');
				readjustSubmenu(parentItems.last(), true);
			}).on('blur.adminmenueditor', '.ame-deep-submenu a, li.ame-has-deep-submenu > a', function (event) {
				if ($adminMenu.data('wp-responsive')) {
					return;
				}

				const $self = $(event.target);
				const $immediateParentItem = $self.closest('li.ame-has-deep-submenu');
				if ($immediateParentItem.hasClass('ame-has-highlighted-item')) {
					return;
				}

				$immediateParentItem.removeClass('opensub');
			});
		}, 1);
	})
})(jQuery);