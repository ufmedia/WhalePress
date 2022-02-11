casper.start();
casper.test.comment("Make sure AME doesn't crash when it runs into menu items with invalid (NULL) titles");

var numberOfErrors = 0;
casper.on("page.error", function(msg, trace) {
	numberOfErrors++;

	casper.test.comment('JavaScript error: "' + msg + '"');
	casper.test.comment('Stack trace:');
	var utils = require('utils');
	utils.dump(trace);

	casper.test.fail('JavaScript error: "' + msg + '"');
});

ameTest.thenQuickSetup(['null-menus']);
casper.then(function() {
	if (numberOfErrors === 0) {
		casper.test.pass('The menu editor page loads without uncaught JavaScript errors');
	}
});

casper.run(function() {
	this.test.done();
});