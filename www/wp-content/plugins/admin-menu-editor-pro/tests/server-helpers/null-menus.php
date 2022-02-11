<?php
/**
 * This test helper creates admin menu items that have NULL menu titles, page titles
 * and couple of other properties.
 *
 * Technically it's not valid to set the menu title to NULL (it must be a string), but
 * some plugins do it anyway. AME should not crash when it encounters menu items like that.
 */

add_action('admin_menu', function() {
	add_options_page(null, null, 'read', null);
	add_menu_page(null, null, 'read', 'a-fake-slug-for-null-menu', null, null);
});