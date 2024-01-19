<?php
/**
 *
 * This file contains the TimberPress interface.
 *
 * @package TimberPress
 */

namespace TimberPressTheme;

/**
 * Init interface.
 */
interface TimberPressInterface {

	/**
	 * Add to global context.
	 *
	 * @param array $context context['this'] Being the Twig's {{ this }}.
	 * @return void
	 */
	public function add_to_context( $context );

	/**
	 * Declare theme supports.
	 *
	 * @return void
	 */
	public function theme_supports();

	/**
	 * Add to any new functions to Twig.
	 *
	 * @param Twig_Environment $twig The Twig environment.
	 * @return void
	 */
	public function add_to_twig( $twig );
}
