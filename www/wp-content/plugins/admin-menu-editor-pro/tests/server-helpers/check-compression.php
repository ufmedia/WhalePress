<?php
/*
 * Verify that compression preserves menu data.
 *
 * You should be able to take a menu configuration, store it in either compressed and uncompressed form, load it again,
 * and get back the exact same data in both cases.
 */

function ame_test_array_diff_assoc_recursive($first, $second) {
	if ( !is_array($second) ) {
		return $first;
	}

	$difference = array();
	foreach($first as $key => $value) {
		if ( !array_key_exists($key, $second) ) {
			$difference[$key] = $value;
		} elseif ( is_array($value) ) {
			$sub_difference = ame_test_array_diff_assoc_recursive($value, $second[$key]);
			if ( !empty($sub_difference) ) {
				$difference[$key] = $sub_difference;
			}
		} elseif ($second[$key] !== $value) {
			$difference[$key] = $value;
		}
	}

	return $difference;
}

add_action('admin_init', function() {
	global $wp_menu_editor;
	$menu = $wp_menu_editor->load_custom_menu();
	if ( empty($menu) ) {
		return;
	}

	$compressed = ameMenu::compress($menu);
	$loaded = ameMenu::load_json(ameMenu::to_json($compressed));
	$expected = ameMenu::load_json(ameMenu::to_json($menu));

	$diff1 = ame_test_array_diff_assoc_recursive($expected, $loaded);
	$diff2 = ame_test_array_diff_assoc_recursive($loaded, $expected);

	if ( !empty($diff1) || !empty($diff2) ) {
		header('X-AME-Test-Failed: compression', true, 500);

		echo "<h1>Test failed: Compression causes data loss!</h1>";
		echo "<p>Loading compressed and uncompressed versions of the same menu configuration produced different results.</p>";

		echo '<p>Keys that are missing or different in the compressed configuration (expected vs compressed):</p>';
		echo '<pre>';
		echo htmlentities(print_r($diff1, true));
		echo '</pre>';

		echo '<h2>Reverse diff (compressed vs expected):</h2>';
		echo '<pre>';
		echo htmlentities(print_r($diff2, true));
		echo '</pre>';

		exit;
	}
});