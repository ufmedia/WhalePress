<?php

/*
 * Idea: Show tweaks as options in menu properties, e.g. in a "Tweaks" section styled like the collapsible
 * property sheets in Delphi.
 */

require_once __DIR__ . '/configurables.php';
require_once __DIR__ . '/ameBaseTweak.php';
require_once __DIR__ . '/ameHideSelectorTweak.php';
require_once __DIR__ . '/ameHideSidebarTweak.php';
require_once __DIR__ . '/ameHideSidebarWidgetTweak.php';
require_once __DIR__ . '/ameDelegatedTweak.php';
require_once __DIR__ . '/ameTinyMceButtonManager.php';
require_once __DIR__ . '/ameAdminCssTweakManager.php';
require_once __DIR__ . '/ameGutenbergBlockManager.php';

/** @noinspection PhpUnused The class is actually used in extras.php */

//TODO: When importing tweak settings, pick the largest of lastUserTweakSuffix. See mergeSettingsWith().

class ameTweakManager extends amePersistentModule {
	const APPLY_TWEAK_AUTO = 'auto';
	const APPLY_TWEAK_MANUALLY = 'manual';

	protected $tabSlug = 'tweaks';
	protected $tabTitle = 'Tweaks';
	protected $optionName = 'ws_ame_tweak_settings';

	protected $settingsFormAction = 'ame-save-tweak-settings';

	/**
	 * @var ameBaseTweak[]
	 */
	private $tweaks = array();

	/**
	 * @var ameBaseTweak[]
	 */
	private $pendingTweaks = array();

	/**
	 * @var ameBaseTweak[]
	 */
	private $postponedTweaks = array();

	/**
	 * @var ameTweakSection[]
	 */
	private $sections = array();

	private $editorButtonManager;
	private $adminCssManager;
	private $gutenbergBlockManager;

	/**
	 * @var null|array
	 */
	private $cachedEnabledTweakSettings = null;

	/**
	 * @var callable[]
	 */
	private $tweakBuilders = array();

	public function __construct($menuEditor) {
		parent::__construct($menuEditor);

		add_action('init', array($this, 'onInit'), PHP_INT_MAX - 1000);

		//We need to process widgets after they've been registered (usually priority 10)
		//but before WordPress has populated the $wp_registered_widgets global (priority 95 or 100).
		add_action('widgets_init', array($this, 'processSidebarWidgets'), 50);
		//Sidebars are simpler: we can just use a really late priority.
		add_action('widgets_init', array($this, 'processSidebars'), 1000);

		$this->editorButtonManager = new ameTinyMceButtonManager();
		$this->adminCssManager = new ameAdminCssTweakManager();
		$this->gutenbergBlockManager = new ameGutenbergBlockManager($menuEditor);

		$this->tweakBuilders['admin-css'] = array($this->adminCssManager, 'createTweak');
	}

	public function onInit() {
		$this->addSection('general', 'General');
		$this->registerTweaks();

		$tweaksToProcess = $this->pendingTweaks;
		$this->pendingTweaks = array();
		$this->processTweaks($tweaksToProcess);
	}

	private function registerTweaks() {
		//We may be able to improve performance by only registering tweaks that are enabled
		//for the current user. However, we still need to show all tweaks in the "Tweaks" tab.
		$isTweaksTab = is_admin()
			&& isset($_GET['page'], $_GET['sub_section'])
			&& ($_GET['page'] === 'menu_editor')
			&& ($_GET['sub_section'] === $this->tabSlug);
		if ( $isTweaksTab ) {
			$tweakFilter = null;
		} else {
			$tweakFilter = $this->getEnabledTweakSettings();
		}

		$tweakData = require(__DIR__ . '/default-tweaks.php');

		foreach (ameUtils::get($tweakData, 'sections', array()) as $id => $section) {
			$this->addSection($id, ameUtils::get($section, 'label', $id), ameUtils::get($section, 'priority', 10));
		}

		$defaultTweaks = ameUtils::get($tweakData, 'tweaks', array());
		if ( $tweakFilter !== null ) {
			$defaultTweaks = array_intersect_key($defaultTweaks, $tweakFilter);
		}

		foreach ($defaultTweaks as $id => $properties) {
			if ( isset($properties['selector']) ) {
				$tweak = new ameHideSelectorTweak(
					$id,
					isset($properties['label']) ? $properties['label'] : null,
					$properties['selector']
				);

				if ( isset($properties['screens']) ) {
					$tweak->setScreens($properties['screens']);
				}
			} else if ( isset($properties['className']) ) {
				if ( isset($properties['includeFile']) ) {
					require_once $properties['includeFile'];
				}

				$className = $properties['className'];
				$tweak = new $className(
					$id,
					isset($properties['label']) ? $properties['label'] : null
				);
			} else {
				throw new LogicException('Unknown tweak type in default-tweaks.php for tweak "' . $id . '"');
			}

			if ( isset($properties['parent']) ) {
				$tweak->setParentId($properties['parent']);
			}
			if ( isset($properties['section']) ) {
				$tweak->setSectionId($properties['section']);
			}

			$this->addTweak($tweak);
		}

		do_action('admin-menu-editor-register_tweaks', $this, $tweakFilter);

		//Register user-defined tweaks.
		$settings = $this->loadSettings();
		$userDefinedTweakIds = ameUtils::get($settings, 'userDefinedTweaks', array());
		if ( !empty($userDefinedTweakIds) ) {
			$tweakSettings = isset($settings['tweaks']) ? $settings['tweaks'] : array();
			foreach ($userDefinedTweakIds as $id => $unused) {
				if ( !isset($tweakSettings[$id]['typeId']) ) {
					continue;
				}
				$properties = $tweakSettings[$id];
				if ( isset($this->tweakBuilders[$properties['typeId']]) ) {
					$tweak = call_user_func($this->tweakBuilders[$properties['typeId']], $properties);
					if ( $tweak ) {
						$this->addTweak($tweak);
					}
				}
			}
		}
	}

	/**
	 * @param ameBaseTweak $tweak
	 * @param string $applicationMode
	 */
	public function addTweak($tweak, $applicationMode = self::APPLY_TWEAK_AUTO) {
		$this->tweaks[$tweak->getId()] = $tweak;
		if ( $applicationMode === self::APPLY_TWEAK_AUTO ) {
			$this->pendingTweaks[$tweak->getId()] = $tweak;
		}
	}

	/**
	 * @param ameBaseTweak[] $tweaks
	 */
	protected function processTweaks($tweaks) {
		$settings = $this->getEnabledTweakSettings();

		foreach ($tweaks as $tweak) {
			if ( empty($settings[$tweak->getId()]) ) {
				continue; //This tweak is not enabled for the current user.
			}

			if ( $tweak->hasScreenFilter() ) {
				if ( !did_action('current_screen') ) {
					$this->postponedTweaks[$tweak->getId()] = $tweak;
					continue;
				} else if ( !$tweak->isEnabledForCurrentScreen() ) {
					continue;
				}
			}

			$settingsForThisTweak = null;
			if ( $tweak->supportsUserInput() ) {
				$settingsForThisTweak = ameUtils::get($settings, array($tweak->getId()), array());
			}
			$tweak->apply($settingsForThisTweak);
		}

		if ( !empty($this->postponedTweaks) ) {
			add_action('current_screen', array($this, 'processPostponedTweaks'), 10, 1);
		}
	}

	/**
	 * Get settings associated with tweaks that are enabled for the current user.
	 */
	protected function getEnabledTweakSettings() {
		if ( $this->cachedEnabledTweakSettings !== null ) {
			return $this->cachedEnabledTweakSettings;
		}

		$settings = ameUtils::get($this->loadSettings(), 'tweaks');
		if ( !is_array($settings) ) {
			$settings = array();
		}

		$currentUser = wp_get_current_user();
		$roles = $this->menuEditor->get_user_roles($currentUser);
		$isSuperAdmin = is_multisite() && is_super_admin($currentUser->ID);

		$results = array();
		foreach ($settings as $id => $tweakSettings) {
			$enabledForActor = ameUtils::get($tweakSettings, 'enabledForActor', array());
			if ( !$this->appliesToUser($enabledForActor, $currentUser, $roles, $isSuperAdmin) ) {
				continue;
			}

			$results[$id] = $tweakSettings;
		}

		$this->cachedEnabledTweakSettings = $results;
		return $results;
	}

	/**
	 * @param array $enabledForActor
	 * @param WP_User $user
	 * @param array $roles
	 * @param bool $isSuperAdmin
	 * @return bool
	 */
	private function appliesToUser($enabledForActor, $user, $roles, $isSuperAdmin = false) {
		//User-specific settings have priority over everything else.
		$userActor = 'user:' . $user->user_login;
		if ( isset($enabledForActor[$userActor]) ) {
			return $enabledForActor[$userActor];
		}

		//The "Super Admin" flag has priority over regular roles.
		if ( $isSuperAdmin && isset($enabledForActor['special:super_admin']) ) {
			return $enabledForActor['special:super_admin'];
		}

		//If it's enabled for any role, it's enabled for the user.
		foreach ($roles as $role) {
			if ( !empty($enabledForActor['role:' . $role]) ) {
				return true;
			}
		}

		//By default, all tweaks are disabled.
		return false;
	}

	/**
	 * @param WP_Screen $screen
	 */
	public function processPostponedTweaks($screen = null) {
		if ( empty($screen) && function_exists('get_current_screen') ) {
			$screen = get_current_screen();
		}
		$screenId = isset($screen, $screen->id) ? $screen->id : null;

		foreach ($this->postponedTweaks as $id => $tweak) {
			if ( !$tweak->isEnabledForScreen($screenId) ) {
				continue;
			}
			$tweak->apply();
		}

		$this->postponedTweaks = array();
	}

	public function processSidebarWidgets() {
		global $wp_widget_factory;
		global $pagenow;
		if ( !isset($wp_widget_factory, $wp_widget_factory->widgets) || !is_array($wp_widget_factory->widgets) ) {
			return;
		}

		$widgetTweaks = array();
		foreach ($wp_widget_factory->widgets as $id => $widget) {
			$tweak = new ameHideSidebarWidgetTweak($widget);
			$widgetTweaks[$tweak->getId()] = $tweak;
		}

		//Sort the tweaks in alphabetic order.
		uasort(
			$widgetTweaks,
			/**
			 * @param ameBaseTweak $a
			 * @param ameBaseTweak $b
			 * @return int
			 */
			function ($a, $b) {
				return strnatcasecmp($a->getLabel(), $b->getLabel());
			}
		);

		foreach ($widgetTweaks as $tweak) {
			$this->addTweak($tweak, self::APPLY_TWEAK_MANUALLY);
		}

		if ( is_admin() && ($pagenow === 'widgets.php') ) {
			$this->processTweaks($widgetTweaks);
		}
	}

	public function processSidebars() {
		global $wp_registered_sidebars;
		global $pagenow;
		if ( !isset($wp_registered_sidebars) || !is_array($wp_registered_sidebars) ) {
			return;
		}

		$sidebarTweaks = array();
		foreach ($wp_registered_sidebars as $id => $sidebar) {
			$tweak = new ameHideSidebarTweak($sidebar);
			$this->addTweak($tweak, self::APPLY_TWEAK_MANUALLY);
			$sidebarTweaks[$tweak->getId()] = $tweak;
		}

		if ( is_admin() && ($pagenow === 'widgets.php') ) {
			$this->processTweaks($sidebarTweaks);
		}
	}

	public function addSection($id, $label, $priority = null) {
		$section = new ameTweakSection($id, $label);
		if ( $priority !== null ) {
			$section->setPriority($priority);
		}
		$this->sections[$section->getId()] = $section;
	}

	protected function getTemplateVariables($templateName) {
		$variables = parent::getTemplateVariables($templateName);
		$variables['tweaks'] = $this->tweaks;
		return $variables;
	}

	public function enqueueTabScripts() {
		$codeEditorSettings = null;
		if ( function_exists('wp_enqueue_code_editor') ) {
			$codeEditorSettings = wp_enqueue_code_editor(array('type' => 'text/html'));
		}

		wp_register_auto_versioned_script(
			'ame-tweak-manager',
			plugins_url('tweak-manager.js', __FILE__),
			array(
				'ame-lodash',
				'knockout',
				'ame-actor-selector',
				'ame-jquery-cookie',
				'ame-ko-extensions',
			)
		);
		wp_enqueue_script('ame-tweak-manager');

		//Reselect the same actor.
		$query = $this->menuEditor->get_query_params();
		$selectedActor = null;
		if ( isset($query['selected_actor']) ) {
			$selectedActor = strval($query['selected_actor']);
		}

		$scriptData = $this->getScriptData();
		$scriptData['selectedActor'] = $selectedActor;
		$scriptData['defaultCodeEditorSettings'] = $codeEditorSettings;
		wp_localize_script('ame-tweak-manager', 'wsTweakManagerData', $scriptData);
	}

	protected function getScriptData() {
		$settings = $this->loadSettings();
		$tweakSettings = ameUtils::get($settings, 'tweaks', array());

		$tweakData = array();
		foreach ($this->tweaks as $id => $tweak) {
			$item = $tweak->toArray();
			$item = array_merge(ameUtils::get($tweakSettings, $id, array()), $item);
			$tweakData[] = $item;
		}

		$sectionData = array();
		foreach ($this->sections as $section) {
			$sectionData[] = array(
				'id'       => $section->getId(),
				'label'    => $section->getLabel(),
				'priority' => $section->getPriority(),
			);
		}

		return array(
			'tweaks'              => $tweakData,
			'sections'            => $sectionData,
			'isProVersion'        => $this->menuEditor->is_pro_version(),
			'lastUserTweakSuffix' => ameUtils::get($settings, 'lastUserTweakSuffix', 0),
		);
	}

	public function enqueueTabStyles() {
		parent::enqueueTabStyles();
		wp_enqueue_auto_versioned_style(
			'ame-tweak-manager-css',
			plugins_url('tweaks.css', __FILE__)
		);
	}

	public function handleSettingsForm($post = array()) {
		parent::handleSettingsForm($post);

		$submittedSettings = json_decode($post['settings'], true);

		//To save space, filter out tweaks that are not enabled for anyone and have no other settings.
		//Most tweaks only have "id" and "enabledForActor" properties.
		$basicProperties = array('id' => true, 'enabledForActor' => true);
		$submittedSettings['tweaks'] = array_filter(
			$submittedSettings['tweaks'],
			function ($settings) use ($basicProperties) {
				if ( !empty($settings['enabledForActor']) ) {
					return true;
				}
				$additionalProperties = array_diff_key($settings, $basicProperties);
				return !empty($additionalProperties);
			}
		);

		//User-defined tweaks must have a type.
		$submittedSettings['tweaks'] = array_filter(
			$submittedSettings['tweaks'],
			function ($settings) {
				return empty($settings['isUserDefined']) || !empty($settings['typeId']);
			}
		);

		//TODO: Give other components an opportunity to validate and sanitize tweak settings. E.g. a filter.
		//Sanitize CSS with FILTER_SANITIZE_FULL_SPECIAL_CHARS if unfiltered_html is not enabled. Always strip </style>.

		//Build a lookup array of user-defined tweaks so that we can register them later
		//without iterating through the entire list.
		$userDefinedTweakIds = array();
		foreach ($submittedSettings['tweaks'] as $properties) {
			if ( !empty($properties['isUserDefined']) && !empty($properties['id']) ) {
				$userDefinedTweakIds[$properties['id']] = true;
			}
		}

		//We use an incrementing suffix to ensure each user-defined tweak gets a unique ID.
		$lastUserTweakSuffix = ameUtils::get($this->loadSettings(), 'lastUserTweakSuffix', 0);
		$newSuffix = ameUtils::get($submittedSettings, 'lastUserTweakSuffix', 0);
		if ( is_scalar($newSuffix) && is_numeric($newSuffix) ) {
			$newSuffix = max(intval($newSuffix), 0);
			if ( $newSuffix < 10000000 ) {
				$lastUserTweakSuffix = $newSuffix;
			}
		}

		$this->settings['tweaks'] = $submittedSettings['tweaks'];
		$this->settings['userDefinedTweaks'] = $userDefinedTweakIds;
		$this->settings['lastUserTweakSuffix'] = $lastUserTweakSuffix;
		$this->saveSettings();

		$params = array('updated' => 1);
		if ( !empty($post['selected_actor']) ) {
			$params['selected_actor'] = strval($post['selected_actor']);
		}

		wp_redirect($this->getTabUrl($params));
		exit;
	}
}

class ameTweakSection {
	private $id;
	private $label;

	private $priority = 0;

	public function __construct($id, $label) {
		$this->id = $id;
		$this->label = $label;
	}

	public function getId() {
		return $this->id;
	}

	public function getLabel() {
		return $this->label;
	}

	public function getPriority() {
		return $this->priority;
	}

	public function setPriority($priority) {
		$this->priority = $priority;
		return $this;
	}
}
