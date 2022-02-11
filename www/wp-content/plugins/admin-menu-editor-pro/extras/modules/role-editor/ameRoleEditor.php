<?php
/** @noinspection PhpComposerExtensionStubsInspection, SqlResolve */

/** @noinspection PhpUnused Module is loaded dynamically. */
class ameRoleEditor extends amePersistentProModule {
	const REQUIRED_CAPABILITY = 'edit_users';
	const CORE_COMPONENT_ID = ':wordpress:';

	const UPDATE_PREFERENCES_ACTION = 'ws_ame_rex_update_user_preferences';
	const USER_PREFERENCE_KEY = 'ws_ame_rex_prefs';
	const BACKUP_CLEANUP_HOOK = 'ws_ame_rex_cleanup_role_backups';
	const USER_DEFINED_CAP_KEY = 'ws_ame_rex_user_defined_caps';

	const SETTINGS_ERROR_TRANSIENT = 'ws_ame_rex_settings_errors';

	protected $tabSlug = 'roles';
	protected $tabTitle = 'Roles';
	protected $settingsFormAction = 'ame-save-role-settings';

	protected $optionName = 'ws_ame_role_editor';

	/**
	 * @var ameRexCapability[]
	 */
	private $capabilities = array();
	/**
	 * @var array
	 */
	private $uncategorizedCapabilities = array();

	/**
	 * @var ameRexComponentRegistry
	 */
	private $knownComponents;
	private $postTypeRegistrants = array();
	private $taxonomyRegistrants = array();

	/**
	 * @var ameRexCategory[]
	 */
	private $componentRootCategories = array();

	/**
	 * @var ameRexCategory[]
	 */
	private $componentCapPrefixes = array();

	/**
	 * @var string Name of the table that stores role data backups.
	 */
	private $backupTable;
	/**
	 * @var bool Backups are currently disabled pending a full implementation.
	 */
	private $backupsEnabled = false;

	/**
	 * @var array List of errors encountered when saving role settings.
	 */
	private $cachedSettingsErrors = array();

	/**
	 * @var ameEditableRoleFilter[] Editable roles per user. [userId => $filterInstance]
	 */
	private $cachedEditableRoles = array();
	/**
	 * @var string[] Overall, most specific strategy per user. [123 => 'auto', 456 => 'user-defined-list', ...]
	 */
	private $cachedOverallEditableRoleStrategy = array();
	/**
	 * @var bool Is the hook that clears the role cache already installed?
	 */
	private $isRoleCacheClearingHookSet = false;
	/**
	 * @var array
	 */
	private $cachedEnabledRoleCaps = array();

	public function __construct($menuEditor) {
		parent::__construct($menuEditor);

		add_filter('editable_roles', array($this, 'filterEditableRoles'), 20, 1);
		add_filter('map_meta_cap', array($this, 'restrictUserEditing'), 10, 4);

		//Optimization: Only record plugins that register post types and taxonomies when the current page is an AME tab.
		if (isset($_GET['sub_section'])) {
			add_action('registered_post_type', array($this, 'recordPostTypeOrigin'), 10, 2);
			add_action('registered_taxonomy', array($this, 'recordTaxonomyOrigin'), 10, 3);
		}

		add_action('wp_ajax_' . self::UPDATE_PREFERENCES_ACTION, array($this, 'ajaxUpdateUserPreferences'));

		/** @var wpdb */
		global $wpdb;
		$this->backupTable = $wpdb->base_prefix . 'ame_role_backups';
		add_action(self::BACKUP_CLEANUP_HOOK, array($this, 'deleteOldRoleBackups'));
	}

	public function enqueueTabScripts() {
		parent::enqueueTabScripts();

		wp_register_auto_versioned_script(
			'ame-role-editor',
			plugins_url('role-editor.js', __FILE__),
			array(
				'ame-lodash',
				'knockout',
				'jquery',
				'jquery-qtip',
				'ame-actor-manager',
				'ame-actor-selector',
				'ame-ko-extensions',
			)
		);

		wp_enqueue_script('ame-role-editor');

		$this->knownComponents = new ameRexComponentRegistry();
		$this->queryInstalledComponents();

		$defaultCapabilities = $this->getDefaultCapabilities();
		$multisiteCapabilities = $this->getMultisiteOnlyCapabilities();

		foreach ($this->getAllCapabilities(array(wp_get_current_user())) as $capability => $unusedValue) {
			$descriptor = new ameRexCapability();
			if (isset($defaultCapabilities[$capability]) || isset($multisiteCapabilities[$capability])) {
				$descriptor->componentId = self::CORE_COMPONENT_ID;
			} else {
				$this->uncategorizedCapabilities[$capability] = true;
			}
			$this->capabilities[$capability] = $descriptor;
		}
		//TODO: do_not_allow should never end up in a plugin category. It's part of core.

		$postTypes = $this->getPostTypeDescriptors();
		$this->analysePostTypes($postTypes);

		$taxonomies = $this->findRegisteredTaxonomies();
		$this->analyseTaxonomies($taxonomies);

		//$categorizationStartTime = microtime(true);

		//Check which menu items use what capabilities and what the corresponding components are.
		$this->analyseAdminMenuCapabilities();

		$this->queryCapabilityDatabase();

		$this->assignCapabilitiesToComponents();

		$probablePostTypeCategories = $this->findProbablePostTypeCategories();
		$clusteredCategories = $this->groupSimilarCapabilities();

		foreach ($this->componentRootCategories as $category) {
			//Find component roots that have both subcategories and capabilities and
			//put all freestanding capabilities in a "General" subcategory.
			if (!empty($category->capabilities) && !empty($category->subcategories)) {
				$generalCategory = new ameRexCategory('General', $category->componentId);
				$generalCategory->capabilities = $category->capabilities;
				$category->capabilities = array();
				array_unshift($category->subcategories, $generalCategory);
			}
		}

		$coreCategory = $this->loadCoreCategories();

		//Normally, only a Super Admin on Multisite has certain Multisite administration capabilities.
		//However, there is at least one plugin that uses these capabilities even in a regular WP install,
		//so we'll show them as long as they're assigned to at least one role or user.
		if (!is_multisite() && isset($coreCategory->subcategories['default/multisite'])) {
			$multisiteCategory = $coreCategory->subcategories['default/multisite'];
			$multisiteCategory->capabilities = array_intersect_key($multisiteCategory->capabilities, $this->capabilities);
			if (empty($multisiteCategory->capabilities)) {
				unset($coreCategory->subcategories['default/multisite']);
			}
		}

		/*echo '<pre>';
		print_r($clusteredCategories);
		print_r($probablePostTypeCategories);
		print_r(array_keys($this->uncategorizedCapabilities));
		print_r($this->capabilities);
		exit;*/

		//$elapsed = microtime(true) - $categorizationStartTime;
		//printf('Categorization time: %.3f ms', $elapsed * 1000);
		//exit;

		$customCategories = array_merge($this->componentRootCategories, $probablePostTypeCategories, $clusteredCategories);
		$customCategoryDescriptors = array();
		foreach ($customCategories as $category) {
			/** @var ameRexCategory $category */
			$customCategoryDescriptors[] = $category->toArray();
		}

		$components = array();
		foreach ($this->knownComponents as $id => $component) {
			$components[$id] = $component->toArray();
		}

		$stableMetaCaps = self::loadCapabilities('stable-meta-caps.txt');
		$metaCapMap = array();
		$currentUserId = get_current_user_id();
		foreach ($stableMetaCaps as $metaCap => $unused) {
			$primitiveCaps = map_meta_cap($metaCap, $currentUserId);
			if ((count($primitiveCaps) === 1) && !in_array('do_not_allow', $primitiveCaps)) {
				$targetCap = reset($primitiveCaps);
				if ($targetCap !== $metaCap) {
					$metaCapMap[$metaCap] = $targetCap;
				}
			}
		}

		$userPreferences = array();
		$userPreferenceData = get_user_meta(get_current_user_id(), self::USER_PREFERENCE_KEY, true);
		if (is_string($userPreferenceData) && !empty($userPreferenceData)) {
			$userPreferences = json_decode($userPreferenceData, true);
			if (!is_array($userPreferences)) {
				$userPreferences = array();
			}
		}

		$query = $this->menuEditor->get_query_params();
		$selectedActor = null;
		if (isset($query['selected_actor'])) {
			$selectedActor = strval($query['selected_actor']);
		}

		$scriptData = array(
			'coreCategory'              => $coreCategory->toArray(),
			'customCategories'          => $customCategoryDescriptors,
			'postTypes'                 => $postTypes,
			'taxonomies'                => $taxonomies,
			'capabilities'              => $this->capabilities,
			'uncategorizedCapabilities' => array_keys($this->uncategorizedCapabilities),
			'deprecatedCapabilities'    => self::loadCapabilities('deprecated-capabilities.txt'),
			'userDefinedCapabilities'   => $this->getUserDefinedCaps(),
			'knownComponents'           => $components,
			'metaCapMap'                => $metaCapMap,
			'roles'                     => $this->getRoleData(),
			'users'                     => array(),
			'defaultRoleName'           => get_option('default_role'),
			'trashedRoles'              => array(), //todo: Load trashed roles from somewhere.
			'selectedActor'             => $selectedActor,
			'editableRoles'             => ameUtils::get($this->loadSettings(), 'editableRoles', new stdClass()),

			'userPreferences'        => $userPreferences,
			'adminAjaxUrl'           => self_admin_url('admin-ajax.php'),
			'updatePreferencesNonce' => wp_create_nonce(self::UPDATE_PREFERENCES_ACTION),
		);

		$jsonData = wp_json_encode($scriptData);

		if ( !is_string($jsonData) ) {
			$message = sprintf(
				'Failed to encode role data as JSON. The encoding function returned a %s.',
				esc_html(gettype($jsonData))
			);
			if ( function_exists('json_last_error_msg') ) {
				$message .= sprintf(
					'<br>JSON error message: "<strong>%s</strong>".',
					esc_html(json_last_error_msg())
				);
			}
			if ( function_exists('json_last_error') ) {
				$message .= sprintf(' JSON error code: %d.', json_last_error());
			}

			add_action('all_admin_notices', function () use ($message, $scriptData) {
				printf('<div class="notice notice-error"><p>%s</p></div>', $message);
			});
		}

		wp_add_inline_script(
			'ame-role-editor',
			sprintf('wsRexRoleEditorData = (%s);', $jsonData)
		);
	}

	public function enqueueTabStyles() {
		parent::enqueueTabStyles();
		wp_enqueue_auto_versioned_style(
			'ame-role-editor-styles',
			plugins_url('role-editor.css', __FILE__)
		);
	}

	public function displaySettingsPage() {
		if (!$this->userCanAccessModule()) {
			echo 'Error: You don\'t have sufficient permissions to access these settings.';
			return;
		}

		if ($this->backupsEnabled && !wp_next_scheduled(self::BACKUP_CLEANUP_HOOK)) {
			wp_schedule_event(time() + 10 * 60, 'daily', self::BACKUP_CLEANUP_HOOK);
		}
		parent::displaySettingsPage();
	}

	private function getPostTypeDescriptors() {
		$results = array();
		$wpPostTypes = get_post_types(array(), 'objects');

		//Note: When the "map_meta_cap" option is disabled for a CPT, the values of the "cap"
		//object will be treated as primitive capabilities. For example, "read_post" => "read_post"
		//means that WP will actually check if the user has the literal "read_post" capability.

		//On the other hand, when "map_meta_cap" is enabled, some "cap" entries can be re-mapped
		//to other "cap" entries depending on the current user, post owner, post status, etc.

		//These three meta capabilities will always be mapped to something else if "map_meta_cap"
		//is enabled. We'll skip them unless mapping is off or someone has assigned them to a role.
		//Note: It's possible that it would be fine to skip them even then. Not sure.
		$metaCaps = array('edit_post', 'read_post', 'delete_post');

		foreach ($wpPostTypes as $name => $postType) {
			$isIncluded = $postType->public || !$postType->_builtin;

			//Skip the "attachment" post type. It only has one unique capability (upload_files), which
			//is included in a default group.
			if ($name === 'attachment') {
				$isIncluded = false;
			}

			if (!$isIncluded) {
				continue;
			}

			$label = $name;
			$pluralLabel = $name;
			if (isset($postType->labels, $postType->labels->name) && !empty($postType->labels->name)) {
				$label = $postType->labels->name;
				$pluralLabel = $postType->labels->name;
			}

			//We want the plural in lowercase, but if there are multiple consecutive uppercase letters
			//then it's probably an acronym. Stuff like "aBc" is probably a contraction or a proper noun.
			if (!preg_match('@([A-Z]{2}|[a-z][A-Z])@', $pluralLabel)) {
				$pluralLabel = strtolower($pluralLabel);
			}

			$capabilities = array();
			foreach ((array)$postType->cap as $capType => $capability) {
				//Skip meta caps unless they already exist.
				if (in_array($capType, $metaCaps) && ($postType->map_meta_cap || !isset($this->capabilities[$capability]))) {
					continue;
				}

				//Skip the "read" cap. It's redundant - most CPTs use it, and all roles have it by default.
				if (($capType === 'read') && ($capability === 'read')) {
					continue;
				}

				//Some plugins apparently set capability to "false". Perhaps the intention is to disable it.
				if ($capability === false) {
					continue;
				}

				$capabilities[$capType] = $capability;
			}

			$component = isset($this->postTypeRegistrants[$name]) ? $this->postTypeRegistrants[$name] : null;

			$descriptor = array(
				'label'       => $label,
				'name'        => $name,
				'pluralLabel' => $pluralLabel,
				'permissions' => $capabilities,
				'isDefault'   => isset($postType->_builtin) && $postType->_builtin,
				'componentId' => $component,
			);

			$results[$name] = $descriptor;
		}

		return $results;
	}

	protected function findRegisteredTaxonomies() {
		$registeredTaxonomies = array();
		$usedLabels = array('Categories' => true, 'Category' => true, 'Tags' => true);

		foreach (get_taxonomies(array(), 'object') as $taxonomy) {
			$permissions = (array)($taxonomy->cap);

			//Skip "link_category" because its only cap (manage_links) is already part of a default category.
			if (
				($taxonomy->name === 'link_category')
				&& ($permissions['manage_terms'] === 'manage_links')
				&& (count(array_unique($permissions)) === 1)
			) {
				continue;
			}

			//Skip "nav_menu" and "post_format" because they're intended for internal use and have the same
			//caps as the "Category" taxonomy.
			if (in_array($taxonomy->name, array('nav_menu', 'post_format')) && $taxonomy->_builtin) {
				continue;
			}

			$componentId = null;
			$isBuiltIn = isset($taxonomy->_builtin) && $taxonomy->_builtin;
			if ($isBuiltIn) {
				$componentId = self::CORE_COMPONENT_ID;
			} else if (isset($this->taxonomyRegistrants[$taxonomy->name])) {
				$componentId = $this->taxonomyRegistrants[$taxonomy->name];
			}

			$label = $taxonomy->name;
			if (isset($taxonomy->labels, $taxonomy->labels->name) && !empty($taxonomy->labels->name)) {
				$label = $taxonomy->labels->name;
			}

			$uniqueLabel = $label;
			if (isset($usedLabels[$uniqueLabel]) && !$isBuiltIn) {
				$uniqueLabel = str_replace('_', ' ', $taxonomy->name);
			}
			//We want the label in lowercase unless it's an acronym.
			if (!preg_match('@([A-Z]{2}|[a-z][A-Z])@', $uniqueLabel)) {
				$uniqueLabel = strtolower($uniqueLabel);
			}
			$usedLabels[$uniqueLabel] = true;

			$registeredTaxonomies[$taxonomy->name] = array(
				'name'        => $taxonomy->name,
				'label'       => $label,
				'pluralLabel' => $uniqueLabel,
				'componentId' => $componentId,
				'permissions' => $permissions,
			);

		}

		return $registeredTaxonomies;
	}

	protected function analysePostTypes($postTypes) {
		//Record which components use which CPT capabilities.
		foreach ($postTypes as $name => $postType) {
			if (empty($postType['componentId']) || !isset($this->knownComponents[$postType['componentId']])) {
				continue;
			}
			$this->knownComponents[$postType['componentId']]->registeredPostTypes[$name] = true;
			foreach ($postType['permissions'] as $action => $capability) {
				if (isset($this->capabilities[$capability])) {
					$this->capabilities[$capability]->addUsage($postType['componentId']);
				}
			}

			//Add a CPT category to the component that created this post type.
			if (empty($postType['isDefault']) && ($postType['componentId'] !== self::CORE_COMPONENT_ID)) {
				$componentRoot = $this->getComponentCategory($postType['componentId']);
				if ($componentRoot) {
					$category = new ameRexPostTypeCategory(
						$postType['label'],
						$postType['componentId'],
						$name,
						$postType['permissions']
					);
					$componentRoot->subcategories[] = $category;
				}
			}
		}
	}

	protected function analyseTaxonomies($taxonomies) {
		//Record taxonomy components and create taxonomy categories for those components.
		foreach ($taxonomies as $name => $taxonomy) {
			if (empty($taxonomy['componentId'])) {
				continue;
			}
			foreach ($taxonomy['permissions'] as $action => $capability) {
				if (isset($this->capabilities[$capability])) {
					$this->capabilities[$capability]->addUsage($taxonomy['componentId']);
				}
			}

			//Add a taxonomy category to the component that created this taxonomy.
			if ($taxonomy['componentId'] !== self::CORE_COMPONENT_ID) {
				$componentRoot = $this->getComponentCategory($taxonomy['componentId']);
				if ($componentRoot) {
					$category = new ameRexTaxonomyCategory(
						$taxonomy['label'],
						$taxonomy['componentId'],
						$name,
						$taxonomy['permissions']
					);
					$componentRoot->subcategories[] = $category;
				}
			}
		}
	}

	/**
	 * Assign each capability that has known component relationships to one specific component.
	 * Copy component-related context information to the capability.
	 */
	protected function assignCapabilitiesToComponents() {
		//Figure out which component each capability belongs to.
		foreach ($this->capabilities as $capability => $unusedValue) {
			$details = $this->capabilities[$capability];

			if (empty($details->componentId) && !empty($details->usedByComponents)) {
				//Sort related components by priority.
				if (count($details->usedByComponents) > 1) {
					uksort($details->usedByComponents, array($this, 'compareComponents'));
				}
				//Pick the first component.
				$details->componentId = key($details->usedByComponents);
			}

			if (!empty($details->componentId)) {
				//Copy context information that's relevant to the selected component.
				if (isset($details->componentContext[$details->componentId])) {
					$propertiesToCopy = array('permissions', 'documentationUrl', 'notes');
					foreach ($propertiesToCopy as $property) {
						if (isset($details->componentContext[$details->componentId][$property])) {
							$details->$property = $details->componentContext[$details->componentId][$property];
						}
					}
				}

				if ($details->componentId !== self::CORE_COMPONENT_ID) {
					//Add the capability to the component category unless it's already there.
					$category = $this->getComponentCategory($details->componentId);
					if ($category !== null) {
						if (!$category->hasCapability($capability)) {
							$category->capabilities[$capability] = true;
						}
						unset($this->uncategorizedCapabilities[$capability]);
					} else {
						//This should never happen. If the capability has a component ID, that component
						//should already be registered.
						trigger_error(sprintf(
							'[AME] Capability "%s" belongs to component "%s" but that component appears to be unknown.',
							$capability,
							$details->componentId
						), E_USER_WARNING);
						continue;
					}
				}
			}
		}
	}

	/**
	 * @return ameRexCategory
	 */
	private function loadCoreCategories() {
		$root = new ameRexCategory('Core', self::CORE_COMPONENT_ID);
		$root->slug = 'default/core';

		$lines = file_get_contents(__DIR__ . '/data/core-categories.txt');
		$lines = explode("\n", $lines);

		$currentCategory = new ameRexCategory('Placeholder', self::CORE_COMPONENT_ID);

		//Each category starts with a title. The title is followed by one or more indented lines listing
		//capability names, one capability per line. Blank lines are ignored.
		$lineNumber = 0;
		foreach ($lines as $line) {
			$lineNumber++;

			//Skip blank lines.
			$line = rtrim($line);
			if ($line === '') {
				continue;
			}

			$firstChar = substr($line, 0, 1);
			if ($firstChar === ' ' || $firstChar === "\t") {
				//Found a capability.
				$capability = trim($line);
				//Skip unassigned caps. Even core capabilities sometimes get removed as WP development continues.
				if (isset($this->capabilities[$capability])) {
					$currentCategory->capabilities[$capability] = true;
				}
			} else {
				//Found a "Category title [optional slug]"
				if (preg_match('@^(?P<title>[^\[]+)(?:\s+\[(?P<slug>[^]]+)])?\s*$@', $line, $matches)) {
					//Save the previous category if it matched any capabilities.
					if (count($currentCategory->capabilities) > 0) {
						$root->addSubcategory($currentCategory);
					}

					$title = trim($matches['title']);
					$slug = !empty($matches['slug']) ? trim($matches['slug']) : ('default/' . $title);

					$currentCategory = new ameRexCategory($title, self::CORE_COMPONENT_ID);
					$currentCategory->slug = $slug;
				}
			}
		}

		//Save the last category.
		if (count($currentCategory->capabilities) > 0) {
			$root->addSubcategory($currentCategory);
		}

		return $root;
	}

	protected function analyseAdminMenuCapabilities() {
		$menu = $this->menuEditor->get_active_admin_menu();
		if (!empty($menu['tree'])) {
			foreach ($menu['tree'] as $item) {
				$this->analyseMenuItem($item);
			}
		}
	}

	protected function analyseMenuItem($item, $parent = null) {
		$capability = ameUtils::get($item, array('defaults', 'access_level'));

		if (empty($item['custom']) && !empty($item['defaults']) && !empty($capability) && empty($item['separator'])) {
			$defaults = $item['defaults'];
			$hook = get_plugin_page_hook(ameUtils::get($defaults, 'file', ''), ameUtils::get($defaults, 'parent', ''));

			$rawTitle = ameMenuItem::get($item, 'menu_title', '[Untitled]');
			$fullTitle = trim(strip_tags(ameMenuItem::remove_update_count($rawTitle)));
			if ($parent) {
				$parentTitle = ameMenuItem::remove_update_count(ameMenuItem::get($parent, 'menu_title', '[Untitled]'));
				$fullTitle = trim(strip_tags($parentTitle)) . ' → ' . $fullTitle;
			}

			$relatedComponents = array();
			if (!empty($hook)) {
				$reflections = $this->getHookReflections($hook);
				foreach ($reflections as $reflection) {
					$path = $reflection->getFileName();
					$componentId = $this->getComponentIdFromPath($path);
					if ($componentId) {
						$relatedComponents[$this->getComponentIdFromPath($path)] = true;
					}
				}
			}

			if (isset($this->capabilities[$capability])) {
				$this->capabilities[$capability]->menuItems[] = $fullTitle;
				$this->capabilities[$capability]->addManyUsages($relatedComponents);
			}
		}

		if (!empty($item['items'])) {
			foreach ($item['items'] as $submenu) {
				$this->analyseMenuItem($submenu, $item);
			}
		}
	}

	/**
	 * @param string $tag
	 * @return AmeReflectionCallable[]
	 */
	protected function getHookReflections($tag) {
		global $wp_filter;
		if (!isset($wp_filter[$tag])) {
			return array();
		}

		$reflections = array();
		foreach ($wp_filter[$tag] as $priority => $handlers) {
			foreach ($handlers as $index => $callback) {
				try {
					$reflection = new AmeReflectionCallable($callback['function']);
					$reflections[] = $reflection;
				} catch (ReflectionException $e) {
					//Invalid callback, let's just ignore it.
					continue;
				}
			}
		}
		return $reflections;
	}

	protected function getComponentIdFromPath($absolutePath) {
		static $pluginDirectory = null, $muPluginDirectory = null, $themeDirectory = null;
		if ($pluginDirectory === null) {
			$pluginDirectory = wp_normalize_path(WP_PLUGIN_DIR);
			$muPluginDirectory = wp_normalize_path(WPMU_PLUGIN_DIR);
			$themeDirectory = wp_normalize_path(WP_CONTENT_DIR . '/themes');
		}

		$absolutePath = wp_normalize_path($absolutePath);
		$pos = null;
		$type = '';
		if (strpos($absolutePath, $pluginDirectory) === 0) {
			$type = 'plugin';
			$pos = strlen($pluginDirectory);
		} else if (strpos($absolutePath, $muPluginDirectory) === 0) {
			$type = 'mu-plugin';
			$pos = strlen($muPluginDirectory);
		} else if (strpos($absolutePath, $themeDirectory) === 0) {
			$type = 'theme';
			$pos = strlen($themeDirectory);
		}

		if ($pos !== null) {
			$nextSlash = strpos($absolutePath, '/', $pos + 1);
			if ($nextSlash !== false) {
				$componentDirectory = substr($absolutePath, $pos + 1, $nextSlash - $pos - 1);
			} else {
				$componentDirectory = substr($absolutePath, $pos + 1);
			}
			return $type . ':' . $componentDirectory;
		}
		return null;
	}

	protected function getRoleData() {
		$wpRoles = ameRoleUtils::get_roles();
		$roles = array();

		$usersByRole = count_users();

		foreach ($wpRoles->role_objects as $roleId => $role) {
			$capabilities = array();
			if (!empty($role->capabilities) && is_array($role->capabilities)) {
				$capabilities = $this->menuEditor->castValuesToBool($role->capabilities);
			}

			$hasUsers = false;
			if (isset($usersByRole['avail_roles'], $usersByRole['avail_roles'][$roleId])) {
				$hasUsers = ($usersByRole['avail_roles'][$roleId] > 0);
			}

			//Our JS expects the capability map to be an object. It must be an object
			//even if it's empty or if all of the keys (i.e. capability names) are numeric.
			$capabilities = (object)$capabilities;

			$roles[] = array(
				'name'         => $roleId,
				'displayName'  => ameUtils::get($wpRoles->role_names, $roleId, $roleId),
				'capabilities' => $capabilities,
				'hasUsers'     => $hasUsers,
			);
		}
		return $roles;
	}

	/**
	 * Get a list of all known capabilities that apply to the current WordPress install.
	 *
	 * @param WP_User[] $users List of zero or more users.
	 * @return array Associative array indexed by capability name.
	 */
	protected function getAllCapabilities($users = array()) {
		//Always include capabilities that are built into WordPress.
		$capabilities = $this->getDefaultCapabilities();

		//Add capabilities assigned to roles.
		$capabilities = $capabilities + ameRoleUtils::get_all_capabilities(is_multisite());

		//Add capabilities of users.
		$roleNames = ameRoleUtils::get_role_names();
		foreach ($users as $user) {
			$userCaps = $user->caps;
			//Remove roles from the capability list.
			$userCaps = array_diff_key($userCaps, $roleNames);
			$capabilities = $capabilities + $userCaps;
		}

		//Add custom capabilities that were created by the user. These persist until manually deleted.
		$capabilities = $capabilities + $this->getUserDefinedCaps();

		$capabilities = $this->menuEditor->castValuesToBool($capabilities);

		uksort($capabilities, 'strnatcasecmp');
		return $capabilities;
	}

	protected function getDefaultCapabilities() {
		static $defaults = null;
		if ($defaults !== null) {
			return $defaults;
		}

		$defaults = self::loadCapabilities('default-capabilities.txt');

		if (is_multisite()) {
			$defaults = array_merge($defaults, $this->getMultisiteOnlyCapabilities());
		}

		return $defaults;
	}

	protected function getMultisiteOnlyCapabilities() {
		static $cache = null;
		if ($cache === null) {
			$cache = self::loadCapabilities('default-multisite-capabilities.txt');
		}
		return $cache;
	}

	/**
	 * Load a list of capabilities from a text file.
	 *
	 * @param string $fileName
	 * @param bool|int|string $fillValue Optional. Fill the result array with this value. Defaults to false.
	 * @return array Associative array with capability names as keys and $fillValue as values.
	 */
	public static function loadCapabilities($fileName, $fillValue = false) {
		$fileName = __DIR__ . '/data/' . $fileName;
		if (!is_file($fileName) || !is_readable($fileName)) {
			return array();
		}

		$contents = file_get_contents($fileName);

		$capabilities = preg_split('@[\r\n]+@', $contents);
		$capabilities = array_map('trim', $capabilities);
		$capabilities = array_filter($capabilities, array(__CLASS__, 'isNotEmptyString'));
		$capabilities = array_filter($capabilities, array(__CLASS__, 'isNotLineComment'));

		$capabilities = array_fill_keys($capabilities, $fillValue);

		return $capabilities;
	}

	protected static function isNotEmptyString($input) {
		return $input !== '';
	}

	protected static function isLineComment($input) {
		$input = trim($input);
		if ($input === '') {
			return false;
		}

		$firstChar = substr($input, 0, 1);
		if ($firstChar === '#' || $firstChar === ';') {
			return true;
		}

		if (substr($input, 0, 2) === '//') {
			return true;
		}

		return false;
	}

	protected static function isNotLineComment($input) {
		return !self::isLineComment($input);
	}

	/**
	 * Get components, capability metadata and possible categories from the capability database.
	 */
	private function queryCapabilityDatabase() {
		$engine = new ameRexCapabilityInfoSearch();

		$engine->addDataSource(new ameRexSqliteDataSource(__DIR__ . '/data/capability-excerpt.sqlite3'));
		//$engine->addDataSource(new ameRexJsonCapabilityDataSource(__DIR__ . '/data/capability-metadata.json'));

		$results = $engine->query(array_keys($this->capabilities), $this->knownComponents);
		foreach($results as $capability => $components) {
			$this->capabilities[$capability]->addManyUsages($components);
		}
	}

	private function compareComponents($idA, $idB) {
		$a = $this->knownComponents->components[$idA];
		$b = $this->knownComponents->components[$idB];

		if ($a->isActive && !$b->isActive) {
			return -1;
		}
		if ($b->isActive && !$a->isActive) {
			return 1;
		}
		if ($a->isInstalled && !$b->isInstalled) {
			return -1;
		}
		if ($b->isInstalled && !$a->isInstalled) {
			return 1;
		}

		return ($b->activeInstalls - $a->activeInstalls);
	}

	/**
	 * @param string $id
	 * @param WP_Post_Type $postType
	 */
	public function recordPostTypeOrigin($id, $postType) {
		if (!is_admin() || empty($postType) || empty($id)) {
			return;
		}

		if (isset($postType->_builtin) && $postType->_builtin) {
			return;
		}

		//Find the last entry that is part of a plugin or theme.
		$component = $this->detectCallerComponent();
		if ($component !== null) {
			$this->postTypeRegistrants[$id] = $component;
		}
	}

	public function recordTaxonomyOrigin(
		$id,
		/** @noinspection PhpUnusedParameterInspection It's part of the filter signature. We can't remove it. */
		$objectType,
		$taxonomy = array()
	) {
		if (!is_admin() || empty($taxonomy) || empty($id) || !is_array($taxonomy)) {
			return;
		}

		if (isset($taxonomy['_builtin']) && $taxonomy['_builtin']) {
			return;
		}

		$component = $this->detectCallerComponent();
		if ($component !== null) {
			$this->taxonomyRegistrants[$id] = $component;
		}
	}

	/**
	 * Detect the plugin or theme that triggered the current hook.
	 * If multiple components are involved, only the earliest one will be returned
	 * (i.e. the one at the bottom of the call stack).
	 *
	 * @return null|string
	 */
	private function detectCallerComponent() {
		$trace = debug_backtrace(DEBUG_BACKTRACE_IGNORE_ARGS);
		//Drop the first three entries because they just contain this method, its caller,
		//and an apply_filters or do_action call.
		array_shift($trace);
		array_shift($trace);
		array_shift($trace);

		//Find the last entry that is part of a plugin or theme.
		$component = null;
		foreach ($trace as $item) {
			if (empty($item['file'])) {
				continue;
			}

			$possibleComponent = $this->getComponentIdFromPath($item['file']);
			if ($possibleComponent) {
				$component = $possibleComponent;
			}
		}
		return $component;
	}

	private function queryInstalledComponents() {
		$installedPlugins = get_plugins();
		foreach ($installedPlugins as $pluginFile => $plugin) {
			$pathComponents = explode('/', $pluginFile, 2);
			if (count($pathComponents) < 2) {
				continue;
			}
			$component = new ameRexComponent(
				'plugin:' . $pathComponents[0],
				ameUtils::get($plugin, 'Name', $pathComponents[0])
			);
			$component->isInstalled = true;
			$component->isActive = is_plugin_active($pluginFile);
			$this->knownComponents[$component->id] = $component;
		}

		$installedMuPlugins = get_mu_plugins();
		foreach($installedMuPlugins as $pluginFile => $plugin) {
			$component = new ameRexComponent(
				'mu-plugin:' . $pluginFile,
				ameUtils::get($plugin, 'Name', $pluginFile)
			);
			$component->isInstalled = true;
			$component->isActive = true; //mu-plugins are always active.
			$this->knownComponents[$component->id] = $component;
		}

		$activeThemeSlugs = array(get_stylesheet(), get_template());
		foreach ($activeThemeSlugs as $slug) {
			$componentId = 'theme:' . $slug;
			if (isset($this->knownComponents[$componentId])) {
				continue;
			}
			$theme = wp_get_theme($slug);
			if (!empty($theme)) {
				$component = new ameRexComponent($componentId, $theme->get('Name'));
				$component->isActive = true;
				$component->isInstalled = true;
				$this->knownComponents[$component->id] = $component;
			}
		}
	}

	/**
	 * @param $componentId
	 * @return ameRexCategory|null
	 */
	private function getComponentCategory($componentId) {
		if (!isset($this->componentRootCategories[$componentId])) {
			if (!isset($this->knownComponents[$componentId])) {
				return null;
			}
			$category = new ameRexCategory($this->knownComponents[$componentId]->name, $componentId);
			$category->slug = 'components/' . $componentId;
			$this->componentRootCategories[$componentId] = $category;
		}
		return $this->componentRootCategories[$componentId];
	}

	/**
	 * Group capabilities that look like they belong to a post type but are not used by any registered post types.
	 * This could be stuff left behind by an uninstalled plugin, or just a set of similar capabilities.
	 *
	 * @return ameRexCategory[]
	 */
	protected function findProbablePostTypeCategories() {
		$potentialPostTypes = array();
		$foundCategories = array();

		//At the moment, WordPress database schema limits post types to 20 characters.
		$namePattern = '(?P<post_type>.{1,20}?)s?';
		$cptPatterns = array(
			'@^edit_(?:(?:others|private|published)_)?' . $namePattern . '$@',
			'@^delete_(?:(?:others|private|published)_)?' . $namePattern . '$@',
			'@^publish_' . $namePattern . '$@',

			'@^read_private_' . $namePattern . '$@',
			'@^read_' . $namePattern . '$@',

			//WooCommerce stuff
			'@^(assign|edit|manage|delete)_' . $namePattern . '_terms$@',
		);

		foreach ($this->uncategorizedCapabilities as $capability => $unused) {
			foreach ($cptPatterns as $pattern) {
				if (preg_match($pattern, $capability, $matches)) {
					$postType = $matches['post_type'];

					//Unknown CPT-like capability.
					if (!isset($potentialPostTypes[$postType])) {
						$potentialPostTypes[$postType] = array();
					}
					$potentialPostTypes[$postType][$capability] = $capability;

					break;
				}
			}
		}

		//Empirically, real post types have at least 3 associated capabilities.
		foreach ($potentialPostTypes as $postType => $typeCaps) {
			if (count($typeCaps) >= 3) {
				//Note that this group does not correspond to an existing post type. It's just a set of similar caps.
				$title = ameUtils::ucWords(str_replace('_', ' ', $postType));
				if (substr($title, -1) !== 's') {
					$title .= 's'; //Post type titles are usually plural.
				}

				$category = new ameRexCategory($title);
				$category->capabilities = array_fill_keys($typeCaps, true);
				$foundCategories[] = $category;

				//Now that we know which group these caps belong to, remove them from consideration.
				foreach ($typeCaps as $capability) {
					unset($this->uncategorizedCapabilities[$capability]);
				}
			}
		}

		return $foundCategories;
	}

	private function groupSimilarCapabilities() {
		$stopWords = $this->getPrefixStopWords();

		//Find the common prefix of each component root, if there is one.
		foreach ($this->componentRootCategories as $category) {
			if (!empty($category->capabilities) && (count($category->capabilities) > 1)) {
				$possiblePrefix = key($category->capabilities);
				foreach ($category->capabilities as $capability => $unusedValue) {
					for ($i = 0; $i < min(strlen($possiblePrefix), strlen($capability)); $i++) {
						if ($possiblePrefix[$i] !== $capability[$i]) {
							if ($i >= 1) {
								$possiblePrefix = substr($possiblePrefix, 0, $i);
							} else {
								$possiblePrefix = '';
							}
							break;
						}
					}

					if ($possiblePrefix === '') {
						break;
					}
				}

				//The prefix must be at least 2 characters long and must not consist entirely of stopwords.
				if (strlen($possiblePrefix) >= 2) {
					$tokens = $this->tokenizeCapability($possiblePrefix);
					$foundStopWords = 0;
					foreach ($tokens as $token) {
						if (isset($stopWords[strtolower($token)])) {
							$foundStopWords++;
						}
					}
					if ($foundStopWords === count($tokens)) {
						continue;
					}

					$prefix = implode(' ', array_slice($tokens, 0, 2));
					$this->componentCapPrefixes[$prefix] = $category;
				}
			}
		}

		$possibleCategories = array();
		foreach ($this->uncategorizedCapabilities as $capability => $unusedValue) {
			$tokens = $this->tokenizeCapability($capability);
			$upperLimit = min(2, count($tokens) - 1);

			$prefix = null;
			for ($i = 0; $i < $upperLimit; $i++) {
				if ($prefix === null) {
					$prefix = $tokens[$i];
				} else {
					$prefix .= ' ' . $tokens[$i];
				}
				if (isset($stopWords[$tokens[$i]]) || (strlen($tokens[$i]) < 2)) {
					continue;
				}

				//Check if one of the existing component categories has the same prefix
				//and add this capability there.
				if (isset($this->componentCapPrefixes[$prefix])) {
					$this->componentCapPrefixes[$prefix]->addCapabilityToDefaultLocation($capability);
					unset($this->uncategorizedCapabilities[$capability]);

					$componentId = $this->componentCapPrefixes[$prefix]->componentId;
					if ($componentId !== null) {
						$this->capabilities[$capability]->addUsage($componentId);
						if (empty($this->capabilities[$capability]->componentId)) {
							$this->capabilities[$capability]->componentId = $componentId;
						}
					}
				}

				if (!isset($possibleCategories[$prefix])) {
					$possibleCategories[$prefix] = array();
				}
				$possibleCategories[$prefix][$capability] = true;
			}
		}

		uasort($possibleCategories, array($this, 'compareArraySizes'));

		$approvedCategories = array();
		foreach ($possibleCategories as $prefix => $capabilities) {
			$capabilities = array_intersect_key($capabilities, $this->uncategorizedCapabilities);
			if (count($capabilities) < 3) {
				continue;
			}

			$title = $prefix;
			//Convert all-lowercase to Title Case, but preserve stuff that already has mixed case.
			if (strtolower($title) === $title) {
				$title = ameUtils::ucWords($title);
			}

			//No vowels = probably an acronym.
			if (!preg_match('@[aeuio]@', $title)) {
				$title = strtoupper($title);
			}

			$category = new ameRexCategory($title);
			$category->capabilities = $capabilities;
			$approvedCategories[] = $category;
			foreach ($capabilities as $capability => $unused) {
				unset($this->uncategorizedCapabilities[$capability]);
			}
		}

		return $approvedCategories;
	}

	private function tokenizeCapability($capability) {
		return preg_split('@[\s_\-]@', $capability, -1, PREG_SPLIT_NO_EMPTY);
	}

	private function getPrefixStopWords() {
		static $stopWords = null;
		if ($stopWords === null) {
			$stopWords = array(
				'edit',
				'delete',
				'add',
				'list',
				'manage',
				'read',
				'others',
				'private',
				'published',
				'publish',
				'terms',
				'view',
				'create',
				'settings',
				'options',
				'option',
				'setting',
				'update',
				'install',
			);
			$stopWords = array_fill_keys($stopWords, true);
		}
		return $stopWords;
	}

	private function compareArraySizes($a, $b) {
		return count($b) - count($a);
	}

	public function ajaxUpdateUserPreferences() {
		check_ajax_referer(self::UPDATE_PREFERENCES_ACTION);

		@header('Content-Type: application/json; charset=' . get_option('blog_charset'));
		if (!$this->userCanAccessModule()) {
			echo json_encode(array('error' => 'Access denied'));
			exit;
		}

		$post = $this->menuEditor->get_post_params();
		if (!isset($post['preferences']) || !is_string($post['preferences'])) {
			echo json_encode(array('error' => 'The "preferences" field is missing or invalid.'));
			exit;
		}

		$preferences = json_decode($post['preferences'], true);
		if ($preferences === null) {
			echo json_encode(array('error' => 'The "preferences" field is not valid JSON.'));
			exit;
		}

		if (!is_array($preferences)) {
			echo json_encode(array('error' => 'The "preferences" field is not valid. Expected an associative array.'));
			exit;
		}

		update_user_meta(get_current_user_id(), self::USER_PREFERENCE_KEY, json_encode($preferences));

		echo json_encode(array('success' => true));
		exit;
	}

	public function handleSettingsForm($post = array()) {
		if (!$this->userCanAccessModule()) {
			wp_die("You don't have sufficient permissions to change these settings.");
		}

		$redirectParams = array();
		if (!empty($post['selectedActor'])) {
			$redirectParams['selected_actor'] = strval($post['selectedActor']);
		}

		$validator = new ameRexSettingsValidator(
			$post['settings'],
			$this->getAllCapabilities(array(wp_get_current_user())),
			$this->getUserDefinedCaps(),
			ameUtils::get($this->loadSettings(), 'editableRoles', array()),
			$this->getEffectiveEditableRoles(),
			$this->menuEditor
		);

		$errors = $validator->validate();
		$this->storeSettingsErrors($errors);

		$shouldUpdateNetwork = !empty($post['isGlobalUpdate']) && is_multisite() && is_super_admin();
		$totalChanges = $validator->getTotalChangeCount();

		//var_dump($totalChanges, $post);
		//exit;

		if (($totalChanges <= 0) && !$shouldUpdateNetwork) {
			$redirectParams['no-changes-made'] = 1;
			wp_redirect($this->getTabUrl($redirectParams));
			exit;
		}

		if ($shouldUpdateNetwork && ($totalChanges < 1)) {
			$totalChanges = 1; //A network update is always at least one change.
		}

		if ($this->backupsEnabled) {
			//Make a backup before actually changing anything.
			$currentUser = wp_get_current_user();
			$this->createRoleBackup(sprintf(
				'Automatic backup before applying %d changes made by %s',
				$totalChanges,
				$currentUser->user_login
			));
		}

		//Save user defined capabilities.
		if ($validator->getUserDefinedCaps() !== null) {
			$this->saveUserDefinedCaps($validator->getUserDefinedCaps());
		}

		//Apply role changes.
		//-------------------
		$wpRoles = ameRoleUtils::get_roles();

		//Delete roles.
		foreach ($validator->getRolesToDelete() as $id => $role) {
			$wpRoles->remove_role($id);
		}

		//Create roles.
		foreach ($validator->getRolesToCreate() as $id => $role) {
			$wpRoles->add_role($id, $role['displayName'], $role['capabilities']);
		}

		//Update role capabilities and display names.
		$rolesToModify = $validator->getRolesToModify();
		if (!empty($rolesToModify)) {
			foreach ($rolesToModify as $id => $role) {
				//Rename the role.
				if ($wpRoles->roles[$id]['name'] !== $role['displayName']) {
					$wpRoles->roles[$id]['name'] = $role['displayName'];
				}
				$wpRoles->roles[$id]['capabilities'] = $role['capabilities'];
			}
			//Save role data.
			update_option($wpRoles->role_key, $wpRoles->roles);
		}

		//Apply role settings to all network sites if requested. We'll do that even if the settings
		//weren't changed, which lets you use this feature to normalize role settings across the network.
		if ($shouldUpdateNetwork) {
			$result = $this->updateNetworkRoles(get_option($wpRoles->role_key));
			if (is_wp_error($result)) {
				$errors[] = $result;
				$this->storeSettingsErrors($errors);
			}
		}

		//Apply user changes.
		//-------------------

		foreach ($validator->getUsersToModify() as $userId => $modifiedUser) {
			$newCaps = $modifiedUser['capabilities'];
			$newRoles = $modifiedUser['roles'];
			$user = $validator->getExistingUser($userId);

			//We have to go through the trouble of removing/adding each role individually
			//because some plugins use the "add_user_role" and "remove_user_role" hooks.
			$oldRoles = (isset($user->roles) && is_array($user->roles)) ? $user->roles : array();
			$removedRoles = array_diff($oldRoles, $newRoles);
			$addedRoles = array_diff($newRoles, $oldRoles);
			foreach ($removedRoles as $role) {
				$user->remove_role($role);
			}
			foreach ($addedRoles as $role) {
				$user->add_role($role);
			}

			//Now that the necessary hooks have been triggered, we can just overwrite the caps array.
			//This is faster than calling add_cap() a bunch of times and it lets us precisely control
			//the order of roles in the array.
			$user->remove_all_caps();
			$user->roles = array();
			$user->caps = array_merge($newCaps, array_fill_keys($newRoles, true));

			update_user_meta($user->ID, $user->cap_key, $user->caps);
			$user->get_role_caps();
			$user->update_user_level_from_caps();
		}

		//Save editable roles.
		$this->loadSettings();
		$this->settings['editableRoles'] = $validator->getNewEditableRoleSettings();
		$this->saveSettings();

		$redirectParams['updated'] = 1;
		wp_redirect($this->getTabUrl($redirectParams));
		exit;

		//TODO: Consider creating revisions in an update_option filter (flushed on shutdown), not here. Also in add_option.
		//TODO: Maybe leave revision log formatting until time of display. It can be built based on change lists, I think.

		//TODO: It's still useful to take a backup/create a revision before updating if there have been no backups in X days.
		//The roles could have changed while the plugin is inactive, in which case the previous revision could be out of date.

		//TODO: Save trashed roles.

		/*
		 * Remove all roles that don't exist in the role list.
			For each existing role:
				Add missing caps, remove deleted caps.
				Keep a list of caps created with AME even if they're unused.
			Create roles that don't exist.
			Rename roles where the current name doesn't match the new one.

			Update user capabilities.
			Update user roles (see validateUserRoleChange)

			(Seems straightforward. Could be done directly if API is too slow.)
			Validation:
				Only change editable roles.
				Some capabilities are only available to super admins.
				Cannot create capabilities with "<>&" characters.
				Validate roles names and display names.
				Don't delete the default role and used roles.
		 */
	}

	/**
	 * Update role settings across the entire Multisite network. Applies the same settings to all sites.
	 *
	 * @param mixed $roleData
	 * @return bool|WP_Error
	 */
	private function updateNetworkRoles($roleData) {
		global $wpdb;
		/** @var wpdb $wpdb */

		if (!is_multisite()) {
			return new WP_Error(
				'ame_not_multisite',
				'Cannot update roles on all sites because this is not a Multisite network.'
			);
		}

		if (empty($roleData)) {
			return new WP_Error('ame_invalid_role_data', 'Role data is invalid.');
		}

		if (!function_exists('get_sites')) {
			return new WP_Error(
				'ame_wp_incompatible',
				'The plugin does not support this feature in the current WordPress version.'
			);
		}

		$sites = get_sites(array(
			/*
			 * As of this writing, WP documentation doesn't mention any officially supported way
			 * to make get_sites() return all available results. There are unofficial workarounds,
			 * but simply specifying a very high number should be good enough for most situations.
			 * We'll probably hit the PHP execution time limit before we hit the result limit.
			 */
			'number' => 1000000,
			'fields' => 'ids',
		));
		$serializedData = serialize($roleData);

		foreach ($sites as $siteId) {
			$prefix = $wpdb->get_blog_prefix($siteId);
			$tableName = $prefix . 'options';
			$optionName = $prefix . 'user_roles';

			$query = $wpdb->prepare(
				"UPDATE {$tableName} SET option_value = %s WHERE option_name = %s LIMIT 1",
				array($serializedData, $optionName)
			);

			$result = $wpdb->query($query);
			if ($result === false) {
				$errorMessage = sprintf('Failed to update site with ID %d.', $siteId);
				if (!empty($wpdb->last_error)) {
					$errorMessage .= ' Database error: ' . $wpdb->last_error;
				}
				return new WP_Error('ame_db_error', $errorMessage);
			}
		}

		return true;
	}

	/** @noinspection PhpUnusedPrivateMethodInspection */
	private function tempGenerateChangeSummary($role = null) {
		global $wpRoles;
		$id = '';

		if (!empty($rolesToDelete)) {
			$deletedIds = array_keys($rolesToDelete);
			if (count($deletedIds) === 1) {
				$summary[] = 'Deleted ' . $deletedIds[0];
			} else if (count($deletedIds) === 2) {
				$summary[] = 'Deleted ' . implode(' and ', $deletedIds);
			} else {
				$summary[] = 'Deleted ' . count($deletedIds) . ' roles';
			}
		}

		if (!empty($rolesToCreate)) {
			$createdIds = array_keys($rolesToCreate);
			$summary[] = 'Created ' . $this->formatPhraseList($createdIds, '%d roles');
		}

		$renamedRoles[] = sprintf('"%1$s" to %2$s', $wpRoles->roles[$id]['name'], $role['displayName']);

		$oldGrantedCaps = array_filter($wpRoles->roles[$id]['capabilities']);
		$newGrantedCaps = array_filter($role['capabilities']);
		$addedCaps = array_diff_key($newGrantedCaps, $oldGrantedCaps);
		$removedCaps = array_diff_key($oldGrantedCaps, $newGrantedCaps);

		$changes = array();
		if (!empty($addedCaps)) {
			$changes[] = count($addedCaps) . ' added';
		}
		if (!empty($removedCaps)) {
			$changes[] = count($removedCaps) . ' removed';
		}
		$capSummaries[] = $id . ' (' . implode(', ', $changes) . ')';

		//Add renames and cap changes to the summary.
		if (!empty($renamedRoles)) {
			$summary[] = 'Renamed ' . $this->formatPhraseList($renamedRoles, '%d roles', 1);
		}
		if (!empty($capSummaries)) {
			$summary[] = 'Changed capabilities: ' . implode(', ', $capSummaries);
		}
	}

	private function formatPhraseList($items, $combinedTemplate = '%d items', $limit = 2) {
		$itemCount = count($items);
		if ($itemCount === 1) {
			return $items[0];
		} else if ($itemCount === 2) {
			return implode(' and ', $items);
		} else if ($itemCount <= $limit) {
			return implode(', ', $items);
		}
		return sprintf($combinedTemplate, $itemCount);
	}

	/**
	 * @param array $errors
	 */
	private function storeSettingsErrors($errors) {
		if (empty($errors)) {
			delete_transient(self::SETTINGS_ERROR_TRANSIENT);
			return;
		}
		set_transient(self::SETTINGS_ERROR_TRANSIENT, $errors, 30 * 60);
		$this->cachedSettingsErrors = $errors;
	}

	/**
	 * @return array
	 */
	private function fetchSettingsErrors() {
		$storedErrors = get_transient(self::SETTINGS_ERROR_TRANSIENT);
		if ($storedErrors !== false) {
			delete_transient(self::SETTINGS_ERROR_TRANSIENT);
			$this->cachedSettingsErrors = (array)$storedErrors;
		}
		return $this->cachedSettingsErrors;
	}

	protected function getTemplateVariables($templateName) {
		$variables = parent::getTemplateVariables($templateName);
		$variables['settingsErrors'] = $this->fetchSettingsErrors();
		return $variables;
	}

	/**
	 * @param string $comment
	 * @param string|null $roleData
	 * @return bool
	 */
	private function createRoleBackup($comment = '', $roleData = null) {
		//TODO: If we're going to do backups, remember to create the table if it doesn't exist.
		//TODO: Delete the table when the plugin is uninstalled.
		if ($roleData === null) {
			$wpRoles = ameRoleUtils::get_roles();
			$roleData = get_option($wpRoles->role_key);
		}

		/** @var wpdb */
		global $wpdb;

		$result = $wpdb->insert(
			$this->backupTable,
			array(
				'created_on' => gmdate('Y-m-d H:i:s'),
				'site_id'    => get_current_blog_id(),
				'user_id'    => get_current_user_id(),
				'role_data'  => serialize($roleData),
				'comment'    => $comment,
			),
			array('%s', '%d', '%d', '%s', '%s')
		);
		return ($result !== false);
	}

	/**
	 * Delete old role data backups.
	 *
	 * We keep either the last 10 backups or the last 30 days of backups, whichever is greater.
	 */
	public function deleteOldRoleBackups() {
		/** @var wpdb */
		global $wpdb;

		$nthItemDate = $wpdb->get_var(
			'SELECT created_on FROM ' . $this->backupTable
			. ' WHERE 1 ORDER BY created_on DESC LIMIT 1 OFFSET 10'
		);

		if (empty($nthItemDate)) {
			return; //There are 10 or fewer backups. Do nothing.
		}

		$survivalThreshold = gmdate(
			'Y-m-d H:i:s',
			min(strtotime($nthItemDate . ' UTC'), strtotime('-30 days'))
		);

		$wpdb->query($wpdb->prepare(
			'DELETE FROM ' . $this->backupTable .
			' WHERE created_on <= %s', $survivalThreshold
		));
	}

	/**
	 * Check if a user can access the role editor module.
	 *
	 * @param int|null $userId Optional user ID. Defaults to the current user.
	 * @return bool
	 */
	private function userCanAccessModule($userId = null) {
		if (($userId === null) || ($userId === get_current_user_id())) {
			return $this->menuEditor->current_user_can_edit_menu() && current_user_can(self::REQUIRED_CAPABILITY);
		}
		$user = get_user_by('id', $userId);
		if (!$user) {
			return false;
		}
		return $this->menuEditor->user_can_edit_menu($userId)
			&& $user->has_cap(self::REQUIRED_CAPABILITY);
	}

	private function saveUserDefinedCaps($capabilities) {
		delete_site_option(self::USER_DEFINED_CAP_KEY);

		if (empty($capabilities)) {
			return;
		}
		update_site_option(self::USER_DEFINED_CAP_KEY, $capabilities);
	}

	/**
	 * Get a list of capabilities that were created by the user(s).
	 *
	 * @return array [capabilityName => arbitraryValue]
	 */
	private function getUserDefinedCaps() {
		$caps = get_site_option(self::USER_DEFINED_CAP_KEY, array());
		if (!is_array($caps)) {
			return array();
		}
		return $caps;
	}

	/**
	 * Apply "editable roles" settings.
	 *
	 * @param array $editableRoles
	 * @return array
	 */
	public function filterEditableRoles($editableRoles) {
		//Sanity check: The role list should be an array or something array-like.
		if ( !is_array($editableRoles) && !($editableRoles instanceof Traversable) ) {
			return $editableRoles;
		}

		//Do nothing if the core user API hasn't been loaded yet. There is at least one plugin that tries to get
		//editable roles before WordPress loads the user API and determines which user is logged in.
		if ( !is_callable('wp_get_current_user') ) {
			return $editableRoles;
		}

		// Do nothing if the overall strategy is "none" ("leave unchanged").
		$user = wp_get_current_user();
		if (
			isset($this->cachedOverallEditableRoleStrategy[$user->ID])
			&& ($this->cachedOverallEditableRoleStrategy[$user->ID] === 'none')
		) {
			return $editableRoles;
		}

		//It's possible that another plugin has already removed some roles from the array. We'll need the full list
		//so that we can restore enabled roles if the user has selected the "user-defined-list" strategy.
		if (function_exists('wp_roles')) {
			$allRoles = array_merge(wp_roles()->roles, $editableRoles);
		} else {
			$allRoles = $editableRoles;
		}

		//Try the cache first.
		if ( isset($this->cachedEditableRoles[$user->ID]) ) {
			return $this->cachedEditableRoles[$user->ID]->filter($allRoles, $editableRoles);
		}

		//A super admin always has full access to everything. Do not remove any roles.
		if (is_multisite() && is_super_admin()) {
			return $editableRoles;
		}

		$settings = ameUtils::get($this->loadSettings(), 'editableRoles', array());
		$userRoles = $this->menuEditor->get_user_roles($user);

		//User-specific settings have precedence.
		//For users, "auto" means "use role settings".
		$userActorId = 'user:' . $user->user_login;
		if ( ameUtils::get($settings, array($userActorId, 'strategy'), 'auto') !== 'auto' ) {
			$userSettings = $settings[$userActorId];
			if ($userSettings['strategy'] === 'none') {
				//Leave the roles unchanged.
				$this->cachedOverallEditableRoleStrategy[$user->ID] = 'none';
				return $editableRoles;
			} else if ($userSettings['strategy'] === 'user-defined-list') {
				//Allow editing only those roles that are on the list.
				$filteredResult = array();
				$allowedRoles = ameUtils::get($userSettings, 'userDefinedList', array());
				foreach($allRoles as $roleId => $role) {
					if ( isset($allowedRoles[$roleId]) ) {
						$filteredResult[$roleId] = $role;
					}
				}
				$this->cachedEditableRoles[$user->ID] = new ameEditableRoleReplacer(
					array_fill_keys(array_keys($filteredResult), true)
				);
				$this->cachedOverallEditableRoleStrategy[$user->ID] = 'user-defined-list';
				return $filteredResult;
			}
			//We'll only reach this line if the user's strategy setting is not valid.
			//In that case, let's leave the role list unchanged.
			return $editableRoles;
		}

		$leaveUnchanged = true;
		$hasAnyUserDefinedList = false;
		$autoDisabledRoles = array();
		$filteredResult = array();

		foreach($allRoles as $roleId => $role) {
			$wasEnabled = isset($editableRoles[$roleId]);
			$canAutoDisable = false;

			//Include this role if at least one of the user's roles is allowed to edit it.
			foreach($userRoles as $userRoleId) {
				$actorId = 'role:' . $userRoleId;

				$strategy = ameUtils::get($settings, array($actorId, 'strategy'), 'auto');
				$leaveUnchanged = $leaveUnchanged && ($strategy === 'none');

				if ($strategy === 'user-defined-list') {
					$hasAnyUserDefinedList = true;
					if ( isset($settings[$actorId]['userDefinedList'][$roleId]) ) {
						$filteredResult[$roleId] = $role;
						break;
					}
				} else if ( ($strategy === 'auto') ) {
					//Shortcut: A user with role X can assign role X to other users (assuming that they can edit users).
					if ( $roleId === $userRoleId ) {
						$shouldLeaveEnabled = true;
					} else {
						//Does the target role have the same or fewer capabilities as the user's role?
						$targetCaps = $this->getEnabledCoreCapabilitiesForRole($roleId, $role);
						$sameCaps = array_intersect_key(
							$targetCaps,
							$this->getEnabledCoreCapabilitiesForRole($userRoleId)
						);
						$shouldLeaveEnabled = (count($sameCaps) === count($targetCaps));
					}

					$canAutoDisable = !$shouldLeaveEnabled;
					if ( $wasEnabled && $shouldLeaveEnabled ) {
						$filteredResult[$roleId] = $role;
						break;
					}
				} else if ($strategy === 'none') {
					if ($wasEnabled) {
						$filteredResult[$roleId] = $role;
					}
				}
			}

			if ($canAutoDisable && !isset($filteredRoles[$roleId])) {
				$autoDisabledRoles[] = $roleId;
			}
		}

		//Are all of the roles set to "none" = leave unchanged?
		if ($leaveUnchanged) {
			$this->cachedOverallEditableRoleStrategy[$user->ID] = 'none';
			return $editableRoles;
		}

		$overallStrategy = $hasAnyUserDefinedList ? 'user-defined-list' : 'auto';
		$this->cachedOverallEditableRoleStrategy[$user->ID] = $overallStrategy;

		//We won't need the capability cache again unless something changes or replaces the current user mid-request.
		//That's probably going to be rare, so we can throw away the cache to free up some RAM.
		$this->cachedEnabledRoleCaps = array();
		//Update the user cache.
		if ($overallStrategy === 'auto') {
			$this->cachedEditableRoles[$user->ID] = new ameEditableRoleLimiter($autoDisabledRoles);
		} else {
			$this->cachedEditableRoles[$user->ID] = new ameEditableRoleReplacer(
				array_fill_keys(array_keys($filteredResult), true)
			);
		}

		if (!$this->isRoleCacheClearingHookSet) {
			$this->isRoleCacheClearingHookSet = true;
			//Clear cache when user roles or capabilities change.
			add_action('updated_user_meta', array($this, 'clearEditableRoleCache'), 10, 0);
			add_action('deleted_user_meta', array($this, 'clearEditableRoleCache'), 10, 0);
			//Clear cache when switching to another site because users can have different roles
			//on different sites.
			add_action('switch_blog', array($this, 'clearEditableRoleCache'), 10, 0);
		}

		return $filteredResult;
	}

	/**
	 * @param string $roleId
	 * @param array|null $roleData
	 * @return boolean[]
	 */
	private function getEnabledCoreCapabilitiesForRole($roleId, $roleData = null) {
		if (isset($this->cachedEnabledRoleCaps[$roleId])) {
			return $this->cachedEnabledRoleCaps[$roleId];
		}

		if ($roleData) {
			$capabilities = isset($roleData['capabilities']) ? $roleData['capabilities'] : null;
		} else {
			$roleObject = get_role($roleId);
			$capabilities = isset($roleObject->capabilities) ? $roleObject->capabilities : null;
		}
		if (!isset($capabilities)) {
			return array();
		}

		$enabledCaps = array_filter($capabilities);

		//Keep only core capabilities like "edit_posts" and filter out custom capabilities added by plugins or themes.
		$enabledCaps = array_intersect_key($enabledCaps, $this->getDefaultCapabilities());

		$this->cachedEnabledRoleCaps[$roleId] = $enabledCaps;
		return $enabledCaps;
	}

	/**
	 * Get roles that the current user can edit in the role editor. Unlike get_editable_roles(), this method should
	 * include any special roles that do not show up in the role list when editing a user, like the forum roles
	 * created by bbPress.
	 *
	 * @return array
	 */
	private function getEffectiveEditableRoles() {
		$editableRoles = get_editable_roles();
		if (empty($editableRoles) || !is_array($editableRoles)) {
			$editableRoles = array();
		}
		if (function_exists('bbp_get_dynamic_roles')) {
			$userId = get_current_user_id();
			if (
				!isset($this->cachedOverallEditableRoleStrategy[$userId])
				|| ($this->cachedOverallEditableRoleStrategy[$userId] !== 'user-defined-list')
			) {
				$bbPressRoles = bbp_get_dynamic_roles();
				$editableRoles = array_merge($bbPressRoles, $editableRoles);
			}
		}
		return $editableRoles;
	}

	public function clearEditableRoleCache() {
		$this->cachedEditableRoles = array();
		$this->cachedOverallEditableRoleStrategy = array();
		$this->cachedEnabledRoleCaps = array();
	}

	/**
	 * Prevent less-privileged users from editing more privileged users.
	 *
	 * @param array $requiredCaps List of primitive capabilities (output).
	 * @param string $capability  The meta capability (input).
	 * @param int $thisUserId     The user that's trying to do something.
	 * @param array $args
	 * @return array
	 */
	public function restrictUserEditing($requiredCaps, $capability, $thisUserId, $args) {
		static $editUserCaps = array('edit_user', 'delete_user', 'promote_user');
		if (!in_array($capability, $editUserCaps) || !isset($args[0])) {
			return $requiredCaps;
		}

		/** @var int The user that might be edited or deleted. */
		$targetUserId = intval($args[0]);

		$thisUserId = intval($thisUserId);
		$isMultisite = is_multisite();
		$isSuperAdmin = $isMultisite && is_super_admin($thisUserId);

		//Super Admins can edit everything.
		if ($isSuperAdmin) {
			return $requiredCaps;
		}

		$accessDenied = array_merge($requiredCaps, array('do_not_allow'));

		//Only Super Admins can edit other Super Admins.
		if ($isMultisite && is_super_admin($targetUserId) && !$isSuperAdmin) {
			return $accessDenied;
		}

		//Users that don't have access to the role editor can't edit users that do have access.
		if (!$this->userCanAccessModule($thisUserId) && $this->userCanAccessModule($targetUserId)) {
			return $accessDenied;
		}

		//Finally, a user can only edit those other users that have an editable role.
		//This part only works with the current user because get_editable_roles() does not take a user parameter.
		if (($thisUserId === get_current_user_id()) && ($thisUserId !== $targetUserId) ) {
			//The file that defines get_editable_roles() is only loaded in the admin back-end even though
			//the "edit_user" capability is also used in the front-end, e.g. when adding an "Edit" link
			//to the Toolbar/Admin Bar on author pages.
			if (!function_exists('get_editable_roles')) {
				return $requiredCaps;
			}
			$editableRoles = get_editable_roles();

			$strategy = 'auto';
			if ( isset($this->cachedOverallEditableRoleStrategy[$thisUserId]) ) {
				$strategy = $this->cachedOverallEditableRoleStrategy[$thisUserId];
			}

			//Don't apply any further restrictions if all editable role settings are set to "leave unchanged"
			//for this user.
			if ($strategy === 'none') {
				return $requiredCaps;
			}

			if (function_exists('bbp_get_dynamic_roles')) {
				$bbPressRoles = bbp_get_dynamic_roles();
			} else {
				$bbPressRoles = array();
			}

			$targetUser = get_user_by('id', $targetUserId);
			$roles = (isset($targetUser->roles) && is_array($targetUser->roles)) ? $targetUser->roles : array();
			foreach($roles as $roleId) {
				/*
				 * = bbPress compatibility fix =
				 *
				 * bbPress always removes its special roles (like "Participant") from the editable role list. As far
				 * as I can tell, the intent is to prevent people from bypassing bbPress settings and manually giving
				 * those roles to users.
				 *
				 * This should not automatically prevent administrators from editing users who have any bbPress roles.
				 * Therefore, let's ignore bbPress roles here unless the user has custom editable role settings.
				 */
				if (array_key_exists($roleId, $bbPressRoles) && ($strategy !== 'user-defined-list')) {
					continue;
				}

				if (!array_key_exists($roleId, $editableRoles)) {
					return $accessDenied;
				}
			}
		}

		return $requiredCaps;
	}

	public function getExportOptionLabel() {
		return '"Editable Roles" settings';
	}
}

interface ameEditableRoleFilter {
	/**
	 * @param array<string, array> $allRoles
	 * @param array<string, array> $editableRoles
	 * @return array<string, array> Filtered editable roles.
	 */
	public function filter($allRoles, $editableRoles);
}

/**
 * Replaces the list of editable roles with the specified list.
 * Any changes that were made by other plugins will be overwritten.
 */
class ameEditableRoleReplacer implements ameEditableRoleFilter {
	private $enabledRoles;

	/**
	 * @param array<string,mixed> $enabledRoles
	 */
	public function __construct($enabledRoles) {
		$this->enabledRoles = $enabledRoles;
	}

	public function filter($allRoles, $editableRoles) {
		$result = array();
		foreach ($allRoles as $roleId => $role) {
			if ( isset($this->enabledRoles[$roleId]) ) {
				$result[$roleId] = $role;
			}
		}
		return $result;
	}

}

/**
 * Removes the specified roles from the list of editable roles.
 */
class ameEditableRoleLimiter implements ameEditableRoleFilter {
	private $rolesToRemove;

	/**
	 * @param string[] $rolesToRemove
	 */
	public function __construct($rolesToRemove) {
		$this->rolesToRemove = $rolesToRemove;
	}

	public function filter($allRoles, $editableRoles) {
		foreach ($this->rolesToRemove as $roleId) {
			if ( array_key_exists($roleId, $editableRoles) ) {
				unset($editableRoles[$roleId]);
			}
		}
		return $editableRoles;
	}
}