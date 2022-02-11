/* Test the ability to create custom menus and menu items. */
casper.start();
ameTest.thenQuickSetup(['check-compression']);

var fixedFrameHeight = 567;

casper.then(function() {
	ameTest.loadDefaultMenu();
});

casper.then(function() {
	casper.test.comment('Add a new menu after "Appearance", then click it.');

	casper.test.assertEval(function() {
		var menuEditor = jQuery('#ws_menu_editor');
		var appearance = menuEditor.find('.ws_item_title:contains("Appearance")').first().closest('.ws_container');
		appearance.click();
		return (appearance.length === 1) && appearance.hasClass('ws_active');
	}, 'Clicked on "Appearance"');

	casper.click('#ws_new_menu');
	casper.test.assertExists('#ws_menu_editor .ws_active.ws_custom', 'Clicking "New menu" creates a new custom menu');
	casper.test.assertSelectorHasText('#ws_menu_editor .ws_active .ws_item_title', 'Custom Menu 1', 'The new menu is named "Custom Menu 1" by default');

	//Rename to "New Menu" and set the URL.
	casper.evaluate(function() {
		var menuEditor = jQuery('#ws_menu_editor');
		var item = menuEditor.find('.ws_active').closest('.ws_container');

		item.find('.ws_edit_field-menu_title input.ws_field_value').val('New Menu').change();
		//Select "Custom" from the "Target page" drop-down.
		item.find('.ws_edit_field-template_id select.ws_field_value').val('').change();
		//Set menu URL.
		item.find('.ws_edit_field-file input.ws_field_value').val('index.php?new_custom_menu=me').change();
	});
	casper.click('#ws_save_menu');
});

ameTest.waitForSettingsSavedMessage(function() {
	casper.test.assertSelectorHasText(
		'#message,#setting-error-settings_updated',
		'Settings saved.',
		'Menu saved successfully'
	);
	var expectedUrl = ameTestConfig.adminUrl + '/index.php?new_custom_menu=me';
	casper.test.assertSelectorHasText(
		'#adminmenu a[href="' + expectedUrl + '"]',
		'New Menu',
		'The new menu exists and has the right URL and title'
	);

	//Attempt to click the menu.
	casper.click('#adminmenu a[href="' + expectedUrl + '"]');
});
casper.then(function() {
	casper.test.assertUrlMatch('index\.php\?new_custom_menu=me', 'Clicking the menu opens the right page');
	casper.test.assertSelectorHasText('#adminmenu .menu-top.current a.current', 'New Menu', 'The new menu gets marked as current');
	casper.test.assertEvalEquals(function() {
		return jQuery('.menu-top.current').prev().attr('id');
	}, 'menu-appearance', 'The new menu is immediately after "Appearance"');
});

//Test custom submenu creation, links to external URLs, and opening them in a new window or frame.
casper.then(function() {
	casper.test.comment('Add several submenu items to both built-in and plugin-created menus');
});
ameTest.activateHelper('dummy-menus');
ameTest.thenOpenMenuEditor();

casper.then(function() {
	ameTest.loadDefaultMenu();

	ameTest.selectItemByTitle('Dashboard');
	ameTest.addNewItem({
		'menu_title' : 'Dashboard Submenu',
		'template_id': '',
		'file'       : 'index.php?test-menu=dashboard-submenu'
	});

	ameTest.selectItemByTitle('Media');
	ameTest.addNewItem({
		'menu_title' : 'Media Submenu',
		'template_id': '',
		'file'       : 'http://example.com/',
		'open_in'    : 'new_window'
	});

	//Select a specific plugin submenu and add a new custom menu after it.
	ameTest.selectItemByTitle('Dummy Top Menu', 'Dummy Submenu #1');
	ameTest.addNewItem({
		'menu_title' : 'Plugin Submenu',
		'template_id': '',
		'file'       : 'http://example.com/?third', //Anyone got a better example URL?
		'open_in'    : 'iframe'
	});

	//Add another menu that opens in frame, but set the frame height manually this time.
	ameTest.selectItemByTitle('Media');
	ameTest.addNewItem({
		'menu_title' : 'Fixed Frame',
		'template_id': '',
		'file'       : 'http://example.com/?second',
		'open_in'    : 'iframe',
		'iframe_height' : fixedFrameHeight
	});

	casper.click('#ws_save_menu');
});

ameTest.waitForSettingsSavedMessage(function() {
	casper.test.assertSelectorHasText('#message,#setting-error-settings_updated', 'Settings saved.', 'Menu saved successfully');

	//Verify that all the menus we just added actually exist.
	casper.test.assertSelectorHasText(
		'#menu-dashboard .wp-submenu a[href$="index.php?test-menu=dashboard-submenu"]',
		'Dashboard Submenu',
		'Added a Dashboard submenu'
	);
	casper.test.assertSelectorHasText(
		'#menu-media .wp-submenu a[href="http://example.com/"]',
		'Media Submenu',
		'Added a Media submenu'
	);
	casper.test.assertSelectorHasText(
		'#toplevel_page_dummy-top-menu .wp-submenu a[href*="?page=framed-menu-item-"]',
		'Plugin Submenu',
		'Added a submenu to a plugin menu (open in = iframe)'
	);
	casper.test.assertSelectorHasText(
		'#menu-media .wp-submenu a[href*="?page=framed-menu-item-"]',
		'Fixed Frame',
		'Added another submenu to Media (open in = iframe, fixed height)'
	);

	casper.test.assertEval(function() {
		var item = jQuery('#menu-media').find('.wp-submenu a[href="http://example.com/"]');
		return item.attr('target') === '_blank';
	}, 'Media submenu is set to open in a new tab');

	//Verify that the item set to open in an frame works properly.
	casper.click('#toplevel_page_dummy-top-menu .wp-submenu a[href*="?page=framed-menu-item-"]');
});

casper.then(function() {
	casper.test.assertSelectorHasText(
		'#adminmenu .wp-submenu li.current a',
		'Plugin Submenu',
		'Clicking the custom plugin submenu marks the correct item as current'
	);
	casper.test.assertExists('#ws-framed-page', 'Setting a menu to open in an frame generates an IFrame');
	casper.test.assertEvalEquals(function() {
		return jQuery('#ws-framed-page').attr('src');
	}, 'http://example.com/?third', 'IFrame source matches the menu URL');

	//Verify that the second item that's set to open in an frame has the right height.
	casper.click('#menu-media .wp-submenu a[href*="?page=framed-menu-item-"]');
});

casper.then(function() {
	casper.test.assertEvalEquals(function() {
		return jQuery('#ws-framed-page').attr('src');
	}, 'http://example.com/?second', 'Fixed IFrame source matches the menu URL');

	casper.test.assertEvalEquals(function() {
		return jQuery('#ws-framed-page').height();
	}, fixedFrameHeight, 'The frame height matches the height that was entered by the user');
});

ameTest.deactivateAllHelpers();

casper.run(function() {
    this.test.done();
});