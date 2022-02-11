<?php

class Wslm_BasicPluginLicensingUI {
    const AUTO_LICENSE_CRON_ACTION = 'wslm_auto_activate_license-';
    const ACTIVATION_FAILURE_FLAG = 'wslm_auto_activation_failed-';

	private $licenseManager;
	/**
	 * @var Puc_v4p10_Plugin_UpdateChecker
	 */
	private $updateChecker;
	private $pluginFile;
	private $slug;
	private $requiredCapability = 'update_plugins';

	private $triedLicenseKey = null;
	/**
	 * @var Wslm_ProductLicense
	 */
	private $triedLicense = null;
	private $currentTab = 'current-license';
	private $tabs = array();

	private $keyConstant = null;
	private $maxAutoActivationAttempts = 8;

	/** @var bool Whether to display the site token (if any) in the licensing window. */
	protected $tokenDisplayEnabled = false;

	public function __construct(Wslm_LicenseManagerClient $licenseManager, $pluginFile, $updateChecker = null, $keyConstant = null) {
		$this->licenseManager = $licenseManager;
		$this->pluginFile = $pluginFile;
		$this->slug = $this->licenseManager->getProductSlug();
		$this->keyConstant = $keyConstant;
		$this->updateChecker = $updateChecker;

		$this->tabs = array(
			'current-license' => array(
				'caption' => 'Current License',
				'callback' => array($this, 'tabCurrentLicense'),
			),
			'manage-sites' => array(
				'caption' => 'Manage Sites',
				'callback' => array($this, 'tabManageSites'),
			),
		);

		//Turning on the DISALLOW_FILE_MODS constant disables the "update_plugins" capability,
		//so we need to use something else in that case.
		if ( defined('DISALLOW_FILE_MODS') && constant('DISALLOW_FILE_MODS') ) {
			if ( is_multisite() ) {
				$this->requiredCapability = 'manage_network_plugins';
			} else {
				$this->requiredCapability = 'activate_plugins';
			}
		}

		$basename = plugin_basename($this->pluginFile);
		add_filter(
			'plugin_action_links_' . $basename,
			array($this, 'addLicenseActionLink')
		);
		add_filter(
			'network_admin_plugin_action_links_' . $basename,
			array($this, 'addLicenseActionLink')
		);

		add_action('wp_ajax_' . $this->getAjaxActionName(), array($this, 'printUi'));

		add_action('after_plugin_row_' . $basename, array($this, 'printPluginRowNotice'), 10, 0);

		if ( isset($this->updateChecker) ) {
			add_filter('upgrader_pre_download', array($this, 'authorizePluginUpdate'), 10, 3);
		}

		add_action('all_admin_notices', array($this, 'autoActivateLicense'));
		add_action(self::AUTO_LICENSE_CRON_ACTION . $this->slug, array($this, 'autoActivateLicense'));
		add_action('wslm_license_activated-' . $this->slug, array($this, 'clearActivationFailureFlag'), 10, 0);
	}

	public function addLicenseActionLink($links) {
		if ( $this->currentUserCanManageLicense() ) {
			$links['licenses'] = $this->makeLicenseLink();
		}
		return $links;
	}

	private function currentUserCanManageLicense() {
		return apply_filters(
			'wslm_current_user_can_manage_license-' . $this->slug,
			current_user_can($this->requiredCapability)
		);
	}

	private function makeLicenseLink($linkText = 'License') {
		return sprintf(
			'<a href="%s" class="thickbox" title="%s">%s</a>',
			esc_attr(add_query_arg(
				array( 'TB_iframe' => true, ),
				$this->getLicensingPageUrl()
			)),
			esc_attr($this->getPageTitle()),
			apply_filters('wslm_action_link_text-' . $this->slug, $linkText)
		);
	}

	private function getLicensingPageUrl() {
		$url = add_query_arg(
			array(
		        'action'   => $this->getAjaxActionName(),
		        '_wpnonce' => wp_create_nonce('show_license'), //Assumes the default license action = "show_license".
			),
			admin_url('admin-ajax.php')
		);
		return $url;
	}

	private function getAjaxActionName() {
		return 'show_license_ui-' . $this->slug;
	}

	private function getPageTitle() {
		return apply_filters('wslm_license_ui_title-' . $this->slug, 'Manage Licenses');
	}

	public function printUi() {
		if ( !$this->currentUserCanManageLicense() ) {
			wp_die("You don't have sufficient permissions to manage licenses for this product.");
		}

		$action = isset($_REQUEST['license_action']) ? strval($_REQUEST['license_action']) : '';
		if ( empty($action) ) {
			$action = 'show_license';
		}
		check_admin_referer($action);

		$this->triedLicenseKey = isset($_POST['license_key']) ? trim(strval($_POST['license_key'])) : $this->licenseManager->getLicenseKey();

		if ( isset($_REQUEST['tab']) && is_string($_REQUEST['tab']) && array_key_exists($_REQUEST['tab'], $this->tabs) ) {
			$this->currentTab = $_REQUEST['tab'];
		}

		//We run some core hooks later to load admin CSS and other dependencies. Some plugins that
		//use those hooks will crash if they encounter a "fake" admin page without a screen object,
		//causing the license page to be blank. Lets set up a screen to avoid that.
		set_current_screen('wslm-' . $this->slug . '-licensing_ui');

		$this->printHeader();
		$this->dispatchAction($action);
		$this->printLogo();
		$this->printTabList();
		?>
		<div class="wrap" id="wslm-section-holder">
			<?php
			foreach($this->tabs as $id => $tab) {
				printf(
					'<div id="section-%1$s" class="wslm-section%2$s">',
					esc_attr($id),
					($this->currentTab !== $id) ? ' hidden' : ''
				);
				call_user_func($tab['callback']);
				echo '</div>';
			}
			?>
		</div> <!-- #wslm-section-holder -->
		<?php

		exit();
	}

	private function dispatchAction($action) {
		do_action('wslm_ui_action-' . $action . '-' . $this->slug);
		$method = 'action' . str_replace(' ', '', ucwords(str_replace('_', ' ', $action)));
		if ( method_exists($this, $method) ) {
			$this->$method();
		} else {
			$this->printNotice(
				sprintf('Unknown action "%s"', htmlentities($action)),
				'error'
			);
		}
	}

	/** @noinspection PhpUnusedPrivateMethodInspection Used by dispatchAction(). */
	private function actionShowLicense() {
		//Don't need to do anything special in this case, I think.
		//Maybe request the site list if we have a license key.
		$this->licenseManager->checkForLicenseUpdates();
		$this->triedLicenseKey = $this->licenseManager->getLicenseKey();
		$this->triedLicense = $this->licenseManager->getLicense();
	}

	/** @noinspection PhpUnusedPrivateMethodInspection Used by dispatchAction(). */
	private function actionLicenseThisSite() {
		if ( empty($this->triedLicenseKey) ) {
			$this->printNotice('The license key must not be empty.', 'error');
			return;
		}
		$result = $this->licenseManager->licenseThisSite($this->triedLicenseKey);
		if ( is_wp_error($result) ) {
			$this->printError($result);
		} else {
			$this->printNotice('Success! This site is now licensed.');

			//Print any notices or warnings, like "you can't receive updates, please renew".
			if ( isset($result['notice']) ) {
				$this->printNotice($result['notice']['message'], $result['notice']['class']);
			}
		}
	}

	/** @noinspection PhpUnusedPrivateMethodInspection Used by dispatchAction(). */
	private function actionUnlicenseThisSite() {
		$result = $this->licenseManager->unlicenseThisSite();
		if ( is_wp_error($result) ) {
			$this->printError($result);
		} else {
			$this->printNotice('Success! The existing license has been removed from this site.');
		}
	}

	/** @noinspection PhpUnusedPrivateMethodInspection Used by dispatchAction(). */
	private function actionUnlicenseOtherSite() {
		$this->currentTab = 'manage-sites';

		$siteUrl = isset($_POST['site_url']) ? strval($_POST['site_url']) : '';
		if ( empty($siteUrl) || empty($this->triedLicenseKey) ) {
			$this->printNotice('Please specify both the site URL and license key.', 'error');
			return;
		}

		$result = $this->licenseManager->unlicenseSite($siteUrl, $this->triedLicenseKey);
		if ( is_wp_error($result) ) {
			$this->printError($result);
			$this->triedLicense = $result->get_error_data('license');
		} else {
			$this->printNotice(
				'Success! This license key is no longer associated with ' . htmlentities($siteUrl)
			);
			$this->triedLicense = $result;
		}
	}

	/** @noinspection PhpUnusedPrivateMethodInspection Used by dispatchAction(). */
	private function actionShowLicensedSites() {
		$this->currentTab = 'manage-sites';
		if ( empty($this->triedLicenseKey) ) {
			$this->printNotice('License key must not be empty.', 'error');
			return;
		}

		$result = $this->licenseManager->requestLicenseDetails($this->triedLicenseKey);
		if ( is_wp_error($result) ) {
			$this->printError($result);
		} else {
			$this->triedLicense = $result;
		}
	}

	/** @noinspection PhpUnusedPrivateMethodInspection */
	private function tabCurrentLicense() {
		//Display license information
		$currentLicense = $this->licenseManager->getLicense();
		echo '<h3>Current License</h3>';

		if ( $currentLicense->isValid() ) {
			if ( !$currentLicense->canReceiveProductUpdates() ) {
				$this->printLicenseDetails(
					'Valid License (updates disabled)',
					'This site is currently licensed. However, your access to updates and support has expired.
					 Please consider renewing your license.',
					$currentLicense
				);
			} else {
				$this->printLicenseDetails(
					'Valid License',
					'This site is currently licensed and qualifies for automatic upgrades &amp; support for this product.
				     If you no longer wish to use this product on this site you can remove the license.',
					$currentLicense
				);
			}

			?>
			<form method="post" action="<?php echo esc_attr($this->getLicensingPageUrl()); ?>">
				<input type="hidden" name="license_action" value="unlicense_this_site" />
				<?php wp_nonce_field('unlicense_this_site'); ?>
				<?php submit_button('Remove License', 'secondary', 'submit', false); ?>
			</form>
			<?php
			$this->printLicenseKeyForm(
				'Change License Key',
				'Want to use a different license key? Enter it below.',
				'Change Key',
				'secondary'
			);
		} else {
			if ( $currentLicense->getStatus() === 'no_license_yet' ) {
				$this->printLicenseDetails(
					'No License Yet',
					'This site is currently not licensed. Please enter your license key below.'
				);
				$this->printLicenseKeyForm();
			} else {
				$this->printLicenseDetails(
					'Invalid license (' . htmlentities($currentLicense->getStatus()) . ')',
					'The current license is not valid. Please enter a valid license key below.',
					$currentLicense
				);
				$this->printLicenseKeyForm();
			}
		}
	}

	/**
	 * @param string $status
	 * @param string $message
	 * @param Wslm_ProductLicense $currentLicense
	 */
	private function printLicenseDetails($status, $message = '', $currentLicense = null) {
		$currentKey = $this->licenseManager->getLicenseKey();
		$currentToken = $this->licenseManager->getSiteToken();
		?>
		<p>
			<span class="license-status">
				<label>Status:</label> <?php echo $status; ?>
			</span>
		</p>

		<?php
		if ( !empty($currentKey) ) {
			?><p><label>License key:</label> <?php echo htmlentities($currentKey); ?></p><?php
		}
		if ( !empty($currentToken) && $this->tokenDisplayEnabled ) {
			?><p><label>Site token:</label> <?php echo htmlentities($currentToken); ?></p><?php
		}

		$expiresOn = isset($currentLicense) ? $currentLicense->get('expires_on') : null;
		if ( $expiresOn ) {
			$formattedDate = date_i18n(get_option('date_format'), strtotime($expiresOn));
			?><p>
				<label>Expires:</label>
				<span title="<?php echo esc_attr($expiresOn); ?>"><?php echo $formattedDate ?></span>
			  </p>
			<?php
		}

		do_action('wslm_license_ui_details-' . $this->slug, $currentKey, $currentToken, $currentLicense);

		if ( !empty($message) ) {
			echo '<p>', $message, '</p>';
		}
	}

	/** @noinspection PhpUnusedPrivateMethodInspection */
	private function tabManageSites() {
		if ( isset($this->triedLicense, $this->triedLicense->sites) ) {

			?>
			<h3>Sites Associated With License Key "<?php echo htmlentities($this->triedLicenseKey); ?>"</h3>
			<?php
			if ( !empty($this->triedLicense->sites) ):
			?>
			<table class="widefat">
				<?php foreach($this->triedLicense->sites as $site): ?>
				<tr>
					<td>
						<?php echo htmlentities($site->site_url); ?><br>
						Token: <?php echo htmlentities($site->token); ?>
					</td>
					<td style="vertical-align: middle; width: 11em;">
						<form method="post" action="<?php echo esc_attr($this->getLicensingPageUrl()); ?>">
							<input type="hidden" name="site_url" value="<?php echo esc_attr($site->site_url); ?>" />
							<input type="hidden" name="license_key" value="<?php echo esc_attr($this->triedLicenseKey); ?>" />
							<input type="hidden" name="license_action" value="unlicense_other_site" />
							<?php wp_nonce_field('unlicense_other_site'); ?>
							<?php submit_button('Remove License', 'secondary', 'submit', false); ?>
						</form>
					</td>
				</tr>
				<?php endforeach; ?>
			</table>
			<?php
			else:
			?>
				There are currently no sites using this license key.
			<?php
			endif;

		} else {
			$this->printLicenseKeyForm(
				'',
				'To view sites currently associated with a license, enter your license key below.',
				'Show Licensed Sites',
				'primary',
				'show_licensed_sites'
			);
		}
	}

	private function printLicenseKeyForm(
		$formCaption = 'Enter a License Key',
		$formDescription = '',
		$buttonTitle = 'Activate Key',
		$buttonType = 'primary',
		$licenseAction = 'license_this_site'
	) {
		?>
		<h3><?php echo $formCaption; ?></h3>
		<?php
		if ( !empty($formDescription) ) {
			echo '<p>', $formDescription, '</p>';
		}
		?>
		<form method="post" action="<?php echo esc_attr($this->getLicensingPageUrl()); ?>">
			<input type="hidden" name="license_action" value="<?php echo esc_attr($licenseAction); ?>" />
			<?php wp_nonce_field($licenseAction); ?>
			<!--suppress HtmlFormInputWithoutLabel -->
			<input type="text" name="license_key" size="36" />
			<?php submit_button($buttonTitle, $buttonType, 'submit', false); ?>
		</form>
		<?php
	}

	private function printError(WP_Error $error) {
		foreach ($error->get_error_codes() as $code) {
			foreach ($error->get_error_messages($code) as $message) {
				if ( !empty($message) ) {
					$this->printNotice(
						$message . "\n<br>Error code: <code>" . htmlentities($code) . '</code>',
						'error'
					);
				}
			}
		}
	}

	private function printNotice($message, $class = 'updated') {
		printf('<div class="notice %s"><p>%s</p></div>', esc_attr($class), $message);
	}

	private function printHeader() {
		?>
		<!DOCTYPE html>
		<!--[if IE 8]>
		<html xmlns="http://www.w3.org/1999/xhtml" class="ie8" <?php do_action('admin_xml_ns'); ?> <?php language_attributes(); ?>>
		<![endif]-->
		<!--[if !(IE 8) ]><!-->
		<html xmlns="http://www.w3.org/1999/xhtml" <?php do_action('admin_xml_ns'); ?> <?php language_attributes(); ?>>
		<!--<![endif]-->
		<head>
			<meta http-equiv="Content-Type" content="<?php
				bloginfo('html_type');
				echo '; charset', '=' , get_option('blog_charset');
			?>" />
			<title><?php echo esc_html($this->getPageTitle()); ?></title>
			<?php
				wp_admin_css( 'global' );
				wp_admin_css( 'admin' );
				wp_admin_css();
				wp_admin_css( 'colors' );

				wp_enqueue_style(
					'wslm-basic-ui',
					plugins_url('/ui.css', __FILE__),
					array(),
					'20160619'
				);
				wp_enqueue_script('jquery');

				do_action('admin_print_styles');
				do_action('admin_print_scripts');
				do_action('admin_head');
			?>
		</head>
		<body class="wp-admin wp-core-ui iframe no-js" id="licensing-information">
		<script type="text/javascript">
		//<![CDATA[
		(function(){
			var c = document.body.className;
			c = c.replace(/no-js/, 'js');
			document.body.className = c;
		})();
		//]]>
		</script>
		<?php
	}

	private function printLogo() {
		//Logo (optional)
		echo '<div id="wslm-product-logo">';
		do_action('wslm_license_ui_logo-' . $this->slug);
		echo '</div>';
	}

	private function printTabList() {
		?>
		<div id="plugin-information-header">
			<ul id="sidemenu">
				<?php
				$baseTabUrl = remove_query_arg('tab');
				foreach($this->tabs as $name => $tab) {
					printf(
						'<li><a name="%s" href="%s"%s>%s</a></li>',
						esc_attr($name),
						esc_attr(add_query_arg('tab', $name, $baseTabUrl)),
						($name === $this->currentTab) ? ' class="current"' : '',
						$tab['caption']
					);
				}
				?>
			</ul>
		</div>

		<script type="text/javascript">
			jQuery(function($) {
				var tabSelector = jQuery('#sidemenu');

				function selectTab(tab) {
					//Flip the tab
					tabSelector.find('a.current').removeClass('current');
					tabSelector.find('a[name="' + tab + '"]').addClass('current');
					//Flip the content.
					$('#wslm-section-holder').find('div.wslm-section').hide(); //Hide 'em all
					$('#section-' + tab).show();
				}

				selectTab('<?php echo esc_js($this->currentTab); ?>');
				tabSelector.find('a').click( function() {
					var tab = $(this).attr('name');
					selectTab(tab);
					return false;
				});
			});
		</script>
		<?php
	}

	public function printPluginRowNotice() {
		//If there's anything wrong with the plugin's license, output a notice under the plugin row in "Plugins".
		$license = $this->licenseManager->getLicense();
		if ( !$this->currentUserCanManageLicense() || ($license->getStatus() === 'valid') ) {
			return;
		}

		$renewalUrl = $license->get('renewal_url');

		$messages = array(
			'no_license_yet' => "License is not set yet. Please enter your license key to enable automatic updates.",
			'expired' => sprintf(
				'Your access to updates has expired. You can continue using the plugin, but you\'ll need to %1$srenew your license%2$s to receive updates and bug fixes.',
				$renewalUrl ? '<a href="' . esc_attr($renewalUrl) . '">' : '',
				$renewalUrl ? '</a>' : ''
			),
			'not_found' => 'The current license key or site token is invalid.',
			'wrong_site' => 'Please re-enter your license key. This is necessary because the site URL has changed.',
		);
		$status = $license->getStatus();
		$notice = isset($messages[$status]) ? $messages[$status] : 'The current license is invalid.';

		$licenseLink = $this->makeLicenseLink(apply_filters(
			'wslm_plugin_row_link_text-' . $this->slug,
			'Enter License Key'
		));
		$showLicenseLink = ($status !== 'expired');

		//WP 4.6+ uses different styles for the update row. We use an inverted condition here because some buggy
		//plugins overwrite $wp_version. This way the default is to assume it's WP 4.6 or higher.
		$isWP46orHigher = !(isset($GLOBALS['wp_version']) && version_compare($GLOBALS['wp_version'], '4.5.9', '<='));

		$messageClasses = array('update-message');
		if ( $isWP46orHigher ) {
			$messageClasses = array_merge($messageClasses, array('notice',  'inline', 'notice-warning', 'notice-alt'));
		}

		?>
		<tr class="plugin-update-tr">
			<td class="plugin-update colspanchange" colspan="3">
				<div class="<?php echo esc_attr(implode(' ', $messageClasses)); ?>">
					<?php
						if ( $isWP46orHigher ) {
							echo '<p>';
						}

						if ( $showLicenseLink ) {
							echo $licenseLink, ' | ';
						}
						echo $notice;

						if ( $isWP46orHigher ) {
							echo '</p>';
						}
					?>
				</div>
			</td>
		</tr>
		<?php
	}


	/**
	 * Abort update if the user doesn't have a valid key or the key has expired (not eligible for updates).
	 *
	 * @param bool|WP_Error $result
	 * @param string $package Update download URL. Typically points to a .zip file.
	 * @param WP_Upgrader $upgrader
	 * @return bool|WP_Error
	 */
	function authorizePluginUpdate(
		$result,
		/** @noinspection PhpUnusedParameterInspection */ $package,
		$upgrader
	) {
		//Sanity check.
		if ( !isset($upgrader, $upgrader->skin) ) {
			return $result;
		}

		$license = $this->licenseManager->getLicense();
		if ( $license->canReceiveProductUpdates() || !$this->updateChecker->isPluginBeingUpgraded($upgrader) ) {
			return $result;
		}

		if ( $license->getStatus() === 'expired' ) {
			//Reload the license in case the user just renewed and is retrying the update.
			$this->licenseManager->checkForLicenseUpdates();
			$license = $this->licenseManager->getLicense();
			if ( $license->canReceiveProductUpdates() ) {
				return $result;
			}
		}

		$status = $license->getStatus();
		$messages = array(
			'no_license_yet' => "Please enter your license key to enable plugin updates.",
			'expired' => sprintf(
				'Your access to %s updates has expired. Please renew your license.',
				apply_filters('wslm_product_name-' . $this->slug, $this->slug)
			)
		);

		$result = new WP_Error(
			'wslm_update_not_available',
			isset($messages[$status]) ? $messages[$status] : 'Update not available. Please (re)enter your license key.',
			'[' . $status . ']'
		);

		//This bit is important. At least in WP 4.3, the return value will be lost or replaced with a generic
		//"download failed" error unless you also set it on the upgrader skin.
		$upgrader->skin->set_result($result);

		return $result;
	}

	public function autoActivateLicense() {
	    $doingCron = defined('DOING_CRON') && DOING_CRON;
		if ( !$this->currentUserCanManageLicense() && !$doingCron ) {
			return;
		}

		$license = $this->licenseManager->getLicense();
		if ( $license->isValid() ) {
			return;
		}

		$failureFlag = self::ACTIVATION_FAILURE_FLAG . $this->slug;
		$state = get_site_option($failureFlag, null);
		if ( !is_array($state) || !isset($state['failures']) ) {
			$state = array(
				'failures' => $state ? 1 : 0,
                'lastAttemptTime' => 0,
			);
        }

		if ( ($state['failures'] > $this->maxAutoActivationAttempts) ) {
			return;
		}

		$elapsedTime = time() - $state['lastAttemptTime'];
		$desiredDelay = $this->calculateLicenseActivationDelay($state['failures']);
		if ( $elapsedTime < $desiredDelay ) {
		    return;
        }

		$state['failures']++;
		$state['lastAttemptTime'] = time();
		update_site_option($failureFlag, $state);

		$result = null;
		$tokenHistory = $this->licenseManager->getTokenHistory();
		if ( !empty($this->keyConstant) && defined($this->keyConstant) ) {
			//Attempt to activate the license key that's defined in wp-config.php.
			$result = $this->licenseManager->licenseThisSite(constant($this->keyConstant));
		} else if ( !empty($tokenHistory) ) {
			//Check if there's a known token that matches the current site URL. Try to activate that token.
			$possibleToken = array_search($this->licenseManager->getSiteUrl(), array_reverse($tokenHistory, true));
			if ( !empty($possibleToken) ) {
				$result = $this->licenseManager->licenseThisSiteByToken($possibleToken);
			}
		}

		if ( is_wp_error($result) ) {
		    $productName = apply_filters('wslm_product_name-' . $this->slug, $this->slug);
		    if ( is_admin() && !$doingCron ) {
			    printf(
				    '<div class="error">
                        <p>
                            %1$s tried to automatically activate your license, but it didn\'t work.<br/>
                            Error: <code>%2$s [%3$s]</code>
                        </p>
                        <p>Please go to the <a href="%4$s">Plugins</a> page and enter your license key.</p>
                    </div>',
				    $productName,
				    $result->get_error_message(),
				    $result->get_error_code(),
				    is_multisite() ? network_admin_url('plugins.php') : admin_url('plugins.php')
			    );
		    }

			$plainError = sprintf(
				'%1$s failed to automatically activate a license. Error: %2$s [%3$s]',
				$productName,
				$result->get_error_message(),
				$result->get_error_code()
			);
		    error_log($plainError);

			//Try again later, but only if we have a license key.
			if (
				($state['failures'] < $this->maxAutoActivationAttempts)
				&& !empty($this->keyConstant)
				&& defined($this->keyConstant)
			) {
				wp_schedule_single_event(
					time() + $this->calculateLicenseActivationDelay($state['failures']) + 1,
					self::AUTO_LICENSE_CRON_ACTION . $this->slug,
                    array($state['failures'] + 1)
				);
			}
		} else if ( $result instanceof Wslm_ProductLicense ) {
			//Success! Don't output anything, just proceed as normal.
			$this->clearActivationFailureFlag();
		}
	}

	/**
     * Calculate the minimum delay after the Nth automatic license
     * activation attempt.
     *
	 * @param int $attempt
	 * @return float|int Delay in seconds.
	 */
	private function calculateLicenseActivationDelay($attempt) {
		if ( $attempt < 1 ) {
			return 0;
		}

	    $minDelay = 20;
	    $maxDelay = 600;
	    $growthLimit = 4; //Stop increasing the delay after this many attempts.

        $fraction = (min($attempt - 1, $growthLimit) / ($growthLimit));

		$desiredDelay = $minDelay + round(($maxDelay - $minDelay) * $fraction);
		if ( $desiredDelay < $minDelay ) {
		    $desiredDelay = $minDelay;
        }
		return $desiredDelay;
	}

	public function clearActivationFailureFlag() {
	    delete_site_option(self::ACTIVATION_FAILURE_FLAG . $this->slug);
	}
}