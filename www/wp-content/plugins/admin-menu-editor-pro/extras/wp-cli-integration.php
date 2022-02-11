<?php /** @noinspection PhpComposerExtensionStubsInspection */

/**
 * Implements the "admin-menu-editor" WP CLI command.
 */
class ameWpCliCommand extends WP_CLI_Command {

	/**
	 * Activate a license key on the site.
	 *
	 * ## OPTIONS
	 *
	 * <license-key>
	 * : The license key to use. This is usually a 32 character code, all uppercase.
	 *
	 * @synopsis <license-key>
	 *
	 * @subcommand activate-license
	 * @param array $args
	 * @throws \WP_CLI\ExitException
	 */
	public function activateLicense($args) {
		if (count($args) < 1) {
			WP_CLI::error('You must specify a license key');
			return;
		}

		$licenseManager = $this->getLicenseManager();
		$result = $licenseManager->licenseThisSite($args[0]);
		if ( is_wp_error($result) ) {
			WP_CLI::error(sprintf('%s [%s]', $result->get_error_message(), $result->get_error_code()));
		} else {
			WP_CLI::success('Success! This site is now licensed.');
		}
	}

	/**
	 * Remove the current license from the site.
	 * @subcommand deactivate-license
	 * @throws \WP_CLI\ExitException
	 */
	public function deactivateLicense() {
		$licenseManager = $this->getLicenseManager();
		if ( !$licenseManager->hasExistingLicense() ) {
			WP_CLI::error('This site does not have a license, so you can\'t deactivate the license.');
			return;
		}

		$result = $licenseManager->unlicenseThisSite();
		if ( is_wp_error($result) ) {
			WP_CLI::error(sprintf('%s [%s]', $result->get_error_message(), $result->get_error_code()));
		} else {
			WP_CLI::success('Success! The current license has been removed.');
		}
	}

	/**
	 * Display information about the currently active license.
	 * @subcommand license-status
	 */
	public function licenseStatus() {
		$licenseManager = $this->getLicenseManager();

		if ( $licenseManager->hasExistingLicense() ) {
			$license = $licenseManager->getLicense();
			$expiresOn = $license->get('expires_on');
			$licenseKey = $licenseManager->getLicenseKey();
			$token = $licenseManager->getSiteToken();

			$info = array(
				'License found' => 'Yes',
				'Licensed URL' => $license->get('site_url', 'N/A'),
				'Status' => $license->getStatus(),
				'Expires' => empty($expiresOn) ? 'Never' : $expiresOn,
				'License key' => $licenseKey ? $licenseKey : 'Not stored in the WordPress database',
				'Site token' => $token ? $token : 'None',
			);
		} else {
			$info = array(
				'License found' => 'No'
			);
		}

		foreach($info as $name => $value) {
			WP_CLI::line(sprintf(
				'%s: %s',
				str_pad($name, 14, ' '),
				$value
			));
		}
	}

	/**
	 * Export the plugin configuration as JSON.
	 *
	 * ## OPTIONS
	 *
	 * [<file>]
	 * : Export file name.
	 *
	 * [--all]
	 * : Export all settings. For backwards compatibility reasons, the default is to
	 * export only the admin menu configuration.
	 *
	 * [--output]
	 * : Dump the export data to the console instead of saving it as a file.
	 *
	 * [--file=<file>]
	 * : An alternative way to specify the export file name.
	 *
	 * [--pretty]
	 * : Indent the JSON output to make it more readable.
	 *
	 * @param array $args
	 * @param array $assoc_args
	 * @throws InvalidMenuException
	 * @throws \WP_CLI\ExitException
	 */
	public function export($args, $assoc_args) {
		if ( empty($assoc_args['file']) && !empty($args[0]) ) {
			$assoc_args['file'] = $args[0];
		}

		if ( empty($assoc_args['file']) && empty($assoc_args['output']) ) {
			WP_CLI::error('You must specify either a file name or the "--output" parameter.');
			return;
		}

		$menuEditor = $this->getMenuEditor();

		if ( empty($assoc_args['all']) ) {
			$customMenu = $menuEditor->load_custom_menu();

			if ( empty($customMenu) ) {
				WP_CLI::error('Nothing to export. This site is using the default admin menu.');
				return;
			}

			$json = ameMenu::to_json(ameMenu::compress($customMenu));
		} else {
			$exportedData = $this->getPorter()->export_data();
			$json = json_encode($exportedData, !empty($assoc_args['pretty']) ? JSON_PRETTY_PRINT : 0);
		}

		if ( !empty($assoc_args['output']) ) {
			WP_CLI::line($json);
		} else {
			$fileName = $assoc_args['file'];
			$bytesWritten = file_put_contents($fileName, $json);
			if ( $bytesWritten > 0 ) {
				WP_CLI::success(sprintf('Export completed. %d bytes written.', $bytesWritten));
			} else {
				WP_CLI::error('Failed to write the file.');
			}
		}
	}

	/**
	 * Import plugin configuration from a JSON file.
	 *
	 * ## OPTIONS
	 *
	 * <file>
	 * : Import file name.
	 *
	 * [--what=<comma-separated-list>]
	 * : Which settings to import. The default is to import everything that's in
	 * the input file. Run "wp admin-menu-editor list-exportable-modules" for a list
	 * of options.
	 *
	 * ## EXAMPLES
	 *
	 *     # Import a file.
	 *     wp admin-menu-editor import config.json
	 *
	 *     # Import only specific parts of the configuration.
	 *     wp admin-menu-editor import config.json --what=admin-menu,metaboxes
	 *
	 * @param array $args
	 * @param array $assoc_args
	 * @throws \WP_CLI\ExitException
	 */
	public function import($args, $assoc_args = array()) {
		$fileName = $args[0];
		if ( !is_readable($fileName) ) {
			WP_CLI::error('The file doesn\'t exist or isn\'t readable.');
			return;
		}

		$enabledModules = null;
		if ( !empty($assoc_args['what']) ) {
			$enabledModules = explode(',', $assoc_args['what'], 100);
			$enabledModules = array_map('trim', $enabledModules);
			$enabledModules = array_fill_keys($enabledModules, true);
		}

		$json = file_get_contents($fileName);

		//Is this valid JSON?
		$decoded = json_decode($json, true);
		if ( function_exists('json_last_error') && (json_last_error() !== JSON_ERROR_NONE) ) {
			WP_CLI::error('Failed to parse JSON: ' . json_last_error_msg());
			return;
		}
		if ( empty($decoded) || !is_array($decoded) ) {
			WP_CLI::error('Unexpected JSON value. This is probably not an Admin Menu Editor export file.');
			return;
		}

		//Is it the unified configuration format?
		if ( isset($decoded['format'], $decoded['format']['name']) ) {
			if ( $decoded['format']['name'] === wsAmeImportExportFeature::$export_container_format_name ) {
				$this->importUnifiedSettings($decoded, $enabledModules);
				return;
			}
		}

		//It could also be an admin menu.
		$this->importAdminMenu($json);
	}

	/**
	 * @param array $container
	 * @param null $enabledModules
	 * @throws \WP_CLI\ExitException
	 */
	private function importUnifiedSettings($container, $enabledModules = null) {
		WP_CLI::log('Importing settings...');

		$moduleStatus = $this->getPorter()->import_data($container, $enabledModules);
		$successfulImports = 0;

		foreach($moduleStatus as $id => $status) {
			if ( isset($status['message']) ) {
				$message = $status['message'];
			} else if ( !empty($status['success']) ) {
				$message = 'OK';
			} else if ( !empty($status['skipped']) ) {
				$message = 'Skipped';
			} else {
				$message = 'Error';
			}

			WP_CLI::log($id . ': ' . $message);

			if ( !empty($status['success']) ) {
				$successfulImports++;
			}
		}

		if ( $successfulImports > 0 ) {
			WP_CLI::success('Import completed.');
		} else {
			WP_CLI::error('All modules either failed or were skipped.');
		}
	}

	/**
	 * @param $json
	 * @throws \WP_CLI\ExitException
	 */
	private function importAdminMenu($json) {
		try {
			$loadedMenu = ameMenu::load_json($json);
		} catch (Exception $ex) {
			WP_CLI::error($ex->getMessage());
			return;
		}

		$menuEditor = $this->getMenuEditor();

		try {
			$menuEditor->set_custom_menu($loadedMenu);
		} catch (InvalidMenuException $ex) {
			WP_CLI::error($ex->getMessage());
			return;
		}
		WP_CLI::success('Import completed.');
	}

	/**
	 * List settings that can be exported or imported.
	 *
	 * @subcommand list-exportable-modules
	 */
	public function listExportableModules() {
		$modules = $this->getPorter()->get_exportable_components();
		if ( is_callable('WP_CLI\Utils\format_items') ) {
			$items = array();
			foreach($modules as $id => $info) {
				$items[] = array(
					'id' => $id,
					'label' => isset($info['label']) ? $info['label'] : '(No label)'
				);
			}
			WP_CLI\Utils\format_items('table', $items, array('id', 'label'));
		}
	}

	/**
	 * Reset the "who can access this plugin" setting to the default value.
	 *
	 * @subcommand reset-plugin-access
	 */
	public function resetPluginAccess() {
		$menuEditor = $this->getMenuEditor();

		$oldSetting = $menuEditor->get_plugin_option('plugin_access');
		$newSetting = $menuEditor->is_super_plugin() ? 'super_admin' : 'manage_options';
		$menuEditor->set_plugin_option('plugin_access', $newSetting);

		WP_CLI::success('Access permissions changed from "' . $oldSetting . '" to "' . $newSetting . '".');
	}

	/**
	 * @return WPMenuEditor
	 */
	private function getMenuEditor() {
		return $GLOBALS['wp_menu_editor'];
	}

	/**
	 * @return Wslm_LicenseManagerClient
	 */
	private function getLicenseManager() {
		return $GLOBALS['ameProLicenseManager'];
	}

	/** @noinspection PhpUnusedPrivateMethodInspection */
	/**
	 * @return wsMenuEditorExtras
	 */
	private function getExtras() {
		return $GLOBALS['wsMenuEditorExtras'];
	}

	/**
	 * @return wsAmeImportExportFeature
	 */
	private function getPorter() {
		return wsAmeImportExportFeature::get_instance();
	}
}

/** @noinspection PhpUnhandledExceptionInspection */
WP_CLI::add_command('admin-menu-editor', 'ameWpCliCommand');