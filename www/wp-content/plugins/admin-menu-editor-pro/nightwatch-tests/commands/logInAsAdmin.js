const helper = require('../helper.js');

module.exports = class LogInAsAdminCommand {
	command(callback) {
		const browser = this.api;

		return new Promise((resolve) => {
			browser.logInAs(helper.config.adminUsername, helper.config.adminPassword, function (result) {
				if (callback) {
					callback.call(browser);
				}
				resolve(result)
			});
		});
	}
}