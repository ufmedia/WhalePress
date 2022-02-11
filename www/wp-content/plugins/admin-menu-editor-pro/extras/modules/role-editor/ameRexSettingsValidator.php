<?php

/**
 * This class takes settings submitted by the user, validates them, and separates
 * them into individual components (e.g. created roles, etc) for easy access.
 */
class ameRexSettingsValidator {
	private $inputData = '';
	private $errors = array();

	private $preExistingCapabilities = array();
	private $preExistingUserDefinedCaps = array();
	private $oldEditableRoleSettings;

	/**
	 * @var WPMenuEditor
	 */
	private $menuEditor;

	private $userDefinedCaps = null;
	private $modifiedUserDefinedCapCount = 0;

	private $rolesToDelete = array();
	private $rolesToCreate = array();
	private $rolesToModify = array();
	private $usersToModify = array();
	private $knownRoleIDs = array();
	private $existingUsers;

	private $editableRoleSettings;
	private $areEditableRolesModified = false;

	/**
	 * @var array List of currently editable roles. Not to be confused with editable role *settings* that control
	 * which roles will appear on this list.
	 */
	private $effectiveEditableRoles;

	/**
	 * @param string $jsonString Settings submitted by the user.
	 * @param array $allCapabilities Capabilities that exist now, before the submitted settings are applied.
	 * @param array $userDefinedCaps
	 * @param array $oldEditableRoleSettings
	 * @param array $effectiveEditableRoles
	 * @param WPMenuEditor $menuEditor
	 */
	public function __construct(
		$jsonString, $allCapabilities, $userDefinedCaps, $oldEditableRoleSettings,
		$effectiveEditableRoles, $menuEditor
	) {
		$this->inputData = $jsonString;
		$this->preExistingCapabilities = $allCapabilities;
		$this->preExistingUserDefinedCaps = $userDefinedCaps;
		$this->oldEditableRoleSettings = $oldEditableRoleSettings;
		$this->effectiveEditableRoles = $effectiveEditableRoles;
		$this->menuEditor = $menuEditor;
	}

	public function validate() {
		$this->errors = array();
		$data = json_decode($this->inputData, true);

		if ($data === null) {
			$this->errors[] = new WP_Error(
				'ame_rex_invalid_json',
				'JSON parsing failed. Submitted settings are probably invalid or corrupted.'
			);
			return $this->errors;
		}

		if (!is_array($data)) {
			$this->errors[] = new WP_Error(
				'ame_rex_unexpected_data_type',
				sprintf('JSON parsing failed. Expected type: associative array, actual type: %s.', gettype($data))
			);
			return $this->errors;
		}

		$submittedRoles = array();
		foreach ($data['roles'] as $tempRole) {
			$submittedRoles[$tempRole['name']] = $tempRole;
		}

		$wpRoles = ameRoleUtils::get_roles();;
		$existingRoles = (isset($wpRoles->roles) && is_array($wpRoles->roles)) ? $wpRoles->roles : array();

		$knownRoleIDs = array_fill_keys(
			array_merge(array_keys($existingRoles), array_keys($submittedRoles)),
			true
		);

		$editableRoles = $this->effectiveEditableRoles;

		//For validation purposes, we also need existing capabilities.
		$existingCapabilities = $this->preExistingCapabilities;

		//Remove all roles that don't exist in the role list.
		$rolesToDelete = array_diff_key($editableRoles, $submittedRoles);
		//Don't delete the default role. The user should set a different default role first.
		$defaultRole = get_option('default_role');
		if (isset($rolesToDelete[$defaultRole])) {
			unset($rolesToDelete[$defaultRole]);
			$this->errors[] = new WP_Error(
				'ame_rex_cannot_delete_default_role',
				'You cannot delete the default role. Set a different default role first.'
			);
		}
		//Don't delete roles that are currently assigned to one or more users. This check may be slow.
		if (count($rolesToDelete) > 0) {
			$usersByRole = count_users();
			if (isset($usersByRole['avail_roles'])) {
				foreach ($usersByRole['avail_roles'] as $id => $totalUsers) {
					if (($totalUsers > 0) && isset($rolesToDelete[$id])) {
						unset($rolesToDelete[$id]);
						$this->errors[] = new WP_Error(
							'ame_rex_deleted_role_has_users',
							sprintf(
								'Role "%s" cannot be deleted because there are still %d users with that role.',
								$id,
								$totalUsers
							)
						);
					}
				}
			}
		}

		$rolesToCreate = array();
		$rolesToModify = array();

		//Validate all new or modified properties.
		foreach ($submittedRoles as $id => $role) {
			$isNewRole = !isset($existingRoles[$id]);
			$isModifiedRole = false;

			//Only modify existing roles if they're editable.
			if (!$isNewRole && (!isset($editableRoles[$id]) || !isset($wpRoles->role_objects[$id]))) {
				$this->errors[] = new WP_Error(
					'ame_rex_role_not_editable',
					sprintf('You don\'t have permission to edit role "%s"', $id)
				);
				continue;
			}

			//Validate the role ID (internal name).
			if ($isNewRole) {
				$state = $this->validateRoleName($id, $existingRoles, $existingCapabilities);
				if (is_wp_error($state)) {
					$this->errors[] = $state;
					continue;
				}
			}

			//Validate the display name.
			if ($isNewRole || ($editableRoles[$id]['name'] !== $role['displayName'])) {
				$state = $this->validateRoleDisplayName($role['displayName']);
				if (is_wp_error($state)) {
					$this->errors[] = $state;
					continue;
				}
				$isModifiedRole = $isModifiedRole || !$isNewRole;
			}

			//Validate capabilities.
			$capErrors = $this->validateCapabilityAssignment(
				$role['capabilities'],
				$existingCapabilities,
				$knownRoleIDs
			);
			if (!empty($capErrors)) {
				$this->errors = array_merge($this->errors, $capErrors);
				continue;
			}

			if (!$isNewRole) {
				//Have any of the capabilities changed?
				$oldCaps = $this->menuEditor->castValuesToBool($wpRoles->roles[$id]['capabilities']);
				if (!$this->areAssocArraysEqual($oldCaps, $role['capabilities'])) {
					$isModifiedRole = true;
				}
			}

			//Everything looks valid.
			if ($isNewRole) {
				$rolesToCreate[$id] = $role;
			} else if ($isModifiedRole) {
				$rolesToModify[$id] = $role;
			}
		}

		//TODO: Existing roles might have to include newly added roles.

		//Validate user settings.
		//-----------------------

		$submittedUsers = ameUtils::get($data, 'users', array());
		if (!is_array($submittedUsers)) {
			$submittedUsers = array();
		}
		$existingUsers = array();
		$usersToModify = array();
		foreach ($submittedUsers as $modifiedUser) {
			//Skip malformed user records that are missing required fields.
			if (!isset($modifiedUser, $modifiedUser['userId'], $modifiedUser['capabilities'], $modifiedUser['roles'])) {
				continue;
			}
			$userId = intval(ameUtils::get($modifiedUser, 'userId', 0));

			//User must exist.
			$user = get_user_by('id', $userId);
			if (empty($user) || !$user->exists()) {
				continue;
			}

			$previousRoles = array();
			if (isset($user->roles) && is_array($user->roles)) {
				$previousRoles = array_values($user->roles);
			}
			$previousCapsWithoutRoles = array_diff_key(
				(isset($user->caps) && is_array($user->caps)) ? $user->caps : array(),
				array_fill_keys($previousRoles, true)
			);

			//TODO: Allow adding newly created roles if they are editable. Tricky. Might be better to disable that option in the editor.
			//Validate roles.
			list($newRoles, $roleErrors) = $this->validateUserRoleChange(
				$previousRoles,
				$modifiedUser['roles'],
				$editableRoles
			);
			$modifiedUser['roles'] = $newRoles;

			//Validate capabilities.
			$newCapsWithoutRoles = array_diff_key(
				$modifiedUser['capabilities'],
				$knownRoleIDs,
				array_fill_keys($newRoles, true)
			);
			$capErrors = $this->validateCapabilityAssignment(
				$newCapsWithoutRoles,
				$existingCapabilities,
				$knownRoleIDs
			);
			$modifiedUser['capabilities'] = $newCapsWithoutRoles;

			//Have any of the roles or capabilities actually changed?
			$isModifiedUser = false;
			$oldCaps = $this->menuEditor->castValuesToBool($previousCapsWithoutRoles);
			if (!$this->areAssocArraysEqual($oldCaps, $newCapsWithoutRoles)) {
				$isModifiedUser = true;
			}
			//Note: The order of roles is significant.
			if (!$this->areAssocArraysEqual($previousRoles, $newRoles)) {
				$isModifiedUser = true;
			}

			//Don't check permissions if the user hasn't actually made any changes.
			if (!$isModifiedUser) {
				continue;
			}

			//The current user must have permission to edit this user.
			if (!current_user_can('edit_user', $userId)) {
				$this->errors[] = new WP_Error(
					'ame_uneditable_user',
					sprintf('You don\'t have sufficient permissions to edit the user with ID #%d.', $userId)
				);
				continue;
			}

			//Now validation errors actually matter.
			if (!empty($capErrors)) {
				$this->errors = array_merge($this->errors, $capErrors);
				continue;
			}
			if (!empty($roleErrors)) {
				$this->errors = array_merge($this->errors, $roleErrors);
				continue;
			}

			if ($isModifiedUser) {
				$usersToModify[$userId] = $modifiedUser;
				$existingUsers[$userId] = $user;
			}
		}

		//Now that we know what roles exist, we can validate and save user-defined capabilities.
		$this->userDefinedCaps = null;
		if (isset($data['userDefinedCaps']) && is_array($data['userDefinedCaps'])) {
			$validCaps = array();
			foreach ($data['userDefinedCaps'] as $capability) {
				$status = $this->validateCapabilityName($capability, $knownRoleIDs);
				if (!is_wp_error($status)) {
					$validCaps[$capability] = true;
				}
			}
			$this->userDefinedCaps = $validCaps;

			$addedCaps = array_diff_key($this->userDefinedCaps, $this->preExistingUserDefinedCaps);
			$deletedCaps = array_diff_key($this->preExistingUserDefinedCaps, $this->userDefinedCaps);
			$this->modifiedUserDefinedCapCount = count($addedCaps) + count($deletedCaps);
		}

		//Validate "editable roles" settings.
		$submittedEditableRoles = ameUtils::get($data, 'editableRoles', array());
		if (!is_array($submittedEditableRoles)) {
			$submittedEditableRoles = array();
		}
		$allowedStrategies = array('auto', 'none', 'user-defined-list');
		$newEditableRoles = array();
		foreach($submittedEditableRoles as $actorId => $settings) {
			if (!$this->userCanEditActor($actorId, $editableRoles)) {
				if (isset($this->oldEditableRoleSettings[$actorId])) {
					$newEditableRoles[$actorId] = $this->oldEditableRoleSettings[$actorId];
				}
				continue;
			}

			//Validate the strategy.
			if (!isset($settings['strategy']) || !in_array($settings['strategy'], $allowedStrategies)) {
				$settings['strategy'] = 'auto';
			}
			//The user-defined role list, if any, must be in the form of [roleId => true].
			if ($settings['strategy'] === 'user-defined-list') {
				$sanitizedList = array();
				if (is_array($settings['userDefinedList'])) {
					foreach(array_keys($settings['userDefinedList']) as $roleId) {
						$sanitizedList[strval($roleId)] = true;
					}
				}
				$settings['userDefinedList'] = $sanitizedList;
			} else {
				$settings['userDefinedList'] = null;
			}

			//"auto" is the default so we don't need to store it.
			if ($settings['strategy'] === 'auto') {
				$settings = null;
			}

			$newEditableRoles[$actorId] = $settings;
		}
		//Restore removed settings if the user doesn't have permission to edit them.
		$removedSettings = array_diff_key($this->oldEditableRoleSettings, $submittedEditableRoles);
		foreach($removedSettings as $actorId => $settings) {
			if (!$this->userCanEditActor($actorId, $editableRoles) && isset($this->oldEditableRoleSettings[$actorId]) ) {
				$newEditableRoles[$actorId] = $this->oldEditableRoleSettings[$actorId];
			}
		}
		//Check if we have actually made any changes.
		if (!$this->areAssocArraysRecursivelyEqual($newEditableRoles, $this->oldEditableRoleSettings)) {
			$this->areEditableRolesModified = true;
		}

		$this->rolesToModify = $rolesToModify;
		$this->rolesToCreate = $rolesToCreate;
		$this->rolesToDelete = $rolesToDelete;
		$this->usersToModify = $usersToModify;
		$this->knownRoleIDs = $knownRoleIDs;
		$this->existingUsers = $existingUsers;
		$this->editableRoleSettings = $newEditableRoles;

		return $this->errors;
	}

	/**
	 * @param string $name
	 * @param array $roles
	 * @param array $capabilities
	 * @return bool|WP_Error
	 */
	private function validateRoleName($name, $roles = array(), $capabilities = array()) {
		$name = trim($name);

		if ($name === '') {
			return new WP_Error('ame_empty_role_name', 'Role name cannot be empty.');
		}

		//Name can only contain certain characters.
		if (preg_match('/[^a-z0-9_]/', $name)) {
			return new WP_Error(
				'ame_invalid_characters_in_name',
				'Role name contains invalid characters. Please use only lowercase English letters, numbers, and underscores.'
			);
		}

		//Numeric names could cause problems with how PHP handles associative arrays.
		if (is_numeric($name)) {
			return new WP_Error('ame_numeric_role_name', 'Numeric role names are not allowed.');
		}

		//Name must not be a duplicate.
		if (array_key_exists($name, $roles)) {
			return new WP_Error('ame_duplicate_role', 'Duplicate role name.');
		}

		//WP stores capabilities and role names in the same associative array,
		//so they must be unique with respect to each other.
		if (array_key_exists($name, $capabilities)) {
			return new WP_Error('ame_role_matches_capability', 'Role name can\'t be the same as a capability name.');
		}

		return true;
	}

	/**
	 * @param string $displayName
	 * @return bool|WP_Error
	 */
	private function validateRoleDisplayName($displayName) {
		$displayName = trim($displayName);

		if ($displayName === '') {
			return new WP_Error('ame_empty_role_display_name', 'Role display name cannot be empty.');
		}

		if (preg_match('/[><&\r\n\t]/', $displayName)) {
			return new WP_Error('ame_invalid_display_name_chars', 'Role display name contains invalid characters.');
		}

		return true;
	}

	/**
	 * @param string $capability
	 * @param string[] $roles
	 * @return bool|WP_Error
	 */
	private function validateCapabilityName($capability, $roles = array()) {
		if ($capability === '') {
			return new WP_Error('ame_empty_cap', 'Capability name must not be an empty string.');
		}

		//WP API allows completely arbitrary capability names, but this plugin forbids some characters
		//for sanity's sake and to avoid XSS.
		static $invalidCharacters = '/[><&\r\n\t]/';
		if (preg_match($invalidCharacters, $capability)) {
			return new WP_Error('ame_invalid_cap_characters', 'Capability name contains invalid characters.');
		}

		//PHP doesn't allow numeric string keys, and there's no conceivable reason to start the name with a space.
		static $invalidFirstCharacter = '/^[\s0-9]/i';
		if (preg_match($invalidFirstCharacter, $capability)) {
			return new WP_Error('ame_invalid_cap_start', 'Capability name cannot start with a number or a space.');
		}

		//Roles and caps are stored in the same array, so they must be mutually unique.
		if (array_key_exists($capability, $roles)) {
			return new WP_Error(
				'ame_cap_equals_role',
				sprintf('Capability name "%s" cannot be the same as the name of a role.', $capability)
			);
		}

		//Some capabilities are special and should never be directly assigned to roles.
		static $excludedCaps = array('do_not_allow', 'exist', 'customize');
		if (in_array($capability, $excludedCaps)) {
			return new WP_Error(
				'ame_create_reserved_cap',
				'Cannot create a capability that matches a meta capability or a reserved capability.'
			);
		}

		return true;
	}

	private function validateCapabilityAssignment($capabilities, $existingCapabilities, $roles = array()) {
		//Preexisting capabilities can be granted even if they don't meet our validation requirements.
		$newCaps = array_diff_key($capabilities, $existingCapabilities);
		$errors = array();
		foreach ($newCaps as $capability => $isGranted) {
			$validationState = $this->validateCapabilityName($capability, $roles);
			if (is_wp_error($validationState)) {
				$errors[] = $validationState;
			}
		}
		return $errors;
	}

	/**
	 * Verify that the current user has permission to change a user's roles from $oldRoles to $newRoles.
	 *
	 * Returns the roles that the selected user should have after the change. Any invalid changes - like adding
	 * or removing non-editable roles - will be undone.
	 *
	 * For example, lets say that the selected user has these roles:
	 *    $oldRoles = ['administrator', 'foo', 'bar']
	 *
	 * Then the current user tries to change their roles to this:
	 *    $newRoles = ['foo', 'author', 'qux']
	 *
	 * Lets assume that the current user can edit all roles except "administrator", "foo" and "qux".
	 * Here's what the function will return:
	 *    ['administrator', 'foo', 'author']
	 *
	 * Here's what it does:
	 * - Prevent the attempt to remove a non-editable role ('administrator').
	 * - Prevent the attempt to add a non-editable role ('qux').
	 * - Keep 'administrator' as the primary role because it's not editable.
	 * - Let the user add or remove any roles that they can edit ('author', 'bar').
	 * - let the user include roles that they can't edit if the subject already had them ('foo').
	 *
	 * @param array $oldRoles Current role IDs.   Example: array('administrator', 'foo', 'bar').
	 * @param array $newRoles New role IDs.       Example: array('foo', 'author', 'qux').
	 * @param array|null $editableRoles
	 * @return array [validated-new-roles, errors]
	 */
	private function validateUserRoleChange($oldRoles, $newRoles, $editableRoles = null) {
		if ($editableRoles === null) {
			$editableRoles = get_editable_roles();
			if (!is_array($editableRoles)) {
				$editableRoles = array();
			}
		}
		$errors = array();

		if (!is_array($newRoles)) {
			return array($oldRoles, array(new WP_Error('ame_rex_invalid_argument', 'Role list must be an array.')));
		}

		$newPrimaryRole = reset($newRoles);

		//NB: It is NOT an error to select a new primary role when the old one is not editable.
		//WordPress UI simply doesn't give the option to leave the role unchanged. We shouldn't penalize users for that.
		$oldPrimaryRole = reset($oldRoles);
		if (is_string($oldPrimaryRole) && ($oldPrimaryRole !== '') && !isset($editableRoles[$oldPrimaryRole])) {
			//Keep the existing primary role. Treat the new one as a normal "other" role.
			$newPrimaryRole = $oldPrimaryRole;
			array_unshift($newRoles, $oldPrimaryRole); //This might duplicate the role. We'll remove duplicates later.
		}

		//It's always valid to keep the same roles, even if the current user can't edit them.
		$validNewRoles = array_intersect($newRoles, $oldRoles);

		//Does the current user have permission to add/remove these roles?
		$changedRoles = array_merge(
			array_fill_keys(array_diff($newRoles, $oldRoles), 'add'),
			array_fill_keys(array_diff($oldRoles, $newRoles), 'remove')
		);
		$errorMessages = array(
			'add'    => 'You cannot give users the "%s" role.',
			'remove' => 'You cannot remove the "%s" role from users.',
		);

		foreach ($changedRoles as $roleId => $action) {
			$isAllowed = isset($editableRoles[$roleId]);

			if (($isAllowed && ($action === 'add')) || (!$isAllowed && ($action === 'remove'))) {
				$validNewRoles[] = $roleId;
			}

			if (!$isAllowed && isset($errors)) {
				$errors[] = new WP_Error(
					sprintf('ame_rex_cannot_%1$s_role_%2$s', $action, $roleId),
					sprintf($errorMessages[$action], htmlentities($roleId))
				);
			}
		}

		//Move the primary role to the start of the array.
		$primaryRoleIndex = array_search($newPrimaryRole, $validNewRoles, true);
		if ($newPrimaryRole && ($primaryRoleIndex > 0)) {
			unset($validNewRoles[$primaryRoleIndex]);
			array_unshift($validNewRoles, $newPrimaryRole);
		}

		//Deduplicate roles. array_unique() sorts the array but preserves keys, so we can use ksort() to restore order.
		$validNewRoles = array_unique($validNewRoles, SORT_STRING); //Requires PHP >= 5.2.9
		ksort($validNewRoles);

		return array(array_values($validNewRoles), $errors);
	}

	/**
	 * Check if the currently logged-in user can edit the settings of a specific actor.
	 *
	 * @param string $actorId
	 * @param array $currentEditableRoles
	 * @return bool
	 */
	private function userCanEditActor($actorId, $currentEditableRoles) {
		if ($actorId === 'special:super_admin') {
			return is_super_admin();
		}

		list($type, $name) = explode(':', $actorId, 2);
		if ($type === 'user') {
			$victim = get_user_by('login', $name);
			if ($victim) {
				return current_user_can('edit_user', $victim->ID);
			}
			return current_user_can('edit_users');
		}

		if ($type === 'role') {
			return isset($currentEditableRoles[$name]);
		}

		return false;
	}

	/**
	 * Check if two arrays have the same keys and values. Arrays with string keys
	 * or mixed keys can be in different order and still be considered "equal".
	 *
	 * @param array $a
	 * @param array $b
	 * @return bool
	 */
	private function areAssocArraysEqual($a, $b) {
		if (count($a) !== count($b)) {
			return false;
		}
		$sameItems = array_intersect_assoc($a, $b);
		return count($sameItems) === count($b);
	}

	/**
	 * Like areAssocArraysEqual(), but also compares nested arrays.
	 *
	 * @param array $a
	 * @param array $b
	 * @return bool
	 */
	private function areAssocArraysRecursivelyEqual($a, $b) {
		if (count($a) !== count($b)) {
			return false;
		}
		$sameKeys = array_intersect_key($a, $b);
		if (count($sameKeys) !== count($a)) {
			return false;
		}
		foreach($sameKeys as $key => $valueA) {
			$valueB = $b[$key];
			if ($valueA !== $valueB) {
				if (is_array($valueA) && is_array($valueB)) {
					if (!$this->areAssocArraysRecursivelyEqual($valueA, $valueB)) {
						return false;
					}
				} else {
					return false;
				}
			}
		}
		return true;
	}

	public function getUserDefinedCaps() {
		return $this->userDefinedCaps;
	}

	public function getTotalChangeCount() {
		//TODO: Maybe count each modified capability as a separate change.
		return count($this->rolesToDelete) + count($this->rolesToCreate)
			+ count($this->rolesToModify) + count($this->usersToModify)
			+ $this->modifiedUserDefinedCapCount + ($this->areEditableRolesModified ? 1 : 0);
	}

	public function getRolesToDelete() {
		return $this->rolesToDelete;
	}

	public function getRolesToModify() {
		return $this->rolesToModify;
	}

	public function getRolesToCreate() {
		return $this->rolesToCreate;
	}

	public function getUsersToModify() {
		return $this->usersToModify;
	}

	public function getNewEditableRoleSettings() {
		return $this->editableRoleSettings;
	}

	/**
	 * @param $userId
	 * @return WP_User
	 */
	public function getExistingUser($userId) {
		return $this->existingUsers[$userId];
	}
}