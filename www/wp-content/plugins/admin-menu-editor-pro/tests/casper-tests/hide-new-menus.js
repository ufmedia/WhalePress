/*
 * Test "new menu visibility" settings.
 *
 * By default, the plugin displays new menu items without any changes and determines their permissions
 * based on the required capability. The user can configure the plugin to automatically hide new items
 * from users who can't access the menu editor.
 */
casper.start();
ameTest.thenQuickSetup();

//To detect "new" menus you need a baseline - that is, you need to save the menu configuration in the database.
ameTest.thenSaveMenu();

//Go to the "Settings" tab and change new menu visibility to match_plugin_access.
casper.thenOpen(ameTestConfig.adminUrl + '/options-general.php?page=menu_editor&sub_section=settings', function () {
	casper.test.comment('Change "New menu visibility" to "Show only to users who can access this plugin".');

	casper.fillSelectors(
		'form#ws_plugin_settings_form',
		{
			'input[name="unused_item_permissions"]': 'match_plugin_access'
		},
		true
	);
});

ameTest.waitForSettingsSavedMessage();

//Make some new menu items show up.
ameTest.activateHelper('dummy-menus');

//The menus should be visible to the admin.
casper.thenOpen(ameTestConfig.adminUrl, function () {
	casper.test.assertExists(
		'#toplevel_page_dummy-top-menu',
		'The admin can see a new top level menu.'
	);
	casper.test.assertExists(
		'#toplevel_page_dummy-menu-with-no-items',
		'The admin can see a new top level menu that has no submenus.'
	);
	casper.test.assertExists(
		'#menu-settings a[href$="options-general.php?page=dummy-settings"]',
		'The admin can see a new submenu item that was added to an existing top level menu.'
	);
});

ameTest.thenLogin('editor', 'password');
casper.thenOpen(ameTestConfig.adminUrl, function () {
	casper.test.assertDoesntExist(
		'#toplevel_page_dummy-top-menu',
		'An editor cannot see a new top level menu.'
	);
	casper.test.assertDoesntExist(
		'#toplevel_page_dummy-menu-with-no-items',
		'An editor cannot see a new top level menu that has no submenus.'
	);
	casper.test.assertDoesntExist(
		'#menu-settings a[href$="options-general.php?page=dummy-settings"]',
		'An editor cannot see a new submenu item that was added to an existing top level menu.'
	);
	casper.test.assertExists(
		'#menu-posts',
		'An editor can still see menu items that already existed (e.g. "Posts").'
	);
});

casper.run(function () {
	this.test.done();
});