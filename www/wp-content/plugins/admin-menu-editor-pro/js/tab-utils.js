jQuery(function ($) {
	var menuEditorHeading = $('#ws_ame_editor_heading').first();
	var pageWrapper = menuEditorHeading.closest('.wrap');
	var tabList = pageWrapper.find('.nav-tab-wrapper').first();

	//On AME pages, move settings tabs after the heading. This is necessary to make them appear on the right side,
	//and WordPress breaks that by moving notices like "Settings saved" after the first H1 (see common.js).
	var menuEditorTabs = tabList.add(tabList.next('.clear'));
	if ((menuEditorHeading.length > 0) && (menuEditorTabs.length > 0)) {
		menuEditorTabs.insertAfter(menuEditorHeading);
	}

	//Switch tab styles when there are too many tabs and they don't fit on one row.
	var $firstTab = null,
		$lastTab = null,
		knownTabWrapThreshold = -1;

	function updateTabStyles() {
		if (($firstTab === null) || ($lastTab === null)) {
			var $tabItems = tabList.children('.nav-tab');
			$firstTab = $tabItems.first();
			$lastTab = $tabItems.last();
		}

		//To detect if any tabs are wrapped to the next row, check if the top of the last tab
		//is below the bottom of the first tab.
		var firstPosition = $firstTab.position();
		var lastPosition = $lastTab.position();
		var windowWidth = $(window).width();
		//Sanity check.
		if (
			!firstPosition || !lastPosition || !windowWidth
			|| (typeof firstPosition['top'] === 'undefined')
			|| (typeof lastPosition['top'] === 'undefined')
		) {
			return;
		}
		var firstTabBottom = firstPosition.top + $firstTab.outerHeight();
		var areTabsWrapped = (lastPosition.top >= firstTabBottom);

		//Tab positions may change when we apply different styles, which could lead to the tab bar
		//rapidly cycling between one and two two rows when the browser width is just right.
		//To prevent that, remember what the width was when we detected wrapping, and always apply
		//the alternative styles if the width is lower than that.
		var wouldWrapByDefault = (windowWidth <= knownTabWrapThreshold);

		var tooManyTabs = areTabsWrapped || wouldWrapByDefault;
		if (tooManyTabs && (windowWidth > knownTabWrapThreshold)) {
			knownTabWrapThreshold = windowWidth;
		}

		pageWrapper.toggleClass('ws-ame-too-many-tabs', tooManyTabs);
	}

	updateTabStyles();

	$(window).on('resize', wsAmeLodash.debounce(
		function () {
			updateTabStyles();
		},
		300
	));
});

