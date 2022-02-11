<?php

class ameVisibleUsers extends ameModule {
	public function __construct($menuEditor) {
		parent::__construct($menuEditor);

		add_action('wp_ajax_ws_ame_search_users', array($this, 'ajaxSearchUsers'));
		add_filter('admin_menu_editor-editor_script_dependencies', array($this, 'addEditorScript'));
		add_filter('admin_menu_editor-footer', array($this, 'outputDialogTemplate'));
	}

	public function ajaxSearchUsers() {
		global $wpdb; /** @var wpdb $wpdb */
		global $wp_roles;

		if ( !$this->menuEditor->current_user_can_edit_menu() ) {
			die($this->menuEditor->json_encode(array(
				'error' => __("You don't have permission to use Admin Menu Editor Pro.", 'admin-menu-editor')
			)));
		}

		if ( !check_ajax_referer('search_users', false, false) ){
			die($this->menuEditor->json_encode(array(
				'error' => __("Access denied. Invalid nonce.", 'admin-menu-editor')
			)));
		}

		$query = strval($_GET['query']);
		$limit = intval($_GET['limit']);
		if ( $limit > 50 ) {
			$limit = 50;
		}

		$capability_key = $wpdb->prefix . 'capabilities';
		$sql =
			"SELECT ID, user_login, display_name, meta_value as capabilities
			 FROM {$wpdb->users} LEFT JOIN {$wpdb->usermeta}
			 ON ({$wpdb->users}.ID = {$wpdb->usermeta}.user_id AND {$wpdb->usermeta}.meta_key = \"$capability_key\") ";

		if ( !empty($query) ) {
			$like = '%' . $wpdb->esc_like($query) . '%';
			$sql .= $wpdb->prepare(
				' WHERE (user_login LIKE %s) OR (display_name LIKE %s) ',
				$like, $like
			);
		}

		$sql .= ' LIMIT ' . ($limit + 1); //Ask for +1 result so that we know if there are additional results.

		$users = $wpdb->get_results($sql, ARRAY_A);

		$is_multisite = is_multisite();
		if ( !isset($wp_roles) ) {
			$wp_roles = new WP_Roles();
		}

		$results = array();
		foreach($users as $user) {
			//Capabilities (when present) are stored as serialized PHP arrays.
			if ( !empty($user['capabilities']) ) {
				$capabilities = $this->menuEditor->castValuesToBool(unserialize($user['capabilities']));
			} else {
				$capabilities = array();
			}

			//Get roles from capabilities.
			$roles = array_filter(array_keys($capabilities), array($wp_roles, 'is_role'));

			$results[] = array(
				'id' => $user['ID'],
				'user_login' => $user['user_login'],
				'capabilities' => $capabilities,
				'roles' => $roles,
				'is_super_admin' => $is_multisite && is_super_admin($user['ID']),
				'display_name' => strval($user['display_name']),
				'avatar_html' => get_avatar($user['ID'], 32),
			);
		}

		$more_results_available = false;
		if ( count($results) > $limit ) {
			$more_results_available = true;
			array_pop($results);
		}

		$response = array(
			'users' => $results,
			'moreResultsAvailable' => $more_results_available,
		);
		die($this->menuEditor->json_encode($response));
	}

	public function registerScripts() {
		parent::registerScripts();

		wp_register_auto_versioned_script(
			'ame-visible-users',
			plugins_url('extras/modules/visible-users/visible-users.js', $this->menuEditor->plugin_file),
			array('jquery', 'ame-lodash', 'jquery-ui-dialog', 'ame-actor-manager',)
		);

		wp_localize_script(
			'ame-visible-users',
			'ameVisibleUsersScriptData',
			array(
				'searchUsersNonce' => wp_create_nonce('search_users'),
				'adminAjaxUrl' => admin_url('admin-ajax.php'),
			)
		);
	}

	public function addEditorScript($dependencies) {
		$dependencies[] = 'ame-visible-users';
		return $dependencies;
	}

	public function outputDialogTemplate() {
		if ( wp_script_is('ame-visible-users', 'enqueued') || wp_script_is('ame-visible-users', 'done') ) {
			include dirname(__FILE__) . '/visible-users-template.php';
		}
	}
}