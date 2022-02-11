/**
 * Test the unified export and import feature.
 */

casper.start();
casper.test.comment('Test unified export and import');

ameTest.thenQuickSetup();

//Make some changes in different tabs to verify that different types of settings are exported correctly.

//Admin menu
casper.then(function () {
	casper.test.comment('Generating test data...');
	casper.test.comment(' - Admin menu');

	//Add a custom top-level item and a submenu item.
	ameTest.selectItemByTitle('Pages');
	casper.click('#ws_new_menu');
	ameTest.selectItemByTitle('Settings', 'Reading');
	casper.click('#ws_new_item');

	//Change menu properties.
	ameTest.selectItemByTitle('Tools');
	ameTest.setItemFields({
		'menu_title': 'Modified menu title',
		'page_title': 'Modified page title',
		'css_class': 'menu-top menu-icon-tools ame-test-custom-class',
		'icon_url': 'dashicons-info',
		'page_heading': 'Modified page heading'
	});

	casper.click('#ws_save_menu');
});
ameTest.waitForSettingsSavedMessage();

//Meta boxes
casper.thenOpen(ameTestConfig.adminUrl + '/options-general.php?page=menu_editor&sub_section=metaboxes', function () {
	casper.test.comment(' - Meta boxes');
});
casper.waitUntilVisible('#ame-mb-screen-list', function () {
	//No changes for now.
	casper.click('.ame-mb-save-form #submit');
}, null, 25000);
ameTest.waitForSettingsSavedMessage();

//Dashboard widgets
casper.thenOpen(ameTestConfig.adminUrl + '/options-general.php?page=menu_editor&sub_section=dashboard-widgets', function () {
	casper.test.comment(' - Dashboard widgets');
});
casper.waitUntilVisible('#ame-dashboard-widgets', function () {
	//Add a custom widget.
	casper.click('#ame-add-html-widget');
	//Save changes.
	casper.click('#ame-major-widget-actions #submit');
});
ameTest.waitForSettingsSavedMessage();

//Branding
casper.thenOpen(ameTestConfig.adminUrl + '/options-general.php?page=menu_editor&sub_section=branding', function () {
	casper.test.comment(' - Branding');
	casper.fillSelectors('.wrap form', {'#ame-custom_toolbar_logo_link': 'https://example.com/?custom'}, false);

	//Save changes.
	casper.click('.wrap #submit');
});
ameTest.waitForSettingsSavedMessage();

//Login
casper.thenOpen(ameTestConfig.adminUrl + '/options-general.php?page=menu_editor&sub_section=login-page', function () {
	casper.test.comment(' - Login');
	casper.fillSelectors(
		'#ame-login-page-settings',
		{'#ame-logo-link-url': 'https://example.com/?logo-link-url'},
		false
	);

	//Save changes.
	casper.click('.wrap #submit');
});
ameTest.waitForSettingsSavedMessage();

//Colors
casper.thenOpen(ameTestConfig.adminUrl + '/options-general.php?page=menu_editor&sub_section=colors', function () {
	casper.test.comment(' - Colors');

	casper.click('.ame-form-box-field .wp-color-result');
	//Save changes.
	casper.click('.wrap #submit');
});
ameTest.waitForSettingsSavedMessage();

var exportFileName;
casper.thenOpen(ameTestConfig.adminUrl + '/options-general.php?page=menu_editor&sub_section=export', function () {
	//Export.
	casper.test.comment('Exporting everything to a file...');

	var fs = require('fs');
	exportFileName = fs.workingDirectory + '/export.json';

	var formInfo = casper.evaluate(function () {
		var $form = jQuery('.wrap form').first();
		return {data: $form.serialize(), url: $form.attr('action')};
	});

	casper.download(formInfo.url, exportFileName, 'POST', formInfo.data);

	casper.test.assert(
		fs.exists(exportFileName),
		'Export file successfully downloaded'
	);

	var downloadedSize = fs.size(exportFileName);
	casper.test.assert(
		downloadedSize >= 1024 * 4,
		'Export file is large enough (' + downloadedSize + ' bytes)'
	);

	//Validate JSON.
	var content = fs.read(exportFileName);
	try {
		var json = JSON.parse(content);
	} catch (ex) {
		casper.test.fail('Export file is not valid JSON. Exception: "' + ex.message + '"')
	}
	//All export files have a certain format.
	casper.test.assertEquals(
		_.get(json, 'format.name'),
		'Admin Menu Editor configuration container',
		'Export file has the correct format header.'
	)
});

ameTest.resetPluginConfiguration();

casper.thenOpen(ameTestConfig.adminUrl + '/options-general.php?page=menu_editor&sub_section=import', function () {
	casper.test.comment('Importing settings...');

	casper.test.assertEval(
		function () {
			return jQuery('.ame-unified-import-form #submit').prop('disabled');
		},
		'The "Next" button is disabled when no file is selected'
	);

	casper.fill('.ame-unified-import-form', {'imported-data': exportFileName});
	casper.test.assertEval(
		function () {
			return !jQuery('.ame-unified-import-form #submit').prop('disabled');
		},
		'The "Next" button becomes enabled when the user selects a file'
	);

	casper.click('.ame-unified-import-form #submit');
});

casper.waitUntilVisible('#ame-import-step-2', function() {
	casper.test.assertExists(
		'#ame-import-step-2 .ame-importable-module',
		'At least one importable module is visible'
	);

	casper.click('.ame-unified-import-form #submit');
});

casper.waitForSelector('#ame-import-step-3-start', function() {
	casper.test.assertDoesntExist('#wpbody-content .notice-error', 'No errors appear after importing a file');
	casper.test.assertExists('#ame-import-step-3-done', 'Import completion message shows up');
});

//The next step would be to verify that the imported configuration matches what was exported,
//but that's complicated and we're not going to do that at this time.

casper.then(function () {
	//Finally, get rid of the export file.
	var fs = require('fs');
	fs.remove(exportFileName);
});

casper.run(function () {
	this.test.done();
});

