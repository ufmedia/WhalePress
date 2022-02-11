module.exports = class LogInAsAdminCommand {
	command(callback) {
		const browser = this.api;

		return new Promise((resolve) => {
			browser.click('#ws_load_menu').acceptAlert(function() {
				if (callback) {
					callback.call(browser);
				}
				resolve({value: true});
			});
		});
	}
}