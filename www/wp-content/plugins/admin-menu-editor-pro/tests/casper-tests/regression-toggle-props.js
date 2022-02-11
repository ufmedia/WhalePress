casper.start();
casper.test.comment("Regression test: Simply opening and closing menu properties shouldn't change any settings.");

ameTest.thenQuickSetup();

casper.then(function() {
	var initialItemState, newItemState;

	casper.test.comment('Close and reopen the "Dashboard" item');

	ameTest.selectItemByTitle('Dashboard');

	initialItemState = casper.evaluate(getMenuData, '.ws_menu.ws_active');
	casper.click('#ws_menu_editor .ws_menu.ws_active .ws_edit_link');
	casper.click('#ws_menu_editor .ws_menu.ws_active .ws_edit_link');
	newItemState = casper.evaluate(getMenuData, '.ws_menu.ws_active');

	casper.test.assert(
		_.isEqual(initialItemState, newItemState),
		"Closing and re-opening the menu properties for the \"Dashboard\" item doesn't change its settings"
	);

	casper.test.comment('Create a new custom menu, then close and reopen its properties');
	ameTest.addNewMenu();

	function getMenuData(selector) {
		return jQuery('#ws_menu_editor').find(selector).first().data('menu_item');
	}

	initialItemState = casper.evaluate(getMenuData, '.ws_menu.ws_active');
	casper.click('#ws_menu_editor .ws_menu.ws_active .ws_edit_link');
	casper.click('#ws_menu_editor .ws_menu.ws_active .ws_edit_link');
	newItemState = casper.evaluate(getMenuData, '.ws_menu.ws_active');

	casper.test.assert(
		_.isEqual(initialItemState, newItemState),
		"Closing and re-opening the properties of a custom menu item doesn't change its settings"
	);
});

casper.run(function() {
	this.test.done();
});