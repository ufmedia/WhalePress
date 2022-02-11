casper.start();
casper.test.comment("Regression test: Make sure menu items that have an empty slug show up in the editor.");

ameTest.thenQuickSetup(['dummy-menus']);

casper.then(function() {
	casper.test.assert(
		ameTest.selectItemByTitle('No Slug'),
		'The "No Slug" menu shows up in the editor and it can be selected'
	);

	casper.test.assert(
		ameTest.selectItemByTitle('No Slug', 'Submenu With Slug'),
		'The "No Slug -> Submenu With Slug" submenu item also shows up in the editor'
	);

	casper.test.assertSelectorHasText(
		'#toplevel_page_ .wp-menu-name',
		'No Slug',
		'The "No Slug" menu exists in the admin menu'
	);
});

casper.run(function() {
	this.test.done();
});