<?php

namespace YahnisElsts\AdminMenuEditor\Redirects;

use ameMenuItem;
use amePersistentModule;
use ameRoleUtils;
use ameUtils;
use DateTime;
use DateTimeZone;
use Exception;
use RuntimeException;
use WP_Error;
use WP_User;

class Module extends amePersistentModule {
	const FILTER_PRIORITY = 1000000;
	const UI_SCRIPT_HANDLE = 'ame-redirector-ui';

	const FIRST_LOGIN_AGE_LIMIT_IN_DAYS = 14;
	const FIRST_LOGIN_META_KEY = 'ame_rui_first_login_done';

	const SETTINGS_INIT_TIME_KEY = 'ws_ame_rui_first_change';

	const PRELOADED_USER_LIMIT = 50;
	const SEARCH_USER_LIMIT = 30;
	protected static $desiredUserFields = array('ID', 'display_name', 'user_login');

	protected $tabSlug = 'redirects';
	protected $tabTitle = 'Redirects';
	protected $optionName = 'ws_ame_redirects';

	protected $settingsFormAction = 'ame-save-redirect-settings';

	/**
	 * @var RedirectCollection|null
	 */
	protected $redirects = null;

	protected $searchUsersAction;

	public function __construct($menuEditor) {
		parent::__construct($menuEditor);

		if ( !$this->isEnabledForRequest() ) {
			return;
		}

		//Let the user disable all redirects in wp-config.php.
		$allRedirectsDisabled = defined('AME_DISABLE_REDIRECTS') && constant('AME_DISABLE_REDIRECTS');
		if ( !$allRedirectsDisabled ) {
			//Login redirect.
			add_filter('login_redirect', [$this, 'filterLoginRedirect'], self::FILTER_PRIORITY, 3);
			//Logout redirect. We might need to also use the "wp_logout" action if something bypasses wp-login.php.
			add_filter('logout_redirect', [$this, 'filterLogoutRedirect'], self::FILTER_PRIORITY, 3);
			//Registration redirect. This happens after the user is created but before the user logs in.
			add_filter('registration_redirect', [$this, 'filterRegistrationRedirect'], self::FILTER_PRIORITY, 1);
		}

		if ( is_admin() ) {
			$this->searchUsersAction = ajaw_v1_CreateAction('ws-ame-rui-search-users')
				->requiredParam('term')
				->method('get')
				->permissionCallback(array($this, 'userCanSearchUsers'))
				->handler(array($this, 'ajaxSearchUsers'))
				->register();

			add_action('admin_menu_editor-load_tab-' . $this->tabSlug, [$this, 'addContextualHelp']);
		}
	}

	/**
	 * Get the redirect that best matches the given trigger and user.
	 *
	 * When there are multiple redirects that could apply in this context, only the redirect
	 * with the highest priority will be returned.
	 *
	 * @param string $trigger
	 * @param WP_User $user
	 * @return Option<Redirect>
	 */
	protected function getBestRedirectFor($trigger, WP_User $user) {
		$redirectsForTrigger = $this->getRedirects()->filterByTrigger($trigger);
		if ( empty($redirectsForTrigger) ) {
			return None::getInstance();
		}
		$actors = $this->getUserActors($user);

		//Redirects should already be sorted by priority, so we can just return the first match.
		foreach ($redirectsForTrigger as $redirect) {
			if ( array_key_exists($redirect->getActorId(), $actors) ) {
				return new Some($redirect);
			}
		}
		return None::getInstance();
	}

	/**
	 * @param WP_User|null $user
	 * @return array<string,bool>
	 */
	protected function getUserActors(WP_User $user) {
		$actorIds = ['special:default' => true]; //The "default" setting applies to every user.

		if ( !isset($user) ) {
			return $actorIds;
		}

		if ( isset($user->user_login) ) {
			$actorIds['user:' . $user->user_login] = true;
		}

		if ( isset($user->roles) && is_array($user->roles) ) {
			foreach ($user->roles as $roleId) {
				$actorIds['role:' . $roleId] = true;
			}
		}

		if ( is_multisite() && is_super_admin($user) ) {
			$actorIds['special:super_admin'] = true;
		}

		return $actorIds;
	}

	/**
	 * @return RedirectCollection
	 */
	protected function getRedirects() {
		if ( $this->redirects !== null ) {
			return $this->redirects;
		}

		$settings = $this->loadSettings();
		if ( isset($settings['redirects']) ) {
			$this->redirects = RedirectCollection::fromDbFormat($settings['redirects']);
		} else {
			$this->redirects = new RedirectCollection();
		}

		return $this->redirects;
	}

	public function saveSettings() {
		if ( isset($this->redirects) ) {
			$this->loadSettings();
			$this->settings['redirects'] = $this->redirects->toDbFormat();
		}
		parent::saveSettings();
	}

	/**
	 * @param string $redirectTo
	 * @param string $requestedRedirectTo
	 * @param WP_User|WP_Error $user
	 * @return string
	 * @noinspection PhpUnusedParameterInspection The parameters are defined by the hook and can't be changed.
	 */
	public function filterLoginRedirect($redirectTo, $requestedRedirectTo, $user = null) {
		if ( $this->checkFirstLogin($user) ) {
			$trigger = Triggers::FIRST_LOGIN;
		} else {
			$trigger = Triggers::LOGIN;
		}
		return $this->filterRedirect($trigger, $redirectTo, $requestedRedirectTo, $user);
	}

	public function filterLogoutRedirect($redirectTo, $requestedRedirectTo, $user = null) {
		return $this->filterRedirect(Triggers::LOGOUT, $redirectTo, $requestedRedirectTo, $user);
	}

	public function filterRegistrationRedirect($redirectTo) {
		//Note that this does not depend on the user's role as the user isn't logged in yet.
		return $this->filterRedirect(Triggers::REGISTRATION, $redirectTo, '');
	}

	/**
	 * @param string $trigger
	 * @param string $redirectTo
	 * @param string $requestedRedirectTo
	 * @param WP_User|WP_Error $user
	 * @return string
	 * @noinspection PhpUnusedParameterInspection The requested URL is unused right now, but might be useful in the future.
	 */
	protected function filterRedirect($trigger, $redirectTo, $requestedRedirectTo, $user = null) {
		if ( !($user instanceof WP_User) ) {
			return $redirectTo;
		}

		$found = $this->getBestRedirectFor($trigger, $user);
		if ( $found->nonEmpty() ) {
			/** @var Redirect $customRedirect */
			$customRedirect = $found->get();
			$url = $customRedirect->getUrl();

			//WordPress uses wp_safe_redirect() for login, logout, and registration redirects, which
			//only allows local redirects by default. Let's temporarily add the domain name of the URL
			//to the allowed host list to let the user set any redirect URL they want.
			$redirectHost = parse_url($url, PHP_URL_HOST);
			if ( !empty($redirectHost) ) {
				add_filter('allowed_redirect_hosts', function ($allowedHosts) use ($redirectHost) {
					$allowedHosts[] = $redirectHost;
					return $allowedHosts;
				});
			}

			return $url;
		} else {
			return $redirectTo;
		}
	}

	/**
	 * @param WP_User|null $user
	 * @return bool
	 */
	private function checkFirstLogin($user) {
		if ( !($user instanceof WP_User) ) {
			return false;
		}

		/* WordPress doesn't record logins by default, so we use a few checks to help ensure that
		 * this redirect will only happen when a new user logs in for the first time:
		 *
		 * - Account doesn't have the custom "first login done" flag.
		 * - Account is less than X days old.
		 * - Account was created after the admin changed redirect settings for the first time.
		 */

		//Check the first login flag.
		$isFirstLoginDone = !empty(get_user_meta($user->ID, self::FIRST_LOGIN_META_KEY, true));
		if ( $isFirstLoginDone ) {
			return false;
		}
		//This may or may not be the first login, but any future logins definitely won't be first.
		update_user_meta($user->ID, self::FIRST_LOGIN_META_KEY, 1);

		//Account age.
		//Handle invalid timestamps by acting as if the user was registered just now.
		$registrationTime = $this->getRegistrationTimestamp($user, time());
		$accountAgeInDays = (time() - $registrationTime) / (24 * 3600);
		if ( $accountAgeInDays > self::FIRST_LOGIN_AGE_LIMIT_IN_DAYS ) {
			return false;
		}

		//Account created after using the "redirects" feature, not before.
		if ( $registrationTime <= $this->getFirstSettingsActivityTime() ) {
			return false;
		}
		return true;
	}

	/**
	 * @param WP_User $user
	 * @param int $default
	 */
	private function getRegistrationTimestamp($user, $default) {
		if ( !isset($user, $user->user_registered) ) {
			return $default;
		}

		try {
			$dateTime = new DateTime($user->user_registered, new DateTimeZone('UTC'));
			return $dateTime->getTimestamp();
		} catch (Exception $e) {
			return $default;
		}
	}

	/**
	 * @return int
	 */
	private function getFirstSettingsActivityTime() {
		$activityTimestamp = get_site_option(self::SETTINGS_INIT_TIME_KEY, 0);
		if ( is_numeric($activityTimestamp) ) {
			return intval($activityTimestamp);
		} else {
			return 0;
		}
	}

	public function registerScripts() {
		parent::registerScripts();

		wp_register_auto_versioned_script(
			'ame-knockout-sortable',
			plugins_url('knockout-sortable.js', __FILE__),
			['knockout', 'jquery', 'jquery-ui-sortable', 'jquery-ui-draggable', 'jquery-ui-droppable']
		);
	}

	public function enqueueTabScripts() {
		parent::enqueueTabScripts();

		wp_enqueue_auto_versioned_script(
			self::UI_SCRIPT_HANDLE,
			plugins_url('redirector-ui.js', __FILE__),
			[
				'jquery',
				'jquery-ui-position',
				'jquery-ui-autocomplete',
				'knockout',
				'ame-actor-selector',
				'ame-actor-manager',
				'ame-knockout-sortable',
				'ame-lodash',
				$this->searchUsersAction->getScriptHandle(),
			]
		);

		$flattenedRedirects = $this->getRedirects()->flatten();

		$usableMenuItems = [];
		$adminMenu = $this->menuEditor->get_active_admin_menu();
		if ( !empty($adminMenu['tree']) ) {
			$extractor = new MenuExtractor($adminMenu['tree']);
			$usableMenuItems = $extractor->getUsableItems();
		}

		$wpRoles = ameRoleUtils::get_roles();
		$roles = [];
		foreach ($wpRoles->role_objects as $roleId => $role) {
			$roles[] = [
				'name'        => $roleId,
				'displayName' => ameUtils::get($wpRoles->role_names, $roleId, $roleId),
			];
		}

		list($loadedUsers, $hasMoreUsers) = $this->preloadUsers($flattenedRedirects);

		$scriptData = [
			'redirects'       => $flattenedRedirects,
			'usableMenuItems' => $usableMenuItems,
			'roles'           => $roles,
			'users'           => $loadedUsers,
			'hasMoreUsers'    => $hasMoreUsers,
		];

		if ( isset($_GET['selectedTrigger']) && in_array($_GET['selectedTrigger'], Triggers::getValues()) ) {
			$scriptData['selectedTrigger'] = $_GET['selectedTrigger'];
		}

		wp_add_inline_script(
			self::UI_SCRIPT_HANDLE,
			sprintf('wsAmeRedirectorSettings = (%s);', wp_json_encode($scriptData)),
			'before'
		);
	}

	public function enqueueTabStyles() {
		parent::enqueueTabStyles();

		wp_enqueue_auto_versioned_style(
			'ame-redirector-ui-css',
			plugins_url('redirector.css', __FILE__)
		);
	}

	public function handleSettingsForm($post = array()) {
		parent::handleSettingsForm($post);

		$submittedSettings = json_decode($post['settings'], true);
		$validationResult = $this->validateSubmittedSettings($submittedSettings);

		if ( is_wp_error($validationResult) ) {
			//It seems that wp_die() doesn't automatically escape special characters, so let's do that.
			$message = esc_html($validationResult->get_error_message());
			wp_die($message);
		}

		$newRedirects = new RedirectCollection();
		foreach ($submittedSettings['redirects'] as $redirect) {
			$newRedirects->add($redirect);
		}
		$this->redirects = $newRedirects;
		$this->saveSettings();

		//Remember the first time the admin changes settings. This can then be used to avoid applying
		//"first login" redirects to users who existed before any custom redirects did.
		$activityTimestamp = get_site_option(self::SETTINGS_INIT_TIME_KEY, null);
		if ( empty($activityTimestamp) ) {
			add_site_option(self::SETTINGS_INIT_TIME_KEY, time());
		}

		$params = ['updated' => 1];
		if ( !empty($post['selectedTrigger']) ) {
			$params['selectedTrigger'] = strval($post['selectedTrigger']);
		}

		wp_redirect($this->getTabUrl($params));
		exit;
	}

	/**
	 * @param $settings
	 * @return bool|WP_Error
	 */
	protected function validateSubmittedSettings($settings) {
		if ( !is_array($settings) ) {
			return new WP_Error(
				'ame_invalid_json',
				sprintf('Invalid JSON data. Expected an associative array, got %s.', gettype($settings))
			);
		}

		if ( !array_key_exists('redirects', $settings) ) {
			return new WP_Error('rui_missing_redirects_key', 'The required "redirects" field is missing.');
		}

		$allowedProperties = [
			//Actor IDs always follow the "prefix:value" format.
			'actorId'           => /** @lang RegExp */
				'@^[a-z]{1,15}+:[^\s].{0,300}+$@i',
			//The URL can be basically anything, so we don't try to validate it.
			'urlTemplate'       => null,
			//Menu template IDs are based on menu URLs, so they're pretty unpredictable. If one is given, it must be non-empty.
			'menuTemplateId'    => /** @lang RegExp */
				'@^.@',
			//A trigger is always a lowercase string. We could just list the supported values once dev. is done.
			'trigger'           => /** @lang RegExp */
				'@^[a-z\-]{2,20}+$@i',
			//The shortcode flag is a boolean value. No regex for that.
			'shortcodesEnabled' => null,
		];
		$requiredProperties = [
			'actorId'           => true,
			'urlTemplate'       => true,
			'shortcodesEnabled' => true,
			'trigger'           => true,
		];

		foreach ($settings['redirects'] as $key => $redirect) {
			if ( !is_array($redirect) ) {
				return new WP_Error(
					'rui_bad_redirect_data_type',
					sprintf('Redirect %s should be an array but it is actually %s', $key, gettype($redirect))
				);
			}

			//Verify that it has all the required properties.
			$missingProperties = array_diff_key($requiredProperties, $redirect);
			if ( !empty($missingProperties) ) {
				$firstMissingProp = reset($missingProperties);
				return new WP_Error(
					'rui_missing_key',
					sprintf('Redirect %s is missing the required property "%s"', $key, $firstMissingProp)
				);
			}

			//Verify that the redirect has only allowed properties.
			$badProperties = array_diff_key($redirect, $allowedProperties);
			if ( !empty($badProperties) ) {
				$firstBadProp = reset($badProperties);
				return new WP_Error(
					'rui_bad_key',
					sprintf('Redirect %s has an unsupported property "%s"', $key, $firstBadProp)
				);
			}

			//String properties must match their validation regex (if any).
			foreach ($allowedProperties as $property => $regex) {
				if (
					is_string($regex) && isset($redirect[$property])
					&& (!is_string($redirect[$property]) || !preg_match($regex, $redirect[$property]))
				) {
					return new WP_Error(
						'rui_invalid_property_value',
						sprintf('Redirect %s: Property "%s" has an invalid value.', $key, $property)
					);
				}
			}

			//shortcodesEnabled must be a boolean.
			if ( array_key_exists('shortcodesEnabled', $redirect) && !is_bool($redirect['shortcodesEnabled']) ) {
				return new WP_Error(
					'rui_invalid_property_value',
					sprintf(
						'Redirect %s: The "shortcodesEnabled" property is invalid.'
						. ' Expected a boolean, but actual type is "%s".',
						$key,
						gettype($redirect['shortcodesEnabled'])
					)
				);
			}

			//URL template must be a string.
			if ( !is_string($redirect['urlTemplate']) ) {
				return new WP_Error(
					'rui_invalid_property_value',
					sprintf(
						'Redirect %s: The "urlTemplate" property is invalid.'
						. ' Expected a string, but actual type is "%s".',
						$key,
						gettype($redirect['urlTemplate'])
					)
				);
			}

			//URL template must be non-empty.
			if ( trim($redirect['urlTemplate']) === '' ) {
				return new WP_Error(
					'rui_empty_url',
					sprintf('Redirect %s: The "urlTemplate" property is empty.', $key)
				);
			}
		}

		return true;
	}

	/**
	 * Load user data for display in the redirect management UI.
	 *
	 * Will load some or all users depending on how many users there are in total.
	 * Users that have custom redirects are always loaded.
	 *
	 * @param array $flattenedRedirects
	 * @return array{array,boolean} An array of users and a boolean indicating if the total number exceeds the limit.
	 */
	protected function preloadUsers(array $flattenedRedirects) {
		$loadedUsers = get_users([
			//In Multisite, include all sites and not just the current site. Note that this might not work if used
			//together with some other arguments (judging by WP_User_Query::prepare_query source code).
			'blog_id'     => 0,
			'number'      => self::PRELOADED_USER_LIMIT + 1,
			'count_total' => false, //Allegedly, this can improve performance.
			'fields'      => self::$desiredUserFields,
		]);

		$hasMoreUsers = count($loadedUsers) > self::PRELOADED_USER_LIMIT;

		$isUserLoaded = [];
		foreach ($loadedUsers as $user) {
			$isUserLoaded[$user->user_login] = true;
		}

		//Always load users that already have custom redirects.
		$userPrefix = 'user:';
		$userPrefixLength = strlen($userPrefix);
		$usersToLoad = [];
		foreach ($flattenedRedirects as $details) {
			if ( substr($details['actorId'], 0, $userPrefixLength) === $userPrefix ) {
				$userLogin = substr($details['actorId'], $userPrefixLength);
				if (
					is_string($userLogin) && ($userLogin !== '')
					&& empty($isUserLoaded[$userLogin])
					&& empty($usersToLoad[$userLogin])
				) {
					$usersToLoad[$userLogin] = true;
				}
			}
		}

		if ( !empty($usersToLoad) ) {
			$additionalUsers = get_users([
				'blog_id'     => 0,
				'count_total' => false,
				'fields'      => self::$desiredUserFields,
				'login__in'   => array_values($usersToLoad),
			]);
			$loadedUsers = array_merge($loadedUsers, $additionalUsers);
		}

		return [$loadedUsers, $hasMoreUsers];
	}

	public function userCanSearchUsers() {
		return $this->menuEditor->current_user_can_edit_menu();
	}

	public function ajaxSearchUsers($params) {
		$foundUsers = get_users([
			'search'         => '*' . $params['term'] . '*',
			'search_columns' => ['user_login', 'display_name'],
			'blog_id'        => 0,
			'number'         => self::SEARCH_USER_LIMIT,
			'count_total'    => false,
			'fields'         => self::$desiredUserFields,
		]);

		$results = [];
		foreach ($foundUsers as $user) {
			$user = (array)$user;
			$results[] = array_merge($user, ['label' => $user['user_login']]);
		}

		return $results;
	}

	public function addContextualHelp() {
		if ( !is_callable('get_current_screen') ) {
			return;
		}
		$screen = get_current_screen();
		if ( $screen ) {
			$screen->add_help_tab([
				'title'   => 'Shortcodes',
				'id'      => 'ame-rui-help-shortcodes',
				'content' => $this->getShortcodeHelp(),
			]);

			$screen->add_help_tab([
				'title'   => 'Priority',
				'id'      => 'ame-rui-help-priority',
				'content' => $this->getPriorityHelp(),
			]);

			$screen->add_help_tab([
				'title'   => 'First Login',
				'id'      => 'ame-rui-help-first-login',
				'content' => $this->getFirstLoginHelp(),
			]);

			$screen->add_help_tab([
				'title'   => 'Disabling Redirects',
				'id'      => 'ame-rui-emergency-shutdown',
				'content' => $this->getEmergencyShutdownHelp(),
			]);
		}
	}

	private function getShortcodeHelp() {
		$message = '<p>You can use shortcodes in redirect URLs. This plugin comes with a few shortcodes that could be useful for redirects:</p>';
		$message .= '<ul>';

		$message .= '<li>' . $this->formatShortcodeInfo(
				'ame-wp-admin',
				'base URL of the WordPress dashboard. Includes the trailing slash.',
				'[ame-wp-admin]'
			) . '</li>';

		$message .= '<li>' . $this->formatShortcodeInfo(
				'ame-home-url',
				'site URL. Usually, this will be the same as the "Site Address (URL)" value in <em>Settings &rarr; General</em>.',
				'[ame-home-url]'
			) . '</li>';

		$message .= '<li>' . $this->formatShortcodeInfo(
				'ame-user-info',
				'information about the logged-in user. Use the <code>field</code> parameter to specify which field to output. Examples:'
			) . '<ul>';

		$userExampleFields = [
			'ID',
			'user_login',
			'display_name',
			'locale',
			'user_nicename',
		];
		foreach ($userExampleFields as $field) {
			$code = '[ame-user-info field="' . $field . '"]';
			$message .= sprintf('<li><code>%s</code> = %s</li>', $code, $this->getExampleShortcodeOutput($code));
		}

		$message .= '</ul></ul>';

		$message .= '<p>Some shortcodes from other plugins may also work, but it depends on the shortcode.</p>';

		return $message;
	}

	private function formatShortcodeInfo($tag, $description, $exampleCode = null) {
		$result = sprintf('<code>[%s]</code> - %s', esc_html($tag), $description);
		if ( $exampleCode !== null ) {
			$result .= ' Example output:<br>' . $this->getExampleShortcodeOutput($exampleCode);
		}
		return $result;
	}

	private function getExampleShortcodeOutput($exampleCode) {
		$output = do_shortcode($exampleCode);
		if ( $output === '' ) {
			return '<em>(empty string)</em>';
		}
		return sprintf('<code>%s</code>', esc_html($output));
	}

	private function getPriorityHelp() {
		$tips = [
			'Redirects are processed from top to bottom and the first matching setting is used.',
			'You can drag and drop redirects to change their priority.',
			'When you create redirects for specific users their order doesn\'t matter, but you can still move them around to organize them.',
		];

		return '<ul><li>'
			. implode("</li>\n<li>", array_map('esc_html', $tips))
			. '</li></ul>';
	}

	private function getFirstLoginHelp() {
		$conditions = [
			sprintf('The user was registered less than %d days ago.', self::FIRST_LOGIN_AGE_LIMIT_IN_DAYS),
			'The user was registered <em>after</em> redirect settings were changed for the first time.',
			sprintf('The user has not logged in while this plugin and the "%s" module is active.', $this->tabTitle),
		];

		return '<p>A "first login" redirect happens when a new user logs in for the first time.<p>'
			. '<p>WordPress does not record logins, so sometimes it\'s not possible to reliably
				determine if a user has already logged in before or not. To help avoid unnecessary 
				redirects, the plugin will only perform a "first login" redirect when all of the following
				conditions are met:</p>'
			. '<ul><li>'
			. implode("</li>\n<li>", $conditions)
			. '</li></ul>';
	}

	private function getEmergencyShutdownHelp() {
		return '<p>If something goes wrong, you can disable all custom redirects by adding this code to wp-config.php:</p>'
			. '<p><code>define(\'AME_DISABLE_REDIRECTS\', true);</code></p>'
			. '<p>Note that this only applies to redirects created using this plugin. It will not prevent other plugins or themes from redirecting users.</p>';
	}
}

class Redirect {
	/**
	 * @var string
	 */
	private $actorId;
	/**
	 * @var string
	 */
	private $urlTemplate;

	/**
	 * @var boolean
	 */
	private $shortcodesEnabled;

	protected function __construct(
		$actorId,
		$urlTemplate,
		$shortcodesEnabled = false
	) {
		$this->actorId = $actorId;
		$this->urlTemplate = $urlTemplate;
		$this->shortcodesEnabled = $shortcodesEnabled;
	}

	public static function fromArray(array $properties) {
		return new static(
			$properties['actorId'],
			$properties['urlTemplate'],
			!empty($properties['shortcodesEnabled'])
		);
	}

	/**
	 * @return string
	 */
	public function getActorId() {
		return $this->actorId;
	}

	/**
	 * @return string
	 */
	public function getUrl() {
		$url = $this->urlTemplate;
		if ( $this->shortcodesEnabled && function_exists('do_shortcode') ) {
			$url = do_shortcode($url);
		}
		return $url;
	}
}

class RedirectCollection {
	/**
	 * @var array<string,array[]>
	 */
	protected $rawItems = [];

	public function __construct($rawItems = []) {
		$this->rawItems = $rawItems;
	}

	/**
	 * @param string $trigger
	 * @return Redirect[]
	 */
	public function filterByTrigger($trigger) {
		if ( isset($this->rawItems[$trigger]) ) {
			return array_map([Redirect::class, 'fromArray'], $this->rawItems[$trigger]);
		} else {
			return [];
		}
	}

	/**
	 * @return array
	 */
	public function toDbFormat() {
		return $this->rawItems;
	}

	/**
	 * @param array $items
	 * @return static
	 */
	public static function fromDbFormat($items) {
		return new static($items);
	}

	/**
	 * @return array
	 */
	public function flatten() {
		$results = [];
		foreach ($this->rawItems as $trigger => $items) {
			foreach ($items as $properties) {
				if ( !is_array($properties) ) {
					continue;
				}
				$properties['trigger'] = $trigger;
				$results[] = $properties;
			}
		}
		return $results;
	}

	/**
	 * Add a redirect to the collection.
	 *
	 * @param array $redirectProperties
	 */
	public function add($redirectProperties) {
		$trigger = $redirectProperties['trigger'];
		if ( !isset($this->rawItems[$trigger]) ) {
			$this->rawItems[$trigger] = [];
		}
		$this->rawItems[$trigger][] = $redirectProperties;
	}
}

abstract class Triggers {
	const LOGIN = 'login';
	const LOGOUT = 'logout';
	const REGISTRATION = 'registration';
	const FIRST_LOGIN = 'firstLogin';

	public static function getValues() {
		return [self::LOGIN, self::LOGOUT, self::REGISTRATION, self::FIRST_LOGIN];
	}
}

/**
 * Really basic Option type implementation.
 *
 * @template T
 */
abstract class Option {
	/**
	 * @return T
	 */
	abstract public function get();

	/**
	 * @return boolean
	 */
	abstract public function isEmpty();

	/**
	 * @return boolean
	 */
	abstract public function nonEmpty();

	/**
	 * @return boolean
	 */
	public function isDefined() {
		return $this->nonEmpty();
	}
}

/**
 * @template T
 * @extends Option<T>
 */
final class Some extends Option {
	/**
	 * @var T
	 */
	private $value;

	/**
	 * Some constructor.
	 *
	 * @param T $value
	 */
	public function __construct($value) {
		$this->value = $value;
	}

	/**
	 * @return T
	 */
	public function get() {
		return $this->value;
	}

	public function isEmpty() {
		return false;
	}

	public function nonEmpty() {
		return true;
	}
}

/**
 * @template T
 * @extends Option<T>
 */
final class None extends Option {
	private function __construct() {
		//This constructor only exists to prevent others from creating instances.
	}

	public function get() {
		throw new RuntimeException('Option value is not set');
	}

	public function isEmpty() {
		return true;
	}

	public function nonEmpty() {
		return false;
	}

	public static function getInstance() {
		static $instance = null;
		if ( $instance === null ) {
			$instance = new self();
		}
		return $instance;
	}
}

class MenuExtractor {
	private $items = [];

	public function __construct($menuTree) {
		foreach ($menuTree as $item) {
			$this->processItem($item);
		}
	}

	private function processItem($item, $parentTitle = null) {
		//Skip separators.
		if ( !empty($item['separator']) ) {
			return;
		}

		$templateId = ameMenuItem::get($item, 'template_id');
		$url = ameMenuItem::get($item, 'url');

		$rawTitle = ameMenuItem::get($item, 'menu_title', '[Untitled]');
		$fullTitle = trim(strip_tags(ameMenuItem::remove_update_count($rawTitle)));
		if ( $parentTitle !== null ) {
			$fullTitle = $parentTitle . ' → ' . $fullTitle;
		}

		if ( empty($item['custom']) && ($templateId !== null) && !$this->looksLikeUnusableSlug($url) ) {
			//Add the admin URL shortcode to the URL if it looks like a relative URL that points
			//to a dashboard page.
			if ( $this->looksLikeDashboardUrl($url) ) {
				$url = '[ame-wp-admin]' . $url;
			}

			$this->items[] = [
				'templateId' => $templateId,
				'title'      => $fullTitle,
				'url'        => $url,
			];
		}

		if ( !empty($item['items']) ) {
			foreach ($item['items'] as $submenu) {
				$this->processItem($submenu, $fullTitle);
			}
		}
	}

	/**
	 * @param string $url
	 * @return boolean
	 */
	private function looksLikeDashboardUrl($url) {
		$scheme = parse_url($url, PHP_URL_SCHEME);
		if ( !empty($scheme) ) {
			return false;
		}

		return preg_match('@^[a-z0-9][a-z0-9_-]{0,30}?\.php@i', $url) === 1;
	}

	/**
	 * Check if a string looks like a plain admin menu slug and not a usable URL.
	 *
	 * Sometimes plugins create admin menus that don't have a callback function. A menu like that
	 * will show up fine, and it can be used as a parent for other menu items. However, the menu
	 * itself won't have a working URL, so we don't want to offer it as a redirect option.
	 *
	 * For example, the top level "WooCommerce" menu doesn't have a valid URL, it just has
	 * a slug: "woocommerce". You just usually don't notice this because WordPress automatically
	 * replaces the menu URL with the URL of the first child item.
	 *
	 * @param string|mixed $url
	 * @return bool
	 */
	private function looksLikeUnusableSlug($url) {
		if ( !is_string($url) ) {
			return true;
		}

		//Technically, a menu slug could be anything, so we can't easily determine if a string
		//is really a slug or just a weird relative URL. However, it seems safe to assume that
		//a "URL" that has no dots (so no file extension or domain name) and no slashes (so no
		//protocol or relative directories) is probably unusable.
		$suspiciousSegmentLength = strcspn($url, './');
		return ($suspiciousSegmentLength === strlen($url));
	}

	public function getUsableItems() {
		return $this->items;
	}
}