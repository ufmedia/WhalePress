casper.start();

ameTest.thenQuickSetup(['dummy-menus']);
ameTest.thenOpenMenuEditor();

casper.then(function() {
	casper.test.comment('Change the background color of a menu item that uses special characters in the URL and ID.');
	ameTest.loadDefaultMenu();

	ameTest.selectItemByTitle('Strange ID', null, true);
	casper.click('.ws_menu.ws_active .ws_toggle_advanced_fields');
	casper.click('.ws_menu.ws_active .ws_open_color_editor');
});

casper.waitUntilVisible(
	'#ws-ame-menu-color-settings',
	function() {
		//Set the background to blue.
		casper.fill(
			'#ws-ame-menu-color-settings',
			{ 'base-color': '#223ccc' },
			false
		);
		casper.click('#ws-ame-save-menu-colors');
	},
	function() {
		casper.test.fail("Clicking the \"Edit...\" button didn't open the color dialog");
	}
);

casper.waitWhileVisible('#ws-ame-menu-color-settings', function() {
	casper.test.comment('Saving changes...');
	casper.click('#ws_save_menu');
});

ameTest.waitForSettingsSavedMessage(function() {
	//Verify that the background color was changed.
	casper.test.assertEvalEquals(
		function() {
			return jQuery('li.menu-top[id*="dummy-strange-id"]', '#adminmenu').css('background-color');
		},
		'rgb(34, 60, 204)', //jQuery returns the computed color as rgb().
		'The background color was changed successfully'
	);
});

casper.run(function() {
	this.test.done();
});