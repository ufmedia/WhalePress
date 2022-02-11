<?php


class ameRexCapabilityInfoSearch {
	/**
	 * @var ameRexCapabilityDataSource[]
	 */
	protected $sources = array();

	/**
	 * @param string[] $capabilities
	 * @param ameRexComponentRegistry $componentRegistry
	 * @return ameRexCapabilitySearchResultSet
	 */
	public function query($capabilities, ameRexComponentRegistry $componentRegistry) {
		$dataset = new ameRexCapabilitySearchResultSet();
		foreach($this->sources as $source) {
			$matches = $source->findCapabilities($capabilities, $componentRegistry);
			foreach($matches as $capabilityName => $components) {
				foreach($components as $componentId => $capInfo) {
					$dataset->addResult($capabilityName, $componentId, $capInfo);
				}
			}
		}
		return $dataset;
	}

	public function addDataSource(ameRexCapabilityDataSource $source) {
		$this->sources[] = $source;
	}
}