<?php
/**
 * This file pulls in all the depancies for the theme.
 *
 * @package TimberPress
 */

/**
 * Require the Composer autoloader.
 */
require_once __DIR__ . '/inc/vendor/autoload.php';

/**
 * Require theme classes.
 */
require_once get_template_directory() . '/inc/functions/class-timberpress.php';
require_once get_template_directory() . '/inc/functions/class-init.php';
