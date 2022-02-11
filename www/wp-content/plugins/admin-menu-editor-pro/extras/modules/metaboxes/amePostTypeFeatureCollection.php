<?php

class amePostTypeFeatureCollection {
	/**
	 * @var amePostTypeFeature[]
	 */
	protected $features = array();

	/**
	 * @param array $currentFeatures
	 * @return bool
	 */
	public function merge($currentFeatures) {
		$changesDetected = false;

		//Add new features.
		foreach ($currentFeatures as $featureName => $unused) {
			if ( !isset($this->features[$featureName]) ) {
				$this->features[$featureName] = amePostTypeFeature::fromArray(array(
					'id'    => $featureName,
					'title' => $this->getFeatureTitle($featureName),
				));
				$changesDetected = true;
			}
		}

		//Remove features that no longer exist.
		$existingFeatures = array_intersect_key($this->features, $currentFeatures);
		if ( count($existingFeatures) !== count($this->features) ) {
			$this->features = $existingFeatures;
			$changesDetected = true;
		}

		return $changesDetected;
	}

	private function getFeatureTitle($featureName) {
		if ( $featureName === 'editor' ) {
			return 'Content Editor';
		}
		return ucfirst($featureName);
	}

	/**
	 * @return amePostTypeFeature[]
	 */
	public function getFeatures() {
		return $this->features;
	}

	/*
	 * Serialize / deserialize
	 */

	public function toArray() {
		return array_map(function (amePostTypeFeature $item) {
			return $item->toArray();
		}, $this->features);
	}

	public static function fromArray($data) {
		$instance = new self();
		foreach ($data as $id => $properties) {
			$instance->features[$id] = amePostTypeFeature::fromArray($properties);
		}
		return $instance;
	}
}