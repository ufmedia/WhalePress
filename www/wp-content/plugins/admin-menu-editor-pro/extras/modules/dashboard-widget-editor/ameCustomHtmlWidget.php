<?php

class ameCustomHtmlWidget extends ameDashboardWidget {
	protected $widgetType = 'custom-html';

	/**
	 * @var string HTML content of the widget.
	 */
	protected $content = '';

	/**
	 * @var bool
	 */
	protected $filtersEnabled = false;

	public static function fromArray($widgetProperties) {
		$widget = new self($widgetProperties);
		$widget->setProperties($widgetProperties);
		return $widget;
	}

	protected function setProperties(array $properties) {
		parent::setProperties($properties);
		$this->content = isset($properties['content']) ? strval($properties['content']) : '';
		$this->filtersEnabled = isset($properties['filtersEnabled']) ? (bool)($properties['filtersEnabled']) : false;
	}

	public function toArray() {
		$properties = parent::toArray();
		$properties['content'] = $this->content;
		$properties['filtersEnabled'] = $this->filtersEnabled;
		return $properties;
	}

	public function getCallback() {
		return array($this, 'displayContent');
	}

	public function displayContent() {
		$content = $this->content;

		if ( $this->filtersEnabled ) {
			//The same filters as on the_content.
			$content = wptexturize($content);
			$content = convert_smilies($content);
			$content = wpautop($content);
			$content = shortcode_unautop($content);
			//This filter is usually applied on content_save_pre.
			$content = convert_invalid_entities($content);
		}

		$content = do_shortcode($content);

		if ( $this->filtersEnabled ) {
			//This filter is also applied on content_save_pre but at a late priority.
			$content = balanceTags($content, true);
		}

		echo $content;
	}
}