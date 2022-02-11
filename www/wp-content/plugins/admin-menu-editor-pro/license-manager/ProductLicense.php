<?php
/**
 * @property array $sites Only present if the license server supports it.
 */
class Wslm_ProductLicense implements ArrayAccess {
    private $data = array();

    public function __construct($data = null) {
        if ( !empty($data) ) {
            $this->data = (array)$data;
        }
        if ( !isset($this->data['addons']) ) {
        	$this->data['addons'] = array();
        }

        $integerFields = array('license_id', 'max_sites', 'customer_id');
        foreach($integerFields as $field) {
	        if ( isset($this->data[$field]) && is_string($this->data[$field]) && is_numeric($this->data[$field]) ) {
		        $this->data[$field] = intval($this->data[$field]);
	        }
        }
    }

    public function getData() {
        return $this->data;
    }

	public function isValid() {
		//A license that's "expired" is still valid, it just doesn't qualify for updates.
		$status = $this->getStatus();
		return ($status === 'valid') || ($status === 'expired');
	}

	public function getStatus() {
		$status = $this->get('status');
		if ( $status === null ) {
			$status = 'valid';
		}

		if ( $status === 'valid' ) {
			$expires = $this->get('expires_on');
			if ( isset($expires) && strtotime($expires) < time() ) {
				$status = 'expired';
			}
		}
		return $status;
	}

	public function canReceiveProductUpdates() {
		return ($this->getStatus() === 'valid');
	}

	public function canDownloadCurrentVersion() {
		//Just an alias, but it's a separate method because there's a subtle
		//semantic difference between being able to download the plugin and
		//having access to updates in general. It might matter one day.
		return $this->canReceiveProductUpdates();
	}

	public function addAddOn($slug, $name = null) {
		$this->data['addons'][$slug] = isset($name) ? $name : $slug;
	}

	public function removeAddOn($slug) {
		unset($this->data['addons'][$slug]);
	}

	public function hasAddOn($slug) {
		return (isset($this->data['addons'], $this->data['addons'][$slug])) && $this->data['addons'][$slug];
	}

	public function get($name, $default = null) {
		if ( array_key_exists($name, $this->data) ) {
			return $this->data[$name];
		} else {
			return $default;
		}
	}

	public function isExisting() {
		return ( $this->getStatus() !== 'no_license_yet' ) && ( ! $this->get('is_virtual', false) );
	}

    public function __get($key) {
		if ( array_key_exists($key, $this->data) ) {
			return $this->data[$key];
		} else {
			throw new RuntimeException('Unknown property '. $key);
		}
    }

	public function __isset($key) {
		return isset($this->data[$key]);
	}


	public function offsetExists($offset) {
		return isset($this->data[$offset]);
	}

	public function offsetGet($offset) {
		return $this->data[$offset];
	}

	public function offsetSet($offset, $value) {
		$this->data[$offset] = $value;
	}

	public function offsetUnset($offset) {
		unset($this->data[$offset]);
	}
}