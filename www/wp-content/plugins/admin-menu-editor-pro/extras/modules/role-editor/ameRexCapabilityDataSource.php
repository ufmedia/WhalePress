<?php /** @noinspection PhpComposerExtensionStubsInspection */

abstract class ameRexCapabilityDataSource {
	/**
	 * @param string[] $capabilities
	 * @param ameRexComponentRegistry $componentRegistry
	 * @return array
	 */
	abstract public function findCapabilities($capabilities, ameRexComponentRegistry $componentRegistry);
}

class ameRexJsonCapabilityDataSource extends ameRexCapabilityDataSource {
	protected $fileName;

	public function __construct($fileName) {
		$this->fileName = $fileName;
	}

	/**
	 * @inheritDoc
	 */
	public function findCapabilities($capabilities, ameRexComponentRegistry $componentRegistry) {
		$results = array();

		/** @noinspection PhpComposerExtensionStubsInspection */
		$meta = json_decode(file_get_contents($this->fileName), true);

		foreach ($capabilities as $capability) {
			if ( !isset($meta['capabilities'][$capability]) ) {
				continue;
			}

			$capDetails = $meta['capabilities'][$capability];
			if ( isset($capDetails['origins']) ) {
				$relatedComponents = $capDetails['origins'];
			} else {
				$relatedComponents = $capDetails;
			}

			$componentContext = array();
			foreach ($relatedComponents as $origin) {
				$info = null;
				if ( is_string($origin) ) {
					$componentId = $origin;
				} else {
					$componentId = $origin['id'];
					if ( count($origin) > 1 ) {
						$info = ameRexComponentCapabilityInfo::fromArray($origin);
					}
				}
				$componentContext[$componentId] = $info;

				$componentMeta = ameUtils::get($meta, 'components.' . $componentId, array());
				$componentRegistry->getOrCreate($componentId, $componentMeta);
			}

			$results[$capability] = $componentContext;
		}

		return $results;
	}
}

class ameRexSqliteDataSource extends ameRexCapabilityDataSource {
	protected $fileName;
	/**
	 * @var PDO|null
	 */
	protected $pdo = null;

	public function __construct($fileName) {
		$this->fileName = $fileName;
	}

	/**
	 * @inheritDoc
	 */
	public function findCapabilities($capabilities, ameRexComponentRegistry $componentRegistry) {
		if ( !$this->connectToDb() ) {
			return array();
		}

		$selectCap = $this->pdo->prepare('
			SELECT componentId, componentName, activeInstalls, notes, permissions, 
			       documentationUrl, capabilityDocumentationUrl
			FROM capabilityInfoView
			WHERE capabilityName = :capability
		');
		$selectCap->setFetchMode(PDO::FETCH_ASSOC);

		$results = array();
		foreach ($capabilities as $capability) {
			$selectCap->execute(array(':capability' => $capability));
			$rows = $selectCap->fetchAll();
			$selectCap->closeCursor();

			if ( empty($rows) ) {
				continue;
			}

			$componentContext = array();
			foreach ($rows as $capDetails) {
				$info = null;
				if ( !empty($capDetails['notes']) || !empty($capDetails['permissions']) || !empty($capDetails['documentationUrl']) ) {
					if ( isset($capDetails['permissions']) ) {
						//Assume one permission per line.
						$capDetails['permissions'] = preg_split(
							'@[\n\r]++@',
							$capDetails['permissions'],
							-1,
							PREG_SPLIT_NO_EMPTY
						);
					}
					$info = ameRexComponentCapabilityInfo::fromArray($capDetails);
				}
				$componentContext[$capDetails['componentId']] = $info;

				$componentRegistry->updateComponent(
					$capDetails['componentId'],
					array(
						'name'                       => $capDetails['componentName'],
						'activeInstalls'             => $capDetails['activeInstalls'],
						'capabilityDocumentationUrl' => $capDetails['capabilityDocumentationUrl'],
					)
				);
			}

			$results[$capability] = $componentContext;
		}

		return $results;
	}

	protected function connectToDb() {
		if ( $this->pdo ) {
			return true;
		}
		if ( !in_array('sqlite', PDO::getAvailableDrivers()) ) {
			return false;
		}

		try {
			$this->pdo = new PDO('sqlite:' . $this->fileName);
			$this->pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
		} catch (PDOException $ex) {
			//If the user doesn't have a SQLite driver, we can't really do anything about it.
			$this->pdo = null;
			return false;
		}

		return true;
	}
}