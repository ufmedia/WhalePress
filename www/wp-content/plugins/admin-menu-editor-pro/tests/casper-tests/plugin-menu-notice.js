/*
 Test the admin notice that explains how to access the menu editor page.
 */
casper.start();
casper.test.comment('Make sure the "go here to access the plugin" notice message shows up as expected');

ameTest.deactivateAllHelpers();
ameTest.resetPluginConfiguration();
ameTest.thenLoginAsAdmin();

casper.thenOpen(ameTestConfig.adminUrl + '/index.php', function() {
	casper.test.assertExists(
		'#ame-plugin-menu-notice',
		'The notice shows up after a fresh installation'
	);
});

ameTest.thenOpenMenuEditor();
casper.then(function() {
	casper.test.assertDoesntExist(
		'#ame-plugin-menu-notice',
		'The notice doesn\'t show up on the menu editor page'
	);
});

casper.thenOpen(ameTestConfig.adminUrl + '/index.php', function() {
	casper.test.assertDoesntExist(
		'#ame-plugin-menu-notice',
		'Visiting the menu editor page automatically disables the notice'
	);
});

ameTest.resetPluginConfiguration(); //Re-enable the notice.
casper.thenOpen(ameTestConfig.adminUrl + '/index.php', function() {
	casper.test.assertExists(
		'#ame-hide-plugin-menu-notice',
		'The notice has a "hide" link'
	);
	casper.click('#ame-hide-plugin-menu-notice');
});

casper.then(function() {
	casper.test.assertDoesntExist(
		'#ame-plugin-menu-notice',
		'Clicking the "hide" link disables the notice'
	);
});

casper.thenOpen(ameTestConfig.adminUrl + '/index.php', function() {
	casper.test.assertDoesntExist(
		'#ame-plugin-menu-notice',
		'The notice stays hidden (i.e. settings are preserved across page loads)'
	);
});

casper.run(function() {
	this.test.done();
});