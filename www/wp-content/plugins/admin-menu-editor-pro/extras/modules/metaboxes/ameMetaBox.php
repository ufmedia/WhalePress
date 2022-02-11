<?php

class ameMetaBox {
	/**
	 * @var string ID. Must be a unique, non-empty string.
	 *
	 * Actually, can have the same ID on different pages with different titles and even callbacks,
	 * but only one id per page. Per add_meta_box, one Id can be in only one context and one priority.
	 */
	protected $id;

	/**
	 * @var string Title.
	 */
	protected $title;

	/**
	 * @var callable
	 */
	protected $callback;

	/**
	 * @var null|mixed
	 */
	protected $callbackArgs;

	/**
	 * @var string The context within the screen where the box will display. Varies from screen to screen.
	 */
	protected $context;

	/**
	 * @var bool[] Role and user permissions. Format: [actorID => boolean].
	 */
	protected $grantAccess = array();

	/**
	 * @var bool[] Default visibility for roles and users. Format: [actorID => boolean].
	 *
	 * Can use the filter default_hidden_meta_boxes in screen.php.
	 */
	protected $visibleByDefault = array();

	/**
	 * @var bool Whether this box is on the default list of hidden meta boxes.
	 */
	protected $isHiddenByDefault = false;

	public function __construct($properties) {
		$this->id = strval($properties['id']);

		$properties = array_merge(
			array(
				'title' => '',
				'context' => 'normal',
				'callback' => null,
				'callbackArgs' => null,
			),
			$properties
		);

		$this->setProperties($properties);
	}

	/**
	 * Is the specified user allowed to access this meta box?
	 *
	 * @param WP_User $user
	 * @param WPMenuEditor $menuEditor
	 * @return bool
	 */
	public function isAvailableTo($user, $menuEditor = null) {
		//By default, any user can see any meta box.
		if ( empty($user) ) {
			return true;
		}

		$userActor = 'user:' . $user->user_login;
		if ( isset($this->grantAccess[$userActor]) ) {
			return $this->grantAccess[$userActor];
		}

		if ( is_multisite() && is_super_admin($user->ID) ) {
			//Super Admin can access everything unless explicitly denied.
			if ( isset($this->grantAccess['special:super_admin']) ) {
				return $this->grantAccess['special:super_admin'];
			}
			return true;
		}

		if (!$menuEditor) {
			$menuEditor = $GLOBALS['wp_menu_editor'];
		}

		//Allow access if at least one role has access.
		$roles = $menuEditor->get_user_roles($user);
		$hasAccess = null;
		foreach ($roles as $roleId) {
			if ( isset($this->grantAccess['role:' . $roleId]) ) {
				$roleHasAccess = $this->grantAccess['role:' . $roleId];
				if ( is_null($hasAccess) ){
					$hasAccess = $roleHasAccess;
				} else {
					$hasAccess = $hasAccess || $roleHasAccess;
				}
			} else {
				//By default, all roles have access.
				$hasAccess = true;
			}
		}

		if ( $hasAccess !== null ) {
			return $hasAccess;
		}
		return true;
	}

	/**
	 * Is the meta box enabled by default for this user?
	 *
	 * @param WP_User $user
	 * @param WPMenuEditor $menuEditor
	 * @return bool|null
	 */
	public function isVisibleByDefaultFor($user, $menuEditor) {
		$initialSetting = !$this->isHiddenByDefault;
		if ( !$user || !$user->exists() ) {
			return $initialSetting;
		}

		//User-specific settings take precedence over everything else.
		$userActor = 'user:' . $user->user_login;
		if ( isset($this->visibleByDefault[$userActor]) ) {
			return $this->visibleByDefault[$userActor];
		}

		if ( is_multisite() && is_super_admin($user->ID) ) {
			//Super Admin can priority over normal roles.
			if ( isset($this->grantAccess['special:super_admin']) ) {
				return $this->grantAccess['special:super_admin'];
			}
		}

		if (!$menuEditor) {
			$menuEditor = $GLOBALS['wp_menu_editor'];
		}

		//Allow access if at least one role has access.
		$roles = $menuEditor->get_user_roles($user);
		$hasAccess = null;
		foreach ($roles as $roleId) {
			if ( isset($this->visibleByDefault['role:' . $roleId]) ) {
				$roleHasAccess = $this->visibleByDefault['role:' . $roleId];
				if ( is_null($hasAccess) ){
					$hasAccess = $roleHasAccess;
				} else {
					$hasAccess = $hasAccess || $roleHasAccess;
				}
			} else {
				//Use the default setting for this role.
				$hasAccess = $initialSetting;
			}
		}

		if ( $hasAccess !== null ) {
			return $hasAccess;
		}
		return $initialSetting;
	}

	public function toArray() {
		return array(
			'id' => $this->id,
			'title' => $this->title,
			'context' => $this->context,
			'isPresent' => $this->isPresent(),
			'grantAccess' => $this->grantAccess,
			'defaultVisibility' => $this->visibleByDefault,
			'isHiddenByDefault' => $this->isHiddenByDefault,
			'className' => get_class($this),
		);
	}

	public static function fromArray($widgetProperties) {
		if ( !empty($widgetProperties['className']) ) {
			$className = $widgetProperties['className'];
			return new $className($widgetProperties);
		}
		return new static($widgetProperties);
	}

	protected function setProperties(array $properties) {
		//Always overwritten.
		$this->title = strval($properties['title']);
		$this->callback = ameUtils::get($properties, 'callback');
		$this->callbackArgs = ameUtils::get($properties, 'callbackArgs');
		$this->context = ameUtils::get($properties, 'context', 'normal');

		//Usually only written upon deserialization.
		$this->grantAccess = ameUtils::get($properties, 'grantAccess', $this->grantAccess);
		$this->visibleByDefault = ameUtils::get($properties, 'defaultVisibility', $this->visibleByDefault);
		$this->isHiddenByDefault = ameUtils::get($properties, 'isHiddenByDefault', $this->isHiddenByDefault);
	}

	/*
	 * Basic getters & setters
	 */

	public function getId() {
		return $this->id;
	}

	public function getTitle() {
		return $this->title;
	}

	public function getContext() {
		return $this->context;
	}

	public function getCallback() {
		return $this->callback;
	}

	public function getHiddenByDefault() {
		return $this->isHiddenByDefault;
	}

	public function setHiddenByDefault($isHidden) {
		$isChanged = ($this->isHiddenByDefault xor $isHidden);
		$this->isHiddenByDefault = $isHidden;
		return $isChanged;
	}

	/**
	 * Is the meta box present on the current site?
	 *
	 * @return bool
	 */
	public function isPresent() {
		return true;
	}
}