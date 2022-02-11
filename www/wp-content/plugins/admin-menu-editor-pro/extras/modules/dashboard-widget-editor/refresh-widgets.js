/*global wsWidgetRefresherData */

jQuery(function($) {
	//Load the Dashboard in a hidden frame.
	var frame = $('<iframe></iframe>');

	frame.on('load', function() {
		//When done, redirect back to the widget editor.
		window.location.href = wsWidgetRefresherData['editorUrl'];
	});

	frame.attr({
		'src': wsWidgetRefresherData['dashboardUrl'],
		'width': 1,
		'height': 1
	});
	frame.css('visibility', 'hidden');

	frame.appendTo('#wpwrap');
});
