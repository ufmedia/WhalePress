'use strict';

(
	/**
	 * @param {Object} data
	 * @param {Array} data.panelsToRemove List of Gutenberg panels to remove.
	 * @param {Array} data.selectorsToHide List of jQuery selectors to hide.
	 */
	function (data) {
		if (typeof data['panelsToRemove'] !== 'undefined') {
			for (var i = 0; i < data.panelsToRemove.length; i++) {
				// noinspection JSUnresolvedFunction
				wp.data.dispatch('core/edit-post').removeEditorPanel(data.panelsToRemove[i]);
			}
		}

		if (typeof data['selectorsToHide'] !== 'undefined') {
			jQuery(function () {
				var styleTag = jQuery('<style type="text/css"></style>');
				var css = '';
				for (var j = 0; j < data.selectorsToHide.length; j++) {
					css = css + data.selectorsToHide[j] + ' { display: none !important; }' + "\n";
				}
				styleTag.text(css).appendTo('head');
			});
		}
	}
)(window['wsAmeGutenbergPanelData'] || {});