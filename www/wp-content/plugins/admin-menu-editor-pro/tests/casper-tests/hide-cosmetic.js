/**
 * Test the "Show/hide" button. It hides menu items without changing their permissions. In other words, it's cosmetic.
 */

casper.start();
ameTest.thenQuickSetup();

casper.then(function() {
	casper.test.comment('Test the cosmetic hiding feature.');

	casper.test.comment('Hide "Posts" from all roles');
	ameTest.selectItemByTitle('Posts');
	casper.click('#ws_hide_menu');

	casper.test.assertVisible(
		'.ws_menu.ws_active .ws_item_head .ws_hidden_flag',
		'"All" has the "hidden" flag for "Posts"'
	);
	ameTest.selectItemByTitle('Posts', 'Add New');
	casper.test.assertVisible(
		'.ws_item.ws_active .ws_item_head .ws_hidden_flag',
		'"All" has the "hidden" flag for "Posts -> Add New"'
	);

	ameTest.selectRoleActor('editor');
	casper.test.assertVisible(
		'.ws_menu.ws_active .ws_item_head .ws_hidden_flag',
		'"Editor" has the "hidden" flag for "Posts"'
	);
	ameTest.selectAdminUserActor();
	casper.test.assertVisible(
		'.ws_menu.ws_active .ws_item_head .ws_hidden_flag',
		'"Current user" has the "hidden" flag for "Posts"'
	);

	casper.test.comment('Hide "Pages" from Administrator');
	ameTest.selectItemByTitle('Pages');
	ameTest.selectRoleActor('administrator');
	casper.click('#ws_hide_menu');

	casper.test.assertVisible(
		'.ws_menu.ws_active .ws_item_head .ws_hidden_flag',
		'"Administrator" has the "hidden" flag for "Pages"'
	);
	ameTest.selectNoActor();
	casper.test.assertNotExists(
		'.ws_menu.ws_active .ws_item_head .ws_hidden_flag',
		'"All" doesn\'t have the "hidden" flag for "Pages"'
	);
	ameTest.selectRoleActor('editor');
	casper.test.assertNotExists(
		'.ws_menu.ws_active .ws_item_head .ws_hidden_flag',
		'"Editor" doesn\'t have the "hidden" flag for "Pages"'
	);
	ameTest.selectAdminUserActor();
	casper.test.assertVisible(
		'.ws_menu.ws_active .ws_item_head .ws_hidden_flag',
		'"Current user" has the "hidden" flag for "Pages"'
	);

	casper.test.comment('Hide "Comments" from Current user');
	ameTest.selectItemByTitle('Comments');
	ameTest.selectAdminUserActor();
	casper.click('#ws_hide_menu');

	ameTest.selectNoActor();
	casper.test.assertNotExists(
		'.ws_menu.ws_active .ws_item_head .ws_hidden_flag',
		'"All" doesn\'t have the "hidden" flag for "Comments"'
	);
	ameTest.selectRoleActor('administrator');
	casper.test.assertNotExists(
		'.ws_menu.ws_active .ws_item_head .ws_hidden_flag',
		'"Administrator" doesn\'t have the "hidden" flag for "Comments"'
	);
	ameTest.selectAdminUserActor();
	casper.test.assertVisible(
		'.ws_menu.ws_active .ws_item_head .ws_hidden_flag',
		'"Current user" has the "hidden" flag for "Comments"'
	);

	casper.test.comment('Hide "Tools" from all roles, then unhide it from Editor');
	ameTest.selectNoActor();
	ameTest.selectItemByTitle('Tools');
	casper.click('#ws_hide_menu');

	ameTest.selectRoleActor('editor');
	casper.click('#ws_hide_menu');
	casper.test.assertNotExists(
		'.ws_menu.ws_active .ws_item_head .ws_hidden_flag',
		'"Editor" doesn\'t have the "hidden" flag for "Tools"'
	);
	ameTest.selectRoleActor('administrator');
	casper.test.assertVisible(
		'.ws_menu.ws_active .ws_item_head .ws_hidden_flag',
		'"Administrator" still has the "hidden" flag for "Tools"'
	);
	ameTest.selectAdminUserActor();
	casper.test.assertVisible(
		'.ws_menu.ws_active .ws_item_head .ws_hidden_flag',
		'"Current user" still has the "hidden" flag for "Tools"'
	);

	casper.click('#ws_save_menu');
});

ameTest.waitForSettingsSavedMessage(function() {
	casper.test.comment('Check menu visibility as "' + ameTestConfig.adminUsername + '"');
	casper.test.assertNotExists('#menu-posts', 'The "Posts" menu is hidden');
	casper.test.assertNotExists('#menu-pages', 'The "Pages" menu is hidden');
	casper.test.assertNotExists('#menu-comments', 'The "Comments" menu is hidden');
});

ameTest.thenLogin('second_admin', ameTestConfig.adminPassword);
casper.then(function() {
	casper.test.comment('Check menu visibility as "second_admin"');
	casper.test.assert(ameTest.isLoggedIn('second_admin'), 'Logged in as second_admin');
	casper.test.assertNotExists('#menu-posts', 'The "Posts" menu is hidden from the second admin');
	casper.test.assertNotExists('#menu-pages', 'The "Pages" menu is hidden from the second admin');
	casper.test.assertExists('#menu-comments', 'The "Comments" menu is visible to the second admin');
});

ameTest.thenLogin('editor', ameTestConfig.adminPassword);
casper.then(function() {
	casper.test.comment('Check menu visibility as "editor"');
	casper.test.assert(ameTest.isLoggedIn('editor'), 'Logged in as editor');
	casper.test.assertNotExists('#menu-posts', 'The "Posts" menu is hidden from the editor');
	casper.test.assertExists('#menu-pages', 'The "Pages" menu is visible to the editor');
	casper.test.assertExists('#menu-comments', 'The "Comments" menu is visible to the editor');
});

casper.run(function() {
	this.test.done();
});