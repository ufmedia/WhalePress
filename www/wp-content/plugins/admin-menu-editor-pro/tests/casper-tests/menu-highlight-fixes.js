/*
 * Test for regressions in the "highlight current menu" algorithm.
 */

casper.start();
casper.test.comment('Test the menu highlight fix');

ameTest.thenQuickSetup();

casper.then(function() {
	casper.test.comment('Move "Settings -> General" to "Appearance"');

	ameTest.loadDefaultMenu();
	ameTest.selectItemByTitle('Settings', 'General');
	casper.click('#ws_cut_item');
	ameTest.selectItemByTitle('Appearance');
	casper.click('#ws_paste_item');

	casper.test.comment('Add a custom "Active Plugins" item to "Plugins" and make it the first link');
	ameTest.selectItemByTitle('Plugins');
	ameTest.addNewItem({
		'menu_title' : 'Active Plugins',
		'template_id': '',
		'file'       : 'plugins.php?plugin_status=active'
	});

	//The plugin doesn't have an API for moving items, so we use this cut & paste hack.
	var originalFirstItem = 'Installed Plugins';
	casper.click('#ws_cut_item');
	ameTest.selectItemByTitle('Plugins', originalFirstItem);
	casper.click('#ws_paste_item'); //"Active Plugins" is now the second item.
	ameTest.selectItemByTitle('Plugins', originalFirstItem);
	casper.click('#ws_cut_item'); //Cut the first item.
	ameTest.selectItemByTitle('Plugins', 'Active Plugins');
	casper.click('#ws_paste_item'); //Paste the original first item after "Active Plugins".

	casper.click('#ws_save_menu');
});

ameTest.waitForSettingsSavedMessage();

casper.wait(500, function() {
	casper.test.assertDoesntExist(
		'#menu-settings .wp-submenu li a[href="options-general.php"]',
		'The "General" item is no longer in the "Settings" menu'
	);
	casper.test.assertExists(
		'#menu-appearance .wp-submenu li a[href="options-general.php"]',
		'The "General" item now shows up under "Appearance"'
	);
	casper.test.assertExists(
		'#menu-settings.wp-has-current-submenu.wp-menu-open',
		'"Settings" is still highlighted as the current menu'
	);
	casper.test.assertExists(
		'#menu-settings .wp-submenu li a[href="options-general.php?page=menu_editor"].current',
		'"Settings -> Menu Editor Pro" is still highlighted as the current menu item'
	);
	casper.test.assertEvalEquals(
		ameTest.getHighlightedMenuCount, 1,
		'There is only one highlighted top level menu'
	);
	casper.test.assertEvalEquals(
		ameTest.getHighlightedItemCount, 1,
		'There is only one highlighted submenu item'
	);

	casper.test.comment('Go to "Appearance -> General"');
});

casper.thenOpen(ameTestConfig.adminUrl + '/options-general.php');

casper.wait(500, function() {
	casper.test.assertExists(
		'#menu-appearance.wp-has-current-submenu.wp-menu-open',
		'"Appearance" is highlighted as the current menu'
	);
	casper.test.assertExists(
		'#menu-appearance .wp-submenu li a[href="options-general.php"].current',
		'"Appearance -> General" is highlighted as the current menu item'
	);
	casper.test.assertEvalEquals(
		ameTest.getHighlightedMenuCount, 1,
		'There is only one highlighted top level menu'
	);
	casper.test.assertEvalEquals(
		ameTest.getHighlightedItemCount, 1,
		'There is only one highlighted submenu item'
	);
});

casper.thenOpen(ameTestConfig.adminUrl + '/plugins.php?plugin_status=active');

casper.wait(500, function() {
	casper.test.comment(
		"Regression test: Verify that an item with a custom URL is highlighted even when it's the first item."
	);

	casper.test.assertExists(
		'#menu-plugins.wp-has-current-submenu.wp-menu-open',
		'"Plugins" is highlighted as the current menu'
	);
	casper.test.assertSelectorHasText(
		'#menu-plugins .wp-submenu li.wp-submenu-head + li',
		'Active Plugins',
		'"Active Plugins" is the first item in the "Plugins" menu'
	);
	casper.test.assertExists(
		'#menu-plugins .wp-submenu li a[href="plugins.php?plugin_status=active"].current',
		'"Plugins -> Active Plugins" is highlighted as the current menu item'
	);
	casper.test.assertExists(
		'#menu-plugins .wp-submenu li a[href="plugins.php"]',
		'"Plugins -> Installed Plugins" still exists'
	);
});

casper.run(function() {
	this.test.done();
});