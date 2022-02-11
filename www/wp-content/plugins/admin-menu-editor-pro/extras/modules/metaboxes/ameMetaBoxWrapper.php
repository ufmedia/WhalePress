<?php

/**
 * A wrapper for regular meta boxes, like those added by WordPress or other plugins.
 */
class ameMetaBoxWrapper extends ameMetaBox {
	private $wasPresent = true;
	private $callbackFileName = null;

	/**
	 * @param array $newProperties
	 * @return boolean True if any properties were changed, false otherwise.
	 */
	public function syncProperties(array $newProperties) {
		if ( $newProperties['id'] !== $this->id ) {
			throw new LogicException(sprintf(
				'Meta box ID mismatch. Expected: "%s", got: "%s".',
				$this->id,
				$newProperties['id']
			));
		}

		$oldProperties = $this->toArray();
		$this->setProperties($newProperties);

		$changesDetected = $this->setPresence($this->hasValidCallback());

		//Update callback file name.
		if ( $this->hasValidCallback() ) {
			$changesDetected = $this->updateCallbackFileName() || $changesDetected;
		}

		foreach (array('title', 'context') as $key) {
			if ( $oldProperties[$key] !== $newProperties[$key] ) {
				$changesDetected = true;
				break;
			}
		}

		return $changesDetected;
	}

	/*
	 * Presence detection
	 */

	public function isPresent() {
		return $this->wasPresent || $this->hasValidCallback();
	}

	protected function hasValidCallback() {
		return isset($this->callback) && is_callable($this->callback);
	}

	public function setPresence($isPresent) {
		$changed = ($this->wasPresent !== $isPresent);
		$this->wasPresent = $isPresent;
		return $changed;
	}

	/*
	 * Callback file name
	 */

	public function getCallbackFileName() {
		//TODO: Maybe normalize this to use forward slashes always? Could help with JSON corruption caused by some DB migration plugins.
		return $this->callbackFileName;
	}

	private function updateCallbackFileName() {
		$reflection = new AmeReflectionCallable($this->callback);

		$fileName = $reflection->getFileName();
		if ( $fileName === false ) {
			$fileName = null;
		}

		if ( $fileName !== $this->callbackFileName ) {
			$this->callbackFileName = $fileName;
			return true; //File name has changed.
		}
		return false; //No changes.
	}

	/*
	 * Include additional properties on load/save.
	 */

	public function toArray() {
		$properties = parent::toArray();
		$properties['wasPresent'] = $this->wasPresent;
		$properties['callbackFileName'] = $this->callbackFileName;
		return $properties;
	}

	protected function setProperties(array $properties) {
		parent::setProperties($properties);

		$keysToCopy = array('wasPresent', 'callbackFileName');
		foreach ($keysToCopy as $name) {
			if ( isset($properties[$name]) ) {
				$this->$name = $properties[$name];
			}
		}
	}
}