<?php
/**
 *
 * This file contains the Init interface.
 *
 * @package TimberPress
 */

namespace TimberPressTheme;

/**
 * Init interface.
 */
interface InitInterface {

	/**
	 * Enqueue theme assets.
	 *
	 * @return void
	 */
	public function timberpress_enqueue_scripts();

	/**
	 * Register Menus.
	 *
	 * @return void
	 */
	public function timberpress_register_menus();
}
