<?php

class ameMetaBoxSettings implements ArrayAccess {
	const FORMAT_NAME = 'Admin Menu Editor meta boxes';
	const FORMAT_VERSION = '2.0';

	/**
	 * @var ameMbeScreenSettings[]
	 */
	private $screens = array();
	private $isInitialRefreshDone = false;

	public function isEmpty() {
		return empty($this->screens);
	}

	/**
	 * @return bool
	 */
	public function isFirstRefreshDone() {
		return $this->isInitialRefreshDone;
	}

	/**
	 * @param bool $isRefreshDone
	 */
	public function setFirstRefreshState($isRefreshDone) {
		$this->isInitialRefreshDone = $isRefreshDone;
	}

	public function toArray() {
		$screenSettings = array_map(function(ameMbeScreenSettings $collection) {
			return $collection->toArray();
		}, $this->screens);

		return array(
			'format' => array(
				'name' => self::FORMAT_NAME,
				'version' => self::FORMAT_VERSION,
			),
			'screens' => $screenSettings,
			'isInitialRefreshDone' => $this->isInitialRefreshDone,
		);
	}

	public static function fromArray($input) {
		if (
			!isset($input['format']['name'], $input['format']['version'])
			|| ($input['format']['name'] !== self::FORMAT_NAME)
		) {
			throw new ameInvalidMetaBoxDataException(
				"Unknown meta box format. The format.name or format.version key is missing or invalid."
			);
		}

		if ( version_compare($input['format']['version'], self::FORMAT_VERSION) > 0 ) {
			throw new ameInvalidMetaBoxDataException(sprintf(
				"Can't import meta box settings that were created by a newer version of the plugin. '.
				'Update the plugin and try again. (Newest supported format: '%s', input format: '%s'.)",
				$input['format']['version'],
				self::FORMAT_VERSION
			));
		}

		$settings = new self();
		foreach($input['screens'] as $screenId => $collectionData) {
			$settings->screens[$screenId] = ameMbeScreenSettings::fromArray($collectionData, $screenId);
		}

		if ( isset($input['isInitialRefreshDone']) && is_scalar($input['isInitialRefreshDone']) ) {
			$settings->isInitialRefreshDone = !empty($input['isInitialRefreshDone']);
		}

		return $settings;
	}

	public function toJSON() {
		return json_encode($this->toArray());
	}

	public static function fromJSON($json) {
		$input = json_decode($json, true);

		if ($input === null) {
			throw new ameInvalidJsonException('Cannot parse meta box data. The input is not valid JSON.');
		}

		if (!is_array($input)) {
			throw new ameInvalidMetaBoxDataException(sprintf(
				'Failed to decode meta box data. Expected type: array, actual type: %s',
				gettype($input)
			));
		}

		return self::fromArray($input);
	}

	/**
	 * Whether a offset exists
	 *
	 * @link http://php.net/manual/en/arrayaccess.offsetexists.php
	 * @param mixed $offset <p>
	 * An offset to check for.
	 * </p>
	 * @return boolean true on success or false on failure.
	 * </p>
	 * <p>
	 * The return value will be casted to boolean if non-boolean was returned.
	 * @since 5.0.0
	 */
	public function offsetExists($offset) {
		return array_key_exists($offset, $this->screens);
	}

	/**
	 * Offset to retrieve
	 *
	 * @link http://php.net/manual/en/arrayaccess.offsetget.php
	 * @param mixed $offset <p>
	 * The offset to retrieve.
	 * </p>
	 * @return mixed Can return all value types.
	 * @since 5.0.0
	 */
	public function offsetGet($offset) {
		return $this->screens[$offset];
	}

	/**
	 * Offset to set
	 *
	 * @link http://php.net/manual/en/arrayaccess.offsetset.php
	 * @param mixed $offset <p>
	 * The offset to assign the value to.
	 * </p>
	 * @param mixed $value <p>
	 * The value to set.
	 * </p>
	 * @return void
	 * @since 5.0.0
	 */
	public function offsetSet($offset, $value) {
		$this->screens[$offset] = $value;
	}

	/**
	 * Offset to unset
	 *
	 * @link http://php.net/manual/en/arrayaccess.offsetunset.php
	 * @param mixed $offset <p>
	 * The offset to unset.
	 * </p>
	 * @return void
	 * @since 5.0.0
	 */
	public function offsetUnset($offset) {
		unset($this->screens[$offset]);
	}
}

class ameInvalidMetaBoxDataException extends RuntimeException {}