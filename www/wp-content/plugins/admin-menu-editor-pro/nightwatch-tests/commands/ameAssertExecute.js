module.exports = class AmeAssertExecuteEqualsCommand {
	command(executable, args, expectedResult, message) {
		const browser = this.api;

		if (typeof args === 'undefined') {
			args = [];
		}
		if (typeof message === 'undefined') {
			message = 'Code successfully executed in the context of the current page';
		}

		return new Promise((resolve) => {
			browser.execute(
				executable,
				args,
				function (result) {
					if (typeof expectedResult === 'undefined') {
						browser.assert.ok(!!result.value, message);
					} else {
						browser.assert.equal(result.value, expectedResult, message);
					}

					resolve({value: result.value});
				}
			);
		});
	}
}