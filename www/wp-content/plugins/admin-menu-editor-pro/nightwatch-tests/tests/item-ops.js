const helper = require('../helper');

describe('Menu item operations', function () {
	function rawClickToolbarButton(browser, level, action, filterSelector) {
		if ((typeof level === 'undefined') || (level < 1)) {
			level = 1;
		}
		if ((typeof filterSelector === 'undefined') || (!filterSelector)) {
			filterSelector = '*';
		}

		browser.execute(
			function (level, action, filterSelector) {
				if (typeof jQuery === 'undefined') {
					return;
				}

				jQuery('#ws_menu_editor .ws_main_container').eq(level - 1)
					.find('.ws_toolbar .ws_button[data-ame-button-action="' + action + '"]')
					.filter(filterSelector)
					.first()
					.click();
			},
			[level, action, filterSelector]
		);
	}

	/**
	 * @type {function(level: number, action:string, filterSelector:string?)}
	 */
	let clickToolbarButton;

	/**
	 * Count the number of menu items in the current list. Optionally, include only items that match the specified title.
	 * This function should be run in page context.
	 *
	 * @param {number} level
	 * @param {string|null} [title]
	 */
	function countMenuItems(level, title) {
		if (typeof jQuery === 'undefined') {
			return -1;
		}

		const list = jQuery('#ws_menu_editor .ame-editor-column-' + level + ' .ame-visible-item-list');
		let items;
		if ((typeof title === 'undefined') || (title === null)) {
			items = list.find('.ws_container');
		} else {
			items = list.find('.ws_container .ws_item_title:contains("' + title + '")');
		}
		return items.length;
	}

	before(
		/**
		 * @param {NightwatchBrowser} browser
		 */
		function (browser) {
			browser.ameQuickSetup();

			clickToolbarButton = function (level, action, filterSelector) {
				return rawClickToolbarButton(browser, level, action, filterSelector);
			}
		}
	);

	test(
		'Clipboard operations',
		/**
		 * @param {NightwatchBrowser} browser
		 */
		function (browser) {
			browser.assert.elementPresent(
				'#ws_menu_editor .ws_toolbar .ws_button',
				'At least one toolbar button exists'
			);

			//Try to copy the "Dashboard" menu.
			clickToolbarButton(1, 'copy');
			clickToolbarButton(1, 'paste');

			browser.assert.containsText(
				{
					selector: '#ws_menu_editor .ws_main_container:first-child .ws_container .ws_item_title',
					index: 0
				},
				'Dashboard',
				'The first top level menu is "Dashboard"'
			);
			browser.assert.containsText(
				{
					selector: '#ws_menu_editor .ws_main_container:first-child .ws_container .ws_item_title',
					index: 1
				},
				'Dashboard',
				'Created a copy of the "Dashboard" menu'
			);

			//Cut the "Tools" menu.
			//First, verify that the item exists.
			browser.ameAssertExecute(
				countMenuItems,
				[1, 'Tools'],
				1,
				'The "Tools" menu exists'
			);

			browser.ameSelectItemByTitle(['Tools']);
			browser.assert.containsText(
				'#ws_menu_editor .ame-editor-column-1 .ame-visible-item-list .ws_container.ws_active .ws_item_title',
				'Tools',
				'The "Tools" menu can be selected'
			);

			//Verify that the item was removed.
			clickToolbarButton(1, 'cut');
			browser.ameAssertExecute(
				countMenuItems,
				[1, 'Tools'],
				0,
				'"Cut" button removes the selected menu'
			);

			//Finally, the paste button should restore the item.
			clickToolbarButton(1, 'paste');
			browser.ameAssertExecute(
				countMenuItems,
				[1, 'Tools'],
				1,
				'"Paste" button restores the item that was cut'
			);

			//Cut from the submenu, paste in the top level menu.
			browser.ameSelectItemByTitle(['Settings', 'Writing']);
			clickToolbarButton(2, 'cut');
			clickToolbarButton(1, 'paste');
			browser.ameAssertExecute(
				countMenuItems,
				[1, 'Writing'],
				1,
				'Can cut an item from a submenu and paste it in the top level'
			);
		}
	);

	test(
		'Item selection',
		/**
		 * @param {NightwatchBrowser} browser
		 */
		function (browser) {
			browser.ameSelectItemByTitle(['Posts', 'Categories']);

			browser.assert.containsText(
				'#ws_menu_editor .ame-editor-column-1 .ame-visible-item-list .ws_container.ws_active .ws_item_title',
				'Posts',
				"Can select a top level menu"
			);

			browser.assert.containsText(
				'#ws_menu_editor .ame-editor-column-2 .ame-visible-item-list .ws_container.ws_active .ws_item_title',
				'Categories',
				"Can select a submenu item"
			);
		}
	);

	test(
		'Item creation',
		/**
		 * @param {NightwatchBrowser} browser
		 */
		function (browser) {
			for (let level = 1; level <= 2; level++) {
				browser.ameSelectItemByTitle(['Settings']);

				//Count how many items there were initially.
				let initialNumberOfItems;
				browser.execute(
					countMenuItems,
					[level],
					function (result) {
						initialNumberOfItems = result.value;
					}
				);

				//Create a new menu item and a new separator.
				clickToolbarButton(level, 'new-menu');
				clickToolbarButton(level, 'new-separator');

				browser.execute(
					countMenuItems,
					[level],
					function (result) {
						//We created two things, so the number of items should have increased by 2.
						const numberOfItems = result.value;
						browser.assert.equal(
							numberOfItems,
							initialNumberOfItems + 2,
							'"New menu" and "New separator" buttons on level ' + level + ' add new items'
						);
					}
				);
			}

			//Attempt to create a new heading.
			browser.assert.not.elementPresent(
				'#ws_menu_editor .ame-editor-column-1 .ws_container .ws_subtype_heading_flag',
				'The default admin menu does not contain any heading items'
			);
			clickToolbarButton(1, 'new-heading');
			browser.assert.elementPresent(
				'#ws_menu_editor .ame-editor-column-1 .ws_container .ws_subtype_heading_flag',
				'We can create a new heading'
			);
		}
	);

	test(
		'Item deletion',
		/**
		 * @param {NightwatchBrowser} browser
		 */
		function (browser) {
			//It's not possible to delete a built-in menu item. The plugin should offer to hide it instead.
			browser.ameSelectItemByTitle(['Posts']);
			clickToolbarButton(1, 'delete');
			browser.assert.visible(
				'#ws-ame-menu-deletion-error',
				'"Delete" button triggers an error dialog if the selected item is not custom'
			);
			browser.click('#ws_hide_menu_from_everyone');

			//Create a custom item, then delete it.
			clickToolbarButton(1, 'new-menu');

			let countBeforeDeletion;
			browser.execute(
				countMenuItems,
				[1],
				function (result) {
					countBeforeDeletion = result.value;
				}
			);

			clickToolbarButton(1, 'delete');
			browser.acceptAlert();

			browser.execute(
				countMenuItems,
				[1],
				function (result) {
					const countAfterDeletion = result.value;
					browser.assert.equal(
						countAfterDeletion,
						countBeforeDeletion - 1,
						'"Delete" button deletes a custom menu item'
					);
				}
			);
		}
	);

	test(
		'Hiding items',
		/**
		 * @param {NightwatchBrowser} browser
		 */
		function (browser) {
			browser.ameLoadDefaultMenu();

			//Select the "Current user (username)" actor.
			browser.click('#ws_actor_selector a[href="#user:' + helper.config.adminUsername + '"]');

			//Hide the entire Posts menu.
			browser.ameSelectItemByTitle(['Posts']);
			clickToolbarButton(1, 'deny');
			//Hide the Media menu (cosmetic).
			browser.ameSelectItemByTitle(['Media']);
			clickToolbarButton(1, 'hide');

			browser.click('#ws_save_menu');

			//Verify that Posts -> All Posts is not accessible.
			browser.url(helper.config.adminUrl + '/edit.php');
			browser.assert.elementPresent(
				'body#error-page',
				'"Hide and prevent access" blocks access to the hidden menu item'
			);

			//Verify that Posts -> Categories is not accessible. Clicking the "Hide and deny" button with
			//a top level menu selected should also hide all of its submenu items.
			browser.url(helper.config.adminUrl + '/edit-tags.php?taxonomy=category');
			browser.assert.elementPresent(
				'body#error-page',
				'Hiding a top level menu also automatically hides its submenu items.'
			);

			//Verify that Media is not visible.
			browser.url(helper.config.adminUrl + '/');
			browser.assert.not.elementPresent(
				'#adminmenu #menu-media',
				'The "Hide without preventing access" button hides the selected menu'
			);

			//Verify that Media is still accessible.
			browser.url(helper.config.adminUrl + '/upload.php');

			browser.assert.elementPresent(
				'.wrap .wp-filter ',
				'The "Hide without preventing access" button does not block access to the hidden menu'
			);
		}
	);

	after(
		/**
		 * @param {NightwatchBrowser} browser
		 */
		function (browser) {
			browser.end();
		}
	);
});
