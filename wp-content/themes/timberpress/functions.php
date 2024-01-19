<?php
/**
 * This file pulls in all the depancies for the theme.
 *
 * @package TimberPress
 */

/**
 * Require the Composer autoloader.
 */
require_once __DIR__ . '/includes/vendor/autoload.php';

/**
 * Require theme interfaces and classes.
 */
require_once get_template_directory() . '/includes/interfaces/interface-timberpress.php'; // TimberPressInterface.
require_once get_template_directory() . '/includes/classes/class-timberpress.php'; // TimberPress.

require_once get_template_directory() . '/includes/interfaces/interface-init.php'; // InitInterface.
require_once get_template_directory() . '/includes/classes/class-init.php'; // Init.
