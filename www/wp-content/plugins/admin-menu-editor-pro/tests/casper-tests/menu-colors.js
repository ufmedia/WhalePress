casper.start();

ameTest.thenQuickSetup(['config-manipulator']);

//Turn off the highlight-new-menus module for this test. The highlights override menu color settings.
ameTest.toggleModule('highlight-new-menus', false);
ameTest.thenOpenMenuEditor();

casper.then(function() {
	casper.test.comment('Change the background color of the "Posts" menu.');
	ameTest.loadDefaultMenu();
	ameTest.selectItemByTitle('Posts', null, true);
	casper.click('.ws_menu.ws_active .ws_toggle_advanced_fields');

	casper.click('.ws_menu.ws_active .ws_open_color_editor');
});

casper.waitUntilVisible(
	'#ws-ame-menu-color-settings',
	function() {
		casper.test.pass("Clicking \"Edit...\" opens the color scheme dialog");
		casper.test.assertEvalEquals(
			function() {
				return jQuery('#ws-ame-menu-color-settings').closest('.ui-dialog').find('.ui-dialog-title').text();
			},
			'Colors: Posts',
			'The dialog has the correct title'
		);

		//Set the background to a nice blue color.
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
	casper.click('#ws_save_menu');
});

ameTest.waitForSettingsSavedMessage(function() {
	//Verify that the background color was changed.
	casper.test.assertEvalEquals(
		function() {
			return jQuery('#menu-posts').css('background-color');
		},
		'rgb(34, 60, 204)', //Apparently jQuery returns the computed color as rgb().
		'The background color was changed successfully'
	);
});

casper.then(function() {
	//Repeat the same process with a custom menu to verify that we can change the color scheme
	//even for menu items that start out without a unique ID. The plugin should auto-generate an ID.
	casper.test.comment('Change the background and text color of a custom menu.');
	ameTest.addNewMenu({
		menu_title: 'Color Test',
		css_class: 'menu-top color-test-top-menu'
	});
	ameTest.selectItemByTitle('Color Test', null, true);

	//Add a couple of submenus.
	for(var i = 0; i < 3; i++) {
		ameTest.addNewItem();
	}

	casper.click('.ws_menu.ws_active .ws_toggle_advanced_fields');
	casper.click('.ws_menu.ws_active .ws_open_color_editor');
});

casper.waitUntilVisible(
	'#ws-ame-menu-color-settings',
	function() {
		//This time we also change text colors.
		casper.fill(
			'#ws-ame-menu-color-settings',
			{
				'base-color': '#ff0000',
				'text-color': '#00ff00',
				'menu-submenu-text': '#0000ff'
			},
			false
		);

		casper.click('#ws-ame-save-menu-colors');
	},
	function() {
		casper.test.fail("Clicking the \"Edit...\" button didn't open the color dialog");
	}
);

casper.waitWhileVisible('#ws-ame-menu-color-settings', function() {
	casper.click('#ws_save_menu');
});

ameTest.waitForSettingsSavedMessage(function() {
	//Verify that the colors were changed.
	casper.test.assertEvalEquals(
		function() {
			return jQuery('li.color-test-top-menu .wp-menu-name').css('color');
		},
		'rgb(0, 255, 0)',
		'Text color was changed successfully'
	);
	casper.test.assertEvalEquals(
		function() {
			return jQuery('li.color-test-top-menu').css('background-color');
		},
		'rgb(255, 0, 0)',
		'Background color was changed successfully'
	);
	casper.test.assertEvalEquals(
		function() {
			return jQuery('li.color-test-top-menu .wp-submenu li a').css('color');
		},
		'rgb(0, 0, 255)',
		'Submenu text color was changed successfully'
	);
});

casper.run(function() {
	this.test.done();
});