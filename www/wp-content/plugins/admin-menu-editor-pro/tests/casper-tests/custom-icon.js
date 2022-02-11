casper.start();
casper.test.comment('Set a custom icon for one of the built-in menus.');

ameTest.thenQuickSetup();

casper.then(function() {
	ameTest.loadDefaultMenu();
	ameTest.selectItemByTitle('Media', null, true);
	casper.click('.ws_menu.ws_active .ws_toggle_advanced_fields');
	ameTest.setItemFields({
		'icon_url': 'images/loading.gif' //Change to something more appropriate if I ever add custom icons to AME.
	});
	casper.click('#ws_save_menu');
});

ameTest.waitForSettingsSavedMessage(function() {
	casper.test.assertExists('#menu-media', 'The "Media" menu exists');
	casper.test.assertDoesntExist('#menu-media.menu-icon-media', "The default icon class has been removed");
	casper.test.assertExists(
		'#menu-media .wp-menu-image img[src="images/loading.gif"]',
		"The custom icon exists and has the right URL"
	);
});

casper.then(function() {
	casper.test.comment('Test the icon selector widget');

	ameTest.selectItemByTitle('Media', null, true);
	casper.click('.ws_menu.ws_active .ws_toggle_advanced_fields');

	casper.click('.ws_menu.ws_active .ws_select_icon');
	casper.test.assertVisible('#ws_icon_selector', 'Clicking the icon button displays the icon selector');

	casper.test.assertEvalEquals(
		function() {
			return jQuery('#ws_icon_selector').find('.ws_selected_icon').data('icon-url');
		},
		'images/loading.gif',
		'The custom icon is marked as selected'
	);

	//Change the icon of the "Media" menu to the built-in "Tools" icon.
	casper.click('#ws_icon_selector .ws_icon_option[data-icon-url="dashicons-admin-tools"]');
	casper.test.assertEval(function() {
		return !jQuery('#ws_icon_selector').is(':visible');
	}, 'Clicking one of the available icons hides the icon selector');

	casper.click('.ws_menu.ws_active .ws_select_icon');
	casper.test.assertEvalEquals(
		function() {
			return jQuery('#ws_icon_selector').find('.ws_selected_icon').data('icon-url');
		},
		'dashicons-admin-tools',
		'The clicked icon is correctly marked as selected'
	);

	casper.click('#ws_save_menu');
});

ameTest.waitForSettingsSavedMessage(function() {
	casper.test.assertExists(
		'#menu-media .wp-menu-image.dashicons-admin-tools',
		'The menu icon class was successfully changed using the icon selector'
	);
	casper.test.assertDoesntExist(
		'#menu-media .wp-menu-image img',
		'Selecting an icon class removes the custom icon URL (if any)'
	);
});

casper.then(function() {
	casper.test.comment('Test Dashicons');

	ameTest.selectItemByTitle('Posts', null, true);
	casper.click('.ws_menu.ws_active .ws_toggle_advanced_fields');
	casper.click('.ws_menu.ws_active .ws_select_icon');

	//Select the "Search" dashicon.
	casper.click('#ws_icon_selector .ws_icon_option[data-icon-url="dashicons-search"]');

	casper.click('#ws_save_menu');
});

ameTest.waitForSettingsSavedMessage(function() {
	casper.test.assertExists(
		'#menu-posts .wp-menu-image.dashicons-search',
		'The menu icon was successfully changed to a Dashicon using the icon selector'
	);
});

casper.then(function() {
	casper.test.comment('Test Font Awesome icons');

	ameTest.selectItemByTitle('Posts', null, true);
	casper.click('.ws_menu.ws_active .ws_toggle_advanced_fields');
	casper.click('.ws_menu.ws_active .ws_select_icon');

	//Select the "Heart" icon.
	casper.click('#ws_icon_selector .ws_tool_tab_nav li:nth-child(2) a'); //Select the "Font Awesome" tab.
	casper.click('#ws_icon_selector .ws_icon_option[data-icon-url="ame-fa-heart"]');

	casper.click('#ws_save_menu');
});

ameTest.waitForSettingsSavedMessage(function() {
	casper.test.assertExists(
		'#menu-posts.ame-menu-fa-heart',
		'The menu icon was successfully changed to a Font Awesome icon using the icon selector'
	);
});

casper.then(function() {
	casper.test.comment('Give a submenu item a custom icon.');

	//By default, submenus are set to "only show icons when manually selected". So they start out with no icons.
	casper.test.assertDoesntExist(
		'#adminmenu ul.wp-submenu .dashicons',
		"By default, submenus don't have Dashicons"
	);
	casper.test.assertDoesntExist(
		'#adminmenu ul.wp-submenu .ame-submenu-icon',
		"By default, submenus don't have .ame-submenu-icon's"
	);

	//Give a submenu one of the default icons.
	ameTest.selectItemByTitle('Settings', 'Writing', true);
	casper.click('.ws_item.ws_active .ws_toggle_advanced_fields');

	ameTest.setItemFields(
		{
			'icon_url': 'dashicons-star-empty'
		},
		'submenu'
	);

	//Give another submenu an icon, then hide that submenu. The plugin shouldn't allocate space for icons
	//(via the .ame-has-submenu-icons class) when the item that has the icon is not visible.
	ameTest.selectItemByTitle('Users', 'Add New', true);
	casper.click('.ws_item.ws_active .ws_toggle_advanced_fields');

	ameTest.setItemFields(
		{
			'icon_url': 'dashicons-star-filled'
		},
		'submenu'
	);

	//Hide it from the current user.
	casper.click('#ws_actor_selector a[href="#user:' + ameTestConfig.adminUsername + '"]');
	casper.click('#ws_submenu_box .ws_item.ws_active .ws_actor_access_checkbox');

	casper.click('#ws_save_menu');
});

ameTest.waitForSettingsSavedMessage(function() {
	casper.test.assertExists(
		'#menu-settings ul.wp-submenu a[href="options-writing.php"] .dashicons-star-empty',
		'Custom submenu icons show up correctly'
	);

	casper.test.assertDoesntExist(
		'#menu-users.ame-has-submenu-icons',
		'Top level menus only get the "ame-has-submenu-icons" class when the submenus with icons are visible'
	);
});

casper.then(function() {
	casper.test.comment('Change submenu icon visibility to "always".');
	casper.click('#ws_ame_settings_tab');
});

//Select the "Show submenu icons": "Always" option and save changes.
casper.waitForSelector('#ws_plugin_settings_form', function() {
	casper.click('input[name="submenu_icons_enabled"][value="always"]');
	casper.click('#submit');
});

ameTest.waitForSettingsSavedMessage(function() {
	//All submenus should have a Dashicon or Font Awesome icon now.
	casper.test.assertEvalEquals(
		function() {
			var submenusWithoutIcons = jQuery('#adminmenu')
				.find('ul.wp-submenu li a')
				.filter(function() {
					return jQuery(this).find('.dashicons,.ame-fa').length === 0
				});
			return submenusWithoutIcons.length;
		},
		0,
		'Setting "Show submenu icons" to "Always" adds icons to all submenus'
	)
});

//Select the "Show submenu icons": "Never" option and save changes.
//We're still on the settings page, so no need to navigate to it again.
casper.waitForSelector('#ws_plugin_settings_form', function() {
	casper.test.comment('Change submenu icon visibility to "never".');
	casper.click('input[name="submenu_icons_enabled"][value="never"]');
	casper.click('#submit');
});

ameTest.waitForSettingsSavedMessage(function() {
	//No submenu icons should be visible now. Even the custom icon we set for Settings -> Writing should be gone.
	casper.test.assertDoesntExist(
		'#adminmenu ul.wp-submenu li a .dashicons',
		'Setting "Show submenu icons" to "Never" hides all submenu Dashicons'
	);
	casper.test.assertDoesntExist(
		'#adminmenu ul.wp-submenu li a .ame-submenu-icon',
		'Setting "Show submenu icons" to "Never" hides all .ame-submenu-icon\'s'
	);
});

casper.run(function() {
    this.test.done();
});