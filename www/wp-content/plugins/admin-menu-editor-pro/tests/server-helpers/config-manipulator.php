<?php
/**
 * Create new users and roles for tests, and change the plugin configuration.
 */

class ameTestDataManipulator {
	public function __construct() {
		add_action('admin_init', array($this, 'handleRequest'));
	}

	public function handleRequest() {
		if ( !empty($_GET['ame_create_user']) ) {
			$this->createUser();
		} elseif ( !empty($_GET['ame_create_role']) ) {
			$this->createRole();
		} elseif ( !empty($_GET['ame_delete_users']) ) {
			$this->deleteUsers();
		} elseif ( !empty($_GET['ame_delete_roles']) ) {
			$this->deleteRoles();
		} elseif ( !empty($_GET['ame_forget_plugin']) ) {
			$this->forgetPlugin();
		} elseif ( !empty($_GET['ame_toggle_module']) ) {
			$this->toggleModule();
		}
	}

	private function createUser() {
		$username = strval($_GET['ame_create_user']);
		$password = strval($_GET['password']);
		$roles = isset($_GET['roles']) ? explode(',', $_GET['roles']) : array();

		$userId = wp_create_user(
			$username,
			$password,
			'fakemail.' . $username . '@localhost'
		);

		$user = get_user_by('id', $userId);

		if ( !empty($roles) ) {
			if ( !empty($user->roles) ) {
				//Remove the default role.
				$existingRole = reset($user->roles);
				$user->remove_role($existingRole);
			}

			foreach($roles as $roleId) {
				$user->add_role($roleId);
			}
		}
	}

	private function createRole() {
		$id = $_GET['ame_create_role'];
		$caps = explode(',', $_GET['capabilities']);
		$caps = array_fill_keys($caps, true);

		$wpRoles = wp_roles();
		$wpRoles->add_role($id, $id, $caps);
	}

	private function deleteUsers() {
		$usernames = explode(',', $_GET['ame_delete_users']);
		foreach($usernames as $username) {
			$user = get_user_by('login', $username);
			if ( $user ) {
				wp_delete_user($user->ID);
			}
		}
	}

	private function deleteRoles() {
		$roles = explode(',', $_GET['ame_delete_roles']);
		$wpRoles = wp_roles();
		foreach($roles as $role) {
			$wpRoles->remove_role($role);
		}
	}

	private function forgetPlugin() {
		$pluginFile = strval($_GET['ame_forget_plugin']);
		$pluginVisibility = amePluginVisibility::getLastCreatedInstance();
		$pluginVisibility->forgetPlugin($pluginFile);
	}

	private function toggleModule() {
		global $wp_menu_editor;

		$moduleId = strval($_GET['ame_toggle_module']);
		$newState = boolval($_GET['ame_active']);

		$isActive = $wp_menu_editor->get_plugin_option('is_active_module');
		$isActive[$moduleId] = $newState;
		$wp_menu_editor->set_plugin_option('is_active_module', $isActive);
	}
}

new ameTestDataManipulator();