<?php
/**
 * Server-side utilities for our CasperJs test suite.
 */

class ameTestUtilities {
	private static $helperOption = 'ame_active_test_helpers';
	private static $activeHelpers = array();
	private static $loadedHelpers = array();

	public static function init() {
		self::$activeHelpers = get_site_option(self::$helperOption, array());

		add_action('plugins_loaded', array(__CLASS__, 'maybeQuickSetup'));

		if ( isset($_GET['ame-activate-helper']) && !empty($_GET['ame-activate-helper']) ) {
			self::activateHelper(strval($_GET['ame-activate-helper']));
		}
		if ( isset($_GET['ame-deactivate-helper']) && !empty($_GET['ame-deactivate-helper']) ) {
			self::deactivateHelper(strval($_GET['ame-deactivate-helper']));
		}
		if ( isset($_GET['ame-deactivate-helpers']) && !empty($_GET['ame-deactivate-helpers']) ) {
			self::deactivateAllHelpers();
		}

		self::loadActiveHelpers();

		add_action('wp_footer', array(__CLASS__, 'showLoadedHelpers'));
		add_action('admin_footer', array(__CLASS__, 'showLoadedHelpers'));
	}

	public static function maybeQuickSetup() {
		if ( isset($_GET['ame-quick-test-setup']) && !empty($_GET['ame-quick-test-setup']) ) {
			ameTestUtilities::quickSetup();
		}
	}

	private static function quickSetup() {
		if ( isset($_GET['activate-helpers']) ) {
			$helpers = explode(',', strval($_GET['activate-helpers']));
			self::$activeHelpers = array_fill_keys(array_filter($helpers), true);
		} else {
			self::$activeHelpers = array();
		}
		self::saveHelperSettings();

		//Reset all menu editor configuration.
		require __DIR__ . '/server-helpers/reset-configuration.php';

		if ( isset($_GET['username'], $_GET['password']) ) {
			$user = wp_signon(array(
				'user_login' => strval($_GET['username']),
				'user_password' => strval($_GET['password']),
				'remember' => false,
			));
			if ( is_wp_error($user) ) {
				wp_die($user);
			}

			wp_redirect(admin_url('options-general.php?page=menu_editor'));
			exit;
		}
	}

	private static function loadActiveHelpers() {
		$helperDir = dirname(__FILE__) . '/server-helpers';
		foreach(array_keys(self::$activeHelpers) as $name) {
			if ( $name === '' ) {
				continue;
			}

			$helperFilename = $helperDir . '/' . $name . '.php';
			if ( is_file($helperFilename) ) {
				require $helperFilename;
				self::$loadedHelpers[] = $name;
			} else {
				wp_die(
					'Failed to load the "' . htmlentities($name) . '" helper - file doesn\'t exist.',
					'Test Helper Error'
				);
			}
		}
	}

	public static function showLoadedHelpers() {
		echo '<div id="ame-test-loaded-helpers">';
		if ( !empty(self::$loadedHelpers) ) {
			echo htmlentities(implode(', ', self::$loadedHelpers));
		} else {
			echo 'No helpers loaded.';
		}
		echo '</div>';
	}

	private static function saveHelperSettings() {
		update_site_option(self::$helperOption, self::$activeHelpers);
	}

	public static function activateHelper($name) {
		self::$activeHelpers[$name] = true;
		self::saveHelperSettings();
	}

	public static function deactivateHelper($name) {
		if ( isset(self::$activeHelpers[$name]) ) {
			unset(self::$activeHelpers[$name]);
		}
		self::saveHelperSettings();
	}

	public static function deactivateAllHelpers() {
		self::$activeHelpers = array();
		self::saveHelperSettings();
	}
}

