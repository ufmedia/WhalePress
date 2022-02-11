<?php


class ameEnvironmentNameTweak extends ameBaseTweak {
	private $currentEnvironment = '';
	private $toolbarIconCss = null;

	public function __construct($id = 'show-environment-in-toolbar', $label = 'Show environment type in the Toolbar') {
		parent::__construct($id, $label);
	}

	public function apply($settings = null) {
		if ( !function_exists('wp_get_environment_type') ) {
			return;
		}
		$this->currentEnvironment = wp_get_environment_type();
		if ( empty($this->currentEnvironment) ) {
			return;
		}

		add_action('admin_bar_menu', array($this, 'addEnvironmentToToolbar'));
	}

	/**
	 * @param WP_Admin_Bar|null $adminBar
	 */
	public function addEnvironmentToToolbar($adminBar = null) {
		if ( !$adminBar ) {
			return;
		}

		//Dashicons for different environments. Some icons are not aligned in the same way as others,
		//so we also store a relative offset (position) from the top of the box.
		$iconsByEnvironment = array(
			'production'  => array('f11f', 3),
			'staging'     => array('f463', 3),
			'development' => array('f107', 3),
			'local'       => array('f102', 2),
		);

		$icon = 'f159';
		$offsetTop = 3;
		if ( !empty($iconsByEnvironment[$this->currentEnvironment]) ) {
			list($icon, $offsetTop) = $iconsByEnvironment[$this->currentEnvironment];
		}

		$itemId = 'ame-tweak-environment-type';
		$this->toolbarIconCss = sprintf(
			'#wp-admin-bar-%s .ab-icon::before {
				content: "\\%s";
				top: %dpx;
			}',
			$itemId,
			$icon,
			$offsetTop
		);

		$iconHtml = '<span class="ab-icon"></span>';
		$adminBar->add_node(array(
			'id'     => $itemId,
			'title'  => $iconHtml . esc_html(ameUtils::ucWords($this->currentEnvironment)),
			'parent' => 'top-secondary',
			'meta'   => array(
				'title' => 'Current environment type',
			),
		));

		add_action('wp_before_admin_bar_render', array($this, 'printToolbarIconCss'));
	}

	public function printToolbarIconCss() {
		printf('<style type="text/css">%s</style>', $this->toolbarIconCss);
	}
}