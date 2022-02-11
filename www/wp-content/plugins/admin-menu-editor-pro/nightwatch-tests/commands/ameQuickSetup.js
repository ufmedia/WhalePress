const helper = require('../helper.js');

module.exports = class AmeQuickTestSetupCommand {
	command(phpHelpers, callback) {
		const browser = this.api;

		return new Promise((resolve) => {
			//Reset plugin configuration, activate helpers, log in and open the menu editor.
			//Doing all of that in one request is noticeably faster than using the individual helper functions.
			phpHelpers = phpHelpers || [];
			let params = {
				'ame-quick-test-setup': '1',
				'username': helper.config.adminUsername,
				'password': helper.config.adminPassword,
				'activate-helpers': phpHelpers.join(',')
			};

			browser.url(
				helper.config.siteUrl + '?' + this.buildQueryString(params),
				function(result) {
					if (callback) {
						callback.call(browser);
					}
					resolve(result);
				}
			);
		});
	};

	buildQueryString(obj) {
		const params = new URLSearchParams(obj);
		return params.toString();
	};
}