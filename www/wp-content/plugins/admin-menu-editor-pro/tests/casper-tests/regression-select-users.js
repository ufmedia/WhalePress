casper.start();
casper.test.comment(
	"Regression test (\"Select visible users\" dialog): Typing in the search box should automatically remove users "
	+ "that don't match the search query from the user list. It should not throw JS errors."
);

ameTest.thenQuickSetup();

casper.then(function() {
	//Click the "Choose users..." link.
	casper.click('#ws_show_more_users');
});
casper.waitUntilVisible('#ws_visible_users_dialog');

//Wait for at least one user to show up.
var initialUserCount = 0;
var userEntrySelector = '#ws_available_users tr .ws_user_username_column';
casper.waitForSelector(userEntrySelector, function() {
	initialUserCount = casper.getElementsInfo(userEntrySelector).length;

	//Simulate typing in the search box.
	casper.test.comment("Typing \"editor\" in the search box...");
	casper.sendKeys('#ws_available_user_query', 'editor');
});

//Wait a few moments for the search query to go through. It's throttled/rate limited.
casper.wait(1000, function() {
	var filteredUserCount = casper.getElementsInfo(userEntrySelector).length;
	casper.test.comment(filteredUserCount + ' users found.');
	casper.test.assert(filteredUserCount > 0, 'The user list shows at least one search result.');
	casper.test.assert(
		filteredUserCount < initialUserCount,
		'Entering a search term shortens the list of results, indicating that filtering has occurred.'
	);
});

casper.on("page.error", function(msg, trace) {
	//Extract the script file name.
	var fileName = trace[0].file;
	var matches =  fileName.match(/\/([^?#/\\]+?\.js)(?:\?|#|$)/);
	if (matches) {
		fileName = matches[1];
	}

	casper.test.fail(
		'The page triggered a JavaScript error: "' + msg
		+ '" in ' + fileName + ':' + trace[0].line
	);

	casper.echo("Error:    " + msg, "ERROR");
	casper.echo("File:     " + trace[0].file, "WARNING");
	casper.echo("Line:     " + trace[0].line, "WARNING");
	casper.echo("Function: " + trace[0]["function"], "WARNING");
});


casper.run(function() {
	this.test.done();
});