<?php

class ameMbeScreenSettings {
	const META_BOX_KEY = 'metaBoxes:';
	const CPT_FEATURE_KEY = 'postTypeFeatures:';

	protected $screenId;
	protected $metaBoxes;
	protected $postTypeFeatures;

	public function __construct($screenId) {
		$this->screenId = $screenId;
	}

	/**
	 * @return ameMetaBoxCollection
	 */
	public function getMetaBoxes() {
		if ( !isset($this->metaBoxes) ) {
			$this->metaBoxes = new ameMetaBoxCollection($this->screenId);
		}
		return $this->metaBoxes;
	}

	/**
	 * @return amePostTypeFeatureCollection
	 */
	public function getPostTypeFeatures() {
		if ( !isset($this->postTypeFeatures) ) {
			$this->postTypeFeatures = new amePostTypeFeatureCollection();
		}
		return $this->postTypeFeatures;
	}

	public function toArray() {
		return array(
			self::META_BOX_KEY => $this->getMetaBoxes()->toArray(),
			self::CPT_FEATURE_KEY => $this->getPostTypeFeatures()->toArray(),
		);
	}

	public static function fromArray($data, $screenId) {
		$instance = new self($screenId);
		if ( isset($data[self::META_BOX_KEY]) ) {
			$instance->metaBoxes = ameMetaBoxCollection::fromArray($data[self::META_BOX_KEY], $screenId);
		} else {
			$instance->metaBoxes = ameMetaBoxCollection::fromArray($data, $screenId);
		}
		if ( isset($data[self::CPT_FEATURE_KEY]) ) {
			$instance->postTypeFeatures = amePostTypeFeatureCollection::fromArray($data[self::CPT_FEATURE_KEY]);
		}
		return $instance;
	}
}