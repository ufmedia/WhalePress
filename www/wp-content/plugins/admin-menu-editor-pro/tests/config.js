var ameTestConfig = {
	siteUrl: 'http://localhost/ame-tests',
	adminUrl: 'http://localhost/ame-tests/wp-admin',
	adminUsername: 'admin',
	adminPassword: 'password'
};

//Auto-detect WordPress URL.
var menuEditorDir = _.get(casper.cli.options, 'menuEditorDir');
if (menuEditorDir) {
	var contentPos = menuEditorDir.indexOf('\\wp-content\\'),
		rootPos = menuEditorDir.indexOf('\\htdocs\\');
	if (contentPos >= 0 && rootPos >= 0) {
		var wordpressSubdir = menuEditorDir.substring(rootPos + '/htdocs/'.length, contentPos);
		ameTestConfig.siteUrl = 'http://localhost/' + wordpressSubdir;
		ameTestConfig.adminUrl = ameTestConfig.siteUrl + '/wp-admin';
	}
}