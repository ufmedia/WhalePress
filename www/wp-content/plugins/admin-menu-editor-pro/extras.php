<?php

/**
 * These flags control how the {@link wsMenuEditorExtras::check_current_user_access} method
 * deals with users that have multiple roles with different permissions. "RC" stands for "role combination".
 */

/**
 * Use only custom role permissions. Roles that don't have explicit settings will be ignored.
 */
define('AME_RC_ONLY_CUSTOM', 1);

/**
 * When a role has no custom settings, use the $default_access argument instead.
 */
define('AME_RC_USE_DEFAULT_ACCESS', 2);

require_once AME_ROOT_DIR . '/extras/exportable-module.php';
require_once AME_ROOT_DIR . '/extras/persistent-pro-module.php';
require_once AME_ROOT_DIR . '/extras/import-export/import-export.php';

class wsMenuEditorExtras {
	/** @var WPMenuEditor */
	private $wp_menu_editor;

	private $framed_pages = array();
	private $embedded_wp_pages = array();

	//A list of IDs for menu items output by Ozh's Admin Drop Down Menu
	//(those can't be modified the usual way because Ozh's plugin strips tags
	//from submenu titles).
	private $ozhs_new_window_menus;

	protected $export_settings;

	/**
	 * @var bool[] Cached user capability values that are only used in the DIRECTLY_GRANTED_VIRTUAL_CAPS mode.
	 * Note that this cache is different from the from the cache in the core class (different modes).
	 */
	private $cached_user_caps = array();

	private $fields_supporting_shortcodes = array('page_title', 'menu_title', 'file', 'css_class', 'hookname', 'icon_url');
	private $current_shortcode_item = null;

	private $are_headings_collapsible = false;

	/**
	 * Class constructor.
	 *
	 * @param WPMenuEditor $wp_menu_editor
	 */
	function __construct($wp_menu_editor){
		$this->wp_menu_editor = $wp_menu_editor;

		add_filter('admin_menu_editor-available_modules', array($this, 'filter_available_modules'), 10, 1);

		//Multisite: Clear caches when switching to another site.
		add_action('switch_blog', array($this, 'clear_site_specific_caches'), 10, 0);

		//Apply most Pro version menu customizations all in one go. This reduces apply_filters() overhead
		//and is slightly faster than adding a separate filter for each feature.
		add_filter('custom_admin_menu', array($this, 'apply_admin_menu_filters'));
		add_filter('custom_admin_submenu', array($this, 'apply_admin_menu_filters'), 10, 2);

		add_action('admin_menu_editor-menu_merged', array($this, 'on_menu_merged'), 10, 1);
		add_action('admin_menu_editor-menu_built', array($this, 'on_menu_built'), 10, 2);

		//Add some extra shortcodes of our own
		$shortcode_callback = array($this, 'handle_shortcode');
		$info_shortcodes = array(
			'wp-wpurl',    //WordPress address (URI), as returned by get_bloginfo()
			'wp-siteurl',  //Blog address (URI)
			'wp-admin',    //Admin area URL (with a trailing slash)
			'wp-name',     //Weblog title
			'wp-version',  //Current WP version
			'wp-user-display-name', //Current user's display name,
			'wp-user-first-name',   // first name,
			'wp-user-last-name',    // last name,
			'wp-user-login',        // and username/login.
			'wp-logout-url', //A URL that lets the current user log out.
		);
		foreach($info_shortcodes as $tag){
			add_shortcode($tag, $shortcode_callback);
		}
		add_shortcode('ame-count-bubble', array($this, 'handle_count_shortcode'));

		//Output the menu-modification JS after the menu has been generated.
		//'in_admin_header' is, AFAIK, the action that fires the soonest after menu
		//output has been completed, so we use that.
		add_action('in_admin_header', array($this, 'fix_flagged_menus'));

		//Import/export settings
		$this->export_settings = array(
		 	'max_file_size' => 5*1024*1024,
		    'file_extension' => 'dat',
		    'old_format_string' => 'wsMenuEditor_ExportFile',
		);

		//Insert the import and export dialog HTML into the editor's page
		add_action('admin_menu_editor-footer', array($this, 'menu_editor_footer'));
		//Handle menu downloads and uploads
		add_action('admin_menu_editor-header', array($this, 'menu_editor_header'));
		//Handle export requests
		add_action( 'wp_ajax_export_custom_menu', array($this,'ajax_export_custom_menu') );
		//Add the "Import" and "Export" buttons
		add_action('admin_menu_editor-sidebar', array($this, 'add_extra_buttons'));

		//Initialise the universal import/export handler.
		wsAmeImportExportFeature::get_instance($this->wp_menu_editor);

		add_filter('admin_menu_editor-self_page_title', array($this, 'pro_page_title'), 10, 0);
		add_filter('admin_menu_editor-self_menu_title', array($this, 'pro_menu_title'), 10, 0);

		//Let other components know we're Pro.
		add_filter('admin_menu_editor_is_pro', array($this, 'is_pro_version'), 10, 0);

		//Add menu item drop zones to the top-level and sub-menu containers.
		add_action('admin_menu_editor-container', array($this, 'output_menu_dropzone'), 10, 1);

		//Add submenu icons.
		add_filter('admin_menu_editor-submenu_with_icon', array($this, 'add_submenu_icon_html'), 10, 2);

		//Multisite: Let people edit the network admin menu.
		add_action(
			'network_admin_menu',
			array($this->wp_menu_editor, 'hook_admin_menu'),
			$this->wp_menu_editor->get_magic_hook_priority()
		);

		//Add extra scripts to the menu editor.
		add_action('admin_menu_editor-register_scripts', array($this, 'register_extra_scripts'));
		add_filter('admin_menu_editor-editor_script_dependencies', array($this, 'add_extra_editor_dependencies'));

		/**
		 * Access management extensions.
		 */

		//Allow usernames to be used in capability checks. Syntax : "user:user_login"
		add_filter('admin_menu_editor-virtual_caps', array($this, 'add_user_actor_cap'), 10, 2);

		//Enable advanced capability operations (OR, AND, NOT) for internal use.
		add_filter('admin_menu_editor-current_user_can', array($this, 'grant_computed_caps_to_current_user'), 10, 2);

		//Custom per-role and per-user access settings (distinct from the "extra capability" field.
		add_filter('custom_admin_menu_capability', array($this, 'apply_custom_access'));

		//Role access: Grant virtual capabilities to roles/users that need them to access certain menus.
		add_filter('admin_menu_editor-virtual_caps', array($this, 'prepare_virtual_caps_for_user'), 10, 2);
		add_filter('role_has_cap', array($this, 'grant_virtual_caps_to_role'), 200, 3);

		add_action('load-options.php', array($this, 'disable_virtual_caps_on_all_options'));

		//Make it possible to automatically hide new admin menus.
		add_filter('admin_menu_editor-new_menu_grant_access', array($this, 'get_new_menu_grant_access'));

		//Remove the plugin from the "Plugins" page for users who're not allowed to see it.
		if ( $this->wp_menu_editor->get_plugin_option('plugins_page_allowed_user_id') !== null ) {
			add_filter('all_plugins', array($this, 'filter_plugin_list'));
		}

		/**
		 * Menu color scheme generation.
		 */
		add_filter('ame_pre_set_custom_menu', array($this, 'add_menu_color_css'));
		add_action('wp_ajax_ame_output_menu_color_css', array($this,'ajax_output_menu_color_css') );

		//FontAwesome icons.
		add_filter('custom_admin_menu', array($this, 'add_menu_fa_icon'), 10, 1);
		add_filter('admin_menu_editor-icon_selector_tabs', array($this, 'add_fa_selector_tab'), 10, 1);
		add_action('admin_menu_editor-icon_selector', array($this, 'output_fa_selector_tab'));

		//Menu headings.
		if ( (is_admin() || (defined('DOING_AJAX') && DOING_AJAX)) && version_compare(PHP_VERSION, '5.6', '>=') ) {
			require_once AME_ROOT_DIR . '/extras/menu-headings/ameMenuHeadingStyler.php';
			new ameMenuHeadingStyler($this->wp_menu_editor);
		}

		//License management
		add_filter('wslm_license_ui_title-admin-menu-editor-pro', array($this, 'license_ui_title'), 10, 0);
		add_action('wslm_license_ui_logo-admin-menu-editor-pro', array($this, 'license_ui_logo'));
		add_action('wslm_license_ui_details-admin-menu-editor-pro', array($this, 'license_ui_upgrade_link'), 10, 3);
		add_filter('wslm_product_name-admin-menu-editor-pro', array($this, 'license_ui_product_name'), 10, 0);

		/**
		 * Add scripts and styles that apply to all admin pages.
		 */
		add_action('admin_enqueue_scripts', array($this, 'enqueue_dashboard_deps'));

		/**
		 * Add-on display and installation.
		 */
		//Disabled for now. This feature should be finished later.
		/*
		add_action('admin-menu-editor-display_addons', array($this, 'display_addons'));
		add_action('admin_menu_editor-enqueue_scripts-settings', array($this, 'enqueue_addon_scripts'));

		add_action('wp_ajax_ws_ame_activate_add_on', array($this, 'ajax_activate_addon'));
		add_action('wp_ajax_ws_ame_activate_add_on', array($this, 'ajax_install_addon'));
		//*/
	}

  /**
   * Process shortcodes in menu fields
   *
   * @param array $item
   * @return array
   */
	function do_shortcodes($item){
		foreach($this->fields_supporting_shortcodes as $field){
			if ( isset($item[$field]) ) {
				$value = $item[$field];
				if ( strpos($value, '[') !== false ){
					$this->current_shortcode_item = $item;
					$item[$field] = do_shortcode($value);
					$this->current_shortcode_item = null;
				}
			}
		}
		return $item;
	}

  /**
   * Get the value of one of our extra shortcodes
   *
   * @param array $atts Shortcode attributes (ignored)
   * @param string $content Content enclosed by the shortcode (ignored)
   * @param string $code
   * @return string Shortcode will be replaced with this value
   */
	function handle_shortcode($atts, /** @noinspection PhpUnusedParameterInspection */ $content = null, $code = ''){
		//The shortcode tag can be either $code or the zeroth member of the $atts array.
		if ( empty($code) ){
			$code = isset($atts[0]) ? $atts[0] : '';
		}

		$info = '['.$code.']'; //Default value
		switch($code){
			case 'wp-wpurl':
				$info = get_bloginfo('wpurl');
				break;

			case 'wp-siteurl':
				$info = get_bloginfo('url');
				break;

			case 'wp-admin':
				$info = admin_url();
				break;

			case 'wp-name':
				$info = get_bloginfo('name');
				break;

			case 'wp-version':
				$info = get_bloginfo('version');
				break;

			case 'wp-user-display-name':
				$info = $this->get_current_user_property('display_name');
				break;

			case 'wp-user-first-name':
				$info = $this->get_current_user_property('first_name');
				break;

			case 'wp-user-last-name':
				$info = $this->get_current_user_property('last_name');
				break;

			case 'wp-user-login':
				$info = $this->get_current_user_property('user_login');
				break;

			case 'wp-logout-url':
				$info = wp_logout_url();
				break;
		}

		return $info;
	}

	private function get_current_user_property($property) {
		$user = wp_get_current_user();
		if (is_object($user)) {
			return strval($user->get($property));
		}
		return '';
	}

	/**
	 * Get the HTML code for the small "(123)" bubble in the title of the current menu item.
	 *
	 * The count bubble shortcode is intended for situations where the user wants to rename
	 * a menu item like "WooCommerce -> Orders" that includes a small bubble showing the number
	 * of pending orders (or plugin updates, comments awaiting moderation, etc). The shortcode
	 * extracts the count from the default menu title and shows it in the custom title.
	 *
	 * @return string
	 */
	public function handle_count_shortcode() {
		if (isset(
			$this->current_shortcode_item,
			$this->current_shortcode_item['defaults'],
			$this->current_shortcode_item['defaults']['menu_title']
		)) {
			//Oh boy, this is excessive! Tests say it takes < 1 ms per shortcode,
			//but it still seems wrong to go this far just to extract a <span> tag.
			$title = $this->current_shortcode_item['defaults']['menu_title'];
			if ( stripos($title, '<span') !== false ) {
				/** @noinspection PhpComposerExtensionStubsInspection */
				$dom = new domDocument;
				if ( @$dom->loadHTML($title) ) {
					/** @noinspection PhpComposerExtensionStubsInspection */
					$xpath = new DOMXpath($dom);
					$result = $xpath->query('//span[contains(@class,"update-plugins") or contains(@class,"awaiting-mod")]');
					if ( $result->length > 0 ) {
						$span = $result->item(0);
						return $span->ownerDocument->saveHTML($span);
					}
				}
			}
		}
		return '';
	}

	/**
	 * Flag menus (and menu items) that are set to open in a new window
	 * so that they can be identified later.
	 *
	 * Adds a <span class="ws-new-window-please"></span> element to the title
	 * of each detected menu.
	 *
	 * @param array $item
	 * @return array
	 */
	function flag_new_window_menus($item){
		$open_in = ameMenuItem::get($item, 'open_in', 'same_window');
		if ( $open_in == 'new_window' ){
			$old_title = ameMenuItem::get($item, 'menu_title', '');
			$item['menu_title'] = $old_title . '<span class="ws-new-window-please" style="display:none;"></span>';

			//For compatibility with Ozh's Admin Drop Down menu, record the link ID that will be
			//assigned to this item. This lets us modify it later.
			if ( function_exists('wp_ozh_adminmenu_sanitize_id') ){
				$subid = 'oamsub_'.wp_ozh_adminmenu_sanitize_id(
					ameMenuItem::get($item, 'file', '')
				);
				$this->ozhs_new_window_menus[] = '#' . str_replace(
					array(':', '&'),
					array('\\\\:', '\\\\&'),
					$subid
				);
			}
		}

		return $item;
	}

	/**
	 * Output a piece of JS that will find flagged menu links and make them
	 * open in a new window.
	 *
	 * @return void
	 */
	function fix_flagged_menus(){
		?>
		<script type="text/javascript">
		(function($){
			$('#adminmenu span.ws-new-window-please, #ozhmenu span.ws-new-window-please').each(function(){
				var marker = $(this);
				//Add target="_blank" to the enclosing link
				marker.parents('a').first().attr('target', '_blank');
				//And to the menu image link, too (only for top-level menus)
				marker.parent().parent().find('> .wp-menu-image a').attr('target', '_blank');
				//Get rid of the marker
				marker.remove();
			});

			<?php if ( !empty($this->ozhs_new_window_menus) ): ?>

			$('<?php echo implode(', ', $this->ozhs_new_window_menus); ?>').each(function(){
				//Add target="_blank" to the link
				$(this).find('a').attr('target', '_blank');
			});

			<?php endif; ?>
		})(jQuery);
		</script>
		<?php
	}

	/**
	 * Intercept menus that need to be displayed in an IFrame.
	 *
	 * Here's how this works : each item that needs to be displayed in an IFrame
	 * gets added as a new menu (or submenu) using the standard WP plugin API.
	 * This ensures that the myriad undocumented data structures that WP employs
	 * for menu generation get populated correctly.
	 *
	 * The reason why this doesn't lead to menu duplication is that the global $menu
	 * and $submenu arrays are thrown away and replaced with custom-generated ones
	 * shortly afterwards. The modified menu entry returned by this function becomes
	 * part of that custom menu.
	 *
	 * All items added in this way have the same callback function - wsMenuEditorExtras::display_framed_page()
	 *
	 * @param array $item
	 * @return array
	 */
	function create_framed_menu($item){
		if ( $item['open_in'] == 'iframe' ){
			$slug = 'framed-menu-' . md5($item['file']);//MD5 should be unique enough
			$this->framed_pages[$slug] = $item; //Used by the callback function

			//Default to using menu title for page title, if no custom title specified 
			if ( empty($item['page_title']) ) {
				$item['page_title'] = $item['menu_title'];
			}

			//Add a virtual menu. The menu record created by add_menu_page will be
			//thrown away; what matters is that this populates other structures
			//like $_registered_pages.
			add_menu_page(
				$item['page_title'],
				$item['menu_title'],
				$item['access_level'],
				$slug,
				array($this, 'display_framed_page')
			);

			//Change the slug to our newly created page.
			$item['file'] = $slug;
		}

		return $item;
	}

	/**
	 * Intercept menu items that need to be displayed in an IFrame.
	 *
	 * @see wsMenuEditorExtras::create_framed_menu()
	 *
	 * @param array $item
	 * @param string $parent_file
	 * @return array
	 */
	function create_framed_item($item, $parent_file = null){
		if ( ($item['open_in'] == 'iframe') && !empty($parent_file) ){

			$slug = 'framed-menu-item-' . md5($item['file'] . '|' . $parent_file);
			$this->framed_pages[$slug] = $item;

			if ( empty($item['page_title']) ) {
				$item['page_title'] = $item['menu_title'];
			}
			add_submenu_page(
				$parent_file,
				$item['page_title'],
				$item['menu_title'],
				$item['access_level'],
				$slug,
				array($this, 'display_framed_page')
			);

			$item['file'] = $slug;
		}

		return $item;
	}

	/**
	 * Display a page in an IFrame.
	 * This callback is used by all menu items that are set to open in a frame.
	 *
	 * @return void
	 */
	function display_framed_page(){
		global $plugin_page;

		if ( isset($this->framed_pages[$plugin_page]) ){
			$item = $this->framed_pages[$plugin_page];
		} else {
			return;
		}

		if ( !current_user_can($item['access_level'], -1) ){
			echo "You do not have sufficient permissions to view this page.";
			return;
		}

		$styles = array(
			'border' => '0 none',
			'width'  => '100%',
			'min-height' => '300px',
		);

		//The user can set the frame height manually or let the plugin calculate it automatically (the default).
		$height = !empty($item['iframe_height']) ? intval($item['iframe_height']) : 0;
		$height = min(max($height, 0), 10000);
		if ( !empty($height) ) {
			$styles['height'] = $height . 'px';
			unset($styles['min-height']);
		}

		$is_scrolling_disabled = !empty($item['is_iframe_scroll_disabled']);

		$style_attr = '';
		foreach($styles as $property => $value) {
			$style_attr .= $property . ': ' . $value . ';';
		}

		$heading = !empty($item['page_title'])?$item['page_title']:$item['menu_title'];
		$heading = sprintf('<%1$s>%2$s</%1$s>', WPMenuEditor::$admin_heading_tag, $heading);
		?>
		<div class="wrap">
		<?php echo $heading; ?>
		<!--suppress HtmlDeprecatedAttribute "frameborder" is used for backwards compatibility only -->
			<iframe
			src="<?php echo esc_attr($item['file']); ?>"
			style="<?php echo esc_attr($style_attr); ?>>"
			id="ws-framed-page"
			frameborder="0"
			<?php
			if ( $is_scrolling_disabled ) {
				echo ' scrolling="no" ';
			}
			?>
		></iframe>
		</div>
		<?php

		if ( empty($height) ) :
		?>
			<script type="text/javascript">
			function wsResizeFrame(){
				var $ = jQuery;
				var footer = $('#footer, #wpfooter');
				var frame = $('#ws-framed-page');
				var containerPadding = parseInt(frame.closest('#wpbody-content').css('padding-bottom'), 10) || 0;

				//Automagically calculate a frame height that fills the entire page without creating a vertical scrollbar.
				var maxHeight = footer.offset().top - frame.offset().top;
				var minHeight = maxHeight - containerPadding;

				var empiricalFudgeFactor = 29; //Based on the default admin theme in WP 4.1 (without the test helper output).
				var initialHeight = maxHeight - empiricalFudgeFactor;

				//Match the height of the frame to its contents. This only works if the frame
				//is in the same origin and it has already finished loading.
				var contentHeight = null;
				var isContentHeightUsed = false;
				try {
					contentHeight = frame.contents().height();
					if ((contentHeight > initialHeight) && (contentHeight > 100)) {
						initialHeight = contentHeight;
						isContentHeightUsed = true;
					}
				} catch (error) {
					//The frame is probably on a different origin and we can't access its contents.
					contentHeight = null;
				}

				frame.height(initialHeight);

				if (!isContentHeightUsed) {
					setTimeout(function () {
						//Check if there's a scroll bar and reduce the height just enough to get rid of it.
						//Sometimes it's not possible to avoid scrolling because another part of the page is too tall,
						//so we have a minimum height limit.
						var scrollDelta = $(document).height() - $(window).height();
						if (scrollDelta > 0) {
							frame.height(Math.max(initialHeight - scrollDelta, minHeight));
						}
					}, 1)
				}
			}

			jQuery(function($){
				wsResizeFrame();

				$('#ws-framed-page').on('load', function () {
					//For same-origin frames, we can auto-resize the frame once it finishes loading.
					wsResizeFrame();
				});
			});
			</script>
		<?php
		endif;
	}

	/**
	 * Set up menu items that display the content of a normal page (as in the post type) as an admin page.
	 *
	 * @param array $item Menu item.
	 * @param string|null $parent_file Parent menu slug or URL.
	 * @return array Modified menu item.
	 */
	public function create_embedded_wp_page($item, $parent_file = null) {
		if ( ameMenuItem::get($item, 'template_id') !== ameMenuItem::embeddedPageTemplateId ) {
			return $item;
		}

		$page_id = ameMenuItem::get($item, 'embedded_page_id', 0);
		$blog_id = ameMenuItem::get($item, 'embedded_page_blog_id', get_current_blog_id());

		//Default to using the menu title as the window title.
		if ( empty($item['page_title']) ) {
			$item['page_title'] = strip_tags($item['menu_title']);
		}

		$slug = 'embedded-page-' . md5($page_id . '|' . $blog_id . '|' . count($this->embedded_wp_pages));
		$this->embedded_wp_pages[$slug] = $item; //Used by the callback function.

		//Add a virtual menu.
		if ( empty($parent_file) ) {
			add_menu_page(
				$item['page_title'],
				$item['menu_title'],
				$item['access_level'],
				$slug,
				array($this, 'display_embedded_wp_page')
			);
		} else {
			add_submenu_page(
				$parent_file,
				$item['menu_title'],
				$item['menu_title'],
				$item['access_level'],
				$slug,
				array($this, 'display_embedded_wp_page')
			);
		}

		//Change the slug to our newly created page.
		$item['file'] = $slug;
		//Force automatic URL generation.
		$item['url'] = '';
		//Make sure admin-helpers.js won't replace the real heading with the placeholder.
		if ($item['page_heading'] === ameMenuItem::embeddedPagePlaceholderHeading) {
			$item['page_heading'] = null;
		}

		return $item;
	}

	/**
	 * A callback for menu items that embed a page or CPT item in the admin panel. Displays the content of the page.
	 */
	public function display_embedded_wp_page() {
		$slug = isset($_GET['page']) ? strval($_GET['page']) : null;
		if ( empty($slug) || !isset($this->embedded_wp_pages[$slug]) ) {
			echo '<h1>Error: Invalid page. How did you get here?</h1>';
			return;
		}

		$item = $this->embedded_wp_pages[$slug];
		$page_id = ameMenuItem::get($item, 'embedded_page_id', 0);
		$page_blog_id = ameMenuItem::get($item, 'embedded_page_blog_id', get_current_blog_id());

		$should_switch = ($page_blog_id !== get_current_blog_id());
		if ( $should_switch ) {
			switch_to_blog($page_blog_id);
		}

		$page = get_post($page_id);
		$expected_post_statuses = array('publish', 'private');
		if ( empty($page) ) {
			printf(
				'Error: Page not found. Post ID %1$d does not exist on blog ID %2$d.',
				$page_id,
				$page_blog_id
			);
		} else if ( !in_array($page->post_status, $expected_post_statuses) ) {
			printf(
				'Error: This page is not published. Post ID: %1$d, expected status: %2$s, actual status: "%3$s".',
				$page_id,
				esc_html('"' . implode('" or "', $expected_post_statuses) . '"'),
				esc_html($page->post_status)
			);
		} else {
			$heading = $item['page_heading'];
			if ( $heading === ameMenuItem::embeddedPagePlaceholderHeading ) {
				//Note that this means the user can't set the heading to the same text as the placeholder.
				//That's poor design, but it probably won't matter in practice.
				$heading = strip_tags($item['menu_title']);
			}

			echo '<div class="wrap">';
			if ( !empty($heading) ) {
				printf('<%2$s>%1$s</%2$s>', $heading, WPMenuEditor::$admin_heading_tag);
			}
			echo apply_filters('the_content', $page->post_content);
			echo '</div>';
		}

		if ( $should_switch ) {
			restore_current_blog();
		}
	}

	private function set_final_hidden_flag($item) {
		//Globally hidden items stay hidden regardless of who is currently logged in.
		if ( !empty($item['hidden']) ) {
			return $item;
		}

		static $user = null, $user_login = '';
		if ( $user === null ) {
			$user = wp_get_current_user();
			$user_login = $user->get('user_login');
		}

		//User-specific settings take precedence.
		$user_actor = 'user:' . $user_login;
		if ( isset($item['hidden_from_actor'][$user_actor]) ) {
			$item['hidden'] = $item['hidden_from_actor'][$user_actor];
			return $item;
		}

		//The item will be hidden only if *all* of the user's roles have it hidden.
		//Unlike with capabilities and permissions, there are no defaults to worry about.
		$actors = array();
		if ( is_multisite() && is_super_admin($user->ID) ) {
			$actors[] = 'special:super_admin';
		}
		foreach($this->wp_menu_editor->get_user_roles($user) as $role) {
			$actors[] = 'role:' . $role;
		}

		$is_hidden = null;
		foreach($actors as $actor) {
			if ( !isset($is_hidden) ) {
				$is_hidden = !empty($item['hidden_from_actor'][$actor]);
			} else {
				$is_hidden = $is_hidden && !empty($item['hidden_from_actor'][$actor]);
			}
		}

		if ( $is_hidden ) {
			$item['hidden'] = true;
		}
		return $item;
	}

	/**
	 * Output the HTML for import and export dialogs.
	 * Callback for the 'menu_editor_footer' action.
	 *
	 * @return void
	 */
	function menu_editor_footer(){
		if ( !$this->wp_menu_editor->is_editor_page() ) {
			return;
		}

		include AME_ROOT_DIR . '/extras/menu-headings/menu-headings-template.php';
		?>
		<div id="export_dialog" title="Export">
	<div class="ws_dialog_panel">
		<div id="export_progress_notice">
			<img src="<?php echo plugins_url('images/spinner.gif', __FILE__); ?>" alt="wait">
			Creating export file...
		</div>
		<div id="export_complete_notice">
			Click the "Download" button below to download the exported admin menu to your computer.
		</div>
	</div>
	<div class="ws_dialog_buttons">
		<a class="button-primary" id="download_menu_button" href="#">Download Export File</a>
		<input type="button" name="cancel" class="button" value="Close" id="ws_cancel_export">
	</div>
</div>

<div id="import_dialog" title="Import">
	<form id="import_menu_form" action="<?php
		echo esc_attr($this->wp_menu_editor->get_plugin_page_url(array('noheader' => '1')));
	?>" method="post">
		<input type="hidden" name="action" value="upload_menu">

		<div class="ws_dialog_panel" id="ws_import_panel">
			<div id="import_progress_notice">
				<img src="<?php echo plugins_url('images/spinner.gif', __FILE__); ?>" alt="wait">
				Uploading file...
			</div>
			<div id="import_progress_notice2">
				<img src="<?php echo plugins_url('images/spinner.gif', __FILE__); ?>" alt="wait">
				Importing menu...
			</div>
			<div id="import_complete_notice">
				Import Complete!
			</div>


			<div class="hide-when-uploading">
				Choose an exported menu file (.<?php echo $this->export_settings['file_extension']; ?>)
				to import:

				<input type="hidden" name="MAX_FILE_SIZE" value="<?php echo intval($this->export_settings['max_file_size']); ?>">
				<input type="file" name="menu" id="import_file_selector" size="35">
			</div>
		</div>

		<div id="ws_import_error" style="display: none">
			<div class="ws_dialog_subpanel">
				<strong>Error:</strong><br>
				<span id="ws_import_error_message">N/A</span>
			</div>

			<div class="ws_dialog_subpanel">
				<strong>HTTP code:</strong><br>
				<span id="ws_import_error_http_code">N/A</span>
			</div>

			<div class="ws_dialog_subpanel">
				<label for="ws_import_error_response"><strong>Server response:</strong></label><br>
				<textarea id="ws_import_error_response" rows="8"></textarea>
			</div>
		</div>

		<div class="ws_dialog_buttons">
			<input type="submit" name="upload" class="button-primary hide-when-uploading" value="Upload File" id="ws_start_import">
			<input type="button" name="cancel" class="button" value="Close" id="ws_cancel_import">
		</div>
	</form>
</div>

		<div id="ws_ame_deep_nesting_dialog" title="Three Level Menu" style="display: none;">
			<div class="ws_dialog_panel">
				<strong style="font-size: larger;">Enable three level menus?</strong><br>
				<em>Example: Menu &rarr; Submenu &rarr; Another Submenu</em>

				<p>
					This is an experimental feature! WordPress usually only supports two levels of admin menus.
					Additional levels might not work correctly in some browsers
					and might be incompatible with some plugins and themes.
				</p>
			</div>
			<div class="ws_dialog_buttons">
				<a class="button-primary" id="ame_allow_deep_nesting" href="#">Enable Experimental Feature</a>
				<input type="button" name="cancel" class="button" value="Cancel" id="ame_reject_deep_nesting">
			</div>
		</div>

<script type="text/javascript">
/** @namespace wsEditorData */
wsEditorData.wsMenuEditorPro = true;

wsEditorData.exportMenuNonce = "<?php echo esc_js(wp_create_nonce('export_custom_menu'));  ?>";
wsEditorData.menuUploadHandler = "<?php echo ('options-general.php?page=menu_editor&noheader=1'); ?>";
wsEditorData.importMenuNonce = "<?php echo esc_js(wp_create_nonce('import_custom_menu'));  ?>";
</script>
		<?php
	}

	/**
	 * Prepare a custom menu for export.
	 *
	 * Expects menu data to be in $_POST['data'].
	 * Outputs a JSON-encoded object with three fields :
	 *    download_url - the URL that can be used to download the exported menu.
	 *    filename - export file name.
	 *    filesize - export file size (in bytes).
	 *
	 * If something goes wrong, the response object will contain an 'error' field with an error message.
	 *
	 * @return void
	 * @throws InvalidMenuException
	 */
	function ajax_export_custom_menu(){
		$wp_menu_editor = $this->wp_menu_editor;
		if (!$wp_menu_editor->current_user_can_edit_menu() || !check_ajax_referer('export_custom_menu', false, false)){
			die( $wp_menu_editor->json_encode( array(
				'error' => __("You're not allowed to do that!", 'admin-menu-editor')
			)));
		}

		//Prepare the export record.
		$export = $this->get_exported_menu();
		$export['total']++; //Export counter. Could be used to make download URLs unique.

		//Compress menu data to make export files smaller.
		$post = $this->wp_menu_editor->get_post_params();
		$menu_data = $post['data'];
		$menu = ameMenu::load_json($menu_data);
		$menu_data = ameMenu::to_json(ameMenu::compress($menu));

		//Save the menu structure.
		$export['menu'] = $menu_data;

		//Include the blog's domain name in the export filename to make it easier to 
		//distinguish between multiple export files.
		$siteurl = get_bloginfo('url');
		$domain = @parse_url($siteurl);
		$domain = isset($domain['host']) ? ($domain['host'] . ' ') : '';

		$export['filename'] = sprintf(
			'%sadmin menu (%s).dat',
			$domain,
			date('Y-m-d')
		);

		//Store the modified export record. The plugin will need it when the user 
		//actually tries to download the menu.
		$this->set_exported_menu($export);

		$download_url = $this->wp_menu_editor->get_plugin_page_url(array(
			'noheader' => '1',
			'action' => 'download_menu',
			'export_num' => $export['total'],
		));

		$result = array(
			'download_url' => $download_url,
			'filename' => $export['filename'],
			'filesize' => strlen($export['menu']),
		);

		die($wp_menu_editor->json_encode($result));
	}

    /**
     * Get the current exported record
     *
     * @return array
     */
	function get_exported_menu(){
		$user = wp_get_current_user();
		$exports = get_metadata('user', $user->ID, 'custom_menu_export', true);

		$defaults = array(
			'total' => 0,
			'menu' => '',
			'filename' => '',
		);

		if ( !is_array($exports) ){
			$exports = array();
		}

		return array_merge($defaults, $exports);
	}

    /**
     * Store the export record.
     *
     * @param array $export
     * @return bool
     */
	function set_exported_menu($export){
		//Caution: update_metadata expects slashed data.
		$export = wp_slash($export);
		$user = wp_get_current_user();
		return update_metadata('user', $user->ID, 'custom_menu_export', $export);
	}

	/**
	 * Handle menu uploads and downloads.
	 * This is a callback for the 'admin_menu_editor_header' action.
	 *
	 * @param string $action
	 * @return void
	 */
	function menu_editor_header($action = ''){
		$wp_menu_editor = $this->wp_menu_editor;

		//Add Pro version buttons to the menu editor toolbar.
		add_filter('admin_menu_editor-toolbar_icons', array($this, 'add_toolbar_icons'), 10, 2);
		add_action('admin_menu_editor-register_toolbar_buttons', array($this, 'register_toolbar_buttons'), 10, 2);

		//Handle menu download requests
		if ( $action == 'download_menu' ){
			$export = $this->get_exported_menu();
			if ( empty($export['menu']) || empty($export['filename']) ){
				die("Exported data not found");
			}

			//Force file download
		    header("Content-Description: File Transfer");
		    header('Content-Disposition: attachment; filename="' . $export['filename'] . '"');
		    header("Content-Type: application/force-download");
		    header("Content-Transfer-Encoding: binary");
		    header("Content-Length: " . strlen($export['menu']));

		     /* The three lines below basically make the download non-cacheable */
			header("Cache-control: private");
			header("Pragma: private");
			header("Expires: Mon, 26 Jul 1997 05:00:00 GMT");

		    echo $export['menu'];

			die();

		//Handle menu uploads
		} elseif ( $action == 'upload_menu' ) {

		    header('Content-Type: text/html');

		    if ( empty($_FILES['menu']) ){
				echo $wp_menu_editor->json_encode(array('error' => "No file specified"));
				die();
			}

			$file_data = $_FILES['menu'];
			if ( filesize($file_data['tmp_name']) > $this->export_settings['max_file_size'] ){
				$this->output_for_jquery_form( $wp_menu_editor->json_encode(array('error' => "File too big")) );
				die();
			}

			//Check for general upload errors.
			if ($file_data['error'] != UPLOAD_ERR_OK) {
				$message = self::get_upload_error_message($file_data['error']);
				$this->output_for_jquery_form( $wp_menu_editor->json_encode(array('error' => $message)) );
				die();
			}

			$file_contents = file_get_contents($file_data['tmp_name']);

			//Check if this file could plausibly contain an exported menu
			if ( strpos($file_contents, $this->export_settings['old_format_string']) !== false ){

				//This is an exported menu in the old format.
				$data = $wp_menu_editor->json_decode($file_contents, true);
				if ( !(isset($data['menu']) && is_array($data['menu'])) ) {
					$this->output_for_jquery_form( $wp_menu_editor->json_encode(array('error' => "Unknown or corrupted file format")) );
					die();
				}

				try {
					$menu = ameMenu::load_array($data['menu'], false, true);
				} catch (InvalidMenuException $ex) {
					$this->output_for_jquery_form( $wp_menu_editor->json_encode(array('error' => $ex->getMessage())) );
					die();
				}

			} else {
				if (strpos($file_contents, ameMenu::format_name) !== false) {

					//This is an export file in the new format.
					try {
						$menu = ameMenu::load_json($file_contents, false, true);
					} catch (InvalidMenuException $ex) {
						$this->output_for_jquery_form( $wp_menu_editor->json_encode(array('error' => $ex->getMessage())) );
						die();
					}

				} else {

					//This is an unknown file.
					$this->output_for_jquery_form($wp_menu_editor->json_encode(array('error' => "Unknown file format")));
					die();

				}
			}

			//Merge the imported menu with the current one.
			$menu['tree'] = $wp_menu_editor->menu_merge($menu['tree']);

			//Everything looks okay, send back the menu data
			$this->output_for_jquery_form( ameMenu::to_json($menu) );
			die ();
		}
	}

	public static function get_upload_error_message($errorCode) {
		switch($errorCode) {
			case UPLOAD_ERR_INI_SIZE:
				$message = sprintf(
					'The uploaded file exceeds the upload_max_filesize directive in php.ini. Limit: %s',
					strval(ini_get('upload_max_filesize'))
				);
				break;
			case UPLOAD_ERR_FORM_SIZE:
				$message = "The uploaded file exceeds the MAX_FILE_SIZE directive that was specified in the HTML form.";
				break;
			case UPLOAD_ERR_PARTIAL:
				$message = "The file was only partially uploaded.";
				break;
			case UPLOAD_ERR_NO_FILE:
				$message = "No file was uploaded.";
				break;
			case UPLOAD_ERR_NO_TMP_DIR:
				$message = "Missing a temporary folder.";
				break;
			case UPLOAD_ERR_CANT_WRITE:
				$message = "Failed to write file to disk.";
				break;
			case UPLOAD_ERR_EXTENSION:
				$message = "File upload stopped by a PHP extension.";
				break;

			default:
				$message = 'Unknown upload error #' . $errorCode;
				break;
		}
		return $message;
	}

	/**
	 * Utility method that outputs data in a format suitable to the jQuery Form plugin.
	 *
	 * Specifically, the docs recommend enclosing JSON data in a <textarea> element if
	 * the request was not sent by XMLHttpRequest. This is because the plugin uses IFrames
	 * in older browsers, which supposedly causes problems with JSON responses.
	 *
	 * @param string $string
	 */
	private function output_for_jquery_form($string) {
		$xhr = isset($_SERVER['HTTP_X_REQUESTED_WITH']) && ($_SERVER['HTTP_X_REQUESTED_WITH'] == 'XMLHttpRequest');
		if (!$xhr) {
			echo '<textarea>';
		}
		echo $string;
		if (!$xhr) {
			echo '</textarea>';
		}
	}

	/**
	 * Output the "Import" and "Export" buttons.
	 * Callback for the 'admin_menu_editor_sidebar' action.
	 *
	 * @return void
	 */
	function add_extra_buttons(){
		?>
		<div class="ws_sidebar_button_separator"></div>

		<input type="button" id='ws_edit_global_colors' value="Colors" class="button ws_main_button" title="Edit default menu colors" />
		<input type="button" id='ws_edit_separator_styles' value="Separators" class="button ws_main_button" title="Edit menu separator appearance" />
		<input type="button" id='ws_edit_heading_styles' value="Headings" class="button ws_main_button" title="Edit the appearance of menu headings" />

		<div class="ws_sidebar_button_separator"></div>

		<input type="button" id='ws_export_menu' value="Export" class="button ws_main_button" title="Export current menu" />
		<input type="button" id='ws_import_menu' value="Import" class="button ws_main_button" />
		<?php
	}

	public function add_toolbar_icons($icons = array(), $imageBaseUrl = '') {
		if ( !is_array($icons) ) {
			return $icons;
		}
		$icons['reset-permissions'] = $imageBaseUrl . '/reset-permissions.png';
		$icons['new-heading'] = plugins_url('extras/menu-headings/heading-add.png', __FILE__);
		return $icons;
	}

	/**
	 * @param ameOrderedMap $firstRow
	 * @param ameOrderedMap $secondRow
	 */
	public function register_toolbar_buttons($firstRow, $secondRow) {
		$hideButtonExtraTooltip = 'When "All" is selected, this will hide the menu from everyone except the current user'
			. (is_multisite() ? ' and Super Admin' : '') . '.';

		$firstRow->insertAllAfter(
			'new-separator',
			array(
				'new-heading'     => array(
					'title'        => 'New heading',
					'topLevelOnly' => true,
				),
				'pro-separator-1' => null,
				'deny'   => array(
					'title' => "Hide and prevent access. \n" . $hideButtonExtraTooltip,
					'alt'   => 'Hide',
					'iconName' => 'hide-and-deny',
				),
			)
		);

		$secondRow->addAll(array(
			'pro-separator-2'   => null,
			'toggle-all'        => array(
				'title'        => 'Toggle all menus for the selected role',
				'alt'          => 'Toggle all',
				'topLevelOnly' => true,
			),
			'reset-permissions' => array(
				'title'        => 'Reset all permissions for the selected role or user',
				'alt'          => 'Reset permissions',
				'topLevelOnly' => true,
			),
			'copy-permissions'  => array(
				'title'        => 'Copy all menu permissions from one role to another',
				'alt'          => 'Copy permissions',
				'topLevelOnly' => true,
			),
			'pro-separator-3'   => null,
		));
	}

	public function register_extra_scripts() {
		wp_register_auto_versioned_script(
			'ame-menu-editor-extras',
			plugins_url('extras/menu-editor-extras.js', $this->wp_menu_editor->plugin_file),
			array('jquery')
		);
		wp_register_auto_versioned_script(
			'ame-ko-extensions',
			plugins_url('extras/ko-extensions.js', $this->wp_menu_editor->plugin_file),
			array('knockout', 'jquery', 'jquery-ui-dialog', 'ame-lodash', 'wp-color-picker')
		);
		wp_register_auto_versioned_script(
			'ame-menu-heading-settings',
			plugins_url('extras/menu-headings/menu-headings.js', $this->wp_menu_editor->plugin_file),
			array('jquery', 'knockout', 'jquery-ui-dialog', 'wp-color-picker', 'ame-lodash', 'ame-ko-extensions',),
			true
		);
	}

	/**
	 * @param array $dependencies
	 * @return array
	 */
	public function add_extra_editor_dependencies($dependencies) {
		$dependencies[] = 'ame-menu-editor-extras';
		$dependencies[] = 'ame-menu-heading-settings';
		return $dependencies;
	}

	/**
	 * Add "user:user_login" to the user's capabilities. This makes it possible to restrict
	 * menu access on a per-user basis.
	 *
	 * @param array $virtual_caps
	 * @param WP_User $user
	 * @return array
	 */
	function add_user_actor_cap($virtual_caps, $user){
		if ( empty($user) || empty($user->user_login) ){
			return $virtual_caps;
		}
		$virtual_caps[WPMenuEditor::ALL_VIRTUAL_CAPS]['user:' . $user->user_login] = true;
		return $virtual_caps;
	}

	/**
	 * Apply custom per-role and per-user access settings to a menu item.
	 *
	 * If the user can't access this menu, this method will change the required
	 * capability to "do_not_allow". Otherwise, it will be left unmodified.
	 *
	 * Callback for the 'custom_admin_menu_capability' filter.
	 *
	 * @param array $item
	 * @return array Modified item.
	 */
	public function apply_custom_access($item) {
		if ( !isset($item['access_check_log']) ) {
			$item['access_check_log'] = array();
		}

		if ( ! $this->current_user_is_granted_access($item) ) {
			$item['access_check_log'][] = '! Changing the required capability to "do_not_allow".';
			$item['access_level'] = 'do_not_allow';
			$item['user_has_access_level'] = false;
		} else {
			$item['user_has_access_level'] = true;
		}

		return $item;
	}

	/**
	 * Check if the current user should be granted access to the specified menu item.
	 *
	 * Applies explicit per-role and per-user settings from $item['grant_access'].
	 * DOES NOT apply the extra capability. That should be done elsewhere.
	 *
	 * If there are no custom permissions set that match the current user, this method
	 * will check if the user would normally be able to access the menu (i.e. without
	 * virtual caps).
	 *
	 * @param array $item Menu item.
	 * @return bool
	 */
	private function current_user_is_granted_access(&$item) {
		static $is_multisite = null;
		static $user = null, $user_login = '';

		if ( $is_multisite === null ) {
			$is_multisite = is_multisite();
		}
		if ( $user === null ) {
			$user = wp_get_current_user();
			$user_login =  $user->get('user_login');
		}

		$has_access = null;
		$log = array();

		$reason = null;
		$debug_title = ameMenuItem::get($item, 'full_title', ameMenuItem::get($item, 'menu_title', '[untitled menu]'));

		$log[] = sprintf('Checking "%s" permissions:', ameMenuItem::get($item, 'menu_title', '[untitled menu item]'));

		if ( isset($item['grant_access']) ) {
			$grants = $item['grant_access'];

			//If this user is specifically allowed/forbidden, use that setting.
			if ( isset($grants['user:' . $user_login]) ) {
				$has_access = $grants['user:' . $user_login];
				$log[] = sprintf(
					'+ Custom permissions for user "%s": %s.',
					$user_login,
					$has_access ? 'ALLOW' : 'DENY'
				);

				$reason = sprintf(
					'The "%1$s" menu item is explicitly %2$s for the user "%3$s".',
					$debug_title,
					$has_access ? 'enabled' : 'disabled',
					$user_login
				);
			} else {
				$log[] = sprintf(
					'- No custom permissions for the "%s" username.',
					$user_login
				);
			}

			//Or if they're a super admin, allow *everything* unless explicitly denied.
			$this->wp_menu_editor->disable_virtual_caps = true;
			if ( is_null($has_access) && $is_multisite && is_super_admin($user->ID) ) {
				$log[] = '+ The current user is a Super Admin.';
				if ( isset($grants['special:super_admin']) ) {
					$has_access = $grants['special:super_admin'];
					$log[] = sprintf("+ Custom permissions for Super Admin: %s.", $has_access ? 'ALLOW' : 'DENY');

					$reason = sprintf(
						'The user "%3$s" is a Super Admin. The "%1$s" menu item is explicitly %2$s for Super Admin.',
						$debug_title,
						$has_access ? 'enabled' : 'disabled',
						$user_login
					);
				} else {
					$has_access = true;
					$log[] = '+ ALLOW access to everything by default.';

					$reason = sprintf(
						'As a Super Admin, the user "%2$s" has access to the "%1$s" menu item by default.',
						$debug_title,
						$user_login
					);
				}
			} else if ( is_null($has_access) ) {
				$log[] = '- The current user is not a Super Admin, or this is not a Multisite install.';
			}
			$this->wp_menu_editor->disable_virtual_caps = false;


			if ( is_null($has_access) ) {
				//Allow the user if at least one of their roles is allowed,
				//or disallow if all their roles are forbidden.
				//TODO: We could get the roles when starting menu generation and then just reuse them.
				$roles = $this->wp_menu_editor->get_user_roles($user);
				$log[] = sprintf(
					'- Current user\'s role: %s',
					!empty($roles) ? implode(', ', $roles) : 'N/A (not logged in?)'
				);
				if ( empty($roles) ) {
					$log[] = sprintf(
						'- Current user\'s capabilities: %s',
						implode(', ', array_keys(array_filter($user->allcaps)))
					);
				}

				foreach ($roles as $role_id) {
					if ( isset($grants['role:' . $role_id]) ) {
						$role_has_access = $grants['role:' . $role_id];
						$log[] = sprintf(
							'+ Permissions for the "%1$s" role: %2$s',
							$role_id,
							$role_has_access ? 'ALLOW' : 'DENY'
						);
						if ( is_null($has_access) ){
							$has_access = $role_has_access;
							$reason = sprintf(
								'The "%1$s" menu item is %2$s for the "%3$s" role.',
								$debug_title,
								$has_access ? 'enabled' : 'disabled',
								$role_id
							);
						} else {
							$has_access = $has_access || $role_has_access; //Allow access if at least one role has access.
							if ( $role_has_access ) {
								$reason = sprintf(
									'The "%1$s" menu item is enabled for the "%2$s" role.',
									$debug_title,
									$role_id
								);
							}
						}
					} else {
						$log[] = sprintf('- No custom permissions for the "%s" role.', $role_id);
					}
				}
			}
		}

		if ( is_null($has_access) ) {
			//There are no custom settings for this user. Check if
			//they would be able to access the menu by default.
			$required_capability = $item['access_level'];

			$log[] = '- There are no custom permissions for the current user or any of their roles.';
			$log[] = '- Checking the default required capability: ' . $required_capability;

			$this->wp_menu_editor->virtual_cap_mode = WPMenuEditor::DIRECTLY_GRANTED_VIRTUAL_CAPS;
			//Cache capability checks because they're relatively slow (determined by profiling).
			//Right now we can rely on capabilities not changing when this method is called, but that's not a safe
			//assumption in general so we only use the cache in this specific case.
			if ( isset($this->cached_user_caps[$required_capability]) ) {
				$has_access = $this->cached_user_caps[$required_capability];
			} else {
				$has_access = $user && $user->has_cap($required_capability);
				$this->cached_user_caps[$required_capability] = $has_access;
			}

			$log[] = sprintf(
				'+ The current user %1$s the "%2$s" capability.',
				$has_access ? 'HAS' : 'does not have',
				htmlentities($required_capability)
			);
			$this->wp_menu_editor->virtual_cap_mode = WPMenuEditor::ALL_VIRTUAL_CAPS;

			$reason = sprintf(
				'The user "%1$s" %2$s the "%3$s" capability that is required to access the "%4$s" menu item.',
				$user_login,
				$has_access ? 'has' : 'doesn\'t have',
				$required_capability,
				$debug_title
			);
		}

		$log[] = '= Result: ' . ($has_access ? 'ALLOW' : 'DENY');

		//Store the log in the item for debugging and configuration analysis.
		if ( !isset($item['access_check_log']) ) {
			$item['access_check_log'] = $log;
		} else {
			$item['access_check_log'] = array_merge($item['access_check_log'], $log);
		}

		//Store the decision summary as well.
		$item['access_decision_reason'] = $reason;

		return $has_access;
	}

	/**
	 * Check if the current user has access to something.
	 *
	 * This is a general method for checking authorization based on a combination of
	 * actor-specific and capability-based permissions.
	 *
	 * @param array $grants List of grants as an [actorId => boolean] map.
	 * @param string|null $default_cap
	 * @param string|null $extra_cap
	 * @param bool $default_access
	 * @param int $flags
	 * @return bool
	 */
	public function check_current_user_access(
		$grants = array(),
		$default_cap = null,
		$extra_cap = null,
		$default_access = false,
		$flags = AME_RC_ONLY_CUSTOM
	) {
		static $is_multisite = null, $user = null, $user_login = '';
		if ( $is_multisite === null ) {
			$is_multisite = is_multisite();
		}
		if ( $user === null ) {
			$user = wp_get_current_user();
			$user_login =  $user->get('user_login');
		}

		//User-specific settings have the highest priority.
		if ( isset($grants['user:' . $user_login]) ) {
			return $grants['user:' . $user_login];
		}

		//Super Admins have access to *everything* unless explicitly denied.
		$this->wp_menu_editor->disable_virtual_caps = true;
		$is_super_admin = $is_multisite && is_super_admin($user->ID);
		$this->wp_menu_editor->disable_virtual_caps = false;

		if ( $is_super_admin ) {
			if ( isset($grants['special:super_admin']) ) {
				return $grants['special:super_admin'];
			} else {
				return true;
			}
		}

		//Allow the user if at least one of their roles is allowed,
		//or disallow if all their roles are forbidden.
		$has_access = null;
		$roles = $this->wp_menu_editor->get_user_roles($user);
		foreach ($roles as $role_id) {
			if ( !isset($grants['role:' . $role_id]) && ($flags & AME_RC_ONLY_CUSTOM) ) {
				continue;
			}

			if ( isset($grants['role:' . $role_id]) ) {
				$role_has_access = $grants['role:' . $role_id];
			} else if ($flags & AME_RC_USE_DEFAULT_ACCESS) {
				$role_has_access = $default_access;
			} else {
				throw new RuntimeException(sprintf(
					"Can't determine default permissions for role \"%s\". Check the flags passed to %s().",
					$role_id,
					__FUNCTION__
				));
			}

			if ( is_null($has_access) ) {
				$has_access = $role_has_access;
			} else {
				$has_access = $has_access || $role_has_access;
			}
		}

		if ( $has_access !== null ) {
			return $has_access;
		}

		//There are no custom settings for this user. Check if they have the capabilities.
		if ( isset($default_cap) ) {
			$this->wp_menu_editor->virtual_cap_mode = WPMenuEditor::DIRECTLY_GRANTED_VIRTUAL_CAPS;
			//Cache capability checks because they're relatively slow.
			if ( isset($this->cached_user_caps[$default_cap]) ) {
				$has_access = $this->cached_user_caps[$default_cap];
			} else {
				$has_access = $user && $user->has_cap($default_cap);
				$this->cached_user_caps[$default_cap] = $has_access;
			}
			$this->wp_menu_editor->virtual_cap_mode = WPMenuEditor::ALL_VIRTUAL_CAPS;
		}

		//The extra capability is an optional filter that's applied on top of other settings.
		//TODO: Check extra cap even if there are user-specific permissions or they are a Super Admin.
		if ( isset($extra_cap) && $has_access ) {
			$this->wp_menu_editor->disable_virtual_caps = true;
			if ( isset($this->cached_user_caps[$extra_cap]) ) {
				$has_extra_cap = $this->cached_user_caps[$extra_cap];
			} else {
				$has_extra_cap = $user && $user->has_cap($extra_cap);
				$this->cached_user_caps[$extra_cap] = $has_extra_cap;
			}
			$this->wp_menu_editor->disable_virtual_caps = false;

			$has_access = $has_access && $has_extra_cap;
		}

		if ( $has_access !== null ) {
			return $has_access;
		}
		return $default_access;
	}

	/**
	 * Give the user virtual caps that they'll need to access certain menu items and directly granted caps.
	 *
	 * @param array $virtual_caps
	 * @param WP_User $user
	 * @return array
	 */
	public function prepare_virtual_caps_for_user($virtual_caps, $user) {
		$grant_keys = array();
		if ( $user ) {
			if ( isset($user->user_login) ) {
				$grant_keys[] = 'user:' . $user->user_login;
			}
			$roles = $this->wp_menu_editor->get_user_roles($user);
			if ( !empty($roles) ) {
				foreach ($roles as $role_id) {
					$grant_keys[] = 'role:' . $role_id;
				}
			}
		}

		//is_super_admin() will call has_cap on single-site installs.
		$this->wp_menu_editor->disable_virtual_caps = true;
		if ( is_multisite() && is_super_admin($user->ID) ) {
			$grant_keys[] = 'special:super_admin';
		}
		$this->wp_menu_editor->disable_virtual_caps = false;

		$modes = array(WPMenuEditor::ALL_VIRTUAL_CAPS, WPMenuEditor::DIRECTLY_GRANTED_VIRTUAL_CAPS);
		foreach ($modes as $virtual_cap_mode) {
			$stored_caps = $this->wp_menu_editor->get_virtual_caps($virtual_cap_mode);
			$caps_to_grant = array();
			foreach ($grant_keys as $grant) {
				if ( isset($stored_caps[$grant]) ) {
					$caps_to_grant = array_merge($caps_to_grant, $stored_caps[$grant]);
				}
			}
			if ( !empty($caps_to_grant) ) {
				$virtual_caps[$virtual_cap_mode] = array_merge(
					$virtual_caps[$virtual_cap_mode],
					$caps_to_grant
				);
			}
		}

		return $virtual_caps;
	}

	public function clear_site_specific_caches() {
		$this->cached_user_caps = array();
	}

	/**
	 * Grant a role virtual caps it'll need to access certain menu items.
	 *
	 * @param array $capabilities Current role capabilities.
	 * @param string $required_cap The required capability.
	 * @param string $role_id Role name/slug.
	 * @return array Filtered capability list.
	 */
	function grant_virtual_caps_to_role($capabilities, /** @noinspection PhpUnusedParameterInspection */ $required_cap, $role_id){
		$wp_menu_editor = $this->wp_menu_editor;

		if ( $this->wp_menu_editor->disable_virtual_caps ) {
			return $capabilities;
		}

		$virtual_caps = $wp_menu_editor->get_virtual_caps($this->wp_menu_editor->virtual_cap_mode);
		$grant_key = 'role:' . $role_id;
		if ( isset($virtual_caps[$grant_key]) ) {
			$capabilities = array_merge($capabilities, $virtual_caps[$grant_key]);
		}

		return $capabilities;
	}

	/**
	 * Hook for the internal current_user_can() function used by Admin Menu Editor.
	 * Enables us to use computed capabilities.
	 *
	 * @uses wsMenuEditorExtras::current_user_can_computed()
	 *
	 * @param bool $allow The return value of current_user_can($capablity).
	 * @param string $capability The capability to check for.
	 * @return bool Whether the user has the specified capability.
	 */
	function grant_computed_caps_to_current_user($allow, $capability) {
		return $this->current_user_can_computed($capability, $allow);
	}

	/**
	 * Check if the current user has the specified computed capability. Basically, this method
	 * implements a very limited subset of Boolean logic for use in capability checks.
	 *
	 * Supported operations:
	 *  "capX"      - Normal capability check. Returns true if the user has the capability "capX".
	 *  "not:capX"  - Logical NOT. Returns true if the user *doesn't* have "capX".
	 *  "capX,capY" - Logical OR. Returns true if the user has at least one of "capX" or "capY".
	 *  "capX+capY" - Logical AND. Returns true if the user has all the listed capabilities.
	 *
	 * Operator precedence: NOT, AND, OR.
	 *
	 * @uses current_user_can() Uses the capability checking function from WordPress core.
	 *
	 * @param string $capability
	 * @param bool $default
	 * @return bool
	 */
	private function current_user_can_computed($capability, $default = null) {
		$or_operator = ',';
		if ( strpos($capability, $or_operator) !== false ) {
			$allow = false;
			foreach(explode($or_operator, $capability) as $term) {
				$allow = $allow || $this->current_user_can_computed($term);
			}
			return $allow;
		}

		$and_operator = '+';
		if ( strpos($capability, $and_operator) !== false ) {
			$allow = true;
			foreach(explode($and_operator, $capability) as $term) {
				$allow = $allow && $this->current_user_can_computed($term);
			}
			return $allow;
		}

		$not_operator = 'not:';
		$length = strlen($not_operator);
		if ( substr($capability, 0, $length) == $not_operator ) {
			return ! $this->current_user_can_computed(substr($capability, $length));
		}

		$capability = trim($capability);

		//Special case to handle weird input like "capability+" and " ,capability".
		if ($capability == '') {
			return true;
		}

		return isset($default) ? $default : current_user_can($capability, -1);
	}

	/**
	 * @see WPMenuEditor::get_new_menu_grant_access()
	 *
	 * @param array $defaultGrantAccess Ignored. The default is completely replaced.
	 * @return array
	 */
	public function get_new_menu_grant_access(/** @noinspection PhpUnusedParameterInspection */$defaultGrantAccess = array()) {
		$capsWereDisabled = $this->wp_menu_editor->disable_virtual_caps;
		$this->wp_menu_editor->disable_virtual_caps = true;

		$grantAccess = array();

		$roles = array_keys(ameRoleUtils::get_role_names());
		$currentUser = wp_get_current_user();
		$access = $this->wp_menu_editor->get_plugin_option('plugin_access');

		if ( ($access === 'super_admin') && !is_multisite() ) {
			//On a regular WordPress site, is_super_admin() just checks for the "delete_users" capability.
			$access = 'delete_users';
		}

		if ( $access === 'super_admin' ) {
			//Hide from everyone except Super Admins.
			foreach($roles as $roleId) {
				$grantAccess['role:' . $roleId] = false;
			}
			$grantAccess['special:super_admin'] = true;
		} else if ( $access === 'specific_user' ) {
			//Hide from everyone except a specific user.
			$allowedUser = get_user_by('id', $this->wp_menu_editor->get_plugin_option('allowed_user_id'));
			if ( $allowedUser && $allowedUser->exists() ) {
				foreach($roles as $roleId) {
					$grantAccess['role:' . $roleId] = false;
				}
				$grantAccess['user:' . $allowedUser->user_login] = true;
				if ( is_multisite() ) {
					$grantAccess['special:super_admin'] = false;
				}
			}
		} else {
			//Only show to roles that have a certain capability (usually "manage_options").
			$capability = apply_filters('admin_menu_editor-capability', $access);
			$grantAccess['user:' . $currentUser->user_login] = current_user_can($capability);
			foreach($roles as $roleId) {
				$role = get_role($roleId);
				if ( $role ) {
					$grantAccess['role:' . $roleId] = $role->has_cap($capability);
				}
			}
		}

		$this->wp_menu_editor->disable_virtual_caps = $capsWereDisabled;
		return $grantAccess;
	}

	function output_menu_dropzone($type = 'menu') {
		printf(
			'<div id="ws_%s_dropzone" class="ws_dropzone"> </div>',
			($type == 'menu') ? 'top_menu' : 'sub_menu'
		);
	}

	function pro_page_title(){
		return 'Menu Editor Pro';
	}

	function pro_menu_title(){
		return 'Menu Editor Pro';
	}

  /**
   * Callback for the 'admin_menu_editor_is_pro' hook. Always returns True to indicate that
   * the Pro version extras are installed.
   *
   * @return bool True
   */
	function is_pro_version(){
		return true;
	}

	function license_ui_title() {
		$title = 'Admin Menu Editor Pro License';
		return $title;
	}

	function license_ui_logo() {
		printf(
			'<p style="text-align: center; margin: 30px 0;"><img src="%s" alt="Logo"></p>',
			esc_attr(plugins_url('images/logo-medium.png', __FILE__))
		);
	}

	/**
	 * @param string|null $currentKey
	 * @param string|null $currentToken
	 * @param Wslm_ProductLicense $currentLicense
	 */
	public function license_ui_upgrade_link($currentKey = null, $currentToken = null, $currentLicense = null) {
		if ( empty($currentKey) && empty($currentToken) ) {
			return;
		}

		$upgradeLink = 'http://adminmenueditor.com/upgrade-license/';
		$upgradeText = 'Upgrade or renew license';

		if ( $currentLicense && ($currentLicense->getStatus() === 'expired') ) {
			$upgradeLink = 'http://adminmenueditor.com/renew-license/';
			$upgradeText = 'Renew license';
		}

		if ( !empty($currentKey) ) {
			$upgradeLink = add_query_arg('license_key', $currentKey, $upgradeLink);
		}
		$externalIcon = plugins_url('/images/external.png', $this->wp_menu_editor->plugin_file);
		?><p>
			<label>Actions:</label>
			<a href="<?php echo esc_attr($upgradeLink); ?>"
			   rel="external"
			   target="_blank"
			   title="Opens in a new window"
			>
				<?php echo $upgradeText; ?>
				<img src="<?php echo esc_attr($externalIcon); ?>" alt="External link icon" width="10" height="10">
			</a>
		</p><?php
	}

	public function license_ui_product_name() {
		return 'Admin Menu Editor Pro';
	}

	/**
	 * Format separator items located in sub-menus.
	 * See /css/admin.css for the relevant styles.
	 *
	 * @param array $item Submenu item.
	 * @return array
	 */
	public function create_submenu_separator($item) {
		static $separator_num = 1;
		if ( !empty($item['separator']) ) {
			$item['menu_title'] = '<hr class="ws-submenu-separator">';
			$item['file'] = '#submenu-separator-' . ($separator_num++);
		}
		return $item;
	}

	/**
	 * Generate the HTML for submenu icons.
	 *
	 * @param array $item A submenu item in the internal format.
	 * @param boolean $hasCustomIconUrl Whether the item has a custom icon URL.
	 * @return array Modified $item.
	 */
	public function add_submenu_icon_html($item, $hasCustomIconUrl) {
		$enabled = $this->wp_menu_editor->get_plugin_option('submenu_icons_enabled');
		if ( empty($enabled) || ($enabled === 'never') ) {
			//Icons are disabled.
			return $item;
		}

		if ( ($enabled == 'if_custom') && !$hasCustomIconUrl ) {
			//Only enabled for icons with custom icons.
			return $item;
		}

		if ( !empty($item['separator']) ) {
			//Separators can't have icons.
			return $item;
		}

		if (strpos($item['icon_url'], 'dashicons-') === 0) {

			$item['menu_title'] = sprintf(
				'<div class="ame-submenu-icon"><div class="dashicons %1$s"></div></div>%2$s',
				esc_attr($item['icon_url']),
				$item['menu_title']
			);
			$item['has_submenu_icon'] = true;

		} elseif (strpos($item['icon_url'], 'ame-fa-') === 0) {

			$item['menu_title'] = sprintf(
				'<div class="ame-submenu-icon"><div class="ame-fa %1$s"></div></div>%2$s',
				esc_attr($item['icon_url']),
				$item['menu_title']
			);
			$item['has_submenu_icon'] = true;

		} elseif ( !empty($item['icon_url']) ) {

			$item['menu_title'] = sprintf(
				'<div class="ame-submenu-icon"><img src="%1$s" alt="Menu icon"></div>%2$s',
				esc_attr($item['icon_url']),
				$item['menu_title']
			);
			$item['has_submenu_icon'] = true;

		}

		return $item;
	}

	/**
	 * Remove Admin Menu Editor Pro from the list of plugins unless the current user
	 * is explicitly allowed to see it.
	 *
	 * @param array $plugins List of installed plugins.
	 * @return array Filtered list of plugins.
	 */
	public function filter_plugin_list($plugins) {
		if ( !is_array($plugins) && !($plugins instanceof ArrayAccess) ) {
			return $plugins;
		}

		$allowed_user_id = $this->wp_menu_editor->get_plugin_option('plugins_page_allowed_user_id');
		if ( get_current_user_id() != $allowed_user_id ) {
			unset($plugins[$this->wp_menu_editor->plugin_basename]);

			//Also hide the Branding and Toolbar Editor add-ons.
			if ( defined('AME_BRANDING_ADD_ON_FILE') ) {
				$brandingAddon = plugin_basename(constant('AME_BRANDING_ADD_ON_FILE'));
				if ( $brandingAddon ) {
					unset($plugins[$brandingAddon]);
				}
			}
			if ( defined('WS_ADMIN_BAR_EDITOR_FILE') ) {
				$toolbarAddon = plugin_basename(constant('WS_ADMIN_BAR_EDITOR_FILE'));
				if ( $toolbarAddon ) {
					unset($plugins[$toolbarAddon]);
				}
			}
		}
		return $plugins;
	}


	/**
	 * Apply Pro version menu customizations like shortcode support, "open in new window" support,
	 * submenu separators and so on.
	 *
	 * @param array $item Admin menu item in the internal format.
	 * @param string|null $parent_file
	 * @return array Modified admin menu item.
	 */
	public function apply_admin_menu_filters($item, $parent_file = null) {
		//Allow the usage of shortcodes in the admin menu
		$item = $this->do_shortcodes($item);

		//Flag menus that are set to open in a new window so that we can later find
		//and modify them with JS. This is necessary because there is no practical
		//way to intercept and modify the menu HTML with PHP alone.
		$item = $this->flag_new_window_menus($item);

		//Handle pages that need to be displayed in a frame.
		if ( isset($item['open_in']) ) {
			if ( !empty($parent_file) ) {
				$item = $this->create_framed_item($item, $parent_file);
			} else {
				$item = $this->create_framed_menu($item);
			}
		}

		//Handle submenu separators.
		if ( current_filter() == 'custom_admin_submenu' ) {
			$item = $this->create_submenu_separator($item);
		}

		//Handle menus that display a WP page in the admin.
		if ( $item['template_id'] === ameMenuItem::embeddedPageTemplateId ) {
			$item = $this->create_embedded_wp_page($item, $parent_file);
		}

		//Apply per-role visibility (cosmetic, not permissions).
		if ( !empty($item['hidden_from_actor']) ) {
			$item = $this->set_final_hidden_flag($item);
		}

		if ( ameMenuItem::get($item, 'sub_type') === 'heading' ) {
			$item['is_unvisitable'] = true;
			//Mark headings as collapsible if that feature is enabled.
			if ( $this->are_headings_collapsible ) {
				$item['css_class'] .= ' ame-collapsible-heading';
			}
		}

		return $item;
	}

	/**
	 * @param array $customMenu
	 */
	public function on_menu_merged($customMenu = array()) {
		//Note: If we never add per-heading collapsible settings, it would be more efficient
		//to get rid of this hook and the "ame-collapsible-heading" class, and instead tell
		//the helper script to enable the expand/collapse feature for all headings.
		$this->are_headings_collapsible = ameUtils::get(
			$customMenu,
			array('menu_headings', 'collapsible'),
			$this->are_headings_collapsible
		);
	}

	/**
	 * @param array $customMenu
	 * @param WPMenuEditor $menuEditor
	 * @noinspection PhpUnusedParameterInspection The unused $customMenu param is part of the hook signature.
	 */
	public function on_menu_built($customMenu = array(), $menuEditor = null) {
		if ( !$menuEditor ) {
			return;
		}

		if ( $menuEditor->is_custom_menu_deep() ) {
			if ( did_action('admin_enqueue_scripts') ) {
				$this->enqueue_third_level_script();
			} else {
				add_action('admin_enqueue_scripts', array($this, 'enqueue_third_level_script'));
			}

			add_action('in_admin_header', array($this, 'output_menu_ready_trigger'));
		}
	}

	public function enqueue_third_level_script() {
		//Third level menu support.
		wp_enqueue_auto_versioned_script(
			'ame-third-level-menus',
			plugins_url('/extras/third-level-menus.js', __FILE__),
			array('jquery', 'hoverIntent')
		);
	}

	public function output_menu_ready_trigger() {
		?>
		<script type="text/javascript">
			if (jQuery && document && (jQuery('#adminmenu').length > 0)) {
				jQuery(document).trigger('adminMenuEditor:menuDomReady');
			}
		</script>
		<?php
	}

	/**
	 * Generate CSS rules for menu items that have user-defined colors.
	 *
	 * This method stores the CSS at the "color_css" key in the menu structure and returns a modified menu.
	 * By storing the color scheme CSS in the menu itself we avoid having to regenerate it on every page load.
	 * We also don't have to worry about cache lifetime - when the menu is modified the old CSS will be
	 * overwritten automatically.
	 *
	 * @param array $custom_menu Admin menu in the internal format.
	 * @return array Modified menu.
	 */
	public function add_menu_color_css($custom_menu) {
		if ( empty($custom_menu) || !is_array($custom_menu) || !isset($custom_menu['tree']) ) {
			return $custom_menu;
		}

		if (!class_exists('ameMenuColorGenerator')) {
			require_once dirname(__FILE__) . '/extras/menu-color-generator.php';
		}
		$generator = new ameMenuColorGenerator();

		$css = array();
		$used_ids = array();
		$colorized_menu_count = 0;

		$global_icon_colors = null;

		//Include global colors, if any.
		if ( isset($custom_menu['color_presets']['[global]']) ) {
			$base_css = $generator->getCss(
				'',
				$custom_menu['color_presets']['[global]'],
				array(),
				dirname(__FILE__) . '/extras/global-menu-color-template.txt'
			);
			$css[] = $base_css;
			$global_icon_colors = $generator->getIconColorScheme();
		}

		foreach($custom_menu['tree'] as &$item) {
			if ( !isset($item['colors']) || empty($item['colors']) ) {
				continue;
			}
			$colorized_menu_count++;

			//Each item needs to have a unique ID so we can target it in CSS. Using a class would be cleaner,
			//but the selectors wouldn't have enough specificity to override WP defaults.
			$id = ameMenuItem::get($item, 'hookname');
			if ( empty($id) || isset($used_ids[$id]) ) {
				$id = (empty($id) ? 'ame-colorized-item' : $id) . '-';
				$id .= $colorized_menu_count . '-t' . time();
				$item['hookname'] = $id;
			}
			$used_ids[$id] = true;

			$sub_type = ameMenuItem::get($item, 'sub_type');
			if ( $sub_type === 'heading' ) {
				$extra_selectors = array('.ame-menu-heading-item');
			} else {
				$extra_selectors = array();
			}

			$item_css = $generator->getCss($id, $item['colors'], $extra_selectors);
			if ( !empty($item_css) ) {
				$css[] = sprintf(
					'/* %1$s (%2$s) */',
					str_replace('*/', ' ', ameMenuItem::get($item, 'menu_title', 'Untitled menu')),
					str_replace('*/', ' ', ameMenuItem::get($item, 'file', '(no URL)'))
				);
				$css[] = $item_css;
			}
		}

		if ( !empty($css) ) {
			$css = implode("\n", $css);
			$custom_menu['color_css'] = $css;
			$custom_menu['color_css_modified'] = time();
			$custom_menu['icon_color_overrides'] = $global_icon_colors;
		} else {
			$custom_menu['color_css'] = '';
			$custom_menu['color_css_modified'] = 0;
			$custom_menu['icon_color_overrides'] = null;
		}

		return $custom_menu;
	}

	/**
	 * Enqueue the user-defined menu color scheme, if any.
	 */
	public function enqueue_menu_color_style() {
		try {
			$custom_menu = $this->wp_menu_editor->load_custom_menu();
		} catch (InvalidMenuException $e) {
			//This exception is best handled elsewhere.
			return;
		}
		if ( empty($custom_menu) || empty($custom_menu['color_css']) ) {
			return;
		}

		wp_enqueue_style(
			'ame-custom-menu-colors',
			add_query_arg(
				'ame_config_id',
				$this->wp_menu_editor->get_loaded_menu_config_id(),
				admin_url('admin-ajax.php?action=ame_output_menu_color_css')
			),
			array(),
			$custom_menu['color_css_modified']
		);

		if ( isset($custom_menu['icon_color_overrides']) ) {
			add_action('admin_head', array($this, 'override_menu_icon_color_scheme'), 9);
		}
	}

	/**
	 * Output menu color CSS for the current custom menu.
	 */
	public function ajax_output_menu_color_css() {
		$config_id = null;
		if ( isset($_GET['ame_config_id']) && !empty($_GET['ame_config_id']) ) {
			$config_id = (string) ($_GET['ame_config_id']);
		}

		try {
			$custom_menu = $this->wp_menu_editor->load_custom_menu($config_id);
		} catch (InvalidMenuException $e) {
			return;
		}
		if ( empty($custom_menu) || empty($custom_menu['color_css']) ) {
			return;
		}

		header('Content-Type: text/css');
		header('X-Content-Type-Options: nosniff'); //No really IE, it's CSS. Honest.

		//Enable browser caching.
		header('Cache-Control: public');
		header('Expires: Thu, 31 Dec ' . date('Y', strtotime('+1 year')) . ' 23:59:59 GMT');
		header('Pragma: cache');

		echo $custom_menu['color_css'];
		exit();
	}

	/**
	 * Replace the icon colors in the current admin color scheme with the custom colors
	 * set by the user. This is necessary to make SVG icons display in the right color.
	 */
	public function override_menu_icon_color_scheme() {
		global $_wp_admin_css_colors;

		$custom_menu = $this->wp_menu_editor->load_custom_menu();
		if (!isset($custom_menu['icon_color_overrides'])) {
			return;
		}

		$color_scheme = get_user_option('admin_color');
		if ( empty( $_wp_admin_css_colors[ $color_scheme ] ) ) {
			$color_scheme = 'fresh';
		}

		$custom_colors = array_merge(
			array(
				'base'    => '#a0a5aa',
				'focus'   => '#00a0d2',
				'current' => '#fff',
			),
			$custom_menu['icon_color_overrides']
		);

		if ( isset($_wp_admin_css_colors[$color_scheme]) ) {
			$_wp_admin_css_colors[$color_scheme]->icon_colors = $custom_colors;
		}
	}

	/**
	 * Enqueue various dependencies on all admin pages.
	 *
	 * It seems inelegant for one plugin to have a dozen different "admin_print_scripts" hooks
	 * (and it might hurt performance), so I've combined some of them into this method.
	 */
	public function enqueue_dashboard_deps() {
		$this->enqueue_menu_color_style();
		$this->enqueue_fontawesome();

		wp_enqueue_auto_versioned_style(
			'ame-pro-admin-styles',
			plugins_url('extras/pro-admin-styles.css', __FILE__),
			array()
		);

		$is_helper_needed = true;
		$helper_data = array();

		$config_id = $this->wp_menu_editor->get_loaded_menu_config_id();
		if ( !empty($config_id) ) {
			$custom_menu = $this->wp_menu_editor->load_custom_menu($config_id);

			if ( ameUtils::get($custom_menu, array('menu_headings', 'textColorType')) === 'default' ) {
				$is_helper_needed = true;
				$helper_data['setHeadingHoverColor'] = true;
			}
		}

		if ( $is_helper_needed ) {
			$this->wp_menu_editor->register_jquery_plugins(array('ame-jquery-cookie'));

			wp_enqueue_auto_versioned_script(
				'ame-pro-admin-helpers',
				plugins_url('extras/pro-admin-helpers.js', __FILE__),
				array('jquery', 'ame-jquery-cookie')
			);

			wp_add_inline_script(
				'ame-pro-admin-helpers',
				sprintf('wsAmeProAdminHelperData = (%s);', json_encode($helper_data)),
				'before'
			);
		}
	}

	/**
	 * Enqueue the Font Awesome icon font & CSS.
	 */
	public function enqueue_fontawesome() {
		wp_enqueue_auto_versioned_style(
			'ame-font-awesome',
			plugins_url('extras/font-awesome/scss/font-awesome.css', __FILE__)
		);
	}

	/**
	 * Add FA icons to top level menus.
	 *
	 * @param array $menu
	 * @return array
	 */
	public function add_menu_fa_icon($menu) {
		$fa_prefix = 'ame-fa-';
		if ( strpos($menu['icon_url'], $fa_prefix) !== 0 ) {
			return $menu;
		}

		$icon = substr($menu['icon_url'], strlen($fa_prefix));

		//Add a placeholder icon to force WP to generate a .wp-menu-image node.
		$menu['wp_icon_url'] = 'dashicons-warning';

		//Override the icon using CSS.
		$menu['css_class'] .= ' ame-menu-fa ame-menu-fa-' . $icon;

		return $menu;
	}

	public function add_fa_selector_tab($tabs) {
		$tabs['ws_fontawesome_icons_tab'] = 'Font Awesome';
		return $tabs;
	}

	public function output_fa_selector_tab() {
		echo '<div class="ws_tool_tab" id="ws_fontawesome_icons_tab" style="display: none">';

		$icons = $this->get_available_fa_icons();
		foreach($icons as $icon_name) {
			printf(
				'<div class="ws_icon_option" title="%1$s" data-icon-url="ame-fa-%2$s">
					<div class="ws_icon_image ame-fa ame-fa-%2$s"></div>
				</div>',
				esc_attr(ucwords(str_replace('-', ' ', $icon_name))),
				$icon_name
			);
		}

		echo '<div class="clear"></div></div>';
	}

	private function get_available_fa_icons() {
		$icon_list = dirname(__FILE__) . '/extras/font-awesome/scss/_ame-icons.scss';
		if ( !is_readable($icon_list) ) {
			return array();
		}

		$scss = file_get_contents($icon_list);
		if ( preg_match_all('@^#\{[^}]+?\}-(?P<name>[\w\d\-]+)\s[^{]*?[^#]\{@m', $scss, $matches) ) {
			return $matches['name'];
		}

		return array();
	}

	public function display_addons() {
		$addOns = $this->get_addons();
		if ( empty($addOns) ) {
			return;
		}

		echo '<tr><th>Add-ons</th><td><table class="ame-available-add-ons">';
		foreach ($addOns as $slug => $addOn) {
			printf('<tr class="ame-add-on-item" data-slug="%s">', esc_attr($slug));
			printf(
				'<td class="ame-add-on-heading">
					<a href="%s" target="_blank" class="ame-add-on-details-link" title="View add-on details in a new tab">
						<span class="ame-add-on-name">%s</span>
					</a>
				</td>',
				esc_attr($addOn['detailsUrl']),
				$addOn['name']
			);

			if ( $addOn['isActive'] ) {
				echo '<td class="ame-add-on-status">Active</td>';
			} else if ( $this->is_add_on_installed($slug) ) {
				printf(
					'<td class="ame-add-on-status">Installed</td>
					 <td><button class="button ame-activate-add-on" data-nonce="%s">Activate</button></td>',
					esc_attr(wp_create_nonce('ws_ame_activate_add_on-' . $slug))
				);
			} else if ( $this->can_download_add_on($slug) ) {
				printf(
					'<td class="ame-add-on-status">Available</td>
					 <td><button class="button ame-install-add-on" data-nonce="%s">Install and Activate</button></td>',
					esc_attr(wp_create_nonce('ws_ame_install_add_on-' . $slug))
				);
			} else {
				$license = $this->get_license();
				if ( $license->hasAddOn($slug) ) {
					echo '<td class="ame-add-on-status">Download not available - no access to updates.</td>';
				} else {
					echo '<td class="ame-add-on-status">Not purchased</td>';
				}
			}

			echo '</tr>';
		}
		echo '</table></td></tr>';
	}

	/**
	 * Get all available add-ons including those that the user hasn't purchased.
	 *
	 * @return array
	 */
	private function get_addons() {
		return array(
			'wp-toolbar-editor' => array(
				'slug'       => 'wp-toolbar-editor',
				'name'       => 'WordPress Toolbar Editor',
				'detailsUrl' => 'https://adminmenueditor.com/toolbar-editor/',
				'isActive'   => defined('WS_ADMIN_BAR_EDITOR_FILE'),
				'fileName'   => 'wp-toolbar-editor/load.php',
			),
			'ame-branding-add-on' => array(
				'slug'       => 'ame-branding-add-on',
				'name'       => 'Branding',
				'detailsUrl' => 'https://adminmenueditor.com/',
				'isActive'   => defined('AME_BRANDING_ADD_ON_FILE'),
				'fileName'   => 'ame-branding-add-on/ame-branding-add-on.php',
			),
		);
	}

	private function is_add_on_installed($slug) {
		$addOns = $this->get_addons();
		if ( !isset($addOns[$slug]) ) {
			return false;
		}
		return file_exists(WP_PLUGIN_DIR . '/' . $addOns[$slug]['fileName']);
	}

	/**
	 * @param string $slug
	 * @return bool
	 */
	private function can_download_add_on($slug) {
		$license = $this->get_license();
		if (!$license) {
			return false;
		}
		return $license->canDownloadCurrentVersion() && $license->hasAddOn($slug);
	}

	private function get_license() {
		global $ameProLicenseManager; /** @var Wslm_LicenseManagerClient $ameProLicenseManager */
		if ( !$ameProLicenseManager ) {
			return null;
		}
		return $ameProLicenseManager->getLicense();
	}

	public function enqueue_addon_scripts() {
		wp_enqueue_auto_versioned_script(
			'ws-ame-add-on-management',
			plugins_url('extras/add-on-management.js', __FILE__),
			array('jquery')
		);

		wp_localize_script(
			'ws-ame-add-on-management',
			'wsAmeAddOnData',
			array(
				'ajaxUrl' => self_admin_url('admin-ajax.php'),
			)
		);
	}

	public function ajax_activate_addon() {
		if ( !isset($_POST['slug']) || !is_string($_POST['slug']) ) {
			exit('Error: No add-on slug specified');
		}

		$slug = $_POST['slug'];
		check_ajax_referer('ws_ame_activate_add_on-' . $slug);

		$addOns = $this->get_addons();
		if ( !isset($addOns[$slug]) ) {
			exit('Error: Add-on not found');
		}

		if ( !current_user_can('activate_plugins') ) {
			exit('You cannot activate plugins');
		}

		$result = activate_plugin($addOns[$slug]['fileName']);
		if ( is_wp_error($result) ) {
			exit($result->get_error_code() . ': ' . $result->get_error_message());
		}
		exit('OK');
	}

	public function ajax_install_addon() {

	}

	/**
	 * Prevent non-privileged users from accessing the special "All Settings" page even if
	 * they've been granted access to other pages that require the "manage_options" capability.
	 */
	public function disable_virtual_caps_on_all_options() {
		//options.php also handles the saving of settings created with the Settings API, so we
		//need to check if this is a direct request for options.php and not just a form submission.
		$action = ameUtils::get($_POST, 'action', ameUtils::get($_GET, 'action', ''));
		$option_page = ameUtils::get($_POST, 'option_page', ameUtils::get($_GET, 'option_page', 'options'));

		if ( ($action !== 'update') && (($option_page === 'options') || empty($option_page)) ) {
			$this->wp_menu_editor->disable_virtual_caps = true;
			add_action('admin_enqueue_scripts', array($this, 'enable_virtual_caps'));
		}
	}

	public function enable_virtual_caps() {
		$this->wp_menu_editor->disable_virtual_caps = false;
	}

	public function filter_available_modules($modules) {
		$modules['plugin-visibility'] = array_merge(
			$modules['plugin-visibility'],
			array(
				'path' => AME_ROOT_DIR . '/extras/modules/plugin-visibility/plugin-visibility.php',
				'className' => 'amePluginVisibilityPro',
				'title' => 'Plugins',
			)
		);
		$modules['role-editor'] = array(
			'path' => AME_ROOT_DIR . '/extras/modules/role-editor/load.php',
			'className' => 'ameRoleEditor',
			'requiredPhpVersion' => '5.3.6',
			'title' => 'Role Editor',
		);
		
		$modules['tweaks'] = array(
			'path' => AME_ROOT_DIR . '/extras/modules/tweaks/tweaks.php',
			'className'    => 'ameTweakManager',
			'title'        => 'Tweaks',
			'requiredPhpVersion' => '5.4',
		);

		$modules['separator-styles'] = array(
			'path' => AME_ROOT_DIR . '/extras/modules/separator-styles/ameMenuSeparatorStyler.php',
			'className'    => 'ameMenuSeparatorStyler',
			'title'        => 'Custom menu separator styles',
			'requiredPhpVersion' => '5.6',
		);

		return $modules;
	}
}

if ( isset($wp_menu_editor) && !defined('WP_UNINSTALL_PLUGIN') ) {
	//Initialize extras
	global $wsMenuEditorExtras;
	$wsMenuEditorExtras = new wsMenuEditorExtras($wp_menu_editor);
}

if ( !defined('IS_DEMO_MODE') && !defined('IS_MASTER_MODE') ) {

//Load the custom update checker (requires PHP 5)
if ( (version_compare(PHP_VERSION, '5.0.0', '>=')) && isset($wp_menu_editor) ){
	require dirname(__FILE__) . '/plugin-updates/plugin-update-checker.php';
	$ameProUpdateChecker = Puc_v4_Factory::buildUpdateChecker(
		'https://adminmenueditor.com/?get_metadata_for=admin-menu-editor-pro',
		$wp_menu_editor->plugin_file, //Note: This variable is set in the framework constructor
		'admin-menu-editor-pro',
		12,                         //check every 12 hours
		'ame_pro_external_updates', //store book-keeping info in this WP option
		'admin-menu-editor-mu.php'
	);

	//Hack. See PluginUpdateChecker::installHooks().
	function wsDisableAmeCron(){
		wp_clear_scheduled_hook('check_plugin_updates-admin-menu-editor-pro');
	}
	register_deactivation_hook($wp_menu_editor->plugin_file, 'wsDisableAmeCron');
}

//Load the license manager.
require dirname(__FILE__) . '/license-manager/LicenseManager.php';
global $ameProLicenseManager;
$ameProLicenseManager = new Wslm_LicenseManagerClient(array(
	'api_url' => 'https://adminmenueditor.com/licensing_api/',
	'product_slug' => 'admin-menu-editor-pro',
	'license_scope' => Wslm_LicenseManagerClient::LICENSE_SCOPE_NETWORK,
	'update_checker' => isset($ameProUpdateChecker) ? $ameProUpdateChecker : null,
	'token_history_size' => 5,
));
if ( isset($wp_menu_editor) ) {
	$ameLicensingUi = new Wslm_BasicPluginLicensingUI(
		$ameProLicenseManager,
		$wp_menu_editor->plugin_file,
		isset($ameProUpdateChecker) ? $ameProUpdateChecker : null,
		'AME_LICENSE_KEY'
	);
}

//Load WP-CLI commands.
if ( defined('WP_CLI') && WP_CLI && isset($wp_menu_editor) ) {
	include dirname(__FILE__) . '/extras/wp-cli-integration.php';
}

}
