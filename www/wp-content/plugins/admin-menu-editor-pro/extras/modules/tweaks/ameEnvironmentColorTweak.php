<?php

use YahnisElsts\AdminMenuEditor\Configurable\ActorFeature;
use YahnisElsts\AdminMenuEditor\Configurable\ColorSetting;
use YahnisElsts\AdminMenuEditor\Configurable\SettingsGroup;

class ameEnvironmentColorTweak extends ameBaseTweak {
	const DEFAULT_ID = 'environment-dependent-colors';

	private $chosenColor = '';
	private $colorizeComponent = array();

	public function __construct($id = null, $label = 'Change menu color depending on the environment') {
		if ( $id === null ) {
			$id = self::DEFAULT_ID;
		}
		parent::__construct($id, $label);

		$toolbarDefaults = array('role:administrator' => true);
		if ( function_exists('is_multisite') && is_multisite() ) {
			$toolbarDefaults['special:super_admin'] = true;
		}

		$this
			->add(
				(new SettingsGroup('colors', 'Environments:'))
					->add(new ColorSetting('production', 'Production'))
					->add(new ColorSetting('staging', 'Staging'))
					->add(new ColorSetting('development', 'Development'))
					->add(new ColorSetting('local', 'Local'))
			)
			->add(
				(new SettingsGroup('targets', 'Apply color to:', null))
					->add(
						(new ActorFeature('colorizeToolbar', 'Toolbar (a.k.a Admin Bar)'))
							->setDefaultAccessMap($toolbarDefaults)
					)
					->add(new ActorFeature('colorizeAdminMenu', 'Admin menu'))
			);
	}

	public function apply($settings = null) {
		if ( !function_exists('wp_get_environment_type') ) {
			return;
		}
		$environment = wp_get_environment_type();
		if ( empty($environment) ) {
			return;
		}

		if ( empty($settings['colors'][$environment]) ) {
			return;
		}

		$this->chosenColor = trim($settings['colors'][$environment]);
		if ( !$this->isValidCssColor($this->chosenColor) ) {
			$this->chosenColor = '';
			return;
		}

		if (
			isset($GLOBALS['wsMenuEditorExtras'])
			&& method_exists($GLOBALS['wsMenuEditorExtras'], 'check_current_user_access')
		) {
			$extras = $GLOBALS['wsMenuEditorExtras'];
			/** @var wsMenuEditorExtras $extras */

			$this->colorizeComponent['toolbar'] = $extras->check_current_user_access(
				ameUtils::get($settings, 'colorizeToolbar', array())
			);
			$this->colorizeComponent['adminMenu'] = $extras->check_current_user_access(
				ameUtils::get($settings, 'colorizeAdminMenu', array())
			);
		}

		if ( did_action('admin_bar_init') ) {
			$this->enqueueEnvironmentStyle();
		} else {
			add_action('admin_bar_init', array($this, 'enqueueEnvironmentStyle'));
		}
	}

	public function enqueueEnvironmentStyle() {
		$customizations = array(
			'toolbar'   => array(
				'background'  => array(
					'#wpadminbar',
					'#wpadminbar .ab-item',
					'#wpadminbar .ab-sub-wrapper',
					'#wpadminbar .ab-sub-secondary',
				),
				'text'        => array(
					'#wpadminbar .ab-empty-item',
					'#wpadminbar a.ab-item',
					'#wpadminbar > #wp-toolbar span.ab-label',
					'#wpadminbar > #wp-toolbar span.noticon',

					'#wpadminbar .ab-icon::before',
					'#wpadminbar .ab-item::before',
					'#wpadminbar #adminbarsearch::before',
				),
				'styleHandle' => 'admin-bar',
			),
			'adminMenu' => array(
				'background'  => array(
					'#adminmenuback',
					'#adminmenuwrap',
					'#adminmenu',
					'#adminmenu .wp-submenu',
				),
				'text'        => array(
					'#adminmenu a',
					'#adminmenu div.wp-menu-image::before',
					'div.wp-menu-image::before',
					'#adminmenu .wp-submenu a',
					'#collapse-button',
				),
				'styleHandle' => 'admin-menu',
			),
		);

		$textColor = $this->getContrastingTextColor($this->chosenColor);

		foreach ($customizations as $component => $details) {
			if ( empty($this->colorizeComponent[$component]) ) {
				continue;
			}

			$css = sprintf(
				'%1$s {	background-color: %2$s !important; }',
				implode(',', $details['background']),
				$this->chosenColor
			);

			if ( $textColor !== null ) {
				$css .= sprintf(
					'%1$s {	color: %2$s !important; }',
					implode(', ', $details['text']),
					$textColor
				);
			}

			wp_add_inline_style($details['styleHandle'], $css);
		}
	}

	private function isValidCssColor($color) {
		if ( !is_string($color) ) {
			return false;
		}
		return (preg_match('@^#[0-9a-f]{3,8}$@i', $color) === 1);
	}

	/**
	 * @param string $backgroundColor
	 * @return string|null A hex color value, or NULL to leave the color unchanged.
	 */
	private function getContrastingTextColor($backgroundColor) {
		$colorLibraryPath = AME_ROOT_DIR . '/extras/phpColors/src/color.php';
		if ( !class_exists('phpColor', false) && file_exists($colorLibraryPath) ) {
			/** @noinspection PhpIncludeInspection */
			include($colorLibraryPath);
		}
		if ( !class_exists('phpColor') ) {
			return null;
		}

		//The default admin color scheme uses a very light grey as the text color for the Toolbar
		//and the admin menu. If the user chooses a light background color, this could make text
		//difficult to read. To avoid that, let's automatically change the text color to dark grey
		//if the background color is too light.

		//TODO: This doesn't really work correctly because phpColor doesn't seem to use the same HSL space as other tools.
		//Maybe replace it with something else.

		try {
			$background = phpColor::hexToHsl($backgroundColor);
			if ( $background['L'] > 0.4 ) {
				//Text needs to be darker.
				return '#101010';
			}
		} catch (Exception $e) {
			return null;
		}
		return null;
	}
}