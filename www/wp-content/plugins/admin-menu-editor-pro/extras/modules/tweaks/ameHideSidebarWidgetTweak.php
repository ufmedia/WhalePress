<?php

class ameHideSidebarWidgetTweak extends ameBaseTweak {
	private $widget;
	private $widgetClass;

	protected $sectionId = 'sidebar-widgets';

	/**
	 * ameHideSidebarWidgetTweak constructor.
	 *
	 * @param WP_Widget $widget
	 */
	public function __construct($widget) {
		$this->widgetClass = get_class($widget);
		$this->widget = $widget;
		parent::__construct(
			'hide-sidebar-widget-' . $this->widgetClass,
			esc_html($widget->name)
		);
	}

	public function apply($settings = null) {
		unregister_widget($this->widgetClass);
	}
}