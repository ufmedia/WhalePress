<?php
class amePostTypeFeature extends ameMetaBox {
	public function toArray() {
		$properties = parent::toArray();
		$properties['parentCollectionKey'] = ameMbeScreenSettings::CPT_FEATURE_KEY;
		$properties['isVirtual'] = true;
		return $properties;
	}
}