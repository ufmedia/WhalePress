<?php

use YahnisElsts\AdminMenuEditor\Configurable\ActorFeature;

abstract class ameBaseTweak extends ActorFeature {
	protected $parentId;
	protected $sectionId;

	/**
	 * @var string[]|null List of admin screen IDs that the tweak applies to.
	 */
	protected $screens = null;

	/**
	 * @param array|null $settings User settings for this tweak.
	 * @return mixed
	 */
	abstract public function apply($settings = null);

	public function getId() {
		return $this->id;
	}

	public function getLabel() {
		return $this->label;
	}

	public function getParentId() {
		return $this->parentId;
	}

	public function setParentId($id) {
		$this->parentId = $id;
		return $this;
	}

	public function setSectionId($id) {
		$this->sectionId = $id;
		return $this;
	}

	public function getSectionId() {
		return $this->sectionId;
	}

	public function hasScreenFilter() {
		return ($this->screens !== null);
	}

	public function isEnabledForCurrentScreen() {
		if ( !$this->hasScreenFilter() ) {
			return true;
		}
		if ( !function_exists('get_current_screen') ) {
			return false;
		}
		$screen = get_current_screen();
		if ( isset($screen, $screen->id) ) {
			return $this->isEnabledForScreen($screen->id);
		}
		return false;
	}

	public function isEnabledForScreen($screenId) {
		if ( $this->screens === null ) {
			return true;
		}
		return in_array($screenId, $this->screens);
	}

	public function setScreens($screens) {
		$this->screens = $screens;
	}

	public function toArray() {
		return array_merge(
			parent::toArray(),
			array(
				'parentId'  => $this->getParentId(),
				'sectionId' => $this->getSectionId(),
			)
		);
	}

	public function supportsUserInput() {
		return $this->hasAnySettings();
	}

	//todo: getEditableProperties(). Or maybe we don't need it at all? Just merge the settings.
}