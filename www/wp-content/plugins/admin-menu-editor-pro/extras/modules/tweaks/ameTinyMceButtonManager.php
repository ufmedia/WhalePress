<?php

class ameTinyMceButtonManager {
	const DETECTED_BUTTON_OPTION = 'ws_ame_detected_tmce_buttons';
	const SECTION_ID = 'tmce-buttons';

	private $detectionEnabled = false;
	private $storageHookSet = false;

	private $newDetectedButtons = array();
	private $cachedKnownButtons = null;

	private $hiddenButtons = array();

	private $builtInButtons = array(
		'kitchensink'    => array('title' => 'More buttons'),
		'wp_add_media'   => array('title' => 'Add Media'),
		'formatselect'   => array('title' => 'Format dropdown'),
		'alignleft'      => array('title' => 'Align left'),
		'aligncenter'    => array('title' => 'Align center'),
		'alignright'     => array('title' => 'Align right'),
		'alignjustify'   => array('title' => 'Justify'),
		'alignnone'      => array('title' => 'No alignment'),
		'bold'           => array('title' => 'Bold'),
		'italic'         => array('title' => 'Italic'),
		'underline'      => array('title' => 'Underline'),
		'strikethrough'  => array('title' => 'Strikethrough'),
		'subscript'      => array('title' => 'Subscript'),
		'superscript'    => array('title' => 'Superscript'),
		'outdent'        => array('title' => 'Decrease indent'),
		'indent'         => array('title' => 'Increase indent'),
		'cut'            => array('title' => 'Cut'),
		'copy'           => array('title' => 'Copy'),
		'paste'          => array('title' => 'Paste'),
		'help'           => array('title' => 'Help'),
		'selectall'      => array('title' => 'Select all'),
		'visualaid'      => array('title' => 'Visual aids'),
		'newdocument'    => array('title' => 'New document'),
		'removeformat'   => array('title' => 'Clear formatting'),
		'remove'         => array('title' => 'Remove'),
		'blockquote'     => array('title' => 'Blockquote'),
		'undo'           => array('title' => 'Undo'),
		'redo'           => array('title' => 'Redo'),
		'fontsizeselect' => array('title' => 'Font Size'),
		'fontselect'     => array('title' => 'Font Family'),
		'styleselect'    => array('title' => 'Style dropdown'),
		'insert'         => array('title' => 'Insert menu'),
		'charmap'        => array('title' => 'Special character'),
		'hr'             => array('title' => 'Horizontal line'),
		'numlist'        => array('title' => 'Numbered list'),
		'bullist'        => array('title' => 'Bulleted list'),
		'media'          => array('title' => 'Insert/edit media'),
		'pastetext'      => array('title' => 'Paste as text'),
		'forecolor'      => array('title' => 'Text color'),
		'backcolor'      => array('title' => 'Background color'),
		'wp_adv'         => array('title' => 'Toolbar Toggle'),
		'wp_more'        => array('title' => 'Insert Read More tag'),
		'wp_page'        => array('title' => 'Page break'),
		'wp_help'        => array('title' => 'Keyboard Shortcuts'),
		'wp_code'        => array('title' => 'Code'),
		'link'           => array('title' => 'Insert/edit link'),
		'unlink'         => array('title' => 'Remove link'),
		'spellchecker'   => array('title' => 'Toggle spellchecker'),
	);

	public function __construct() {
		add_action('admin_init', array($this, 'toggleButtonDetection'));

		$buttonFilters = array('mce_buttons', 'mce_buttons_2', 'mce_buttons_3', 'mce_buttons_4');
		foreach ($buttonFilters as $filter) {
			add_filter($filter, array($this, 'filterButtons'), 9000, 1);
		}

		add_action('admin-menu-editor-register_tweaks', array($this, 'registerButtonTweaks'), 10, 1);
	}

	public function toggleButtonDetection() {
		$this->detectionEnabled = current_user_can('activate_plugins') || current_user_can('edit_others_pages');
	}

	public function filterButtons($buttons) {
		if ( $this->detectionEnabled ) {
			$this->detectNewButtons($buttons);
		}
		$buttons = $this->removeHiddenButtons($buttons);
		return $buttons;
	}

	private function detectNewButtons($buttons) {
		$newButtons = array_diff($buttons, $this->getKnownButtonIds());
		if ( !empty($newButtons) ) {
			$this->newDetectedButtons = array_merge($this->newDetectedButtons, $newButtons);
			if ( !$this->storageHookSet ) {
				add_action('shutdown', array($this, 'storeNewButtons'));
				$this->storageHookSet = true;
			}
		}
	}

	public function storeNewButtons() {
		$newButtons = array_fill_keys($this->newDetectedButtons, time());
		$buttons = array_merge($this->getDetectedButtons(), $newButtons);

		//Filter out built-in buttons. We already know they exist, so there's no need
		//to store them in the database.
		$buttons = array_diff_key($buttons, $this->getBuiltInButtons());
		$this->saveDetectedButtons($buttons);

		$this->newDetectedButtons = array();
	}

	private function saveDetectedButtons($buttons) {
		$this->cachedKnownButtons = null;

		$handle = null;
		if ( function_exists('flock') ) {
			$handle = @fopen(__FILE__, 'r');
			if ( !$handle ) {
				return;
			}
			$success = @flock($handle, LOCK_EX | LOCK_NB);
			if ( !$success ) {
				fclose($handle);
				return;
			}
		}

		if ( is_multisite() ) {
			update_site_option(self::DETECTED_BUTTON_OPTION, $buttons);
		} else {
			update_option(self::DETECTED_BUTTON_OPTION, $buttons, 'yes');
		}

		if ( $handle !== null ) {
			@flock($handle, LOCK_UN);
			fclose($handle);
		}
	}

	/**
	 * @param string[] $buttons
	 * @return string[]
	 */
	private function removeHiddenButtons($buttons) {
		if ( empty($this->hiddenButtons) ) {
			return $buttons;
		}
		return array_diff($buttons, $this->hiddenButtons);
	}

	private function getKnownButtons() {
		if ( $this->cachedKnownButtons === null ) {
			$this->cachedKnownButtons = array_merge($this->getDetectedButtons(), $this->getBuiltInButtons());
		}
		return $this->cachedKnownButtons;
	}

	/**
	 * @return string[]
	 */
	private function getKnownButtonIds() {
		return array_keys($this->getKnownButtons());
	}

	/**
	 * @return array
	 */
	private function getDetectedButtons() {
		if ( is_multisite() ) {
			$buttons = get_site_option(self::DETECTED_BUTTON_OPTION, array());
		} else {
			$buttons = get_option(self::DETECTED_BUTTON_OPTION, array());
		}
		if ( !is_array($buttons) ) {
			return array();
		}
		return $buttons;
	}

	private function getBuiltInButtons() {
		return $this->builtInButtons;
	}

	/**
	 * @param ameTweakManager $tweakManager
	 */
	public function registerButtonTweaks($tweakManager) {
		$tweakManager->addSection(self::SECTION_ID, 'Hide TinyMCE Buttons', 150);
		$theCallback = array($this, 'flagButtonAsHidden');

		$buttons = $this->getKnownButtons();
		$buttonTweaks = array();
		foreach ($buttons as $id => $details) {
			$label = $id;
			if ( isset($details['title']) ) {
				$label = sprintf('%s (%s)', $details['title'], $id);
			}

			$tweak = new ameDelegatedTweak('hide-tmce-' . $id, $label, $theCallback, array($id));
			$tweak->setSectionId(self::SECTION_ID);
			$buttonTweaks[] = $tweak;
		}

		//Sort tweaks by label.
		uasort(
			$buttonTweaks,
			/**
			 * @param ameBaseTweak $a
			 * @param ameBaseTweak $b
			 * @return int
			 */
			function ($a, $b) {
				return strnatcasecmp($a->getLabel(), $b->getLabel());
			}
		);

		foreach ($buttonTweaks as $tweak) {
			$tweakManager->addTweak($tweak);
		}
	}

	/** @noinspection PhpUnused Actually used in registerButtonTweaks(). */
	public function flagButtonAsHidden($buttonId) {
		$this->hiddenButtons[] = $buttonId;
	}
}