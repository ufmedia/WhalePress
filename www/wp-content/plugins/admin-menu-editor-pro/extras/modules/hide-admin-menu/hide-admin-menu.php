<?php
class ameAdminMenuHider {
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

		add_action('init', array($this, 'maybe_hide_admin_menu'));
		add_filter('admin_menu_editor-show_general_box', '__return_true');
		add_action('admin_menu_editor-general_box', array($this, 'output_option'), 10);
	}

	public function maybe_hide_admin_menu() {
		$this->extras = $GLOBALS['wsMenuEditorExtras'];

		if ( $this->should_hide_admin_menu() ) {
			$this->hide_admin_menu();
		}
	}

	/**
	 * Should we hide the entire admin menu from the current user?
	 *
	 * @return bool
	 */
	private function should_hide_admin_menu() {
		$config = $this->menuEditor->load_custom_menu();
		if ( !isset($config, $config['component_visibility'], $config['component_visibility']['adminMenu']) ) {
			return false;
		}

		$grant_access = $config['component_visibility']['adminMenu'];
		return !$this->extras->check_current_user_access($grant_access, null, null, true, AME_RC_USE_DEFAULT_ACCESS);
	}

	private function hide_admin_menu() {
		add_action('in_admin_header', array($this, 'output_hiding_css'));
	}

	/**
	 * Output CSS that hides the admin menu container(s).
	 */
	public function output_hiding_css() {
		?>
		<!--suppress CssUnusedSymbol -->
		<style type="text/css">
			#adminmenumain, #adminmenuback, #adminmenuwrap {
				display: none !important;
			}
			#wpcontent, #wpfooter {
				margin-left: 0 !important;
			}
		</style>
		<?php
	}

	/**
	 * Output the form HTML for the menu editor page.
	 */
	public function output_option() {
		?>
		<label>
			<input type="checkbox" id="ws_ame_show_admin_menu">
			Show the admin menu

			<a class="ws_tooltip_trigger"
			   title="Uncheck to hide the entire admin menu.
					&lt;br&gt;&lt;br&gt;
					Note: This is a purely cosmetic change. It won't prevent people from opening
					admin pages by following other links or by manually entering the page URL."
			><div class="dashicons dashicons-info"></div></a>
		</label><br>
		<?php
	}
}