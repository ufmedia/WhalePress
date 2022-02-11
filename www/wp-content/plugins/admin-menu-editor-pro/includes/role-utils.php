<?php
class ameRoleUtils {
	/**
	 * Retrieve a list of all known, non-meta capabilities of all roles.
	 *
	 * @param bool $include_multisite_caps
	 * @return array Associative array with capability names as keys
	 */
	public static function get_all_capabilities($include_multisite_caps = null){
		if ( $include_multisite_caps === null ) {
			$include_multisite_caps = is_multisite();
		}

		//Cache the results.
		static $regular_cache = null, $multisite_cache = null;
		if ( $include_multisite_caps ) {
			if ( isset($multisite_cache) ) {
				return $multisite_cache;
			}
		} else if ( isset($regular_cache) ) {
			return $regular_cache;
		}

		$wp_roles = self::get_roles();
		$capabilities = array();

		//Iterate over all known roles and collect their capabilities
		foreach($wp_roles->roles as $role){
			if ( !empty($role['capabilities']) && is_array($role['capabilities']) ){ //Being defensive here
				//We use the "+" operator instead of array_merge() to combine arrays because we don't want
				//integer keys to be renumbered. Technically, capabilities should be strings and not integers,
				//but in practice some plugins do create integer capabilities.
				$capabilities = $capabilities + $role['capabilities'];
			}
		}
		$regular_cache = $capabilities;

		//Add multisite-specific capabilities (not listed in any roles in WP 3.0)
		if ($include_multisite_caps) {
			$multisite_caps = array(
				'manage_sites' => 1,
				'manage_network' => 1,
				'manage_network_users' => 1,
				'manage_network_themes' => 1,
				'manage_network_options' => 1,
				'manage_network_plugins' => 1,
			);
			$capabilities = $capabilities + $multisite_caps;
			$multisite_cache = $capabilities;
		}

		return $capabilities;
	}

	 /**
	  * Retrieve a list of all known roles and their names.
	  *
	  * @return array Associative array with role IDs as keys and role display names as values
	  */
	public static function get_role_names(){
		$wp_roles = self::get_roles();
		$roles = array();

		foreach($wp_roles->roles as $role_id => $role){
			$roles[$role_id] = $role['name'];
		}

		return $roles;
	}

	/**
	 * Get the global WP_Roles instance.
	 *
	 * @global WP_Roles $wp_roles
	 * @return WP_Roles
	 */
	public static function get_roles() {
		global $wp_roles;
		if ( !isset($wp_roles) ) {
			$wp_roles = new WP_Roles();
		}
		return $wp_roles;
	}
}