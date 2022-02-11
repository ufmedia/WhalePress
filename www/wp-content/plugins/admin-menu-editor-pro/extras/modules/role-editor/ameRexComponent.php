<?php

class ameRexComponent {
	/**
	 * @var string
	 */
	public $id;
	/**
	 * @var string
	 */
	public $name = '';
	/**
	 * @var float
	 */
	public $activeInstalls = 0.0;

	/**
	 * @var string|null
	 */
	public $capabilityDocumentationUrl = null;

	public $isActive = false;
	public $isInstalled = false;

	public $registeredPostTypes = array();
	public $registeredTaxonomies = array();

	public function __construct($id, $name = null) {
		$this->id = $id;
		$this->name = ($name !== null) ? $name : $id;
	}

	public function toArray() {
		$result = array(
			'componentId'    => $this->id,
			'name'           => $this->name,
			'activeInstalls' => $this->activeInstalls,
			'isActive'       => $this->isActive,
			'isInstalled'    => $this->isInstalled,
		);

		if ($this->capabilityDocumentationUrl) {
			$result['capabilityDocumentationUrl'] = $this->capabilityDocumentationUrl;
		}

		return $result;
	}
}