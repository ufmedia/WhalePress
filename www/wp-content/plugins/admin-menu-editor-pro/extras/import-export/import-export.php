<?php

class wsAmeImportExportFeature {
	public static $export_container_format_name = 'Admin Menu Editor configuration container';
	private static $export_container_format_version = '1.0';

	/**
	 * @var WPMenuEditor
	 */
	private $wp_menu_editor = null;

	private $exportable_global_options = array(
		'hide_advanced_settings',
		'ui_colour_scheme',
		'submenu_icons_enabled',
		'unused_item_position',
		'compress_custom_menu',
		'dashboard_hiding_confirmation_enabled',
	);

	private static $last_instance = null;

	protected function __construct($menuEditor) {
		$this->wp_menu_editor = $menuEditor;

		add_action('admin_menu_editor-header', array($this, 'menu_editor_header'), 10, 2);

		add_filter('admin_menu_editor-tabs', array($this, 'add_import_export_tabs'), 30);
		add_action('admin_menu_editor-section-import', array($this, 'display_import_tab'));
		add_action('admin_menu_editor-section-export', array($this, 'display_export_tab'));
		add_action('admin_menu_editor-clean_up_import', array($this, 'clean_up_import_data'), 10, 3);

		add_action('admin_menu_editor-register_scripts', array($this, 'register_scripts'));
		foreach (array('import', 'export') as $tabSlug) {
			add_action('admin_menu_editor-enqueue_scripts-' . $tabSlug, array($this, 'enqueue_tab_scripts'));
		}
	}

	public function menu_editor_header($action = '', $post = array()) {
		//Handle universal export.
		if ( $action === 'ame_export_settings' ) {
			$this->handle_export_request($action, $post);
		}
	}

	public function export_data() {
		$settings = array();

		$globalOptions = array();
		foreach($this->exportable_global_options as $key) {
			$globalOptions[$key] = $this->wp_menu_editor->get_plugin_option($key);
		}
		if ( !empty($globalOptions) ) {
			$settings['global'] = $globalOptions;
		}

		try {
			$customMenu = $this->wp_menu_editor->load_custom_menu();
			if ( !empty($customMenu) ) {
				$settings['admin-menu'] = ameMenu::add_format_header(ameMenu::compress($customMenu));
			}
		} catch (InvalidMenuException $e) {
			//Ignore it. We can still try to export other settings if this part fails.
		}

		foreach ($this->wp_menu_editor->get_loaded_modules() as $module) {
			if ( !($module instanceof ameModule) ) {
				continue;
			}
			$id = $module->getModuleId();
			if ( empty($id) || isset($settings[$id]) ) {
				continue;
			}

			$exportedData = null;
			if ( $module instanceof ameExportableModule ) {
				$exportedData = $module->exportSettings();
			} else if ( $module instanceof amePersistentModule ) {
				$exportedData = $module->loadSettings();
			}

			if ( $exportedData !== null ) {
				$settings[$id] = $exportedData;
			}
		}

		$settings = apply_filters('admin_menu_editor-exported_data', $settings);

		$container = array(
			'format'   => array(
				'name'    => self::$export_container_format_name,
				'version' => self::$export_container_format_version,
			),
			'settings' => $settings,
		);

		return $container;
	}

	/**
	 * @param array $container
	 * @param array|null $enabledModules
	 * @return array
	 */
	public function import_data($container, $enabledModules = null) {
		$status = array_fill_keys(array_keys($container['settings']), array('success' => false, 'skipped' => true));

		$settings = $container['settings'];

		//Import global plugin settings.
		if (
			!empty($settings['global'])
			&& (!isset($enabledModules) || !empty($enabledModules['global']))
		) {
			$importableOptions = array_intersect_key(
				$settings['global'],
				array_fill_keys($this->exportable_global_options, true)
			);
			if ( !empty($importableOptions) ) {
				$this->wp_menu_editor->set_many_plugin_options($importableOptions);
				$status['global'] = array(
					'success' => true,
					'message' => sprintf('OK, %d options imported', count($importableOptions)),
				);
			}
		}

		//Import the admin menu.
		if (
			!empty($settings['admin-menu'])
			&& (!isset($enabledModules) || !empty($enabledModules['admin-menu']))
		) {
			try {
				$loadedMenu = ameMenu::load_array($settings['admin-menu']);
				$menuEditor = $this->wp_menu_editor;
				$menuEditor->set_custom_menu($loadedMenu);
				$status['admin-menu'] = array('success' => true);
			} catch (Exception $ex) {
				$status['admin-menu'] = array('success' => false, 'message' => $ex->getMessage());
			}
		}

		//Import module settings.
		foreach ($this->wp_menu_editor->get_loaded_modules() as $module) {
			if ( !($module instanceof ameModule) ) {
				continue;
			}
			$id = $module->getModuleId();
			if ( empty($id) || !isset($settings[$id]) ) {
				continue;
			}

			if ( isset($enabledModules) && empty($enabledModules[$id]) ) {
				continue;
			}

			$newSettings = $settings[$id];
			if ( $module instanceof ameExportableModule ) {
				$module->importSettings($newSettings);
				$status[$id] = array('success' => true);
			} else if ( ($module instanceof amePersistentModule) && is_array($newSettings) && !empty($newSettings) ) {
				$module->mergeSettingsWith($newSettings);
				$module->saveSettings();
				$status[$id] = array('success' => true);
			}
		}

		return $status;
	}

	private function handle_export_request($action, $post) {
		check_admin_referer($action);

		$enabledOptions = array();
		foreach (ameUtils::get($post, 'ame-selected-modules', array()) as $option => $value) {
			if ( !empty($value) && ($value !== 'off') ) {
				$enabledOptions[$option] = true;
			}
		}

		//todo: Consider adding some buffer space at the end to avoid truncation when other plugins add superfluous whitespace.

		$data = $this->export_data();
		$data['settings'] = array_intersect_key($data['settings'], $enabledOptions);
		$json = json_encode($data);

		$domain = @parse_url(get_bloginfo('url'), PHP_URL_HOST);
		$fileName = sprintf('%s-AME-configuration(%s).json', $domain, date('Y-m-d'));
		$fileName = apply_filters('admin_menu_editor-export_file_name', $fileName);

		header('Content-Description: File Transfer');
		header('Content-Disposition: attachment; filename=' . $fileName);
		header('Content-Type: application/json; charset=' . get_option('blog_charset'), true);
		header('Connection: close');

		$size = strlen($json);
		if ( ob_get_level() > 0 ) {
			$size += ob_get_length();
		}
		header('Content-Length: ' . $size);

		echo $json;

		wp_ob_end_flush_all();
		flush();
		exit;
	}

	public function get_exportable_components() {
		$options = array(
			'global'     => array('label' => 'General plugin settings'),
			'admin-menu' => array('label' => 'Admin menu'),
		);

		foreach ($this->wp_menu_editor->get_loaded_modules() as $module) {
			if ( !($module instanceof ameModule) ) {
				continue;
			}
			$id = $module->getModuleId();
			if ( !isset($id) ) {
				continue;
			}

			if ( $module instanceof ameExportableModule ) {
				$options[$id] = array(
					'label'       => $module->getExportOptionLabel(),
					'description' => $module->getExportOptionDescription(),
					'module'      => $module,
				);
			} else if ( $module instanceof amePersistentModule ) {
				$options[$id] = array('label' => $module->getTabTitle());
			}
		}

		return $options;
	}

	public function add_import_export_tabs($tabs) {
		$tabs['import'] = 'Import';
		$tabs['export'] = 'Export';
		return $tabs;
	}

	public function display_import_tab() {
		if ( !empty($_REQUEST['action']) ) {
			check_admin_referer($_REQUEST['action']);
		}

		$step = isset($_REQUEST['step']) ? intval($_REQUEST['step']) : 1;
		$step = min(max($step, 1), 3);

		$this->wp_menu_editor->display_settings_page_header();

		if ( $step === 1 ) {
			$formSubmitUrl = $this->get_import_tab_url(2);
			$action = 'ame_upload_settings';
			$maxSize = wp_max_upload_size();
			$formattedSize = size_format($maxSize);

			printf('<form action="%s" method="post" enctype="multipart/form-data" class="ame-unified-import-form">', esc_attr($formSubmitUrl));
			?>
			<h2>Import plugin settings</h2>
			<p>
				<label for="upload">Choose a file to import (<?php printf('maximum size: %s', $formattedSize); ?>
					):</label>
				<br>
				<input type="file" name="imported-data" size="25" id="ame-import-file-selector">
				<input type="hidden" name="action" value="<?php echo esc_attr($action); ?>">
				<input type="hidden" name="max_file_size" value="<?php echo $maxSize; ?>">
			</p>
			<?php

			wp_nonce_field($action);
			submit_button('Next &rarr;', 'primary', 'submit', true, array('disabled' => 'disabled'));
			echo '</form>';
		} else if ( $step === 2 ) {
			$this->do_import_step_2();
		} else if ( $step === 3 ) {
			$this->do_import_step_3();
		}

		$this->wp_menu_editor->display_settings_page_footer();
	}

	private function get_import_tab_url($step = 1) {
		return $this->wp_menu_editor->get_plugin_page_url(array(
			'sub_section' => 'import',
			'step'        => $step,
		));
	}

	private function do_import_step_2() {
		$errorTemplate = '<div class="notice notice-error"><p>%s</p></div>';
		$backButton = sprintf('<p><a class="button" href="%s">Go back</a></p>', esc_attr($this->get_import_tab_url()));

		if ( empty($_FILES['imported-data']) ) {
			printf(
				$errorTemplate,
				'No file uploaded. Please try again.'
				. ' (If you get this error when trying to upload a large file, make sure that post_max_size is at least as high as upload_max_filesize in php.ini.)'
			);
			echo $backButton;
			return;
		}

		$upload = $_FILES['imported-data'];
		if ( $upload['error'] !== UPLOAD_ERR_OK ) {
			$message = wsMenuEditorExtras::get_upload_error_message($upload['error']);
			printf($errorTemplate, $message);
			echo $backButton;
			return;
		}

		$size = filesize($upload['tmp_name']);
		if ( $size <= 0 ) {
			printf($errorTemplate, 'File is empty. Please upload a different file.');
			echo $backButton;
			return;
		}

		if ( !@is_uploaded_file($upload['tmp_name']) || !@is_file($upload['tmp_name']) ) {
			printf($errorTemplate, 'That doesn\'t seem to be a valid uploaded file.');
			echo $backButton;
			return;
		}

		$content = file_get_contents($upload['tmp_name']);
		if ( empty($content) || !preg_match('/^\s{0,30}+[\[\{]/', $content) ) {
			printf($errorTemplate, 'File format is unknown or the data is corrupted.');
			echo $backButton;
			return;
		}

		$importedData = json_decode($content, true);
		/** @noinspection PhpComposerExtensionStubsInspection */
		if ( function_exists('json_last_error') && (json_last_error() !== JSON_ERROR_NONE) ) {
			printf($errorTemplate, 'File is not valid JSON.');
			echo $backButton;
			return;
		}

		if (
			!is_array($importedData)
			|| !isset($importedData['format'], $importedData['format']['name'], $importedData['format']['version'])
		) {
			printf($errorTemplate, 'That is not an Admin Menu Editor Pro export file.');
			echo $backButton;
			return;
		}

		if ( ($importedData['format']['name'] !== self::$export_container_format_name) || empty($importedData['settings']) ) {
			printf(
				$errorTemplate,
				'Unsupported file format. Please upload a file that was downloaded from the "Export" tab in Admin Menu Editor Pro.'
			);
			echo $backButton;
			return;
		} else if ( version_compare($importedData['format']['version'], self::$export_container_format_version, '>') ) {
			printf(
				$errorTemplate,
				sprintf(
					"Cannot import a file created by a newer version of the plugin. File format: '%s', newest supported format: '%s'.",
					esc_html(strval($importedData['format']['version'])),
					self::$export_container_format_version
				)
			);
			echo $backButton;
			return;
		}

		$knownComponents = $this->get_exportable_components();
		$importableComponents = array_intersect_key($importedData['settings'], $knownComponents);

		//Move the file somewhere else to ensure it survives until the next step.
		$tempFile = get_temp_dir() . sprintf('AME-import-file-%d-%.3f.json', get_current_user_id(), microtime(true));
		$metaKey = 'ame_import_' . time() . '_' . substr(sha1($tempFile), 0, 10);
		move_uploaded_file($upload['tmp_name'], $tempFile);
		add_user_meta(get_current_user_id(), $metaKey, wp_slash($tempFile), true);

		//Schedule a cleanup in case the user doesn't go through with the import.
		wp_schedule_single_event(
			time() + 12 * 3600,
			'admin_menu_editor-clean_up_import',
			array(get_current_user_id(), $metaKey, $tempFile)
		);

		//Finally, we can get on with choosing which settings to import!
		$action = 'ame_import_uploaded_settings';

		printf('<form action="%s" method="post" class="ame-unified-import-form" id="ame-import-step-2">', esc_attr($this->get_import_tab_url(3)));

		echo '<h2>Choose what to import</h2>';
		echo '<ul>';
		foreach (array_keys($importedData['settings']) as $key) {
			$label = $key;
			if ( isset($knownComponents[$key], $knownComponents[$key]['label']) ) {
				$label = $knownComponents[$key]['label'];
			}

			echo '<li>';
			printf(
				'<label><input type="checkbox" name="ame-selected-modules[%s]" class="ame-importable-module" %s %s> %s</label>',
				esc_attr($key),
				isset($importableComponents[$key]) ? ' checked ' : '',
				!isset($importableComponents[$key]) ? ' disabled ' : '',
				$label
			);

			if ( !isset($importableComponents[$key]) ) {
				echo ' <span class="description">(You may need to install an add-on to import this.)</span>';
			}

			echo '</li>';
		}
		echo '</ul>';

		echo '<input type="hidden" name="meta-key" value="', esc_attr($metaKey), '">';
		wp_nonce_field($action);
		submit_button('Import Settings');
		echo '</form>';
	}

	private function do_import_step_3() {
		echo '<div id="ame-import-step-3-start"><!-- This is a marker for automated testing. --></div>';

		$errorTemplate = '<div class="notice notice-error"><p>%s</p></div>';

		if ( !$this->wp_menu_editor->current_user_can_edit_menu() ) {
			printf($errorTemplate, 'Access denied.');
			return;
		}

		if ( empty($_POST['meta-key']) ) {
			printf($errorTemplate, 'One of the required fields is missing. Please try re-uploading the file.');
			return;
		}

		$metaKey = strval($_POST['meta-key']);
		if ( strpos($metaKey, 'ame_import_') !== 0 ) {
			printf($errorTemplate, 'Invalid meta key. (This should never happen.)');
			return;
		}

		$tempFile = get_user_meta(get_current_user_id(), $metaKey, true);
		if ( empty($tempFile) ) {
			printf($errorTemplate, 'Import data is missing. This may be a bug or a plugin conflict.');
			return;
		}

		if ( !is_file($tempFile) || !is_readable($tempFile) ) {
			printf($errorTemplate, 'File not found. This may be a bug.');
			return;
		}

		$enabledOptions = array();
		foreach (ameUtils::get($_POST, 'ame-selected-modules', array()) as $option => $value) {
			if ( !empty($value) && ($value !== 'off') ) {
				$enabledOptions[$option] = true;
			}
		}

		if ( empty($enabledOptions) ) {
			printf($errorTemplate, 'No options selected.');
			return;
		}

		echo '<p>Importing settings...</p>';

		$container = json_decode(file_get_contents($tempFile), true);
		$moduleStatus = $this->import_data($container, $enabledOptions);

		foreach ($moduleStatus as $id => $status) {
			if ( isset($status['message']) ) {
				$message = esc_html($status['message']);
			} else if ( !empty($status['success']) ) {
				$message = 'OK';
			} else if ( !empty($status['skipped']) ) {
				$message = 'Skipped';
			} else {
				$message = 'Error';
			}

			printf('<p>%s: %s</p>', esc_html($id), $message);
		}

		if ( @unlink($tempFile) ) {
			echo '<p>Temporary file deleted.</p>';
		}
		if ( delete_user_meta(get_current_user_id(), $metaKey) ) {
			echo '<p>Database cleanup complete.</p>';
		}

		echo '<p id="ame-import-step-3-done">Done.</p>';
	}

	public function clean_up_import_data($userId, $metaKey, $tempFileName) {
		$storedFileName = get_user_meta($userId, $metaKey, true);
		delete_user_meta($userId, $metaKey);

		if ( empty($storedFileName) || !is_string($storedFileName) ) {
			return;
		}

		$extension = pathinfo($storedFileName, PATHINFO_EXTENSION);
		if ( $storedFileName === $tempFileName ) {
			if ( strtolower($extension) === 'json' ) {
				@unlink($storedFileName);
			} else {
				trigger_error(
					sprintf(
						'Admin Menu Editor Pro: Failed to clean up an import file because'
						. ' it does not have the correct extension. Expected: "json", actual: "%s".',
						$extension
					),
					E_USER_WARNING
				);
			}
		} else {
			trigger_error(
				sprintf(
					'Admin Menu Editor Pro: Cannot delete an old import file because the stored file names do not match.'
					. ' Database value: "%s", Cron job value: "%s"',
					$storedFileName,
					$tempFileName
				),
				E_USER_WARNING
			);
		}
	}

	public function display_export_tab() {
		$exportAction = 'ame_export_settings';
		$exportTabUrl = $this->wp_menu_editor->get_plugin_page_url(array(
			'sub_section' => 'export',
			'noheader'    => '1',
		));

		$this->wp_menu_editor->display_settings_page_header();
		echo '<h2>Choose what to export</h2>';

		printf('<form action="%s" method="post">', esc_attr($exportTabUrl));
		echo '<ul>';
		foreach ($this->get_exportable_components() as $key => $details) {
			printf(
				'<li><label><input type="checkbox" name="ame-selected-modules[%s]" checked> %s</label></li>',
				esc_attr($key),
				$details['label']
			);
		}
		echo '</ul>';

		echo '<input type="hidden" name="action" value="', $exportAction, '">';
		wp_nonce_field($exportAction);
		submit_button('Download Export File', 'primary', 'submit', true);

		echo '</form>';

		$this->wp_menu_editor->display_settings_page_footer();
	}

	public function register_scripts() {
		wp_register_auto_versioned_script(
			'ws-ame-import-export',
			plugins_url('extras/import-export/import-export.js', $this->wp_menu_editor->plugin_file),
			array('jquery'),
			true
		);
	}

	public function enqueue_tab_scripts() {
		wp_enqueue_script('ws-ame-import-export');
	}

	public static function get_instance($menuEditor = null) {
		if ( self::$last_instance === null ) {
			self::$last_instance = new self($menuEditor);
		}
		return self::$last_instance;
	}
}