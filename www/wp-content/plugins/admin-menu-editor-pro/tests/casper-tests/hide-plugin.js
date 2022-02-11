/*
 Test setting the "Who can access this plugin" setting to "Only the current user" and "Hide plugin entry".
 */
casper.start();
casper.test.comment('Set "Who can access this plugin" to "Only the current user".');
casper.test.comment('Enable "Hide the plugin entry on the "Plugins" page from other users".');

ameTest.thenQuickSetup();

//Click the "Settings" button.
casper.then(function() {
	casper.click('#ws_ame_settings_tab');
});

//Select the "Only the current user" option and save changes.
casper.waitForSelector('#ws_plugin_settings_form', function() {
	casper.click('input[name="plugin_access"][value="specific_user"]');
	casper.click('input[name="hide_plugin_from_others"]');
	casper.click('#submit');
});
ameTest.waitForSettingsSavedMessage();

casper.thenOpen(ameTestConfig.adminUrl + '/plugins.php', function() {
	casper.test.assertExists(
		'#menu-settings a[href="options-general.php?page=menu_editor"]',
		'The current user can see the "Menu Editor Pro" menu'
	);
	casper.test.assertVisible(
		'.plugins tr[data-slug="admin-menu-editor-pro"]',
		'The current user can see the plugin on the "Plugins" page'
	);

});

//Log in as another admin and make sure the plugin is now hidden.
ameTest.thenLogin('second_admin', 'password');
casper.thenOpen(ameTestConfig.adminUrl + '/plugins.php', function() {
	casper.test.assertDoesntExist(
		'#menu-settings a[href="options-general.php?page=menu_editor"]',
		'Other admins can\'t see the "Menu Editor Pro" menu'
	);
	casper.test.assertNotVisible(
		'.plugins  tr[data-slug="admin-menu-editor-pro"]',
		'Other admins can\'t see it on the "Plugins" page'
	);
});

ameTest.resetPluginConfiguration();

casper.run(function() {
	this.test.done();
});