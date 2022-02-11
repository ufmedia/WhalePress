/*
Test the ability to set change the page title of admin pages. WordPress uses the page title
as the first part of the <title> element (i.e. the window title) in the admin panel.
*/
casper.start();
casper.test.comment('Change the window title of some admin pages.');

ameTest.thenQuickSetup(['dummy-menus']);

casper.then(function() {
	ameTest.loadDefaultMenu();

	//Try it with one of the default submenus. Older versions of AME had a bug where
	//the custom page title would be ignored for built-in WP menus.
	ameTest.selectItemByTitle('Posts', 'Add New', true);
	casper.click('.ws_item.ws_active .ws_toggle_advanced_fields');
	ameTest.setItemFields({
		'page_title': 'My Custom Title'
	}, 'submenu');

	//Try changing the title of a plugin-created menu.
	ameTest.selectItemByTitle('Dummy Top Menu', 'Dummy Top Menu', true);
	casper.click('.ws_item.ws_active .ws_toggle_advanced_fields');
	ameTest.setItemFields({
		'page_title': 'Another Custom Title'
	}, 'submenu');

	//...and a top-level menu with no submenus.
	ameTest.selectItemByTitle('The Dummy', null, true);
	casper.click('.ws_menu.ws_active .ws_toggle_advanced_fields');
	ameTest.setItemFields({
		'page_title': 'Title #42'
	}, 'menu');

	casper.click('#ws_save_menu');
});

//Wait for the "settings saved" message.
ameTest.waitForSettingsSavedMessage();

casper.thenOpen(ameTestConfig.adminUrl + '/post-new.php', function() {
	casper.test.assertTitleMatch(
		/^My\sCustom\sTitle/,
		'Changed the window title of the "Add New Post" page to "My Custom Title"'
	);
});
casper.thenOpen(ameTestConfig.adminUrl + '/admin.php?page=dummy-top-menu', function() {
	casper.test.assertTitleMatch(
		/^Another\sCustom\sTitle/,
		'Changed the window title of a plugin-created submenu page'
	);
});
casper.thenOpen(ameTestConfig.adminUrl + '/admin.php?page=dummy-menu-with-no-items', function() {
	casper.test.assertTitleMatch(
		/^Title #42/,
		'Changed the window title of a plugin-created top level menu that has no submenus'
	);
});

casper.run(function() {
    this.test.done();
});