/*global wsMetaBoxRefresherData */

jQuery(function($) {
	//Load all of the pages that could have meta boxes in hidden frames.
	var pages = wsMetaBoxRefresherData['pagesWithMetaBoxes'],
		frame = null,
		loadedPages = 0,
		totalPages = pages.length,
		$progressBar = $('#ame-mb-refresh-progress');

	$progressBar.prop('max', totalPages);

	for (var i = 0; i < totalPages; i++) {
		frame = $('<iframe></iframe>');

		frame.on('load', function() {
			loadedPages++;
			$progressBar.prop('value', loadedPages);
			//console.log(loadedPages + ' of ' + totalPages);

			//When done, redirect back to the widget editor.
			if (loadedPages >= totalPages) {
				//console.log('Done');
				window.location.href = wsMetaBoxRefresherData['editorUrl'];
			}
		});

		frame.attr({
			'src': pages[i],
			'width': 1,
			'height': 1
		});
		frame.css('visibility', 'hidden');

		frame.appendTo('#wpwrap');
	}

});
