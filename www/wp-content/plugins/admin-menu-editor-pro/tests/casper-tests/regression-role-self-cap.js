casper.start();
casper.test.comment("Menu items that require a specific role should be marked as visible to that role.");

ameTest.thenQuickSetup(['dummy-menus']);

casper.then(function() {
	ameTest.selectActor('role:administrator');
	casper.test.assert(
		ameTest.isItemChecked('Dummy Top Menu', 'Administrator Required'),
		'The item with the required capability "administrator" is checked for the "Administrator" role.'
	);
	ameTest.selectActor('role:contributor');
	casper.test.assert(
		!ameTest.isItemChecked('Dummy Top Menu', 'Administrator Required'),
		'The item with the required capability "administrator" is not checked for the "Contributor" role.'
	);
});

casper.run(function() {
	this.test.done();
});