casper.start();
casper.test.comment('Prevent the user from deleting non-custom menu items.');

ameTest.thenQuickSetup(['dummy-menus']);

casper.then(function() {
	//Try deleting one of the default menus first.
	ameTest.selectItemByTitle('Posts');
	casper.click('#ws_delete_menu');

	casper.test.assertVisible(
		'#ws-ame-menu-deletion-error',
		'An error dialog shows up when trying to delete a default menu'
	);

	casper.test.assertVisible(
		'#ws-ame-menu-deletion-error #ws_hide_menu_from_everyone',
		'The dialog has a "Hide from everyone" button'
	);
	casper.test.assertVisible(
		'#ws-ame-menu-deletion-error #ws_hide_menu_except_current_user',
		'The dialog has a "Hide from everyone except this user" button'
	);
	casper.test.assertVisible(
		'#ws-ame-menu-deletion-error #ws_cancel_menu_deletion',
		'The dialog has a "Cancel" button'
	);

	casper.test.comment('Click "hide from everyone"');
	casper.click('#ws_hide_menu_from_everyone');

	casper.test.assertInvisible('#ws-ame-menu-deletion-error', 'Choosing an option closes the dialog');

	//Did the menu get hidden?
	casper.test.assertEval(
		function() {
			var menuEditor = jQuery('#ws_menu_editor');
			var selectedMenu = menuEditor.find('.ws_menu.ws_active');

			function isHiddenFromEveryone(node) {
				var menuItem = node.data('menu_item');

				for (var actor in wsEditorData.actors) {
					if (!wsEditorData.actors.hasOwnProperty(actor)) {
						continue;
					}
					if (AmeEditorApi.actorCanAccessMenu(menuItem, actor)) {
						return false;
					}
				}

				var subMenuId = node.data('submenu_id');
				if (subMenuId && node.hasClass('ws_menu')) {
					var allWereHidden = true;
					jQuery('.ws_item', '#' + subMenuId).each(function() {
						if (!isHiddenFromEveryone(jQuery(this))) {
							allWereHidden = false;
							return false;
						}
					});

					if (!allWereHidden) {
						return false;
					}
				}

				return true;
			}

			return isHiddenFromEveryone(selectedMenu);
		},
		'The selected menu and its submenus are hidden from all actors'
	);

	//---------------------------------------------------------------------------------------
	casper.test.comment('Now try it with a submenu item that was created by a plugin.');
	ameTest.selectItemByTitle('Dummy Top Menu', 'Dummy Submenu #1');

	casper.click('#ws_delete_item');
	casper.test.assertVisible(
		'#ws-ame-menu-deletion-error',
		'The error dialog also shows up for submenu items'
	);
	casper.test.comment('Click "hide from everyone except this user"');

	casper.click('#ws_hide_menu_except_current_user');

	//In this case, the item should be hidden from everyone except the test admin account.
	casper.test.assertEval(
		function(allowedActor) {
			var menuEditor = jQuery('#ws_menu_editor');
			var selectedItem = menuEditor.find('.ws_item.ws_active');

			var menuItem = selectedItem.data('menu_item');
			if (!AmeEditorApi.actorCanAccessMenu(menuItem, allowedActor)) {
				return false;
			}

			for (var actor in wsEditorData.actors) {
				if (!wsEditorData.actors.hasOwnProperty(actor) || (actor === allowedActor)) {
					continue;
				}
				if (AmeEditorApi.actorCanAccessMenu(menuItem, actor)) {
					return false;
				}
			}

			return true;
		},
		'The selected item is hidden from everyone except the user "' + ameTestConfig.adminUsername + '"',
		'user:' + ameTestConfig.adminUsername
	);
});

casper.then(function() {
	//Finally, verify that the dialog *doesn't* show up when deleting custom items.
	casper.test.comment('Create and then delete a custom menu item');
	casper.click('#ws_new_menu');
	casper.test.assertExists('.ws_menu.ws_active.ws_custom', 'Created a custom top level menu');

	casper.click('#ws_delete_menu');
	casper.test.assertInvisible(
		'#ws-ame-menu-deletion-error',
		'The error dialog *doesn\'t* show up when deleting a custom menu'
	);
	casper.test.assertDoesntExist('.ws_menu.ws_custom', 'The custom menu was successfully deleted');
});

casper.run(function() {
	this.test.done();
});