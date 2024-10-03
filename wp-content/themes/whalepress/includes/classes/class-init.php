<?php
/**
 * This file contains the Init class.
 *
 * @package DokPress
 * @since   1.0.0
 */

namespace WhalePressTheme;

/**
 * Init class.
 *
 * This class is used to initialize the theme. For example, it is used to enqueue scripts and styles.
 *
 * @package DokPress
 */
class Init {

	/**
	 * Construct
	 *
	 * Add hooks for theme initialization.
	 */
	public function __construct() {
		add_action( 'wp_enqueue_scripts', array( $this, 'dokpress_enqueue_scripts' ) );
		add_action( 'init', array( $this, 'dokpress_register_menus' ) );
	}

	/**
	 * Enqueue theme assets.
	 *
	 * @return void
	 */
	public function dokpress_enqueue_scripts(): void {
		$theme = wp_get_theme();

		wp_enqueue_style( 'dokpress-styles', $this->dokpress_asset( 'style-index.css' ), __return_empty_array(), $theme->get( 'Version' ) ); // Theme styles.
		wp_enqueue_script( 'dokpress-scripts', $this->dokpress_asset( 'index.js' ), __return_empty_array(), $theme->get( 'Version' ), true ); // Theme scripts.
	}

	/**
	 * Register Menus.
	 *
	 * @return void
	 */
	public function dokpress_register_menus(): void {
		register_nav_menu( 'main-menu', __( 'Main Menu' ) );
	}

	/**
	 * Get asset path.
	 *
	 * @param  string $path Path to asset.
	 * @return string
	 */
	protected function dokpress_asset( $path ) {
		if ( wp_get_environment_type() === 'production' ) {
			return get_stylesheet_directory_uri() . '/public/build/' . $path;
		}

		return add_query_arg( 'time', time(), get_stylesheet_directory_uri() . '/public/build/' . $path );
	}
}

new Init();
