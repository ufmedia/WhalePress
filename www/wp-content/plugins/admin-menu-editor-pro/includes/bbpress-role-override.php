<?php
class ameBBPressRoleOverride {
	private $customRoleSettings = array();
	private $propertiesToSave = array('roles', 'role_objects', 'role_names');

	public function __construct() {
		//Save a local copy of bbPress roles before bbPress overwrites them, then restore that saved copy later.
		//Note that the priority number here must be higher than the priority of the bbPress::roles_init() callback
		//and lower than the priority of the bbp_add_forums_roles() callback.
		add_action('bbp_roles_init', array($this, 'maybePreserveCustomSettings'), 6);
	}

	public function maybePreserveCustomSettings($wp_roles = null) {
		$priority = has_action('bbp_roles_init', 'bbp_add_forums_roles');
		if ( ($priority === false) || !function_exists('bbp_get_dynamic_roles') || (empty($wp_roles)) ) {
			//bbPress is not active or the current bbPress version is not supported.
			return $wp_roles;
		}

		$bbPressRoles = bbp_get_dynamic_roles();
		if ( !is_array($bbPressRoles) || empty($bbPressRoles) ) {
			return $wp_roles;
		}

		foreach (array_keys($bbPressRoles) as $id) {
			$settings = array();
			foreach ($this->propertiesToSave as $property) {
				if ( isset($wp_roles->{$property}[$id]) ) {
					$settings[$property] = $wp_roles->{$property}[$id];
				}
			}
			if ( !empty($settings) ) {
				$this->customRoleSettings[$id] = $settings;
			}
		}

		if ( !empty($this->customRoleSettings) ) {
			add_action('bbp_roles_init', array($this, 'restoreCustomSettings'), $priority + 5);
		}

		return $wp_roles;
	}

	public function restoreCustomSettings($wp_roles = null) {
		if ( empty($wp_roles) ) {
			return $wp_roles;
		}
		foreach ($this->customRoleSettings as $id => $properties) {
			foreach ($properties as $property => $value) {
				$wp_roles->{$property}[$id] = $value;
			}
		}
		$this->customRoleSettings = array();
		return $wp_roles;
	}
}