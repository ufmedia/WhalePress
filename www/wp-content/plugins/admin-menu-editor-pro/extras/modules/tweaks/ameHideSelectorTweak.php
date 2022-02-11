<?php


class ameHideSelectorTweak extends ameBaseTweak {
	const OUTPUT_HOOK = 'admin_head';

	/**
	 * @var string A CSS selector.
	 */
	protected $selector;

	protected static $pendingSelectors = array();
	protected static $isOutputHookSet = false;

	public function __construct($id, $label, $selector) {
		parent::__construct($id, $label);
		$this->selector = $selector;
	}

	public function apply($settings = null) {
		self::$pendingSelectors[] = $this->selector;

		if (did_action(self::OUTPUT_HOOK)) {
			self::outputPendingSelectors();
		} else if (!self::$isOutputHookSet) {
			add_action(self::OUTPUT_HOOK, array(__CLASS__, 'outputPendingSelectors'));
			self::$isOutputHookSet = true;
		}
	}

	public static function outputPendingSelectors() {
		if (empty(self::$pendingSelectors)) {
			return;
		}

		$css = sprintf(
			'<style type="text/css">%s { display: none !important; }</style>',
			implode(',', self::$pendingSelectors)
		);

		echo '<!-- AME selector tweaks -->', "\n", $css, "\n";

		self::$pendingSelectors = array();
	}
}