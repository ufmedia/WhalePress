/*
 Test the Plugin Visibility module.
 */
casper.options.timeout = 120000;

casper.start();

ameTest.thenQuickSetup(['config-manipulator']);

var pluginsPageUrl = ameTestConfig.adminUrl + '/plugins.php';

/**
 * Check if a plugin is visible.
 * Note: The "Plugins" page must be open to perform this test.
 *
 * @param {string} plugin
 * @return boolean
 */
function isPluginVisible(plugin) {
	return casper.exists('.plugins tr[data-plugin="' + plugin + '"]');
}

function thenOpenPluginVisibility(callback) {
	casper.thenOpen(
		ameTestConfig.adminUrl + '/options-general.php?page=menu_editor&sub_section=plugin-visibility',
		callback
	);
}

function setPluginVisibility(pluginFile, isVisible) {
	var success = casper.evaluate(function (fileName, shouldBeChecked) {
		var checkbox = jQuery('table.plugins input[data-plugin-file="' + fileName + '"]');
		if (checkbox.is(':checked') !== shouldBeChecked) {
			checkbox.click();
		}
		return (checkbox.is(':checked') === shouldBeChecked);
	}, pluginFile, isVisible);

	if (!success) {
		casper.test.fail('Failed to set visibility to ' + (isVisible ? 'true' : 'false'));
	}
}

function isCheckboxChecked(selector) {
	return casper.evaluate(function (checkboxSelector) {
		return jQuery(checkboxSelector).is(':checked');
	}, selector);
}

//Base case.
casper.thenOpen(pluginsPageUrl, function() {
	casper.test.assert(
		isPluginVisible('dummy-plugin-no-dir.php')
		&& isPluginVisible('dummy-plugin-a/dummy-plugin.php')
		&& isPluginVisible('dummy-plugin-b/dummy-plugin.php'),
		'With no custom settings, all plugins are visible.'
	);
});

//Try hiding a specific plugin from "All".
thenOpenPluginVisibility(function() {
	setPluginVisibility('dummy-plugin-a/dummy-plugin.php', false);
	casper.click('.ame-pv-save-form .button-primary');
});

casper.waitForSelector('#setting-error-settings_updated');

ameTest.thenLogin('second_admin', 'password');
casper.thenOpen(pluginsPageUrl, function() {
	casper.test.assert(
		!isPluginVisible('dummy-plugin-a/dummy-plugin.php'),
		'Hiding a plugin from "All" hides it from other administrators.'
	);

	casper.test.assert(
		isPluginVisible('dummy-plugin-b/dummy-plugin.php'),
		'Plugins that were not hidden remain visible.'
	);
});

//Hide a plugin from "Administrator".
ameTest.resetPluginConfiguration();
ameTest.thenLoginAsAdmin();
thenOpenPluginVisibility(function() {
	ameTest.selectRoleActor('administrator');
	setPluginVisibility('dummy-plugin-b/dummy-plugin.php', false);
	casper.click('.ame-pv-save-form .button-primary');
});
casper.waitForSelector('#setting-error-settings_updated');

ameTest.thenLogin('second_admin', 'password');
casper.thenOpen(pluginsPageUrl, function() {
	casper.test.assert(
		!isPluginVisible('dummy-plugin-b/dummy-plugin.php'),
		'Hiding a plugin from "Administrator" hides it from other administrators.'
	);
});

//Hide a plugin from "second_admin" specifically.
ameTest.resetPluginConfiguration();
ameTest.thenLoginAsAdmin();
casper.thenOpen(ameTestConfig.adminUrl + '/?ame_create_user=third_admin&password=password&roles=administrator');

thenOpenPluginVisibility();

//Add "second_admin" to visible users.
ameTest.thenAddVisibleUser('second_admin');

casper.then(function() {
	ameTest.selectActor('user:second_admin');
	setPluginVisibility('dummy-plugin-no-dir.php', false);
	casper.click('.ame-pv-save-form .button-primary');
});

casper.waitForSelector('#setting-error-settings_updated');

ameTest.thenLogin('second_admin', 'password');
casper.thenOpen(pluginsPageUrl, function() {
	casper.test.assert(
		!isPluginVisible('dummy-plugin-no-dir.php'),
		'You can hide a plugin from a specific user.'
	);
});

ameTest.thenLogin('third_admin', 'password');
casper.thenOpen(pluginsPageUrl, function() {
	casper.test.assert(
		isPluginVisible('dummy-plugin-no-dir.php'),
		'When you hide a plugin from a specific user ("second_admin"), other users can still see it.'
	);
});

casper.thenOpen(ameTestConfig.adminUrl + '/?ame_delete_users=third_admin');

//Hide all plugins from "Administrator".
ameTest.thenLoginAsAdmin();
ameTest.resetPluginConfiguration();

thenOpenPluginVisibility(function() {
	ameTest.selectRoleActor('administrator');
	casper.click('.plugins thead .ame-check-column input[type="checkbox"]');
	casper.click('.ame-pv-save-form .button-primary');
});

casper.waitForSelector('#setting-error-settings_updated');

casper.thenOpen(ameTestConfig.adminUrl + '/?ame_forget_plugin=dummy-plugin-no-dir.php');

ameTest.thenLogin('second_admin', 'password');
casper.thenOpen(pluginsPageUrl, function() {
	casper.test.assert(
		!isPluginVisible('dummy-plugin-no-dir.php'),
		'Unchecking the "select all" box for a role hides any new plugins from that role.'
	);
});

//Hide a plugin from "All".
ameTest.thenLoginAsAdmin();
ameTest.resetPluginConfiguration();
thenOpenPluginVisibility(function() {
	setPluginVisibility('dummy-plugin-no-dir.php', false);
	casper.click('.ame-pv-save-form .button-primary');
});

casper.waitForSelector('#setting-error-settings_updated');

//Add a "new_user" user as an Administrator.
casper.thenOpen(ameTestConfig.adminUrl + '/?ame_create_user=new_user&password=password&roles=administrator');
//Add a "Plugin Manager" role with access to plugins
casper.thenOpen(ameTestConfig.adminUrl + '/?ame_create_role=plugin_manager&capabilities=activate_plugins%2Cread');
//Add a "plugman" user as a Plugin Manager.
casper.thenOpen(ameTestConfig.adminUrl + '/?ame_create_user=plugman&password=password&roles=plugin_manager');

ameTest.thenLogin('new_user', 'password');
casper.thenOpen(pluginsPageUrl, function() {
	casper.test.assert(
		!isPluginVisible('dummy-plugin-no-dir.php'),
		'Hiding a plugin from "All" also hides it from new users.'
	);
});

ameTest.thenLogin('plugman', 'password');
casper.thenOpen(pluginsPageUrl, function() {
	casper.test.assert(
		!isPluginVisible('dummy-plugin-no-dir.php'),
		'Hiding a plugin from "All" also hides it from new roles.'
	);
});

ameTest.thenLoginAsAdmin();
thenOpenPluginVisibility(function() {
	ameTest.selectRoleActor('plugin_manager');
	casper.test.assert(
		!isCheckboxChecked('.plugins input[data-plugin-file="dummy-plugin-no-dir.php"]'),
		'The plugin also appears as unchecked for the new role.'
	);
});

//Add a "doubleman" user as an Administrator + Plugin Manager, then hide a plugin from Administrator.
casper.thenOpen(ameTestConfig.adminUrl + '/?ame_create_user=doubleman&password=password&roles=administrator,plugin_manager');

ameTest.thenLoginAsAdmin();
ameTest.resetPluginConfiguration();
thenOpenPluginVisibility(function() {
	ameTest.selectRoleActor('administrator');
	setPluginVisibility('dummy-plugin-a/dummy-plugin.php', false);

	ameTest.selectRoleActor('plugin_manager');
	setPluginVisibility('dummy-plugin-a/dummy-plugin.php', true);

	casper.click('.ame-pv-save-form .button-primary');
});

casper.waitForSelector('#setting-error-settings_updated');

ameTest.thenLogin('doubleman', 'password');
casper.thenOpen(pluginsPageUrl, function() {
	casper.test.assert(
		isPluginVisible('dummy-plugin-a/dummy-plugin.php'),
		'A user with multiple roles can see a plugin if it\'s enabled for at least one of their roles.'
	);
});

ameTest.thenLogin('second_admin', 'password');
casper.thenOpen(pluginsPageUrl, function() {
	casper.test.assert(
		!isPluginVisible('dummy-plugin-a/dummy-plugin.php'),
		'...but a user with one role can\'t see a plugin that\'s disabled for that role.'
	);
});

//Add an "editor_and_admin" user, then hide a plugin from Administrator but not from Editor
casper.thenOpen(ameTestConfig.adminUrl + '/?ame_create_user=editor_and_admin&password=password&roles=administrator,editor');

ameTest.thenLoginAsAdmin();
ameTest.resetPluginConfiguration();
thenOpenPluginVisibility(function() {
	ameTest.selectRoleActor('administrator');
	setPluginVisibility('dummy-plugin-a/dummy-plugin.php', false);
	casper.click('.ame-pv-save-form .button-primary');
});

casper.waitForSelector('#setting-error-settings_updated');

ameTest.thenLogin('editor_and_admin', 'password');
casper.thenOpen(pluginsPageUrl, function() {
	casper.test.assert(
		!isPluginVisible('dummy-plugin-a/dummy-plugin.php'),
		"Roles like \"Editor\" don't count as being able to see a plugin (by default) for users with multiple roles."
	);
});

//Note: To delete test roles and users, you need to be logged in. Deleting the currently user would
//force a logout, so we need to log in as a different user first.
ameTest.thenLoginAsAdmin();
//Delete test users.
casper.thenOpen(ameTestConfig.adminUrl + '/?ame_delete_users=new_user,plugman,doubleman,editor_and_admin', function () {
	casper.test.comment("Test users deleted.");
});
//Delete test role.
casper.thenOpen(ameTestConfig.adminUrl + '/?ame_delete_roles=plugin_manager', function () {
	casper.test.comment("Test role deleted.");
});

//Rename one of the custom plugins.
ameTest.resetPluginConfiguration();

thenOpenPluginVisibility(function() {
	var pluginFile = 'dummy-plugin-a/dummy-plugin.php',
		customName = 'Custom Plugin Name',
		customDescription = 'Custom plugin description.';

	casper.test.comment("Change plugin name and description.");

	var success = casper.evaluate(function (fileName, name, description) {
		var row = jQuery('table.plugins input[data-plugin-file="' + fileName + '"]').closest('tr');
		row.find('.row-actions .edit a').click();

		var inlineEditor = row.next('.inline-edit-row');
		if (inlineEditor.length < 1) {
			return false;
		}

		inlineEditor.find('.ame-pv-custom-name').val(name).change();
		inlineEditor.find('.ame-pv-custom-description').val(description).change();
		inlineEditor.find('.button-primary').click();

		return true;
	}, pluginFile, customName, customDescription);

	if (!success) {
		casper.test.fail('Failed to change plugin name and description.');
	}

	casper.click('.ame-pv-save-form .button-primary');
});

casper.waitForSelector('#setting-error-settings_updated');

casper.thenOpen(pluginsPageUrl, function() {
	casper.test.assertSelectorHasText(
		'.plugins tr[data-plugin="dummy-plugin-a/dummy-plugin.php"] .plugin-title strong',
		'Custom Plugin Name',
		'You can change the plugin name.'
	);

	casper.test.assertSelectorHasText(
		'.plugins tr[data-plugin="dummy-plugin-a/dummy-plugin.php"] .plugin-description',
		'Custom plugin description.',
		'You can change the plugin description.'
	);
});

casper.run(function() {
	this.test.done();
});
