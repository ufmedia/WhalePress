<?php
/**
 *
 * This file contains the Timber class.
 *
 * @package TimberPress
 */

namespace TimberPressTheme;

use Timber\Site;
use Timber;

/**
 * TimberPress class.
 *
 * This class is used to initialize Timber (and Twig) along with the global context and custom functions.
 */
class TimberPress extends Site {

	/**
	 * Construct
	 *
	 * Add hooks for timber initialization.
	 */
	public function __construct() {
		add_filter( 'timber/context', array( $this, 'add_to_context' ), 10, 1 );
		add_action( 'after_setup_theme', array( $this, 'theme_supports' ), 10, 0 );
		add_filter( 'timber/twig', array( $this, 'add_to_twig' ), 10, 1 );
		parent::__construct();
	}


	/**
	 * Build global context.
	 *
	 * This is where you add global context available within the Twig templates.
	 *
	 * @param string $context context['this'] Being the Twig's {{ this }}.
	 */
	public function add_to_context( $context ) {
		$context['menu'] = Timber::get_menu( 'main-menu' );
		$context['site'] = $this;
		return $context;
	}

	/**
	 * Declare theme supports.
	 *
	 * @return void
	 */
	public function theme_supports(): void {
		// Add default posts and comments RSS feed links to head.
		add_theme_support( 'automatic-feed-links' );

		/*
		 * Let WordPress manage the document title.
		 * By adding theme support, we declare that this theme does not use a
		 * hard-coded <title> tag in the document head, and expect WordPress to
		 * provide it for us.
		 */
		add_theme_support( 'title-tag' );

		/*
		 * Enable support for Post Thumbnails on posts and pages.
		 *
		 * @link https://developer.wordpress.org/themes/functionality/featured-images-post-thumbnails/
		 */
		add_theme_support( 'post-thumbnails' );

		/*
		 * Switch default core markup for search form, comment form, and comments
		 * to output valid HTML5.
		 */
		add_theme_support(
			'html5',
			array(
				'comment-form',
				'comment-list',
				'gallery',
				'caption',
			)
		);

		/*
		 * Enable support for Post Formats.
		 *
		 * See: https://codex.wordpress.org/Post_Formats
		 */
		add_theme_support(
			'post-formats',
			array(
				'aside',
				'image',
				'video',
				'quote',
				'link',
				'gallery',
				'audio',
			)
		);

		add_theme_support( 'menus' );
	}

	/** This is where you can add your own functions to twig.
	 *
	 * @param array $twig get extension.
	 * @return array
	 */
	public function add_to_twig( $twig ) {

		return $twig;
	}
}

Timber\Timber::init();
Timber::$dirname = array( 'templates', 'views' );
new TimberPress();
