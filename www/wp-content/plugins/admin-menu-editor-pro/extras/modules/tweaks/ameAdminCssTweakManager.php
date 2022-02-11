<?php

use YahnisElsts\AdminMenuEditor\Configurable\StringSetting;

class ameAdminCssTweakManager {
	private $isOutputHookRegistered = false;
	private $pendingCss = array();

	private $cachedUserInput = null;

	public function __construct() {
		add_action('admin-menu-editor-register_tweaks', array($this, 'registerDefaultTweak'), 10, 1);
	}

	public function enqueueCss($settings = null) {
		if ( ($settings === null) || (empty($settings['css'])) ) {
			return;
		}
		$this->pendingCss[] = $settings['css'];
		if ( !$this->isOutputHookRegistered ) {
			add_action('admin_print_scripts', array($this, 'outputCss'));
			$this->isOutputHookRegistered = true;
		}
	}

	public function outputCss() {
		if ( empty($this->pendingCss) ) {
			return;
		}
		echo '<!-- Admin Menu Editor: Admin CSS tweaks -->', "\n";
		echo '<style type="text/css" id="ame-admin-css-tweaks">', "\n";
		echo implode("\n", $this->pendingCss);
		echo "\n", '</style>', "\n";
	}

	/**
	 * Create a CSS tweak instance with the specified properties.
	 *
	 * @param array $properties
	 * @return ameDelegatedTweak
	 */
	public function createTweak($properties) {
		if ( $this->cachedUserInput === null ) {
			$this->cachedUserInput = (new StringSetting('css'))->textarea('css');
		}

		$cssTweak = new ameDelegatedTweak(
			$properties['id'],
			$properties['label'],
			array($this, 'enqueueCss')
		);
		$cssTweak->setSectionId('admin-css');
		$cssTweak->add($this->cachedUserInput);

		return $cssTweak;
	}

	/**
	 * @param ameTweakManager $tweakManager
	 */
	public function registerDefaultTweak($tweakManager) {
		$tweakManager->addSection('admin-css', 'Admin CSS', 20);

		$defaultTweak = $this->createTweak(array(
			'id'    => 'default-admin-css',
			'label' => 'Add custom admin CSS',
		));
		$tweakManager->addTweak($defaultTweak);
	}
}