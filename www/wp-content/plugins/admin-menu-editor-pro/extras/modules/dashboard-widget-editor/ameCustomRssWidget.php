<?php

class ameCustomRssWidget extends ameDashboardWidget {
	protected $widgetType = 'custom-rss';

	/**
	 * @var string|null RSS feed URL.
	 */
	protected $feedUrl = null;

	protected $maxItems = 5;

	protected $showAuthor = true;
	protected $showDate = true;
	protected $showSummary = true;

	public static function fromArray($widgetProperties) {
		$widget = new self($widgetProperties);
		$widget->setProperties($widgetProperties);
		return $widget;
	}

	protected function setProperties(array $properties) {
		parent::setProperties($properties);

		$this->feedUrl = isset($properties['feedUrl']) ? strval($properties['feedUrl']) : null;
		$this->maxItems = isset($properties['maxItems']) ? max(1, min(intval($properties['maxItems']), 20)) : 5;

		$booleanProperties = array('showAuthor', 'showDate', 'showSummary');
		foreach ($booleanProperties as $name) {
			if ( isset($properties[$name]) ) {
				$this->$name = (bool)($properties[$name]);
			} else {
				$this->$name = true;
			}
		}
	}

	public function toArray() {
		$properties = parent::toArray();

		$storedProperties = array('feedUrl', 'maxItems', 'showAuthor', 'showDate', 'showSummary');
		foreach ($storedProperties as $name) {
			$properties[$name] = $this->$name;
		}

		return $properties;
	}

	public function getCallback() {
		return array($this, 'displayContent');
	}

	public function displayContent() {
		if ( empty($this->feedUrl) ) {
			echo 'Error: No feed URL specified';
			return;
		}

		wp_widget_rss_output(array(
			'url'          => $this->feedUrl,
			'items'        => $this->maxItems,
			'show_author'  => $this->showAuthor ? 1 : 0, //Yes, this function actually expects int's and not booleans.
			'show_date'    => $this->showDate ? 1 : 0,
			'show_summary' => $this->showSummary ? 1 : 0,
		));
	}
}