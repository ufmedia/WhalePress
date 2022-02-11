/* Test the ability to embed a page or post in an admin page. */
casper.start();
ameTest.thenQuickSetup();

casper.then(function() {
	casper.test.comment('Add a new menu that displays a content page embedded in the WP admin.');

	ameTest.selectItemByTitle('Dashboard');

	ameTest.addNewMenu({
		'menu_title' : 'Embedded Page',
		'template_id': '>special:embed_page'
	});
});

casper.then(function() {
	casper.test.assertVisible(
		'#ws_menu_box .ws_container.ws_active .ws_edit_field-embedded_page_id',
		'The "Embedded page ID" field is visible'
	);

	casper.test.comment('Click the dropdown button in the "embedded page" field.');
	casper.click('#ws_menu_box .ws_container.ws_active .ws_embedded_page_selector_trigger');

	casper.test.assertVisible(
		'#ws_embedded_page_selector',
		'The page selector shows up after clicking the button'
	);
});

casper.waitForSelector('#ws_current_site_pages option[value]', function() {
	casper.test.pass('At least one option shows up within 5 seconds');
	casper.test.assertExists(
		'#ws_current_site_pages option[value="custom"]',
		'The selector contains a "Custom" option'
	);
	casper.test.assertExists(
		'#ws_current_site_pages option:nth-child(2)',
		'There is at least one other option'
	);

	//Chose the "Sample Page" page that WordPress automatically creates on installation.
	var sampleOptionValue = casper.evaluate(function() {
		return jQuery('#ws_current_site_pages').find('option:contains("Sample Page")').val();
	});
	if (!sampleOptionValue) {
		casper.test.fail('The page list does not contain "Sample Page"!');
	}

	casper.test.comment('The option value for "Sample Page" is ' + sampleOptionValue + '. Choosing this option.');
	casper.evaluate(function() {
		jQuery('#ws_current_site_pages').val('1_2').change();
	});
}, 5000);

casper.waitWhileVisible('#ws_embedded_page_selector', function() {
	casper.test.pass('After choosing an option, the selector disappears');

	casper.test.comment('Save the menu');
	casper.click('#ws_save_menu');
}, null, 2000);

ameTest.waitForSettingsSavedMessage(function() {
	casper.test.assertSelectorHasText(
		'#adminmenu a[href*="?page=embedded-page-"]',
		'Embedded Page',
		'The new menu exists and has the right URL and title'
	);

	casper.click('#adminmenu a[href*="?page=embedded-page-"]');
});

casper.then(function() {
	casper.test.assertSelectorHasText(
		'.wrap h1',
		'Embedded Page',
		'Page heading is "Embedded Page"'
	);
	casper.test.assertSelectorHasText(
		'.wrap',
		'different from a blog post because it will stay in one place', //Random excerpt from the sample page.
		'Page body contains text from the "Sample Page" page'
	);
});

ameTest.thenOpenMenuEditor();

casper.then(function() {
	casper.test.comment('Change the page heading to something else.');

	ameTest.selectItemByTitle('Embedded Page', null, true);
	ameTest.setItemFields({
		'page_heading': 'My Custom Heading'
	});

	casper.click('#ws_save_menu');
});

ameTest.waitForSettingsSavedMessage(function() {
	casper.click('#adminmenu a[href*="?page=embedded-page-"]');
});

casper.then(function() {
	casper.test.assertSelectorHasText(
		'.wrap h1',
		'My Custom Heading',
		'Page heading is now "My Custom Heading"'
	);
});

ameTest.deactivateAllHelpers();
casper.run(function() {
	this.test.done();
});
