<?php

if ( defined('ABSPATH') && defined('WP_UNINSTALL_PLUGIN') ) {
	delete_site_option('ws_ame_role_editor');
	delete_option('ws_ame_role_editor');
}