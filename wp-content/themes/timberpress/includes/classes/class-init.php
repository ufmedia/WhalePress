<?php
/**
 *
 * This file contains the Init class.
 *
 * @package TimberPress
 */

namespace TimberPressTheme;

/**
 * Init class.
 *
 * This class is used to initialize the theme. For example, it is used to enqueue scripts and styles.
 *
 * @package TimberPress
 */
class Init {


	/**
	 * Construct
	 *
	 * Add hooks for theme initialization.
	 *
	 * @return void
	 */
	public function __construct() : void {
		add_action( 'wp_enqueue_scripts', array( $this, 'timberpress_enqueue_scripts' ) );
		add_action( 'init', array( $this, 'timberpress_register_menus' ) );
	}

	/**
	 * Enqueue theme assets.
  	 * 
    	 * @return void
	 */
	public function timberpress_enqueue_scripts() : void {
		$theme = wp_get_theme();

		wp_enqueue_style( 'google-fonts', 'https://fonts.googleapis.com/css2?family=Inter:wght@400;700&display=swap', null, null ); // Google Fonts.
		wp_enqueue_script( 'jquery', null, null, null, true ); // jQuery.
		wp_enqueue_style( 'timberpress-styles', $this->timberpress_asset( 'style-index.css' ), null, $theme->get( 'Version' ) ); // Theme styles.
		wp_enqueue_script( 'timberpress-scripts', $this->timberpress_asset( 'index.js' ), array( 'jquery' ), $theme->get( 'Version' ), false ); // Theme scripts.
	}

	/**
	 * Register Menus.
  	 * 
         * @return void
	 */
	public function timberpress_register_menus() : void {
		register_nav_menu( 'main-menu', __( 'Main Menu' ) );
	}

	/**
	 * Get asset path.
	 *
	 * @param string $path Path to asset.
	 * @return string
	 */
	protected function timberpress_asset( $path ) {
		if ( wp_get_environment_type() === 'production' ) {
			return get_stylesheet_directory_uri() . '/public/build/' . $path;
		}

		return add_query_arg( 'time', time(), get_stylesheet_directory_uri() . '/public/build/' . $path );
	}
}

new Init();
