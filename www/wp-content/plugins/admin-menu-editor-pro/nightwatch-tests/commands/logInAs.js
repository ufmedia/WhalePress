const helper = require('../helper.js');

module.exports = class LogInAsCommand {
	command(username, password, callback) {
		const browser = this.api;

		if (!username || !password) {
			return;
		}

		return new Promise((resolve) => {
			browser
				.url(helper.config.siteUrl + '/wp-login.php')
				.setValue('#user_login', username)
				.setValue('#user_pass', password)
				.click('#loginform #wp-submit')
				//Wait for the Dashboard and the admin menu to load.
				.waitForElementPresent('#adminmenuwrap')
				.execute(
					function (expected) {
						if (typeof jQuery === 'undefined') {
							return null;
						}

						const $profileItem = jQuery('#wpadminbar #wp-admin-bar-my-account');
						if ($profileItem.find('.display-name').first().text().trim() === expected) {
							return '#wpadminbar #wp-admin-bar-my-account .display-name';
						}
						if ($profileItem.find('.username').first().text().trim() === expected) {
							return '#wpadminbar #wp-admin-bar-my-account .username';
						}
						return null;
					},
					[username],
					function (result) {
						let returnValue = {value: false};
						if (typeof result.value === 'string') {
							browser.assert.containsText(
								result.value,
								username,
								'Logged in as "' + username + '"'
							);
							returnValue.value = username;
						} else {
							browser.assert.fail(
								'Login failed! The expected username ("' + username + '") is not displayed in the Toolbar.'
							)
						}
						if (callback) {
							callback.call(browser);
						}
						resolve(returnValue);
					}
				);
		});
	}
}