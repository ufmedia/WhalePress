<?php


class ameHideSidebarTweak extends ameBaseTweak {
	private $sidebarId;

	protected $sectionId = 'sidebars';

	/**
	 * @param array $sidebar Sidebar data from $wp_registered_sidebars
	 */
	public function __construct($sidebar) {
		$this->sidebarId = $sidebar['id'];
		parent::__construct(
			'hide-sidebar-' . $this->sidebarId,
			esc_html($sidebar['name'])
		);
	}

	public function apply($settings = null) {
		unregister_sidebar($this->sidebarId);
	}
}