<?php


/**
 * Enqueue theme assets.
 */
function horizon_enqueue_scripts() {
	$theme = wp_get_theme();

	wp_enqueue_style( 'horizon', horizon_asset( 'css/app.css' ), array(), $theme->get( 'Version' ) );
	wp_enqueue_script( 'horizon', horizon_asset( 'js/app.js' ), array(), $theme->get( 'Version' ) );
}

add_action( 'wp_enqueue_scripts', 'horizon_enqueue_scripts' );

/**
 * Get asset path.
 *
 * @param string  $path Path to asset.
 *
 * @return string
 */
function horizon_asset( $path ) {
	if ( wp_get_environment_type() === 'production' ) {
		return get_stylesheet_directory_uri() . '/assets/dist/' . $path;
	}

	return add_query_arg( 'time', time(),  get_stylesheet_directory_uri() . '/assets/dist' . $path );
}