<?php

/**
 * Hides the Admin Bar / Toolbar.
 */
class ameAdminBarHider {
	/**
	 * @var WPMenuEditor
	 */
	private $menuEditor;
	/**
	 * @var wsMenuEditorExtras
	 */
	private $extras;

	public function __construct($menuEditor) {
		$this->menuEditor = $menuEditor;

		add_action('init', array($this, 'maybe_hide_admin_bar'));
		add_filter('admin_menu_editor-show_general_box', '__return_true');
		add_action('admin_menu_editor-general_box', array($this, 'output_option'), 20);
	}

	public function maybe_hide_admin_bar() {
		$this->extras = $GLOBALS['wsMenuEditorExtras'];

		if ( $this->should_hide_admin_bar() ) {
			$this->hide_admin_bar();
		}
	}

	/**
	 * Should we hide the admin bar from the current user?
	 *
	 * @return bool
	 */
	private function should_hide_admin_bar() {
		$config = $this->menuEditor->load_custom_menu();
		if ( !isset($config, $config['component_visibility'], $config['component_visibility']['toolbar']) ) {
			return false;
		}

		$grant_access = $config['component_visibility']['toolbar'];
		return !$this->extras->check_current_user_access($grant_access, null, null, true, AME_RC_USE_DEFAULT_ACCESS);
	}

	/**
	 * Hide the Toolbar/Admin Bar both on the front-end and the dashboard.
	 */
	private function hide_admin_bar() {
		add_filter('show_admin_bar', '__return_false');
		add_action('in_admin_header', array($this, 'remove_admin_bar_css_classes'));
		add_filter('wp_admin_bar_class', array($this, 'filter_admin_bar_class'));
		add_action('admin_print_scripts-profile.php', array($this, 'hide_toolbar_settings'));
		add_action('admin_bar_init', array($this, 'remove_bump_css'));
	}

	/**
	 * Remove Admin Bar related classes from the <html> and <body> tags. Usually
	 * these classes are not filterable, so we have to remove them with JS.
	 */
	public function remove_admin_bar_css_classes() {
		?>
		<script type="text/javascript">
			var body = document.body,
				html = document.documentElement;
			body.className = body.className.replace(/\badmin-bar\b/, '');
			html.className = html.className.replace(/\bwp-toolbar\b/, '');
		</script>
		<?php
	}

	/**
	 * Replace the WP_Admin_Bar class with a dummy implementation that doesn't render anything.
	 *
	 * @param string $className
	 * @return string
	 */
	public function filter_admin_bar_class($className) {
		require_once dirname(__FILE__) . '/ameDummyAdminBar.php';

		if ( class_exists('ameDummyAdminBar') ) {
			return 'ameDummyAdminBar';
		} else {
			//Just in case something changes in WP core and the WP_Admin_Bar class becomes unavailable.
			return $className;
		}
	}

	/**
	 * Hide the "Show Toolbar when viewing site" option on the "Profile" page.
	 */
	public function hide_toolbar_settings() {
		?>
		<!--suppress CssUnusedSymbol -->
		<style type="text/css"> .show-admin-bar { display: none; } </style>
		<?php
	}

	/**
	 * Remove the callback that adds an "!important" top margin to <html> and <body>.
	 *
	 * Normally this isn't necessary. It's a compatibility workaround.
	 */
	public function remove_bump_css() {
		remove_action('wp_head', '_admin_bar_bump_cb');
	}

	/**
	 * Add a checkbox to the menu editor page.
	 */
	public function output_option() {
		?>
		<label>
			<input type="checkbox" id="ws_ame_show_toolbar">
			Show the Toolbar

			<a class="ws_tooltip_trigger"
			   title="Uncheck to hide the Toolbar (a.k.a Admin Bar) both on the front-end and in the dashboard."
			><div class="dashicons dashicons-info"></div></a>
		</label>
		<?php
	}
}