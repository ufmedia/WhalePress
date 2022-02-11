<?php


class ameMenuHeadingStyler {
	const CSS_AJAX_ACTION = 'ame_output_heading_css';

	private $menuEditor;

	/**
	 * ameMenuSeparatorStyler constructor.
	 *
	 * @param WPMenuEditor $menuEditor
	 */
	public function __construct($menuEditor) {
		$this->menuEditor = $menuEditor;

		//Put the heading stylesheet before the admin colors stylesheet to make it easier
		//to override the heading colors for individual items (using the "Color scheme" field).
		add_action('admin_enqueue_scripts', array($this, 'enqueueHeadingCustomizations'), 5);
		add_action('wp_ajax_' . self::CSS_AJAX_ACTION, array($this, 'ajaxOutputCss'));

		add_action('admin_menu_editor-enqueue_styles-editor', array($this, 'enqueueEditorStyles'));

		if ( !empty($_COOKIE['ame-collapsed-menu-headings']) ) {
			add_action('in_admin_header', array($this, 'outputRestorationTrigger'));
		}
	}

	public function enqueueHeadingCustomizations() {
		$configId = $this->menuEditor->get_loaded_menu_config_id();
		$customMenu = $this->menuEditor->load_custom_menu($configId);
		if ( empty($customMenu) || empty($customMenu['menu_headings']) ) {
			return;
		}

		//Use the modification timestamp for versioning and cache busting.
		$currentTime = time();
		$modificationTime = (int)ameUtils::get($customMenu, 'menu_headings.modificationTimestamp', $currentTime);
		if ( ($modificationTime <= 0) || ($modificationTime > ($currentTime + 10)) ) {
			$modificationTime = $currentTime;
		}

		wp_enqueue_style(
			'ame-menu-heading-style',
			add_query_arg(
				'ame_config_id',
				$this->menuEditor->get_loaded_menu_config_id(),
				admin_url('admin-ajax.php?action=' . urlencode(self::CSS_AJAX_ACTION))
			),
			[],
			$modificationTime
		);
	}

	public function ajaxOutputCss() {
		header('Content-Type: text/css');
		header('X-Content-Type-Options: nosniff');

		$configId = null;
		if ( isset($_GET['ame_config_id']) && !empty($_GET['ame_config_id']) ) {
			$configId = (string)($_GET['ame_config_id']);
		}
		$customMenu = $this->menuEditor->load_custom_menu($configId);

		if ( empty($customMenu) || empty($customMenu['menu_headings']) ) {
			echo '/* No heading settings found. */';
			return;
		}

		$timestamp = (int)ameUtils::get($customMenu, 'menu_headings.modificationTimestamp', time());
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
		//Note that admin-ajax.php always adds HTTP headers that prevent caching, so we will
		//override all of them even though we don't actually need some of them, like "Expires".
		$cacheLifeTime = 30 * 24 * 3600;
		header('Cache-Control: public, max-age=' . $cacheLifeTime);
		header('Last-Modified: ' . gmdate('D, d M Y H:i:s ', $timestamp) . 'GMT');
		header('Expires: ' . gmdate('D, d M Y H:i:s ', $timestamp + $cacheLifeTime) . 'GMT');
		if ( $omitResponseBody ) {
			exit();
		}

		$output = $this->generateCss($customMenu['menu_headings']);
		echo $output;
		exit;
	}

	protected function generateCss($settings) {
		$textColor = null;
		$backgroundColor = null;

		//General heading appearance.
		$linkStyles = ['cursor' => 'default'];
		$hoverStyles = ['background-color' => 'transparent'];

		if ( ameUtils::get($settings, 'textColorType') === 'custom' ) {
			$textColor = ameUtils::get($settings, 'textColor');
			if ( !empty($textColor) ) {
				$linkStyles['color'] = $textColor;
				$hoverStyles['color'] = $textColor;
			}
		}
		if ( ameUtils::get($settings, 'backgroundColorType') === 'custom' ) {
			$backgroundColor = ameUtils::get($settings, 'backgroundColor');
			if ( !empty($backgroundColor) ) {
				$linkStyles['background-color'] = $backgroundColor;
				$hoverStyles['background-color'] = $backgroundColor;
			}
		}

		if ( !empty($settings['fontWeight']) ) {
			$linkStyles['font-weight'] = $settings['fontWeight'];
		}
		if ( !empty($settings['fontSizeValue']) && !empty($settings['fontSizeUnit']) ) {
			$unit = ($settings['fontSizeUnit'] === 'percentage') ? '%' : $settings['fontSizeUnit'];
			$linkStyles['font-size'] = $settings['fontSizeValue'] . $unit;
		}

		$textTransform = ameUtils::get($settings, 'textTransform', 'none');
		if ( $textTransform !== 'none' ) {
			$linkStyles['text-transform'] = $textTransform;
		}

		//Bottom border.
		$borderStyles = [];
		$borderType = ameUtils::get($settings, 'bottomBorder.style', 'none');
		if ( $borderType !== 'none' ) {
			$borderStyles = [
				'display' => 'block',
				'height'  => '1px',
				'width'   => '100%',
				'content' => "''",
			];

			$borderColor = ameUtils::get($settings, 'bottomBorder.color');
			if ( empty($borderColor) ) {
				$borderColor = $textColor;
			}
			if ( empty($borderColor) ) {
				$borderColor = '#eee'; //Menu text color in the default admin color scheme.
			}

			$borderStyles['border-bottom'] = sprintf(
				'%dpx %s %s',
				ameUtils::get($settings, 'bottomBorder.width', 1),
				$borderType,
				$borderColor
			);
		}

		//Padding can be automatic or custom.
		$paddingType = ameUtils::get($settings, 'paddingType', 'auto');
		$paddingStyles = [];
		if ( $paddingType === 'custom' ) {
			foreach (['top', 'bottom', 'left', 'right'] as $side) {
				$value = ameUtils::get($settings, 'padding' . ucfirst($side));
				if ( isset($value) && ($value > 0) ) {
					$paddingStyles['padding-' . $side] = $value . 'px';
				}
			}
		}

		//The icon.
		$iconStyles = [];
		$collapsedIconStyles = [];
		$iconVisibility = ameUtils::get($settings, 'iconVisibility', 'always');
		if ( $iconVisibility !== 'always' ) {
			$iconStyles['display'] = 'none';

			if ( $iconVisibility === 'if-collapsed' ) {
				$collapsedIconStyles['display'] = 'unset';
			}

			if ( $paddingType === 'auto' ) {
				$paddingStyles['padding-left'] = '9px';
			}
		}

		$output = [
			$this->makeCssRule(
				['& a'],
				$linkStyles
			),
			$this->makeCssRule(
				['& .wp-menu-name'],
				$paddingStyles
			),
			$this->makeCssRule(
				['& .wp-menu-name::after'],
				$borderStyles
			),
			$this->makeCssRule(
				['&:hover', '&:active', '&:focus', '& a:hover', '&.menu-top a:active', '&.menu-top a:focus',],
				$hoverStyles
			),
			$this->makeCssRule(
				['& .wp-menu-image'],
				$iconStyles
			),
			$this->makeCssRule(
				['body.folded & .wp-menu-image'],
				$collapsedIconStyles
			),
			$this->makeCssRule(
				['&.ame-collapsible-heading a'],
				['cursor' => 'pointer']
			),
			//Remove the colored bar from item unless the heading is clickable.
			$this->makeCssRule(
				['&:not(.ame-collapsible-heading) a'],
				['box-shadow' => 'none']
			),
		];

		//Some rules might be empty if we have no custom settings for their properties,
		//let's filter them out.
		$output = array_filter($output, function ($input) {
			return ($input !== '');
		});

		return implode("\n", $output);
	}

	/**
	 * @param string[] $selectors
	 * @param string[] $properties
	 * @param string $parentSelector
	 * @return string
	 */
	protected function makeCssRule($selectors, $properties, $parentSelector = '#adminmenu li.ame-menu-heading-item') {
		if ( empty($properties) || empty($selectors) ) {
			return '';
		}

		if ( !empty($parentSelector) ) {
			$selectors = array_map(
				function ($selector) use ($parentSelector) {
					return str_replace('&', $parentSelector, $selector);
				},
				$selectors
			);
		}

		$output = implode(",\n", $selectors) . " {\n";
		foreach ($properties as $name => $value) {
			$output .= "\t" . $name . ': ' . $value . ";\n";
		}
		$output .= "}\n";
		return $output;
	}

	public function enqueueEditorStyles() {
		wp_enqueue_auto_versioned_style(
			'ame-menu-heading-editor-css',
			plugins_url('menu-headings-editor.css', __FILE__)
		);
	}

	public function outputRestorationTrigger() {
		?>
		<script type="text/javascript">
			if (jQuery && document) {
				jQuery(document).trigger('restoreCollapsedHeadings.adminMenuEditor');
			}
		</script>
		<?php
	}
}