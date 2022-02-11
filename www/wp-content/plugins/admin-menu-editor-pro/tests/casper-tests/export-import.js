/**
 * Test menu export and import.
 */

casper.start();
casper.test.comment('Test menu export and import');

ameTest.thenQuickSetup();

//Make a bunch of changes to verify that different types of settings are exported correctly.
casper.then(function() {
	casper.test.comment('Generating some test data...');

	//Add a custom top-level item and a submenu item.
	ameTest.selectItemByTitle('Posts');
	casper.click('#ws_new_menu');
	ameTest.selectItemByTitle('Settings', 'Writing');
	casper.click('#ws_new_item');

	//Move a menu item to a different parent menu.
	ameTest.selectItemByTitle('Settings', 'General');
	casper.click('#ws_cut_item');
	ameTest.selectItemByTitle('Appearance');
	casper.click('#ws_paste_item');

	//Change menu properties.
	ameTest.selectItemByTitle('Tools');
	ameTest.setItemFields({
		'menu_title' : 'Modified menu title',
		'page_title' : 'Modified page title',
		'css_class' : 'menu-top menu-icon-tools ame-test-custom-class',
		'icon_url' : 'dashicons-info',
		'page_heading' : 'Modified page heading'
	});

	//Move a top level menu to a different position (on the same level).
	ameTest.selectItemByTitle('Users');
	casper.click('#ws_cut_menu');
	ameTest.selectItemByTitle('Dashboard');
	casper.click('#ws_paste_menu');

	//Move a submenu item (within the same submenu).
	ameTest.selectItemByTitle('Settings', 'Permalinks');
	casper.click('#ws_cut_item');
	ameTest.selectItemByTitle('Settings', 'Writing');
	casper.click('#ws_paste_item');

	//Hide a menu.
	casper.click('#ws_actor_selector a[href="#role:administrator"]');
	ameTest.selectItemByTitle('Posts');
	//Click the permissions checkbox, clearing it.
	casper.click('#ws_menu_box .ws_menu.ws_active .ws_actor_access_checkbox');
});

var originalMenuState = null, exportFileName;
casper.then(function() {
	//Save the base state so we can compare to it later.
	originalMenuState = JSON.parse(casper.evaluate(function() {
		return JSON.stringify(AmeEditorApi.readMenuTreeState());
	}));

	//Export.
	casper.test.comment('Exporting it to a file...');
	casper.click('#ws_export_menu');
});

casper.waitUntilVisible('#download_menu_button', function() {
	//Download the export file.
	var exportUrl = casper.evaluate(function() {
		return jQuery('#download_menu_button').prop('href');
	});
	var expectedSize = casper.evaluate(function() {
		return jQuery('#download_menu_button').data('filesize');
	});

	var fs = require('fs');
	exportFileName = fs.workingDirectory + '/menu-export.json';
	casper.download(exportUrl, exportFileName);

	casper.test.assert(
		fs.exists(exportFileName),
		'Export file successfully downloaded'
	);

	var downloadedSize = fs.size(exportFileName);
	casper.test.assertEquals(
		downloadedSize,
		expectedSize,
		'Actual file size matches the expected size (' + expectedSize + ' bytes)'
	);

	//Close the export pop-up.
	casper.click('#ws_cancel_export');
});

casper.waitWhileVisible('#export_dialog', function() {
	casper.test.comment('Now reset the menu and import the test data');

	//Reset the menu to default.
	ameTest.loadDefaultMenu();

	//Now import the file we just downloaded.
	casper.click('#ws_import_menu');
});

casper.waitUntilVisible('#import_dialog', function() {
	casper.fill('#import_menu_form', { 'menu' : exportFileName });

	casper.test.assertEval(
		function() {
			return !jQuery('#ws_start_import').prop('disabled');
		},
		'The "Upload File" button is enabled after selecting a file'
	);

	casper.click('#ws_start_import');
});

//A "import complete" notice should show up after import.
casper.waitUntilVisible('#import_complete_notice', function() {
	casper.test.pass('The "import complete" notice shows up');
});

//The notice should automatically disappear after a few seconds.
casper.waitWhileVisible('#import_complete_notice', function() {

	var importedMenuState = JSON.parse(casper.evaluate(function() {
		return JSON.stringify(AmeEditorApi.readMenuTreeState())
	}));

	//Special case: The URL of the menu items that link to customize.php changes depending on the current URL.
	//Since the import process re-merges the menu, this particular item will get a different URL after import.
	//Lets ignore this particular discrepancy.
	var states = [originalMenuState, importedMenuState];
	_.forEach(states, function(state) {
		function removeReturnArg(url) {
			if (url.match(/^customize\.php/)) {
				url = url.replace(/([&?])return=[^&#]*?([&#]|$)/, '$1$2')
			}
			return url;
		}

		function fixCustomizeMenus(item) {
			if (item.defaults) {
				if (item.defaults.file) {
					item.defaults.file = removeReturnArg(item.defaults.file);
				}
				if (item.defaults.url) {
					item.defaults.url = removeReturnArg(item.defaults.url);
				}
			}

			if (item.items) {
				//Caution: Modifying item properties in deeply nested object nodes seems to be buggy.
				//Sometimes a copy is created for no apparent reason and the original object is left unchanged.
				//That's why we use map() here and explicitly reassign .items.
				item.items = _.map(item.items, fixCustomizeMenus);
			}

			return item;
		}
		_.forEach(state.tree, fixCustomizeMenus);
	});

	casper.test.assert(
		_.isEqual(originalMenuState, importedMenuState),
		'Import restores the menu state that was exported'
	);
});

casper.then(function() {
	//Finally, get rid of the export file.
	var fs = require('fs');
	fs.remove(exportFileName);
});

casper.run(function() {
	this.test.done();
});

