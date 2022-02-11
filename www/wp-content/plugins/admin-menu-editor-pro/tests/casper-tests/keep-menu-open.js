casper.start();
ameTest.thenQuickSetup();

//The viewport must be wide enough to prevent the admin menu from collapsing or switching to the mobile layout.
casper.viewport(1024, 768);

casper.then(function() {
	casper.test.comment('Turn on the "Keep this menu open" option for the "Posts" menu.');

	ameTest.loadDefaultMenu();
	ameTest.selectItemByTitle('Posts', null, true);
	casper.click('.ws_menu.ws_active .ws_toggle_advanced_fields');
	casper.click('.ws_menu.ws_active .ws_edit_field-is_always_open input.ws_field_value');
});

ameTest.thenSaveMenu(function() {
	function isMenuOpen(selector) {
		//WordPress "hides" inactive submenus by giving them a huge negative offset ("top: -1000em;") which moves them
		//outside the viewport. We can use the current offset as a simple heuristic to determine if a submenu is visible.
		var submenuItems = jQuery(selector).find('.wp-submenu li a');
		return submenuItems.is(':visible') && (submenuItems.offset().top > 0);
	}

	casper.test.assertEval(isMenuOpen, 'The "Posts" menu is open', '#menu-posts');
	casper.test.assertEval(isMenuOpen, 'The current menu ("Settings") is also open', '#menu-settings');

	casper.test.assertEvalEquals(
		isMenuOpen,
		false,
		'All other menus are closed',
		'#adminmenu li.menu-top:not("#menu-settings, #menu-posts")'
	);
});

casper.run(function() {
	this.test.done();
});
