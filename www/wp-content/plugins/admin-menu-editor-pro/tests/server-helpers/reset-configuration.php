<?php
/**
 * Reset all plugin configuration (as opposed to resetting just the custom menu).
 */

delete_site_option('ws_menu_editor_pro');
delete_option('ws_menu_editor_pro');

delete_site_option('ws_menu_editor');
delete_option('ws_menu_editor');

delete_site_option('ws_ame_plugin_visibility');
delete_option('ws_ame_plugin_visibility');
delete_site_option('ws_ame_hide_pv_notice');

delete_option('ws_ame_dashboard_widgets');
delete_option('ws_ame_meta_boxes');

//Branding add-on.
delete_option('ws_ame_general_branding');
delete_option('ws_ame_login_page_settings');
delete_option('ws_ame_admin_colors');