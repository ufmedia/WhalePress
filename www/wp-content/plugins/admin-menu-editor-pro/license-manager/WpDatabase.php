<?php
/**
 * A thin wrapper for the wpdb, the WordPress database API.
 */
class Wslm_WpDatabase extends Wslm_Database {
	/** @var wpdb */
	private $wpdb;

	public function __construct() {
		$this->wpdb = $GLOBALS['wpdb'];
	}

	public function getResults($query, $parameters = array()) {
		if ( !empty($parameters) ) {
			$query = str_replace('?', '%s', $query);
			$query = $this->wpdb->prepare($query, $parameters);
		}
		return $this->wpdb->get_results($query, ARRAY_A);
	}

	public function query($query, $parameters = array()) {
		if ( !empty($parameters) ) {
			$query = str_replace('?', '%s', $query);
			$query = $this->wpdb->prepare($query, $parameters);
		}
		return $this->wpdb->query($query);
	}
}
