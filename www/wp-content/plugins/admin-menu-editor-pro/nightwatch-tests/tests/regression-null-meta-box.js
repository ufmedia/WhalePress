const helper = require('../helper');

describe('Regression test: Null meta box ID.', function () {
	before(
		/**
		 * @param {NightwatchBrowser} browser
		 */
		function (browser) {
			browser.ameQuickSetup(['null-meta-box']);
		}
	);

	test(
		'Plugin should not crash when a meta box has its ID set to NULL',
		/**
		 * @param {NightwatchBrowser} browser
		 */
		function (browser) {
			//Open the post editor. The "page" post type is chosen pretty arbitrarily.
			//This should store existing meta boxes in the database.
			browser.url(helper.config.adminUrl + '/post-new.php?post_type=page')
				.assert.elementPresent('#wpfooter', 'Post editor appears to be fully loaded, admin footer is present.')
				.assert.elementPresent('.postbox-container .postbox .inside', 'At least one meta box exists.');

			//Go to the "Meta Boxes" tab.
			browser.url(helper.config.adminUrl + '/options-general.php?page=menu_editor&sub_section=metaboxes')
				.waitForElementPresent(
					'.ame-meta-box-list',
					10 * 1000,
					true,
					null,
					'The plugin successfully displays the meta box list.'
				)
				.assert.elementPresent('#wpfooter', 'Meta box editor appears to be fully loaded.');

			//Go back to the post editor. In older versions, a NULL ID would cause an exception
			//to be thrown here because the plugin stored the invalid ID as "" (an empty string)
			//and then tried to compare it to NULL when synchronizing meta box properties.
			browser.url(helper.config.adminUrl + '/post-new.php?post_type=page')
				.assert.elementPresent('#wpfooter', 'Post editor works fine after refreshing meta boxes.')
				.assert.elementPresent('.postbox-container .postbox .inside', 'At least one meta box still exists.');
		}
	);

	after(
		/**
		 * @param {NightwatchBrowser} browser
		 */
		function (browser) {
			browser.end();
		}
	);
});

