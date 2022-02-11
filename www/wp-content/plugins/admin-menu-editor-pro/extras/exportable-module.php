<?php
interface ameExportableModule {
	/**
	 * @return array|null
	 */
	public function exportSettings();

	/**
	 * @param array $newSettings
	 * @return void
	 */
	public function importSettings($newSettings);


	/**
	 * @return string
	 */
	public function getExportOptionLabel();

	public function getExportOptionDescription();
}