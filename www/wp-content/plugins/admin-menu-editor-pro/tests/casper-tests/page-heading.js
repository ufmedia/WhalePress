/*
 Test the ability to change the page heading. The heading is the <h1> element at the top of most admin pages.
 For plugins it often matches the menu title, but WordPress admin pages sometimes have different headings.

 Some pages have an "Add New" button, a search box or other UI element(s) in the heading. We need to make sure
 not to accidentally overwrite/destroy those elements.
 */
casper.start();
casper.test.comment('Change the page heading of some admin pages.');

ameTest.thenQuickSetup();

casper.then(function() {
	ameTest.loadDefaultMenu();

	//Try it with one of the default submenus that has an "Add New" button.
	ameTest.selectItemByTitle('Plugins', 'Installed Plugins', true);
	casper.click('.ws_item.ws_active .ws_toggle_advanced_fields');
	ameTest.setItemFields({
		'page_heading': 'My Custom Heading'
	}, 'submenu');

	//...and a normal submenu with no UI elements in the heading.
	ameTest.selectItemByTitle('Appearance', 'Widgets', true);
	casper.click('.ws_item.ws_active .ws_toggle_advanced_fields');
	ameTest.setItemFields({
		'page_heading': 'Another Heading'
	}, 'submenu');

	casper.click('#ws_save_menu');
});

//Wait for the "settings saved" message.
ameTest.waitForSettingsSavedMessage();

casper.thenOpen(ameTestConfig.adminUrl + '/plugins.php');

//Wait a little bit for the heading replacement script to run.
casper.wait(500, function() {
	casper.test.assertSelectorHasText(
		'.wrap > h1:first-child', //In WP 4.2 and below it was H2. WP 4.3 changed it to H1.
		'My Custom Heading',
		'The "Plugins" heading was changed to "My Custom Heading"'
	);

	//In WP 4.2 and below the button class was add-new-h2.
	//Before WP 4.8, the button was inside the heading. Now it's after the H1.
	casper.test.assertExists(
		'.wrap > h1 + .page-title-action',
		'The "Add New" button still exists'
	);
});

casper.thenOpen(ameTestConfig.adminUrl + '/widgets.php');

casper.wait(500, function() {
	casper.test.assertSelectorHasText(
		'.wrap > h1:first-child',
		'Another Heading',
		'The "Widgets" heading was changed to "Another Heading"'
	);
});


casper.run(function() {
	this.test.done();
});