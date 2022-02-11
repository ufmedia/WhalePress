<?php
class amePersistentProModule extends amePersistentModule implements ameExportableModule {
	/**
	 * @internal
	 * @param array $importedData
	 */
	public function handleDataImport($importedData) {
		//Action: admin_menu_editor-import_data
		if ( !empty($this->moduleId) && isset($importedData, $importedData[$this->moduleId]) ) {
			$this->importSettings($importedData[$this->moduleId]);
		}
	}

	public function exportSettings() {
		if ( isset($this->moduleId) ) {
			return $this->loadSettings();
		}
		return null;
	}

	public function importSettings($newSettings) {
		if ( !is_array($newSettings) || empty($newSettings) ) {
			return;
		}

		$this->mergeSettingsWith($newSettings);
		$this->saveSettings();
	}

	/**
	 * @return string
	 */
	public function getExportOptionLabel() {
		return $this->getTabTitle();
	}

	public function getExportOptionDescription() {
		return '';
	}
}