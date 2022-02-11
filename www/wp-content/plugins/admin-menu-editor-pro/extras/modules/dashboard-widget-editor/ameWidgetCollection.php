<?php

/**
 * An ordered collection of dashboard widgets.
 */
class ameWidgetCollection {
	const FORMAT_NAME = 'Admin Menu Editor dashboard widgets';
	const FORMAT_VERSION = '1.1';
	const HEADER_PREFIX = 'WH';

	/**
	 * @var ameDashboardWidget[]
	 */
	private $widgets = array();

	/**
	 * @var array Settings for the special "Welcome to WordPress!" panel.
	 */
	private $welcomePanel = array();

	/**
	 * @var string
	 */
	public $siteComponentHash = '';

	/**
	 * Merge the list of standard / built-in widgets with the collection.
	 * Adds wrappers for new widgets and updates existing wrappers.
	 *
	 * @param array $dashboardMetaBoxes Core widget list, as in $wp_meta_boxes['dashboard'].
	 * @return bool True if any widgets were added or changed.
	 */
	public function merge($dashboardMetaBoxes) {
		$changesDetected = false;

		$presentWidgets = $this->convertMetaBoxesToProperties($dashboardMetaBoxes);

		//Update existing wrapped widgets, add new ones.
		$previousWidget = null;
		foreach($presentWidgets as $properties) {
			$wrapper = $this->getWrapper($properties['id']);
			if ($wrapper === null) {
				$wrapper = new ameStandardWidgetWrapper($properties);
				$this->insertAfter($wrapper, $previousWidget);
				$changesDetected = true;
			} else {
				$changesDetected = $wrapper->updateWrappedWidget($properties) || $changesDetected;
			}

			$previousWidget = $wrapper;
		}

		//Flag wrappers that are on the list as present and the rest as not present.
		foreach($this->getWrappedWidgets() as $widget) {
			$changed = $widget->setPresence(array_key_exists($widget->getId(), $presentWidgets));
			$changesDetected = $changesDetected || $changed;
		}

		return $changesDetected;
	}

	/**
	 * Convert the input from the deeply nested array structure that's used by WP core
	 * to a flat [id => widget-properties] dictionary.
	 *
	 * @param array $metaBoxes
	 * @return array
	 */
	private function convertMetaBoxesToProperties($metaBoxes) {
		$widgetProperties = array();

		foreach($metaBoxes as $location => $priorities) {
			foreach($priorities as $priority => $items) {
				foreach($items as $standardWidget) {
					//Skip removed widgets. remove_meta_box() replaces widgets that it removes with false.
					//Also, The Events Calendar somehow creates a widget that's just "true"(?!), so we'll
					//also skip all entries that are not arrays.
					if (empty($standardWidget) || !is_array($standardWidget)) {
						continue;
					}

					$properties = array_merge(
						array(
							'priority' => $priority,
							'location' => $location,
							'callbackArgs' => isset($standardWidget['args']) ? $standardWidget['args'] : null,
						),
						$standardWidget
					);
					$widgetProperties[$properties['id']] = $properties;
				}
			}
		}

		return $widgetProperties;
	}

	/**
	 * Get a wrapped widget by ID.
	 *
	 * @param string $id
	 * @return ameStandardWidgetWrapper|null
	 */
	protected function getWrapper($id) {
		if (!array_key_exists($id, $this->widgets)) {
			return null;
		}
		$widget = $this->widgets[$id];
		if ($widget instanceof ameStandardWidgetWrapper) {
			return $widget;
		}
		return null;
	}


	/**
	 * Insert a widget after the $target widget.
	 *
	 * If $target is omitted or not in the collection, this method adds the widget to the end of the collection.
	 *
	 * @param ameDashboardWidget $widget
	 * @param ameDashboardWidget|null $target
	 */
	protected function insertAfter(ameDashboardWidget $widget, ameDashboardWidget $target = null) {
		if (($target === null) || !array_key_exists($target->getId(), $this->widgets)) {
			//Just put it at the bottom.
			$this->widgets[$widget->getId()] = $widget;
		} else {
			$offset = array_search($target->getId(), array_keys($this->widgets)) + 1;

			$this->widgets = array_merge(
				array_slice($this->widgets, 0, $offset, true),
				array($widget->getId() => $widget),
				array_slice($this->widgets, $offset, null, true)
			);
		}
	}

	/**
	 * Merge wrapped widgets from another collection into this one.
	 *
	 * @param ameWidgetCollection $otherCollection
	 */
	public function mergeWithWrappersFrom($otherCollection) {
		$previousWidget = null;

		foreach($otherCollection->getWrappedWidgets() as $otherWidget) {
			if (!$otherWidget->isPresent()) {
				continue;
			}

			$myWidget = $this->getWrapper($otherWidget->getId());
			if ($myWidget === null) {
				$myWidget = $otherWidget;
				$this->insertAfter($myWidget, $previousWidget);
			} else {
				$myWidget->copyWrappedWidgetFrom($otherWidget);
			}

			$previousWidget = $myWidget;
		}
	}

	/**
	 * Get a list of all wrapped widgets.
	 *
	 * @return ameStandardWidgetWrapper[]
	 */
	protected function getWrappedWidgets() {
		$results = array();
		foreach($this->widgets as $widget) {
			if ($widget instanceof ameStandardWidgetWrapper) {
				$results[] = $widget;
			}
		}
		return $results;
	}

	/**
	 * Get a list of wrapped widgets that are NOT present on the current site.
	 *
	 * @return ameStandardWidgetWrapper[]
	 */
	public function getMissingWrappedWidgets() {
		$results = array();
		foreach($this->getWrappedWidgets() as $widget) {
			if (!$widget->isPresent()) {
				$results[] = $widget;
			}
		}
		return $results;
	}

	/**
	 * Get widgets that are present on the current site.
	 *
	 * @return ameDashboardWidget[]
	 */
	public function getPresentWidgets() {
		$results = array();
		foreach($this->widgets as $widget) {
			if ($widget->isPresent()) {
				$results[] = $widget;
			}
		}
		return $results;
	}

	/**
	 * Remove a widget from the collection.
	 *
	 * @param string $widgetId
	 */
	public function remove($widgetId) {
		unset($this->widgets[$widgetId]);
	}

	/**
	 * Is the collection empty (zero widgets)?
	 *
	 * @return bool
	 */
	public function isEmpty() {
		return count($this->widgets) === 0;
	}

	public function toArray() {
		$widgets = array();
		foreach($this->widgets as $widget) {
			$widgets[] = $widget->toArray();
		}

		$output = array(
			'format' => array(
				'name' => self::FORMAT_NAME,
				'version' => self::FORMAT_VERSION,
			),
			'widgets' => $widgets,
			'welcomePanel' => $this->welcomePanel,
			'siteComponentHash' => $this->siteComponentHash,
		);

		return $output;
	}

	/**
	 * @return string
	 */
	public function toJSON() {
		return json_encode($this->toArray(), JSON_PRETTY_PRINT);
	}

	/**
	 * Get the visibility settings for the "Welcome" panel.
	 *
	 * @return array [actorId => boolean]
	 */
	public function getWelcomePanelVisibility() {
		if (isset($this->welcomePanel['grantAccess']) && is_array($this->welcomePanel['grantAccess'])) {
			return $this->welcomePanel['grantAccess'];
		}
		return array();
	}

	/**
	 * @param array $input
	 * @return self
	 */
	public static function fromArray($input) {
		if ( !is_array($input) ) {
			throw new ameInvalidWidgetDataException(sprintf(
				'Failed to decode widget data. Expected type: array, actual type: %s',
				gettype($input)
			));
		}
		if (
			!isset($input['format']['name'], $input['format']['version'])
			|| ($input['format']['name'] !== self::FORMAT_NAME)
		) {
			throw new ameInvalidWidgetDataException(
				"Unknown widget format. The format.name or format.version key is missing or invalid."
			);
		}

		if ( version_compare($input['format']['version'], self::FORMAT_VERSION) > 0 ) {
			throw new ameInvalidWidgetDataException(sprintf(
				"Can't import widget settings that were created by a newer version of the plugin. '.
				'Update the plugin and try again. (Newest supported format: '%s', input format: '%s'.)",
				self::FORMAT_VERSION,
				$input['format']['version']
			));
		}

		$collection = new self();
		foreach($input['widgets'] as $widgetProperties) {
			$widget = ameDashboardWidget::fromArray($widgetProperties);
			$collection->widgets[$widget->getId()] = $widget;
		}

		if ( isset($input['welcomePanel'], $input['welcomePanel']['grantAccess']) ) {
			$collection->welcomePanel = array(
				'grantAccess' => (array)($input['welcomePanel']['grantAccess']),
			);
		}

		$collection->siteComponentHash = isset($input['siteComponentHash']) ? strval($input['siteComponentHash']) : '';
		return $collection;
	}

	/**
	 * @param string $json
	 * @return self|null
	 */
	public static function fromJSON($json) {
		$input = json_decode($json, true);

		if ($input === null) {
			throw new ameInvalidJsonException('Cannot parse widget data. The input is not valid JSON.');
		}

		return self::fromArray($input);
	}

	/**
	 * @return string
	 */
	public function toDbString() {
		$serializedData = $this->toJSON();
		$tags = array();

		if ( function_exists('gzcompress') ) {
			/** @noinspection PhpComposerExtensionStubsInspection */
			$compressed = gzcompress($serializedData);
			if ( is_string($compressed) ) {
				$serializedData = $compressed;
				$tags[] = 'gz';
			}
		}

		if ( function_exists('base64_encode') ) {
			$serializedData = base64_encode($serializedData);
			$tags[] = '64';
		}

		$header = self::HEADER_PREFIX . sprintf('%4s', implode('', $tags));
		return $header . 'D' . $serializedData;
	}

	/**
	 * @param string $serializedData
	 * @return self|null
	 */
	public static function fromDbString($serializedData) {
		$fragment = substr($serializedData, 0, 32);
		$prefixLength = strlen(self::HEADER_PREFIX);

		if ( substr($fragment, 0, $prefixLength) !== self::HEADER_PREFIX ) {
			return self::fromJSON($serializedData);
		}
		$dataMarkerPos = strpos($fragment, 'D', $prefixLength);
		if ( $dataMarkerPos === false ) {
			return self::fromJSON($serializedData);
		}

		$tags = str_split(substr($fragment, $prefixLength, $dataMarkerPos - $prefixLength), 2);

		$data = substr($serializedData, $dataMarkerPos + 1);
		if ( in_array('64', $tags) ) {
			$data = base64_decode($data);
		}
		if ( in_array('gz', $tags) ) {
			if ( !function_exists('gzuncompress') ) {
				throw new RuntimeException(
					'Cannot decompress dashboard widget data. This site may be missing the Zlib extension.'
				);
			}
			$data = gzuncompress($data);
		}

		return self::fromJSON($data);
	}
}

class ameInvalidWidgetDataException extends RuntimeException {}