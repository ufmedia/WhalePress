const helper = require('../helper');

describe('Basic functionality test', function () {
	// noinspection JSValidateJSDoc Nightwatch.js types are loaded in the IDE but not included in the actual plugin.
	test(
		'Menu Editor UI exists',
		/**
		 * @param {NightwatchBrowser} browser
		 */
		function (browser) {
			//helper.logInAdAdmin(browser);
			browser.logInAsAdmin();

			//Basic sanity checks.
			browser.url(helper.config.adminUrl + '/options-general.php?page=menu_editor')
				.assert.elementPresent('#ws_menu_editor', 'Menu editor page exists and is accessible')
				.assert.elementPresent('.ws_container', 'At least one menu editor widget exists');

			//Attempt to reset the menu configuration.
			browser.ameLoadDefaultMenu();
			browser.assert.containsText(
				{
					selector: '#ws_menu_editor .ws_item_title',
					index: 0
				},
				'Dashboard',
				'First menu item is named "Dashboard"'
			);
		})

	// noinspection JSValidateJSDoc
	test(
		'Change "Dashboard" to "Custom Title" and "Settings -> General" to "Renamed".',
		/**
		 * @param {NightwatchBrowser} browser
		 */
		function (browser) {
			browser.execute(function () {
				const menuEditor = jQuery('#ws_menu_editor');

				//Note: Would be useful to have a function that finds a menu or sub-menu widget by title
				//or by template ID (we can do that by looking at jQuery.data('menu_item').template_id).
				const item = menuEditor.find('.ws_item_title:contains("Dashboard")').first().closest('.ws_container');
				item.find('.ws_edit_link').click();
				item.find('.ws_edit_field-menu_title input.ws_field_value')
					.val('Custom Title')
					.change();

				//Find the "Settings" menu.
				const settingsMenu = menuEditor.find('.ws_item_title:contains("Settings")').first().closest('.ws_container');
				settingsMenu.find('.ws_edit_link').click(); //Necessary to generate the sub-menu HTML.

				//Find the "General" sub-menu item and rename it.
				const generalItem = jQuery('#' + settingsMenu.data('submenu_id'))
					.find('.ws_item_title:contains("General")')
					.first().closest('.ws_container');
				generalItem.find('.ws_edit_link').click();
				generalItem.find('.ws_edit_field-menu_title input.ws_field_value').val('Renamed').change();
			});

			browser.click('#ws_save_menu')

			browser.assert.containsText(
				'#message,#setting-error-settings_updated',
				'Settings saved',
				'Settings saved successfully'
			);

			browser.assert.containsText(
				'#menu-dashboard',
				'Custom Title',
				'"Dashboard" was changed to "Custom Title"'
			);
			browser.assert.containsText(
				'#menu-settings .wp-submenu a[href="options-general.php"]',
				'Renamed',
				'"Settings -> General" was changed to "Renamed"'
			);
		}
	)

	// noinspection JSValidateJSDoc
	after(
		/**
		 * @param {NightwatchBrowser} browser
		 */
		function (browser) {
			browser.end();
		}
	);
});

