<?php
if ( !class_exists('phpColor') ) {
	require_once dirname(__FILE__) . '/phpColors/src/color.php';
}

class ameMenuColorGenerator {
	private $colors = array();

	public function __construct() {}

	/**
	 * Generate color scheme CSS for an admin menu item.
	 *
	 * @param string $menuId Menu item ID.
	 * @param array $colors An array of hex colors indexed by color name. E.g. [base-color => #aabbcc, ..].
	 * @param array $extraSelectors
	 * @param string $templateFilename
	 * @return string
	 */
	public function getCss($menuId, $colors, $extraSelectors = array(), $templateFilename = null) {
		if ( empty($templateFilename) ) {
			$templateFilename = dirname(__FILE__) . '/menu-color-template.txt';
		}
		$template = file_get_contents($templateFilename);

		$this->colors = $this->addComputedColors($colors);

		//Replace $variables with colors.
		$css = preg_replace_callback(
			'@(?P<property>\w[\w\-]*)\s*:\s*\$(?P<name>[\w\-]+)\s*;@i',
			array($this, 'replaceVariable'),
			$template
		);

		if ( !empty($menuId) ) {
			//WordPress replaces special characters in the ID with dashes before output.
			//See /wp-admin/menu-header.php, line #110 in WP 5.5-alpha.
			$sanitizedId = preg_replace('|[^a-zA-Z0-9_:.]|', '-', $menuId);
			$replacement = implode('', $extraSelectors) . '#' . $sanitizedId;
			$css = str_replace('#menu-id-placeholder', $replacement, $css);
		}

		return $css;
	}

	/**
	 * Fill out missing color fields based on available colors.
	 *
	 * Many admin color schemes just define a small set of base colors and generate the rest with Sass.
	 * This method does the same thing in PHP. Based on /wp-admin/css/colors/_variables.scss from WP 3.9-beta2.
	 *
	 * @param array $colors
	 * @return array
	 */
	protected function addComputedColors($colors) {
		if ( !empty($colors['base-color']) ) {
			$baseColor = new phpColor($colors['base-color']);

			if ( empty($colors['icon-color']) ) {
				$hsl = $baseColor->getHsl();
				$hsl['S'] = 0.07;
				$hsl['L'] = 0.95;
				$colors['icon-color'] = '#' . phpColor::hslToHex($hsl);
			}

			if ( empty($colors['menu-submenu-text']) && !empty($colors['text-color']) ) {
				$baseColor = new phpColor($colors['base-color']);
				//WP sets the submenu text color to mix($base-color, $text-color, 30%), but phpColors expects
				//the mixing amount to be -100% to +100%. So we need to convert from [0, 100] to [-100, 100].
				$colors['menu-submenu-text'] = '#' . $baseColor->mix($colors['text-color'], 2 * 30 - 100);
			}

			if ( empty($colors['menu-submenu-background']) ) {
				$baseColor = new phpColor($colors['base-color']);
				$colors['menu-submenu-background'] = '#' . $baseColor->darken(7);
			}
		}

		$defaults = array(
			'menu-text' => 'text-color',
			'menu-icon' => 'icon-color',
			'menu-background' => 'base-color',

			'menu-highlight-text' => 'text-color',
			'menu-highlight-icon' => 'text-color',
			'menu-highlight-background' => 'highlight-color',

			'menu-current-text' => 'menu-highlight-text',
			'menu-current-icon' => 'menu-highlight-icon',
			'menu-current-background' => 'menu-highlight-background',

			'menu-submenu-focus-text' => 'highlight-color',
			'menu-submenu-current-text' => 'text-color',

			'menu-bubble-text' => 'text-color',
			'menu-bubble-background' => 'notification-color',
			'menu-bubble-current-text' => 'text-color',
			'menu-bubble-current-background' => 'menu-submenu-background',
		);

		foreach($defaults as $target => $source) {
			if ( empty($colors[$target]) && !empty($colors[$source]) ) {
				$colors[$target] = $colors[$source];
			}
		}

		return $colors;
	}

	/**
	 * Get the calculated icon colors from the last getCss() call.
	 *
	 * @return array Returns an array of icon colors in the format used by admin color schemes.
	 */
	public function getIconColorScheme() {
		if ( empty($this->colors) ) {
			throw new RuntimeException('You must call getCss() before calling ' . __METHOD__ . '()');
		}

		return array(
			'base'    => !empty($this->colors['menu-icon']) ? $this->colors['menu-icon'] : '#a0a5aa',
			'focus'   => !empty($this->colors['menu-highlight-icon']) ? $this->colors['menu-highlight-icon'] : '#00a0d2',
			'current' => !empty($this->colors['menu-current-icon']) ? $this->colors['menu-current-icon'] : '#fff',
		);
	}

	/**
	 * Replace the $variable in "css-property: $variable" with the corresponding value from $this->colors.
	 *
	 * @param array $matches
	 * @return string
	 */
	protected function replaceVariable($matches) {
		if ( !empty($this->colors[$matches['name']]) ) {
			return str_replace(
				'$' . $matches['name'],
				$this->colors[$matches['name']],
				$matches[0]
			);
		} else {
			return sprintf('/* $%s is not set. */', $matches['name']);
		}
	}

}