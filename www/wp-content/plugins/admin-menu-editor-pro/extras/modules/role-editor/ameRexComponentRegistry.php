<?php

class ameRexComponentRegistry implements IteratorAggregate, ArrayAccess {
	public $components = array();

	public function register(ameRexComponent $component) {
		$this->components[$component->id] = $component;
	}

	public function get($componentId) {
		if ( isset($this->components[$componentId]) ) {
			return $this->components[$componentId];
		}
		return null;
	}

	public function getOrCreate($componentId, $properties = null) {
		if ( isset($this->components[$componentId]) ) {
			return $this->components[$componentId];
		}
		if ( $properties !== null ) {
			$component = new ameRexComponent($componentId, isset($properties['name']) ? $properties['name'] : null);
			if ( isset($properties['activeInstalls']) ) {
				$component->activeInstalls = $properties['activeInstalls'];
			}
			if ( isset($properties['capabilityDocumentationUrl']) ) {
				$component->capabilityDocumentationUrl = $properties['capabilityDocumentationUrl'];
			}
			$this->register($component);
			return $component;
		}
		return null;
	}

	/**
	 * @param string $componentId
	 * @param array $properties
	 * @return ameRexComponent
	 */
	public function updateComponent($componentId, $properties) {
		if ( isset($this->components[$componentId]) ) {
			$component = $this->components[$componentId];
		} else {
			$component = new ameRexComponent($componentId, isset($properties['name']) ? $properties['name'] : null);
			$this->register($component);
		}
		if ( isset($properties['activeInstalls']) ) {
			$component->activeInstalls = $properties['activeInstalls'];
		}
		if ( isset($properties['capabilityDocumentationUrl']) ) {
			$component->capabilityDocumentationUrl = $properties['capabilityDocumentationUrl'];
		}
		return $component;
	}

	/**
	 * @inheritDoc
	 */
	public function getIterator() {
		return new ArrayIterator($this->components);
	}

	/**
	 * @inheritDoc
	 */
	public function offsetExists($offset) {
		return array_key_exists($offset, $this->components);
	}

	/**
	 * @inheritDoc
	 */
	public function offsetGet($offset) {
		return $this->components[$offset];
	}

	/**
	 * @inheritDoc
	 */
	public function offsetSet($offset, $value) {
		$this->components[$offset] = $value;
	}

	/**
	 * @inheritDoc
	 */
	public function offsetUnset($offset) {
		unset($this->components[$offset]);
	}
}