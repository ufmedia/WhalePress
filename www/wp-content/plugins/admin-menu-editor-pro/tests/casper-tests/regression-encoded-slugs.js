casper.start();
casper.test.comment("Regression test: Detect the current menu item when its URL contains %-encoded query parameters.");

ameTest.thenQuickSetup(['dummy-menus']);

casper.then(function() {
	casper.test.comment('Click "Settings -> Special Slug"');
	casper.click('#menu-settings .wp-submenu li a[href*="dummy/special-characters"]');
});

casper.then(function() {
	//Verify that this menu item satisfies test requirements.
	casper.test.assertEval(
		function() {
			var hasPercentEncodedQuery = /[?&].*?%[0-9A-F]{2}/i;
			return hasPercentEncodedQuery.test(location.href);
		},
		'The current URL contains at least one query parameter that uses %-encoding.'
	);
	//Did the plugin highlight the correct item?
	casper.test.assertExists(
		'#menu-settings .wp-submenu li a[href*="dummy/special-characters"].current',
		'The current menu item is highlighted'
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

casper.run(function() {
	this.test.done();
});