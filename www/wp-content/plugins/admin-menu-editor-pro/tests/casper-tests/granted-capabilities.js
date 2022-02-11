/**
 * Test the ability to grant CPT capabilities to roles.
 */

casper.start();
ameTest.thenQuickSetup();

casper.then(function() {
	casper.test.comment('Give the "Author" role the "edit_pages" capability.');

	ameTest.selectActor('role:author');
	ameTest.selectItemByTitle('Pages', null, true);

	casper.click('.ws_menu.ws_active .ws_launch_access_editor');
});

casper.waitUntilVisible('#ws_menu_access_editor', function() {
	casper.test.assertSelectorHasText(
		'.ws_role_table_body .ws_cpt_selected_role', 'Author',
		'The current role is selected by default.'
	);

	//Enable the "Edit" option in the extended permissions panel.
	casper.click('#ws_cpt_action-edit_posts');

	//Save changes.
	casper.click('#ws_menu_access_editor #ws_save_access_settings');

	//By default, AME will also set grant_access[role:author] to true because the role
	//is checked in the "Edit permissions" pop-up. We don't want that; it would automatically
	//give the role the same capability and make the test pointless. Lets revert menu-specific
	//permissions.
	var resetMenuPermissionsButton = '.ws_menu.ws_active .ws_edit_field-access_level .ws_reset_button';
	if (casper.visible(resetMenuPermissionsButton)) {
		casper.test.comment('Reset item-specific permissions (grant_access).');
		casper.click(resetMenuPermissionsButton);
	}

	casper.click('#ws_save_menu');
});

ameTest.waitForSettingsSavedMessage();
ameTest.thenLogin('author', 'password');

casper.then(function() {
	casper.test.comment('Check menu visibility as "author"');
	casper.test.assert(ameTest.isLoggedIn('author'), 'Logged in as author');
	casper.test.assertExists('#menu-pages', 'The "Pages" menu is visible for a user who has the "Author" role');
});

casper.run(function() {
	this.test.done();
});