casper.start();
casper.test.comment('Log into WordPress and check that "Settings -> Menu Editor Pro" exists.');

ameTest.thenQuickSetup(['check-compression']);

casper.then(function() {
	casper.test.assert(ameTest.isLoggedIn(), 'User logged in successfully');
});

//Basic sanity checks.
casper.thenOpen(ameTestConfig.adminUrl + '/options-general.php?page=menu_editor', function() {
	casper.test.assertExists('#ws_menu_editor', 'Menu editor page exists and is accessible');
	casper.test.assertExists('.ws_container', 'At least one menu editor widget exists');
});

casper.then(function() {
	//Attempt to reset the menu configuration.
	casper.test.comment('Reset menu configuration back to the default.');
	ameTest.loadDefaultMenu();
	
	//By default, the first visible menu item is "Dashboard".
	casper.test.assertEval(function() {
		var firstItemTitle = jQuery('#ws_menu_editor').find('.ws_item_title').first().text();
		return firstItemTitle.indexOf('Dashboard') === 0;
	}, 'First menu item is named "Dashboard"');
});

//Try changing the title of a menu item and a sub-menu item.
casper.then(function() {
	casper.test.comment('Change "Dashboard" to "Custom Title" and "Settings -> General" to "Renamed".');
	casper.evaluate(function() {
		var menuEditor = jQuery('#ws_menu_editor');

		//Note: Would be useful to have a function that finds a menu or sub-menu widget by title
		//or by template ID (we can do that by looking at jQuery.data('menu_item').template_id).
		var item = menuEditor.find('.ws_item_title:contains("Dashboard")').first().closest('.ws_container');
		item.find('.ws_edit_link').click();
		item.find('.ws_edit_field-menu_title input.ws_field_value')
			.val('Custom Title')
			.change();

		//Find the "Settings" menu.
		var settingsMenu = menuEditor.find('.ws_item_title:contains("Settings")').first().closest('.ws_container');
		settingsMenu.find('.ws_edit_link').click(); //Necessary to generate the sub-menu HTML.

		//Find the "General" sub-menu item and rename it.
		var generalItem = jQuery('#' + settingsMenu.data('submenu_id'))
			.find('.ws_item_title:contains("General")')
			.first().closest('.ws_container');
		generalItem.find('.ws_edit_link').click();
		generalItem.find('.ws_edit_field-menu_title input.ws_field_value').val('Renamed').change();
	});

	casper.click('#ws_save_menu');
});

ameTest.waitForSettingsSavedMessage(function() {
	casper.test.assertSelectorHasText('#message,#setting-error-settings_updated', 'Settings saved.', 'Menu saved successfully');
	casper.test.assertSelectorHasText('#menu-dashboard', 'Custom Title', '"Dashboard" was changed to "Custom Title"');
	casper.test.assertSelectorHasText(
		'#menu-settings .wp-submenu a[href="options-general.php"]',
		'Renamed',
		'"Settings -> General" was changed to "Renamed"'
	);
});

casper.run(function() {
    this.test.done(); // I must be called once all the async stuff has been executed
});