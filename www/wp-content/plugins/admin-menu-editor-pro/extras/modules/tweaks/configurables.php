<?php

namespace YahnisElsts\AdminMenuEditor\Configurable;

use ArrayAccess;
use ArrayIterator;
use InvalidArgumentException;
use IteratorAggregate;

interface IterableSettingsCollection extends IteratorAggregate, ArrayAccess {
	/**
	 * @param NamedNode $child
	 * @return $this
	 */
	public function add(NamedNode $child);

	/**
	 * Check if the collection contains any setting objects.
	 *
	 * @return bool
	 */
	public function hasAnySettings();
}

abstract class NamedNode {
	/**
	 * @var string
	 */
	protected $id = '';

	/**
	 * @var string
	 */
	protected $label = '';

	/**
	 * NamedNode constructor.
	 *
	 * @param string $id
	 * @param string $label
	 */
	public function __construct($id, $label = '') {
		$this->id = $id;
		$this->label = ($label !== null) ? $label : $id;
	}

	public function getId() {
		return $this->id;
	}

	public function getLabel() {
		return $this->label;
	}

	public function toArray() {
		$result = array(
			'id'    => $this->getId(),
			'label' => $this->getLabel(),
		);

		if ( $this instanceof IterableSettingsCollection ) {
			$children = [];
			foreach ($this as $item) {
				$children[] = $item->toArray();
			}
			$result['children'] = $children;
		}

		return $result;
	}
}

class SettingsGroup extends NamedNode implements IterableSettingsCollection {
	const ID_AS_PATH = '.';

	/**
	 * @var NamedNode[]
	 */
	protected $items = [];

	/**
	 * @var string|null
	 */
	protected $propertyPath = null;

	/**
	 * SettingsGroup constructor.
	 *
	 * @param string $id
	 * @param string|null $label
	 * @param string|null $propertyPath
	 */
	public function __construct($id, $label = null, $propertyPath = self::ID_AS_PATH) {
		parent::__construct($id, $label);
		if ( $propertyPath === self::ID_AS_PATH ) {
			$this->propertyPath = $this->id;
		} else {
			$this->propertyPath = $propertyPath;
		}
	}

	public function getIterator() {
		return new ArrayIterator($this->items);
	}

	public function offsetExists($offset) {
		return array_key_exists($offset, $this->items);
	}

	public function offsetGet($offset) {
		return $this->items[$offset];
	}

	public function offsetSet($offset, $value) {
		if ( !($value instanceof NamedNode) ) {
			throw new InvalidArgumentException(
				'Tried to add an invalid item to ' . __CLASS__ . '. Expected a NamedNode.'
			);
		}
		$this->items[$offset] = $value;
	}

	public function offsetUnset($offset) {
		unset($this->items[$offset]);
	}

	public function toArray() {
		$result = parent::toArray();
		$result['type'] = 'group';
		$result['propertyPath'] = $this->propertyPath;
		return $result;
	}

	public function add(NamedNode $child) {
		$id = $child->getId();
		if ( ($id !== '') && ($id !== null) ) {
			$this->items[$child->getId()] = $child;
		} else {
			$this->items[] = $child;
		}
		return $this;
	}

	public function hasAnySettings() {
		if ( empty($this->items) ) {
			return false;
		}
		foreach ($this->items as $item) {
			if ( $item instanceof Setting ) {
				return true;
			} else if ( ($item instanceof IterableSettingsCollection) && $item->hasAnySettings() ) {
				return true;
			}
		}
		return false;
	}
}

class ActorFeature extends NamedNode implements IterableSettingsCollection {
	/**
	 * @var SettingsGroup
	 */
	protected $children;
	protected $defaultAccessMap = null;

	public function __construct($id, $label = null) {
		parent::__construct($id, $label);
		$this->children = new SettingsGroup('', '', null);
	}

	/**
	 * @param array<string,boolean>|null $accessMap
	 * @return $this
	 */
	public function setDefaultAccessMap($accessMap) {
		$this->defaultAccessMap = $accessMap;
		return $this;
	}

	public function getIterator() {
		return $this->children->getIterator();
	}

	public function offsetExists($offset) {
		return $this->children->offsetExists($offset);
	}

	public function offsetGet($offset) {
		return $this->children[$offset];
	}

	public function offsetSet($offset, $value) {
		$this->children[$offset] = $value;
	}

	public function offsetUnset($offset) {
		unset($this->children[$offset]);
	}

	public function add(NamedNode $child) {
		$this->children->add($child);
		return $this;
	}

	public function toArray() {
		$result = parent::toArray();
		$result['hasAccessMap'] = true;
		if ( $this->defaultAccessMap !== null ) {
			$result['defaultAccessMap'] = $this->defaultAccessMap;
		}
		return $result;
	}

	public function hasAnySettings() {
		return $this->children->hasAnySettings();
	}
}

class Setting extends NamedNode {
	/**
	 * @var mixed|null
	 */
	public $defaultValue = null;

	/**
	 * @var string
	 */
	protected $dataType = 'null';

	/**
	 * @var string|null
	 */
	protected $inputType = null;

	public function toArray() {
		$result = parent::toArray();
		$result['dataType'] = $this->dataType;
		$result['inputType'] = $this->inputType;
		if ( $this->defaultValue !== null ) {
			$result['defaultValue'] = $this->defaultValue;
		}
		return $result;
	}
}

class StringSetting extends Setting {
	protected $dataType = 'string';
	protected $inputType = 'text';

	public $syntaxHighlighting = null;

	public function textarea($syntaxHighlighting = null) {
		$this->inputType = 'textarea';
		$this->syntaxHighlighting = $syntaxHighlighting;
		return $this;
	}

	public function toArray() {
		$result = parent::toArray();
		if ( $this->syntaxHighlighting !== null ) {
			$result['syntaxHighlighting'] = $this->syntaxHighlighting;
		}
		return $result;
	}
}

class ColorSetting extends Setting {
	protected $dataType = 'string';
	protected $inputType = 'color';
}

class BooleanSetting extends Setting {
	protected $dataType = 'boolean';
}