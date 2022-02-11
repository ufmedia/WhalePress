<?php
/**
 * This helper creates an invalid meta box that has a NULL ID, title, and a few other properties.
 * AME should not crash when it encounters a meta box like that.
 */

add_action('add_meta_boxes_page', function () {
	add_meta_box(
		null,
		null,
		function () {
			echo 'This is an invalid meta box! Its ID is NULL.';
		}
	);
}, 10, 0);
