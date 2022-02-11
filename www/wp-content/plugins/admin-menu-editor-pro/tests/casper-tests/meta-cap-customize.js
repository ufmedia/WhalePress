casper.start();
casper.test.comment('Verify that the "customize" meta capability can be checked and granted.');
ameTest.thenQuickSetup();

casper.then(function() {
	ameTest.selectRoleActor('administrator');
	casper.test.assert(
		ameTest.isItemChecked('Appearance', 'Customize'),
		'The "Customize" menu is checked for the Administrator role'
	);

	casper.test.comment('Enable the Customize menu for the Editor role');
	ameTest.selectRoleActor('editor');
	ameTest.selectItemByTitle('Appearance', 'Customize');
	casper.click('#ws_submenu_box .ws_item.ws_active .ws_actor_access_checkbox');

	casper.click('#ws_save_menu');
});

ameTest.waitForSettingsSavedMessage();
ameTest.thenLogin('editor', 'password');

casper.then(function() {
	casper.test.assertExists(
		'#menu-appearance a[href^="customize.php"]',
		'The Editor role can see the Customize menu'
	);
});

casper.run(function() {
	this.test.done();
});