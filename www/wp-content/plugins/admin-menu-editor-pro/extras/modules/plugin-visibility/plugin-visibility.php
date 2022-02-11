<?php
require_once AME_ROOT_DIR . '/modules/plugin-visibility/plugin-visibility.php';

class amePluginVisibilityPro extends amePluginVisibility implements ameExportableModule {
	public function __construct($menuEditor) {
		parent::__construct($menuEditor);

		if ( class_exists('ReflectionClass', false) ) {
			//This should never throw an exception since the parent class must exist for this constructor to be run.
			/** @noinspection PhpUnhandledExceptionInspection */
			$reflector = new ReflectionClass(get_parent_class($this));
			$this->moduleDir = dirname($reflector->getFileName());
			$this->moduleId = basename($this->moduleDir);
		}
	}

	public function exportSettings() {
		$settings = $this->loadSettings();
		if ( empty($settings['plugins']) && empty($settings['grantAccessByDefault']) ) {
			return null;
		}
		return $settings;
	}

	public function importSettings($newSettings) {
		if ( !is_array($newSettings) || empty($newSettings) ) {
			return;
		}

		$this->loadSettings();
		$this->settings = array_merge($this->settings, $newSettings);
		$this->saveSettings();
	}

	/**
	 * @return string
	 */
	public function getExportOptionLabel() {
		return 'Plugin visibility';
	}

	public function getExportOptionDescription() {
		return '';
	}
}