<?php

/**
 * A collection of meta boxes that are displayed on a specific admin screen.
 */
class ameMetaBoxCollection {
	protected $screenId = '';

	/**
	 * @var ameMetaBox[]
	 */
	protected $boxes = array();

	public function __construct($screenId) {
		$this->screenId = $screenId;
	}

	public function merge($coreMetaBoxes) {
		$changesDetected = false;

		$activeBoxes = $this->convertMetaBoxesToProperties($coreMetaBoxes);

		//Update existing boxes, add new ones.
		$previousBox = null;
		foreach($activeBoxes as $properties) {
			$wrapper = $this->getWrapper($properties['id']);
			if ($wrapper === null) {
				$wrapper = new ameMetaBoxWrapper($properties);
				$this->insertAfter($wrapper, $previousBox);
				$changesDetected = true;
			} else {
				$changesDetected = $wrapper->syncProperties($properties) || $changesDetected;
			}

			$previousBox = $wrapper;
		}

		//Flag wrappers that are on the list as present and the rest as not present.
		foreach($this->getWrappedBoxes() as $metaBox) {
			$changed = $metaBox->setPresence(array_key_exists($metaBox->getId(), $activeBoxes));
			$changesDetected = $changesDetected || $changed;
		}

		return $changesDetected;
	}

	/**
	 * Convert the input from the deeply nested array structure that's used by WP core
	 * to a flat [id => widget-properties] dictionary.
	 *
	 * @param array $coreMetaBoxes
	 * @return array
	 */
	private function convertMetaBoxesToProperties($coreMetaBoxes) {
		$metaBoxProperties = array();

		foreach($coreMetaBoxes as $context => $priorities) {
			foreach($priorities as $priority => $items) {
				foreach($items as $metaBox) {
					//Skip removed boxes. remove_meta_box() replaces widgets that it removes with false.
					if (empty($metaBox) || !is_array($metaBox)) {
						continue;
					}

					//Skip boxes that have an invalid ID. The ID must be a string.
					//This is a workaround for plugins that set the ID to null or another unsupported value.
					//Example: "Amazon Simple Affiliate (ASA2)", version 1.15.3.
					if (!is_string($metaBox['id'])) {
						continue;
					}

					$properties = array_merge(
						array(
							'context' => $context,
							'priority' => $priority,
							'callbackArgs' => isset($metaBox['args']) ? $metaBox['args'] : null,
						),
						$metaBox
					);
					$metaBoxProperties[$properties['id']] = $properties;
				}
			}
		}

		return $metaBoxProperties;
	}

	/**
	 * Get a wrapped meta box by ID.
	 *
	 * @param string $id
	 * @return ameMetaBoxWrapper|null
	 */
	protected function getWrapper($id) {
		if (!array_key_exists($id, $this->boxes)) {
			return null;
		}
		$metaBox = $this->boxes[$id];
		if ($metaBox instanceof ameMetaBoxWrapper) {
			return $metaBox;
		}
		return null;
	}

	/**
	 * Insert a meta box after the $target meta box.
	 *
	 * If $target is omitted or not in the collection, this method adds the box to the end of the collection.
	 *
	 * @param ameMetaBox $metaBox
	 * @param ameMetaBox|null $target
	 */
	protected function insertAfter(ameMetaBox $metaBox, ameMetaBox $target = null) {
		if (($target === null) || !array_key_exists($target->getId(), $this->boxes)) {
			//Just put it at the bottom.
			$this->boxes[$metaBox->getId()] = $metaBox;
		} else {
			$offset = array_search($target->getId(), array_keys($this->boxes)) + 1;

			$this->boxes = array_merge(
				array_slice($this->boxes, 0, $offset, true),
				array($metaBox->getId() => $metaBox),
				array_slice($this->boxes, $offset, null, true)
			);
		}
	}

	/**
	 * Remove a meta box from the collection.
	 *
	 * @param string $metBoxId
	 */
	public function remove($metBoxId) {
		unset($this->boxes[$metBoxId]);
	}

	/**
	 * Set the default list of hidden meta boxes.
	 *
	 * @param string[] $metaBoxIds
	 * @return bool
	 */
	public function setHiddenByDefault($metaBoxIds) {
		if ( !is_array($metaBoxIds) ) {
			return false;
		}

		$changesDetected = false;
		foreach($this->getWrappedBoxes() as $box) {
			$changesDetected = $box->setHiddenByDefault(in_array($box->getId(), $metaBoxIds)) || $changesDetected;
		}
		return $changesDetected;
	}

	/*
	 * Item filters
	 */

	/**
	 * @return ameMetaBox[]
	 */
	public function getPresentBoxes() {
		return array_filter($this->boxes, function(ameMetaBox $box) {
			return $box->isPresent();
		});
	}

	/**
	 * Get a list of all wrapped meta boxes.
	 *
	 * @return ameMetaBoxWrapper[]
	 */
	protected function getWrappedBoxes() {
		return array_filter($this->boxes, function($metaBox) {
			return ($metaBox instanceof ameMetaBoxWrapper);
		});
	}

	/**
	 * Get a list of wrapped meta boxes that are NOT present on the current site.
	 *
	 * @return ameMetaBoxWrapper[]
	 */
	public function getMissingWrappedBoxes() {
		return array_filter($this->getWrappedBoxes(), function(ameMetaBox $metaBox) {
			return !$metaBox->isPresent();
		});
	}

	/*
	 * Serialize / deserialize
	 */

	public function toArray() {
		return array_map(function(ameMetaBox $metaBox) {
			return $metaBox->toArray();
		}, $this->boxes);
	}

	public static function fromArray($data, $screenId) {
		$instance = new self($screenId);
		foreach($data as $id => $properties) {
			$instance->boxes[$id] = ameMetaBox::fromArray($properties);
		}
		return $instance;
	}
}