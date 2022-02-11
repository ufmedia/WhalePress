casper.start();
casper.test.comment("Check URL generation for plugin submenus where the parent doesn't have a hook");

ameTest.thenQuickSetup(['dummy-menus', 'check-compression']);

casper.then(function() {
	casper.test.comment('Moving "NH Submenu #1" from "No Hook" to "Settings"');

	ameTest.selectItemByTitle('No Hook', 'NH Submenu #1');
	casper.click('#ws_cut_item');
	ameTest.selectItemByTitle('Settings');
	casper.click('#ws_paste_item');

	casper.click('#ws_save_menu');
});

ameTest.waitForSettingsSavedMessage(function() {
	casper.test.assertSelectorHasText(
		'#menu-settings .wp-submenu li:last-child a',
		'NH Submenu #1',
		'The moved item shows up under the "Settings" menu'
	);
	casper.click('#menu-settings .wp-submenu li:last-child a');
});

casper.then(function() {
	casper.test.assertUrlMatch(
		/wp-admin\/admin\.php\?.*?page=dummy-nh-submenu-1/,
		'The "Settings -> NH Submenu #1" item points to the correct URL'
	);
	casper.test.assertSelectorExists(
		'#nh-submenu-1-content',
		'Clicking the item opens the correct admin page'
	);
});

casper.run(function() {
	this.test.done();
});