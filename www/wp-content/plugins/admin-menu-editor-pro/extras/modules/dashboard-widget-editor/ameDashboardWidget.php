<?php

/**
 * Dashboard widget.
 */
abstract class ameDashboardWidget {
	/**
	 * @var string ID. Must be a unique, non-empty string.
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
	 * @var string Dashboard column. One of the following: 'normal', 'side', 'column3', 'column4'.
	 * @see wp_dashboard
	 */
	protected $location;

	/**
	 * @var string Relative position in the column. One of the following: 'high', 'sorted', 'core', 'default', 'low'.
	 * @see do_meta_boxes
	 */
	protected $priority;

	/**
	 * @var bool[] Role and user permissions. Format: [actorID => boolean].
	 */
	protected $grantAccess;

	/**
	 * @var string|null
	 */
	protected $widgetType = null;

	protected function __construct(array $properties) {
		$this->id = $properties['id'];

		$properties = array_merge(
			array(
				'title' => '',
				'location' => 'normal',
				'priority' => 'core',
				'callback' => null,
				'callbackArgs' => null,
			),
			$properties
		);

		$this->setProperties($properties);
	}

	public function toArray() {
		return array(
			'id' => $this->id,
			'title' => $this->title,
			'location' => $this->location,
			'priority' => $this->priority,
			'isPresent' => $this->isPresent(),
			'grantAccess' => $this->grantAccess,

			'widgetType' => $this->widgetType,
		);
	}

	public static function fromArray($widgetProperties) {
		$widgetType = isset($widgetProperties['widgetType']) ? strval($widgetProperties['widgetType']) : null;
		if ( isset($widgetProperties['wrappedWidget']) ) {
			return ameStandardWidgetWrapper::fromArray($widgetProperties);
		} else if ( $widgetType === 'custom-html' ) {
			return ameCustomHtmlWidget::fromArray($widgetProperties);
		} else if ( $widgetType === 'custom-rss' ) {
			return ameCustomRssWidget::fromArray($widgetProperties);
		} else {
			throw new RuntimeException('Unsupported dashboard widget type "' . $widgetType . '"');
		}
	}

	protected function setProperties(array $properties) {
		$this->title = $properties['title'];
		$this->location = $properties['location'];
		$this->priority = $properties['priority'];
		$this->callback = isset($properties['callback']) ? $properties['callback'] : null;
		$this->callbackArgs = isset($properties['callbackArgs']) ? $properties['callbackArgs'] : null;
		$this->grantAccess = isset($properties['grantAccess']) ? $properties['grantAccess'] : array();
	}

	/*
	 * Basic getters
	 */

	public function getId() {
		return $this->id;
	}

	public function getTitle() {
		return $this->title;
	}

	public function getLocation() {
		return $this->location;
	}

	public function getPriority() {
		return $this->priority;
	}

	public function getCallback() {
		return $this->callback;
	}

	public function isPresent() {
		return true;
	}

	public function canBeRegistered() {
		return true;
	}

	/**
	 * Is the specified user allowed to see/access this widget?
	 *
	 * @param WP_User $user
	 * @param WPMenuEditor $menuEditor
	 * @return bool
	 */
	public function isVisibleTo($user, $menuEditor = null) {
		return self::userCanAccess($user, $this->grantAccess, $menuEditor);
	}

	/**
	 * @param WP_User $user
	 * @param array $grantAccess
	 * @param WPMenuEditor|null $menuEditor
	 * @return bool
	 */
	public static function userCanAccess($user, $grantAccess, $menuEditor = null) {
		//By default, any user can see any widget.
		if ( empty($user) ) {
			return true;
		}

		$userActor = 'user:' . $user->user_login;
		if ( isset($grantAccess[$userActor]) ) {
			return $grantAccess[$userActor];
		}

		if ( is_multisite() && is_super_admin($user->ID) ) {
			//Super Admin can access everything unless explicitly denied.
			if ( isset($grantAccess['special:super_admin']) ) {
				return $grantAccess['special:super_admin'];
			}
			return true;
		}

		if ( !$menuEditor ) {
			$menuEditor = $GLOBALS['wp_menu_editor'];
		}

		//Allow access if at least one role has access.
		$roles = $menuEditor->get_user_roles($user);
		$hasAccess = null;
		foreach ($roles as $roleId) {
			if ( isset($grantAccess['role:' . $roleId]) ) {
				$roleHasAccess = $grantAccess['role:' . $roleId];
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
	 * Register this widget with WordPress.
	 */
	public function addToDashboard() {
		add_meta_box(
			$this->getId(),
			$this->getTitle(),
			$this->getCallback(),
			'dashboard',
			$this->getLocation(),
			$this->getPriority(),
			$this->callbackArgs
		);
	}
}
