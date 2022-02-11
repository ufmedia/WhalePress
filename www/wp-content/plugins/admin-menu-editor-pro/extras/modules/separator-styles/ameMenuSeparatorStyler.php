<?php

class ameMenuSeparatorStyler {
	const CSS_AJAX_ACTION = 'ame_output_separator_css';

	private $menuEditor;

	/**
	 * ameMenuSeparatorStyler constructor.
	 *
	 * @param WPMenuEditor $menuEditor
	 */
	public function __construct($menuEditor) {
		$this->menuEditor = $menuEditor;
		ameMenu::add_custom_loader(array($this, 'loadSeparatorSettings'));

		if ( !is_admin() ) {
			return;
		}

		add_action('admin_menu_editor-footer-editor', array($this, 'outputDialog'));
		add_action('admin_menu_editor-enqueue_styles-editor', array($this, 'enqueueStyles'));

		add_filter('ame_pre_set_custom_menu', array($this, 'addSeparatorCssToConfiguration'));
		add_action('admin_enqueue_scripts', array($this, 'enqueueCustomSeparatorStyle'));
		add_action('wp_ajax_' . self::CSS_AJAX_ACTION, array($this, 'ajaxOutputCss'));
	}

	public function outputDialog() {
		require __DIR__ . '/separator-styles-template.php';

		wp_enqueue_auto_versioned_script(
			'ame-separator-settings-js',
			plugins_url('separator-settings.js', __FILE__),
			array('jquery', 'knockout', 'jquery-ui-dialog', 'jquery-ui-tabs', 'ame-ko-extensions', 'ame-lodash'),
			true
		);
	}

	public function enqueueStyles() {
		wp_enqueue_style(
			'ame-separator-settings',
			plugins_url('separator-settings.css', __FILE__),
			array('menu-editor-base-style', 'wp-color-picker')
		);
	}

	public function addSeparatorCssToConfiguration($customMenu) {
		if ( empty($customMenu) || !is_array($customMenu) ) {
			return $customMenu;
		}

		if ( empty($customMenu['separators']) ) {
			unset($customMenu['separator_css']);
			unset($customMenu['separator_css_modified']);
			return $customMenu;
		}

		$css = $this->generateCss($customMenu['separators']);
		$customMenu['separator_css'] = $css;
		$customMenu['separator_css_modified'] = time();

		return $customMenu;
	}

	private function generateCss($settings) {
		if ( empty($settings['customSettingsEnabled']) ) {
			return '';
		}

		$css = $this->generateSeparatorTypeCss(
			$settings['topLevelSeparators'],
			'#adminmenumain #adminmenu li.wp-menu-separator .separator',
			'#adminmenumain #adminmenu li.wp-menu-separator'
		);

		$css .= "\n" . '#adminmenumain #adminmenu .wp-submenu a.wp-menu-separator {'
			. 'padding: 0;'
			. 'margin: 0;'
			. '}' . "\n";

		$css .= $this->generateSeparatorTypeCss(
			!empty($settings['useTopLevelSettingsForSubmenus'])
				? $settings['topLevelSeparators']
				: $settings['submenuSeparators'],
			'#adminmenumain #adminmenu .wp-submenu .ws-submenu-separator',
			'#adminmenumain #adminmenu .wp-submenu .ws-submenu-separator-wrap'
		);

		return $css;
	}

	private function generateSeparatorTypeCss($settings, $nodeSelector, $parentSelector) {
		$nodeSelector = trim($nodeSelector);
		$parentSelector = trim($parentSelector);

		$shouldClearFloats = false;

		$parentLines = array(
			'height: auto',
			'margin: 0',
			'padding: 0',
			'width: 100%',
		);
		$lines = array();

		$separatorColor = 'transparent';
		if ( $settings['colorType'] !== 'transparent' ) {
			$separatorColor = $settings['customColor'];
			if ( $separatorColor === '' ) {
				$separatorColor = 'transparent';
			}
		}

		if ( $settings['borderStyle'] === 'solid' ) {
			$lines[] = 'border: none';
			$lines[] = 'background-color: ' . $separatorColor;
			$lines[] = 'height: ' . $settings['height'] . 'px';
		} else {
			$lines[] = 'border-top-style: ' . $settings['borderStyle'];

			$lines[] = 'border-top-width: ' . $settings['height'] . 'px';
			$lines[] = 'height: 0';

			$lines[] = 'border-color: ' . $separatorColor;
			$lines[] = 'background: transparent';
		}

		if ( $settings['widthStrategy'] === 'percentage' ) {
			$lines[] = 'width: ' . $settings['widthInPercent'] . '%';
		} else if ( $settings['widthStrategy'] === 'fixed' ) {
			$lines[] = 'width: ' . $settings['widthInPixels'] . 'px';
		}

		$effectiveMargins = array(
			'top'    => $settings['marginTop'] . 'px',
			'bottom' => $settings['marginBottom'] . 'px',
			'left'   => $settings['marginLeft'] . 'px',
			'right'  => $settings['marginRight'] . 'px',
		);

		if ( $settings['widthStrategy'] !== 'full' ) {
			if ( $settings['alignment'] === 'center' ) {
				$effectiveMargins['left'] = 'auto';
				$effectiveMargins['right'] = 'auto';
			} else if ( ($settings['alignment'] === 'left') || ($settings['alignment'] === 'right') ) {
				$lines[] = 'float: ' . $settings['alignment'];
				$shouldClearFloats = true;
			}
		}

		$lines[] = 'margin: ' . $effectiveMargins['top'] . ' ' . $effectiveMargins['right'] . ' '
			. $effectiveMargins['bottom'] . ' ' . $effectiveMargins['left'];

		$result = (
			$nodeSelector . " {\n" . implode(";", $lines) . ";}\n"
			. $parentSelector . " {\n" . implode(";", $parentLines) . ";}\n"
		);
		if ( $shouldClearFloats ) {
			$result .= $parentSelector . '::after { content: ""; display: block; clear: both; height: 0; }';
		}
		return $result;
	}

	public function loadSeparatorSettings($menuConfig, $storedConfig) {
		//Copy separator settings.
		if ( isset($storedConfig['separators']) ) {
			$menuConfig['separators'] = $storedConfig['separators'];
		}
		//Copy the pre-generated CSS.
		if ( isset($storedConfig['separator_css']) && is_string($storedConfig['separator_css']) ) {
			$menuConfig['separator_css'] = $storedConfig['separator_css'];
			$menuConfig['separator_css_modified'] = isset($storedConfig['separator_css_modified'])
				? intval($storedConfig['separator_css_modified'])
				: 0;
		}
		return $menuConfig;
	}

	public function enqueueCustomSeparatorStyle() {
		$customMenu = $this->menuEditor->load_custom_menu();
		if ( empty($customMenu) || empty($customMenu['separator_css']) ) {
			return;
		}

		wp_enqueue_style(
			'ame-custom-separator-styles',
			add_query_arg(
				'ame_config_id',
				$this->menuEditor->get_loaded_menu_config_id(),
				admin_url('admin-ajax.php?action=' . urlencode(self::CSS_AJAX_ACTION))
			),
			array(),
			$customMenu['separator_css_modified']
		);
	}

	public function ajaxOutputCss() {
		$configId = null;
		if ( isset($_GET['ame_config_id']) && !empty($_GET['ame_config_id']) ) {
			$configId = (string)($_GET['ame_config_id']);
		}

		$customMenu = $this->menuEditor->load_custom_menu($configId);
		if ( empty($customMenu) || empty($customMenu['separator_css']) ) {
			echo '/* No CSS found. */';
			return;
		}

		$timestamp = $customMenu['separator_css_modified'];
		//Support the If-Modified-Since header.
		$omitResponseBody = false;
		if ( isset($_SERVER['HTTP_IF_MODIFIED_SINCE']) && !empty($_SERVER['HTTP_IF_MODIFIED_SINCE']) ) {
			$threshold = strtotime((string)$_SERVER['HTTP_IF_MODIFIED_SINCE']);
			if ( $timestamp <= $threshold ) {
				header('HTTP/1.1 304 Not Modified');
				$omitResponseBody = true;
			}
		}

		//Enable browser caching.
		header('Cache-Control: public, max-age=5184000');
		header('Last-Modified: ' . gmdate('D, d M Y H:i:s ', $timestamp) . 'GMT');
		if ( $omitResponseBody ) {
			exit();
		}

		header('Content-Type: text/css');
		header('X-Content-Type-Options: nosniff');

		echo $customMenu['separator_css'];
		exit();
	}
}