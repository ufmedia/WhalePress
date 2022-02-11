<?php
require dirname(__FILE__) . '/pretty-json.php';
require dirname(__FILE__) . '/ProductLicense.php';
require dirname(__FILE__) . '/LicenseServer.php';
require dirname(__FILE__) . '/BasicPluginLicensingUi.php';

class Wslm_LicenseManagerClient {
	const LICENSE_SCOPE_SITE = 'site';
	const LICENSE_SCOPE_NETWORK = 'network';

	private $productSlug = null;
	private $licenseKey = null;
	private $siteToken = null;
	private $storeLicenseKey = false;

	private $tokenHistorySize = 0;
	private $tokenHistory = null;

	private $checkPeriod = null;
	private $cronHook;

	private $optionName;
	private $licenseScope;

	/**
	 * @var Wslm_LicenseManagerApi
	 */
	private $api;

    /** @var Wslm_ProductLicense */
    private $license = null;

    /** @var Puc_v4p11_Plugin_UpdateChecker */
    private $updateChecker = null;

    /**
     * @param array $args
     */
    public function __construct($args = array()) {
        $defaults = array(
            'api_url' => null,
			'api_provider' => null,
            'product_slug' => null,
            'option_name' => null,
            'license_scope' => self::LICENSE_SCOPE_SITE,
			'check_period' => null,
			'store_license_key' => false,
            'update_checker' => null,
	        'token_history_size' => 0,
        );
        $args = array_merge($defaults, $args);

		if ( isset($args['api_provider']) ) {
			$this->api = $args['api_provider'];
		} else {
			$this->api = new Wslm_LicenseManagerApi($args['api_url']);
		}

        $this->productSlug = $args['product_slug'];
        $this->optionName = $args['option_name'];
        $this->licenseScope = $args['license_scope'];
	    $this->tokenHistorySize = $args['token_history_size'];

        if ($args['update_checker'] !== null) {
            $this->updateChecker = $args['update_checker'];
        }

        if ( $this->updateChecker !== null ) {
			if ( $this->productSlug === null ) {
				$this->productSlug = $this->updateChecker->slug;
			}

			$this->updateChecker->addResultFilter(array($this, 'refreshLicenseFromPluginInfo'));
			$this->addUpdateFiltersTo($this->updateChecker);
        }

		if ( empty($this->optionName) ) {
			$this->optionName = 'wsh_license_manager-' . $this->productSlug;
		}

		//Set up the periodic update checks
		$this->cronHook = 'check_license_updates-' . $this->getProductSlug();
		$this->checkPeriod = $args['check_period'];
		if (  $this->checkPeriod > 0 && $this->shouldCheckForUpdates() ){
			//Trigger the check via Cron
			add_filter('cron_schedules', array($this, 'addCustomSchedule'));
			if ( !wp_next_scheduled($this->cronHook) && !defined('WP_INSTALLING') ) {
				$scheduleName = 'every' . $this->checkPeriod . 'hours';
				wp_schedule_event(time(), $scheduleName, $this->cronHook);
			}
			add_action($this->cronHook, array($this, 'checkForLicenseUpdates'));
		} else {
			//Periodic checks are disabled.
			wp_clear_scheduled_hook($this->cronHook);
		}
    }

	protected function load() {
		if ( $this->licenseScope === self::LICENSE_SCOPE_NETWORK ) {
			$options = get_site_option($this->optionName, array());
		} else {
			$options = get_option($this->optionName, array());
		}

		$this->licenseKey = isset($options['license_key']) ? $options['license_key'] : null;
		$this->siteToken = isset($options['site_token']) ? $options['site_token'] : null;
		$this->license = null;
		if ( isset($options['license']) ) {
			$this->license = $this->createLicenseObject($options['license']);
		}

		if ( $this->tokenHistorySize > 0 ) {
			$this->tokenHistory = isset($options['token_history']) ? $options['token_history'] : array();
		} else {
			$this->tokenHistory = null;
		}
	}

	protected function lazyLoad() {
		static $isLoaded = false;
		if ( !$isLoaded ) {
			$this->load();
			$isLoaded = true;
		}
	}

	protected function save() {
		$licenseData = null;
		if ( !empty($this->license) ) {
			$licenseData = $this->license->getData();
			unset($licenseData['sites']);
			unset($licenseData['notice']);
			if ( !$this->storeLicenseKey ) {
				unset($licenseData['license_key']);
			}
		}

		$options = array(
			'license_key' => $this->storeLicenseKey ? $this->licenseKey : null,
			'site_token' => $this->siteToken,
			'license' => $licenseData,
		);

		if ( ($this->tokenHistorySize > 0) && !empty($this->tokenHistory) ) {
			$options['token_history'] = array_slice($this->tokenHistory, -$this->tokenHistorySize);
		}

		if ( $this->licenseScope === self::LICENSE_SCOPE_NETWORK ) {
			update_site_option($this->optionName, $options);
		} else {
			update_option($this->optionName, $options);
		}
	}

	protected function resetState() {
		$this->license = null;
		$this->licenseKey = null;
		$this->siteToken = null;
		$this->tokenHistory = null;
		wp_clear_scheduled_hook($this->cronHook);

		if ( $this->licenseScope === self::LICENSE_SCOPE_NETWORK ) {
			delete_site_option($this->optionName);
		} else {
			delete_option($this->optionName);
		}

		//We no longer have a license, so maybe we no longer have access to updates.
		//Calling resetUpdateState() will ensure any cached updates are discarded.
		if ( $this->updateChecker !== null ) {
			$this->updateChecker->resetUpdateState();
		}
	}

	/**
	 * @return Wslm_ProductLicense
	 */
	public function getLicense() {
		$this->lazyLoad();
		if ( $this->license === null ) {
			return $this->createLicenseObject(array(
				'status' => 'no_license_yet',
				'is_virtual' => true,
			));
		}
		return $this->license;
	}

	public function hasExistingLicense() {
		$this->lazyLoad();
		return ($this->getSiteToken() !== null)
			&& ($this->license !== null)
			&& $this->license->isExisting();
	}

	public function checkForLicenseUpdates() {
		$this->lazyLoad();
		if ( $this->shouldCheckForUpdates() ) {
			$result = $this->requestLicenseDetails();

			if ( !is_wp_error($result) ) {
				$this->license = $result;
			} else if ( in_array($result->get_error_code(), array('not_found', 'wrong_site')) ) {
				//If the key or token is definitely not valid, we have an invalid license.
				//If some other, unexpected error occurs, we can't say with confidence whether
				//the license is OK or not, so then we just return that error.
				//Note: We could use $apiResponse->httpCode == 404 here. More consistent than error code strings.
				$this->license = $this->createLicenseObject(array(
					'status' => $result->get_error_code(),
					'error' => array(
						'code' => $result->get_error_code(),
						'message' => $result->get_error_message(),
					),
					'is_virtual' => true,
				));
			} else {
				return $result;
			}

			$this->save();
			return $this->license;
		} else {
			return new WP_Error(
				'no_license_set',
				"Can't check for license updates because this site doesn't have a license yet."
			);
		}
	}

	protected function shouldCheckForUpdates() {
		return $this->getLicenseKey() !== null || $this->getSiteToken() !== null;
	}

	/**
	 * @param string $licenseKey
	 * @return Wslm_ProductLicense|WP_Error
	 */
	public function requestLicenseDetails($licenseKey = null) {
		//Try to download license details.
		if ( isset($licenseKey) ) {
			$result = $this->api->getLicense($this->productSlug, $licenseKey, $this->getSiteUrl());
		} else {
			if ( $this->getLicenseKey() !== null ) {
				$result = $this->api->getLicense($this->productSlug, $this->getLicenseKey(), $this->getSiteUrl());
			} else {
				$result = $this->api->getLicenseByToken($this->productSlug, $this->getSiteToken(), $this->getSiteUrl());
			}
		}

		if ( $result->success() ) {
			return $this->createLicenseObject($result->response->license);
		} else {
			return $result->asWpError();
		}
	}

	public function createLicenseObject($licenseData = null) {
		$license = apply_filters('wslm_create_license_object-' . $this->productSlug, null, $licenseData);
		if ( $license === null ) {
			$license = new Wslm_ProductLicense($licenseData);
		}
		return $license;
	}

	/**
	 * Activate a license on the current site.
	 *
	 * @param string $licenseKey
	 * @return Wslm_ProductLicense|WP_Error
	 */
	public function licenseThisSite($licenseKey) {
		$result = $this->api->licenseSite($this->productSlug, $licenseKey, $this->getSiteUrl());
		return $this->processActivationResponse($result, $licenseKey);
	}

	/**
	 * Associate an already-activated, site-specific license with the current site.
	 *
	 * This is for situations where you have already obtained a site token somehow and just need
	 * the license manager to verify it and refresh license details.
	 *
	 * @param string $siteToken
	 * @return WP_Error|Wslm_ProductLicense
	 */
	public function licenseThisSiteByToken($siteToken) {
		$result = $this->api->getLicenseByToken($this->productSlug, $siteToken, $this->getSiteUrl());
		return $this->processActivationResponse($result, null, $siteToken);
	}

	/**
	 * @param Wslm_LicenseManagerApiResponse $result
	 * @param string|null $licenseKey
	 * @param string|null $siteToken
	 * @return Wslm_ProductLicense|WP_Error
	 */
	private function processActivationResponse($result, $licenseKey = null, $siteToken = null) {
		$this->lazyLoad();
		if ( $result->success() ) {
			//Success! Lets save our license data.
			$this->license = $this->createLicenseObject($result->response->license);
			$this->siteToken = isset($result->response->site_token) ? $result->response->site_token : $siteToken;
			$this->licenseKey = $this->storeLicenseKey ? $licenseKey : null;

			if ( !isset($this->license['site_url']) && !empty($this->siteToken) ) {
				$this->license['site_url'] = $this->getSiteUrl();
			}

			if ( ($this->tokenHistorySize > 0) && !empty($this->siteToken) ) {
				//Add this token+site combination to the bottom of the list.
				$this->tokenHistory = isset($this->tokenHistory) ? $this->tokenHistory : array();
				unset($this->tokenHistory[$this->siteToken]);
				$this->tokenHistory[$this->siteToken] = $this->getSiteUrl();
			}

			if ( isset($result->response->notice) ) {
				//Stick the notice in the license object for lack of a better place.
				$this->license['notice'] = array(
					'message' => $result->response->notice->message,
					'class' => isset($result->response->notice->class) ? $result->response->notice->class : 'notice-info'
				);
			}

			do_action('wslm_license_activated-' . $this->productSlug, $this->license);

			$this->save();

			//Now that we have a valid license, an update might be available. Clear the cache.
			if ( $this->updateChecker !== null ) {
				$this->updateChecker->resetUpdateState();
			}

			return $this->license;
		} else {
			$error = $result->asWpError();
			if ( isset($result->response->license) ) {
				$error->add_data($this->createLicenseObject($result->response->license), 'license');
			}
			return $error;
		}
	}

	public function unlicenseThisSite() {
		if ( $this->hasExistingLicense() ) {
			$result = $this->unlicenseSite($this->getSiteUrl(), $this->getLicenseKey(), $this->getSiteToken());
			if ( is_wp_error($result) && ($result->get_error_code() === 'api_request_failed') ) {
				return $result;
			}
		}

		$this->resetState();
		return true;
	}

	/**
	 * Unlicense a site.
	 *
	 * @param string $siteUrl
	 * @param string $licenseKey
	 * @param string $token
	 * @return Wslm_ProductLicense|WP_Error|null
	 */
	public function unlicenseSite($siteUrl, $licenseKey, $token = null) {
		if ( !empty($licenseKey) ) {
			$apiResponse = $this->api->unlicenseSite($this->productSlug, $licenseKey, $siteUrl);
		} else if ( !empty($token) ) {
			$apiResponse = $this->api->unlicenseSiteByToken($this->getProductSlug(), $token, $siteUrl);
		} else {
			return new WP_Error(
				'invalid_argument',
				'To unlicense a site, you must specify either a license key or a site token.'
			);
		}

		$responseLicense = null;
		if ( isset($apiResponse->response->license) ) {
			$responseLicense = $this->createLicenseObject($apiResponse->response->license);
		}

		if ( $apiResponse->success() ) {
			$result = $responseLicense;
		} else {
			$error = $apiResponse->asWpError();
			if ( isset($responseLicense) ) {
				$error->add_data('license', $responseLicense);
			}
			$result = $error;
		}

		//Did we just remove the license from the current site?
		if ( $siteUrl === $this->getSiteUrl() ) {
			if ( !is_wp_error($result) || ($result->get_error_code() !== 'api_request_failed') ) {
				//Success. Or, if the request fails for any reason other than API problems,
				//chances are the stored license was invalid. So we'll remove the local copy anyway.
				$this->resetState();
			}
		}

		return $result;
	}

	/**
	 * @return string|null
	 */
	public function getLicenseKey() {
		$this->lazyLoad();
		if (is_string($this->licenseKey) && $this->licenseKey !== '') {
			return $this->licenseKey;
		}
		return null;
    }

	/**
	 * @return string|null
	 */
	public function getSiteToken() {
		$this->lazyLoad();
		if (is_string($this->siteToken) && $this->siteToken !== '') {
			return $this->siteToken;
		}
		return null;
	}

	/**
	 * @return array
	 */
	public function getTokenHistory() {
		$this->lazyLoad();
		return isset($this->tokenHistory) ? $this->tokenHistory : array();
	}

	public function getProductSlug() {
		return $this->productSlug;
	}

	public function getApi() {
		return $this->api;
	}

    public function getSiteUrl() {
		if ( $this->licenseScope === self::LICENSE_SCOPE_NETWORK ) {
			$url = network_site_url();
		} else {
			$url = site_url();
		}
		return str_replace('https://', 'http://', $url);
    }

	/**
	 * Register filters that will add license details to update requests and download URLs.
	 * Add-ons can use this method to easily re-use the same license key as the main plugin.
	 *
	 * @param Puc_v4p11_Plugin_UpdateChecker $updateChecker
	 */
	public function addUpdateFiltersTo($updateChecker) {
		$updateChecker->addQueryArgFilter(array($this, 'filterUpdateChecks'));

		//Add license data to update download URL, or remove the URL if we don't have a license.
		$downloadFilter = array($this, 'filterUpdateDownloadUrl');
		$updateChecker->addFilter('request_info_result', $downloadFilter, 20);
		$updateChecker->addFilter('pre_inject_update', $downloadFilter);
		$updateChecker->addFilter('pre_inject_info', $downloadFilter);
    }

    public function filterUpdateChecks($queryArgs) {
		if ( $this->getSiteToken() !== null ) {
			$queryArgs['license_token'] = $this->getSiteToken();
		}
		if ( $this->getLicenseKey() !== null ) {
			$queryArgs['license_key'] = $this->getLicenseKey();
		}
		$queryArgs['license_site_url'] = $this->getSiteUrl();
        return $queryArgs;
    }

    /**
       * @param Puc_v4p11_Plugin_Info|null $pluginInfo
       * @param array $result
       * @return Puc_v4p11_Plugin_Info|null
       */
    public function refreshLicenseFromPluginInfo($pluginInfo, $result) {
	    $this->lazyLoad();
        if ( !is_wp_error($result) && isset($result['response']['code']) && ($result['response']['code'] == 200) && !empty($result['body']) ){
            $apiResponse = json_decode($result['body']);
            if ( is_object($apiResponse) && isset($apiResponse->license) ) {
                $this->license = $this->createLicenseObject($apiResponse->license);
                $this->save();
            }
        }
        return $pluginInfo;
    }

	/**
	 * Add license data to the update download URL if we have a valid license,
	 * or remove the URL (thus disabling one-click updates) if we don't.
	 *
	 * @param Puc_v4p11_Plugin_Update|Puc_v4p11_Plugin_Info $pluginInfo
	 * @return Puc_v4p11_Plugin_Update|Puc_v4p11_Plugin_Info
	 */
	public function filterUpdateDownloadUrl($pluginInfo) {
		if ( isset($pluginInfo, $pluginInfo->download_url) && !empty($pluginInfo->download_url) ) {
			$license = $this->getLicense();
			if ( $license->canReceiveProductUpdates() ) {
				//Append license data to the download URL so that the server can verify it.
				$args = array_filter(array(
					'license_key' => $this->getLicenseKey(),
					'license_token' => $this->getSiteToken(),
					'license_site_url' => $this->getSiteUrl(),
				));
				$pluginInfo->download_url = add_query_arg($args, $pluginInfo->download_url);
			} else {
				//No downloads without a license!
				$pluginInfo->download_url = null;
			}
		}
		return $pluginInfo;
	}

	public function addCustomSchedule($schedules){
		if ( $this->checkPeriod && ($this->checkPeriod > 0) ){
			$scheduleName = 'every' . $this->checkPeriod . 'hours';
			$schedules[$scheduleName] = array(
				'interval' => $this->checkPeriod * 3600,
				'display' => sprintf('Every %d hours', $this->checkPeriod),
			);
		}
		return $schedules;
	}
}

class Wslm_LicenseManagerApi {
	private $apiUrl;

	public function __construct($apiUrl) {
		$this->apiUrl = $apiUrl;
	}

	public function getLicense($product, $key, $siteUrl = null) {
		$params = ($siteUrl !== null) ? array('site_url' => $siteUrl) : array();
		return $this->get($this->endpoint($product, $key), $params);
	}

	public function licenseSite($product, $key, $siteUrl) {
		$params = array('site_url' => $siteUrl);
 		return $this->post($this->endpoint($product, $key, null, 'license_site'), $params);
	}

	public function unlicenseSite($product, $key, $siteUrl) {
		$params = array('site_url' => $siteUrl);
		return $this->post($this->endpoint($product, $key, null, 'unlicense_site'), $params);
	}

	public function getLicenseByToken($product, $token, $siteUrl = null) {
		$params = ($siteUrl !== null) ? array('site_url' => $siteUrl) : array();
		return $this->get($this->endpoint($product, null, $token), $params);
	}

	public function unlicenseSiteByToken($product, $token, $siteUrl) {
		$params = array('site_url' => $siteUrl);
 		return $this->post($this->endpoint($product, null, $token, 'unlicense_site'), $params);
	}

	public function get($endpoint, $params = array()) {
		return $this->request('get', $endpoint, $params);
	}

	public function post($endpoint, $params = array()) {
		return $this->request('post', $endpoint, $params);
	}

	private function endpoint($product, $license = null, $token = null, $action = null) {
		$endpoint = '/products/' . urlencode($product) . '/licenses/';
		$endpoint .= ($token !== null) ? 'bytoken/' . urlencode($token) : urlencode($license);
		if ( $action !== null ) {
			$endpoint .= '/' . $action;
		}
		return $endpoint;
	}

	/**
	 * Send an API request.
	 *
	 * @param string $method
	 * @param string $endpoint
	 * @param array $params
	 * @return Wslm_LicenseManagerApiResponse
	 */
	public function request($method, $endpoint, $params = array()) {
		$url = $this->getApiUrl($endpoint);
		$method = strtoupper($method);
		$args = array('method' => $method, 'timeout' => 30);

		if ( !empty($params) ) {
			if ( ($method === 'POST') || ($method === 'PUT') ) {
				$args['body'] = $params;
			} else {
				$url .= '?' . http_build_query($params, '', '&');
			}
		}

		$response = wp_remote_request($url, $args);
		return new Wslm_LicenseManagerApiResponse($response);
	}

	private function getApiUrl($endpoint) {
		return rtrim($this->apiUrl, '/') . '/' . ltrim($endpoint, '/');
	}
}

class Wslm_LicenseManagerApiResponse {
    public $response = null;
    public $httpCode;
    public $httpResponse;

	private $error = null;

	/**
	 * @param array|WP_Error $httpResponse
	 */
	public function __construct($httpResponse) {
		$this->httpResponse = $httpResponse;
		$this->httpCode = intval(wp_remote_retrieve_response_code($httpResponse));

		if ( is_wp_error($httpResponse) ) {
			$this->error = new WP_Error('api_request_failed', $httpResponse->get_error_message(), $this);
			$this->response = null;
		} else {
			//Attempt to parse the API response. Expect a JSON document.
			$data = json_decode(wp_remote_retrieve_body($httpResponse));
			if ( $data === null ) {
				$this->error = new WP_Error(
					'api_request_failed',
					'Failed to parse the response returned by the licensing API (expected JSON).',
					$this
				);
			}
			$this->response = $data;
		}
    }

	public function success() {
		return empty($this->error) && ($this->httpCode >= 200 && $this->httpCode < 400);
	}

	public function asWpError() {
		if ( $this->success() ) {
			return null;
		}

		if ( !empty($this->error) ) {
			return $this->error;
		} else if ( isset($this->response->error) ) {
			return new WP_Error($this->response->error->code, $this->response->error->message, $this);
		} else {
			return new WP_Error('http_' . $this->httpCode, 'HTTP error ' . $this->httpCode, $this);
		}
	}
}