casper.start();
casper.test.comment(
	"Regression test: When generating menu URLs, treat parent menus that link to core files " +
	"with query parameters (e.g. \"Pages\") as valid base URLs."
);

ameTest.thenQuickSetup(['dummy-menus']);

var expectedItemUrl = null;
var getPagesSubmenuUrl = function() {
	return jQuery('a:contains("Pages Submenu")', '#adminmenu').attr('href');
};

casper.then(function() {
	//Store the original URL for later.
	expectedItemUrl = casper.evaluate(getPagesSubmenuUrl);
	casper.test.assertTruthy(expectedItemUrl, 'Found the "Pages Submenu" item');

	casper.test.comment('Move "Pages -> Pages Submenu" to the top level');
	ameTest.selectItemByTitle('Pages', 'Pages Submenu');
	casper.click('#ws_cut_item');
	casper.click('#ws_paste_menu');
	casper.click('#ws_save_menu');
});

//Wait for the "settings saved" message and verify the moved item has the right URL.
ameTest.waitForSettingsSavedMessage(function() {
	casper.test.assertEvalEquals(
		getPagesSubmenuUrl,
		expectedItemUrl,
		'Moving an item does not change its URL'
	);
});

casper.run(function() {
	this.test.done();
});