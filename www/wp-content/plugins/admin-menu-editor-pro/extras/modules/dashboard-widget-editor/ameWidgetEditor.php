<?php
require_once AME_ROOT_DIR . '/extras/exportable-module.php';

class ameWidgetEditor extends ameModule implements ameExportableModule {
	//Note: Class constants require PHP 5.3 or better.
	const OPTION_NAME = 'ws_ame_dashboard_widgets';
	const MAX_IMPORT_FILE_SIZE = 2097152; //2 MiB

	protected $tabSlug = 'dashboard-widgets';
	protected $tabTitle = 'Dashboard Widgets';

	/**
	 * @var ameWidgetCollection
	 */
	private $dashboardWidgets;

	private $shouldRefreshWidgets = false;

	public function __construct($menuEditor) {
		parent::__construct($menuEditor);

		if ( is_network_admin() ) {
			//This module doesn't work in the network admin.
			return;
		}

		add_action('wp_dashboard_setup', array($this, 'setupDashboard'), 20000);

		add_action('admin_menu_editor-header', array($this, 'handleFormSubmission'), 10, 2);

		ajaw_v1_CreateAction('ws-ame-export-widgets')
			->requiredParam('widgetData')
			->permissionCallback(array($this, 'userCanEditWidgets'))
			->handler(array($this, 'ajaxExportWidgets'))
			->register();

		ajaw_v1_CreateAction('ws-ame-import-widgets')
			->permissionCallback(array($this, 'userCanEditWidgets'))
			->handler(array($this, 'ajaxImportWidgets'))
			->register();
	}

	public function setupDashboard() {
		global $wp_meta_boxes;

		$this->loadSettings();
		$changesDetected = $this->dashboardWidgets->merge($wp_meta_boxes['dashboard']);

		//Store new widgets and changed defaults.
		//We want a complete list of widgets, so we only do this when an administrator is logged in.
		//Admins usually can see everything. Other roles might be missing specific widgets.
		if ( ($changesDetected || !empty($_GET['ame-cache-buster'])) && $this->userCanEditWidgets() ) {
			//Remove wrapped widgets where the file no longer exists.
			foreach($this->dashboardWidgets->getMissingWrappedWidgets() as $widget) {
				$callbackFileName = $widget->getCallbackFileName();
				if ( !empty($callbackFileName) && !is_file($callbackFileName) ) {
					$this->dashboardWidgets->remove($widget->getId());
				}
			}

			$this->dashboardWidgets->siteComponentHash = $this->generateCompontentHash();
			$this->saveSettings();
		}

		//Remove all Dashboard widgets.
		//Important: Using remove_meta_box() would prevent widgets being re-added. Clearing the array does not.
		$wp_meta_boxes['dashboard'] = array();

		//Re-add all widgets, this time with custom settings.
		$currentUser = wp_get_current_user();
		foreach($this->dashboardWidgets->getPresentWidgets() as $widget) {
			if ( $widget->isVisibleTo($currentUser, $this->menuEditor) ) {
				$widget->addToDashboard();
			} else {
				//Technically, this line is not required. It just ensures that other plugins can't recreate the widget.
				remove_meta_box($widget->getId(), 'dashboard', $widget->getLocation());
			}
		}

		//Optionally, hide the "Welcome to WordPress!" panel. It's technically not a widget, but users
		//assume that it is, it looks similar, and it shows up in the same place.
		$isWelcomePanelHidden = !ameDashboardWidget::userCanAccess(
			$currentUser,
			$this->dashboardWidgets->getWelcomePanelVisibility(),
			$this->menuEditor
		);
		if ( $isWelcomePanelHidden ) {
			remove_action('welcome_panel', 'wp_welcome_panel');
		}
	}

	public function enqueueTabScripts() {
		//TODO: Remove this later, it's already registered in register_base_dependencies.
		wp_register_auto_versioned_script(
			'knockout',
			plugins_url('js/knockout.js', $this->menuEditor->plugin_file)
		);

		wp_register_auto_versioned_script(
			'ame-dashboard-widget',
			plugins_url('dashboard-widget.js', __FILE__),
			array('knockout', 'ame-lodash', 'ame-actor-manager',)
		);

		wp_register_auto_versioned_script(
			'ame-dashboard-widget-editor',
			plugins_url('dashboard-widget-editor.js', __FILE__),
			array(
				'ame-lodash', 'ame-dashboard-widget', 'knockout', 'ame-actor-selector',
				'ame-jquery-form', 'jquery-ui-dialog', 'ame-ko-extensions',
			)
		);

		//Automatically refresh the list of available dashboard widgets.
		$this->loadSettings();
		$query = $this->menuEditor->get_query_params();
		$this->shouldRefreshWidgets = empty($query['ame-widget-refresh-done'])
			&& (
				//Refresh when the list hasn't been populated yet (usually on the first run).
				$this->dashboardWidgets->isEmpty()
				//Refresh when plugins/themes are activated or deactivated.
				|| ($this->dashboardWidgets->siteComponentHash !== $this->generateCompontentHash())
			);

		if ( $this->shouldRefreshWidgets ) {
			wp_enqueue_auto_versioned_script(
				'ame-refresh-widgets',
				plugins_url('refresh-widgets.js', __FILE__),
				array('jquery')
			);

			wp_localize_script(
				'ame-refresh-widgets',
				'wsWidgetRefresherData',
				array(
					'editorUrl' => $this->getEditorUrl(array('ame-widget-refresh-done' => 1)),
					'dashboardUrl' => add_query_arg('ame-cache-buster', time() . '_' . rand(), admin_url('index.php')),
				)
			);
			return;
		}

		wp_enqueue_script('ame-dashboard-widget-editor');

		$selectedActor = null;
		if ( isset($query['selected_actor']) ) {
			$selectedActor = strval($query['selected_actor']);
		}

		wp_localize_script(
			'ame-dashboard-widget-editor',
			'wsWidgetEditorData',
			array(
				'widgetSettings' => $this->dashboardWidgets->toArray(),
				'selectedActor' => $selectedActor,
				'isMultisite' => is_multisite(),
			)
		);
	}

	public function enqueueTabStyles() {
		wp_enqueue_auto_versioned_style(
			'ame-dashboard-widget-editor-css',
			plugins_url('dashboard-widget-editor.css', __FILE__)
		);
	}

	public function displaySettingsPage() {
		if ( $this->shouldRefreshWidgets ) {
			require dirname(__FILE__) . '/widget-refresh-template.php';
		} else {
			parent::displaySettingsPage();
		}
	}

	public function handleFormSubmission($action, $post = array()) {
		//Note: We don't need to check user permissions here because plugin core already did.
		if ( $action === 'save_widgets' ) {
			check_admin_referer($action);

			$this->dashboardWidgets = ameWidgetCollection::fromJSON($post['data']);
			$this->saveSettings();

			$params = array('updated' => 1);

			//Re-select the same actor.
			if ( !empty($post['selected_actor']) ) {
				$params['selected_actor'] = strval($post['selected_actor']);
			}

			wp_redirect($this->getEditorUrl($params));
			exit;
		}
	}

	private function getEditorUrl($queryParameters = array()) {
		$queryParameters = array_merge(
			array(
				'page' => 'menu_editor',
			    'sub_section' => 'dashboard-widgets'
			),
			$queryParameters
		);
		return add_query_arg($queryParameters, admin_url('options-general.php'));
	}

	public function ajaxExportWidgets($params) {
		$exportData = $params['widgetData'];

		//The widget data must be valid JSON.
		$json = json_decode($exportData);
		if ( $json === null ) {
			return new WP_Error('The widget data is not valid JSON.', 'invalid_json');
		}

		$fileName = sprintf(
			'%1$s dashboard widgets (%2$s).json',
			parse_url(get_site_url(), PHP_URL_HOST),
			date('Y-m-d')
		);

		//Force file download.
		header("Content-Description: File Transfer");
		header('Content-Disposition: attachment; filename="' . $fileName . '"');
		header("Content-Type: application/force-download");
		header("Content-Transfer-Encoding: binary");
		header("Content-Length: " . strlen($exportData));

		//The three lines below basically disable caching.
		header("Cache-control: private");
		header("Pragma: private");
		header("Expires: Mon, 26 Jul 1997 05:00:00 GMT");

		echo $exportData;
		exit();
	}

	public function ajaxImportWidgets() {
		if ( empty($_FILES['widgetFile']) ) {
			return new WP_Error('no_file', 'No file specified');
		}

		$importFile = $_FILES['widgetFile'];
		if ( filesize($importFile['tmp_name']) > self::MAX_IMPORT_FILE_SIZE ){
			return new WP_Error(
				'file_too_large',
				sprintf(
					'Import file too large. Maximum allowed size: %s bytes',
					number_format_i18n(self::MAX_IMPORT_FILE_SIZE)
				)
			);
		}

		//Check for general upload errors.
		if ( $importFile['error'] !== UPLOAD_ERR_OK ) {

			$knownErrorCodes = array(
				UPLOAD_ERR_INI_SIZE   => sprintf(
					'The uploaded file exceeds the upload_max_filesize directive in php.ini. Limit: %s',
					strval(ini_get('upload_max_filesize'))
				),
				UPLOAD_ERR_FORM_SIZE  => "The uploaded file exceeds the internal file size limit. Please contact the developer.",
				UPLOAD_ERR_PARTIAL    => "The file was only partially uploaded",
				UPLOAD_ERR_NO_FILE    => "No file was uploaded",
				UPLOAD_ERR_NO_TMP_DIR => "Missing a temporary folder",
				UPLOAD_ERR_CANT_WRITE => "Failed to write file to disk",
				UPLOAD_ERR_EXTENSION  => "File upload stopped by a PHP extension",
			);

			if ( array_key_exists($importFile['error'], $knownErrorCodes) ) {
				$message = $knownErrorCodes[$importFile['error']];
			} else {
				$message = 'Unknown upload error #' . $importFile['error'];
			}

			return new WP_Error('internal_upload_error', $message);
		}

		$fileContents = file_get_contents($importFile['tmp_name']);

		//Check if this file could plausibly contain an exported widget collection.
		if ( strpos($fileContents, ameWidgetCollection::FORMAT_NAME) === false ) {
			return new WP_Error('unknown_file_format', 'Unknown file format');
		}

		try {
			$collection = ameWidgetCollection::fromJSON($fileContents);
		} catch (ameInvalidJsonException $ex) {
			return new WP_Error($ex->getCode(), $ex->getMessage());
		} catch (ameInvalidWidgetDataException $ex) {
			return new WP_Error($ex->getCode(), $ex->getMessage());
		}

		//Merge standard widgets from the existing config with the imported config.
		//Otherwise, we could end up with imported defaults that are incorrect for this site.
		$collection->mergeWithWrappersFrom($this->dashboardWidgets);

		$collection->siteComponentHash = $this->generateCompontentHash();

		return $collection->toArray();
	}

	private function loadSettings() {
		if ( isset($this->dashboardWidgets) ) {
			return $this->dashboardWidgets;
		}

		$settings = $this->getScopedOption(self::OPTION_NAME, null);
		if ( empty($settings) ) {
			$this->dashboardWidgets = new ameWidgetCollection();
		} else {
			$this->dashboardWidgets = ameWidgetCollection::fromDbString($settings);
		}
		return $this->dashboardWidgets;
	}

	private function saveSettings() {
		//Save per site or site-wide based on plugin configuration.
		$settings = $this->dashboardWidgets->toDbString();
		$this->setScopedOption(self::OPTION_NAME, $settings);
	}

	public function exportSettings() {
		$dashboardWidgets = $this->loadSettings();
		if ( !$dashboardWidgets || $dashboardWidgets->isEmpty() ) {
			return null;
		}
		return $dashboardWidgets->toArray();
	}

	public function importSettings($newSettings) {
		if ( empty($newSettings) ) {
			return;
		}

		$this->loadSettings();
		$collection = ameWidgetCollection::fromArray($newSettings);

		//Merge standard widgets from the existing config with the imported config.
		//Otherwise, we could end up with imported defaults that are incorrect for this site.
		$collection->mergeWithWrappersFrom($this->dashboardWidgets);

		$collection->siteComponentHash = $this->generateCompontentHash();

		$this->dashboardWidgets = $collection;
		$this->saveSettings();
	}

	public function getExportOptionLabel() {
		return 'Dashboard widgets';
	}

	public function getExportOptionDescription() {
		return '';
	}

	public function userCanEditWidgets() {
		return $this->menuEditor->current_user_can_edit_menu();
	}

	/**
	 * Calculate a hash of site components: WordPress version, active theme, and active plugins.
	 *
	 * Any of these components can register dashboard widgets, so the hash is useful for detecting
	 * when widgets might have changed.
	 *
	 * @return string
	 */
	private function generateCompontentHash() {
		$components = array();

		//WordPress.
		$components[] = 'WordPress ' . (isset($GLOBALS['wp_version']) ? $GLOBALS['wp_version'] : 'unknown');

		//Active theme.
		$theme = wp_get_theme();
		if ( $theme && $theme->exists() ) {
			$components[] = $theme->get_stylesheet() . ' : ' . $theme->get('Version');
		}

		//Active plugins.
		$activePlugins = wp_get_active_and_valid_plugins();
		if ( is_multisite() ) {
			$activePlugins = array_merge($activePlugins, wp_get_active_network_plugins());
		}
		//The hash shouldn't depend on the order of plugins.
		sort($activePlugins);
		$components = array_merge($components, $activePlugins);

		return md5(implode('|' , $components));
	}
}