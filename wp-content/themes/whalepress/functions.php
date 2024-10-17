<?php
/**
 * This file pulls in all the depancies for the theme.
 *
 * @package WhalePress
 * @since   1.0.0
 */

/**
 * Require the Composer autoloader.
 */
require_once __DIR__ . '/includes/vendor/autoload.php';

/**
 * Require theme interfaces and classes.
 */

require_once get_template_directory() . '/includes/classes/class-theme.php'; // Theme.
require_once get_template_directory() . '/includes/classes/class-init.php'; // Init.
