<?php
//Enqueue CSS
function ufm_enqueue_base_style() {
    wp_enqueue_style('base-styles', get_template_directory_uri() . '/style.css');
    //wp_enqueue_style('typekit-styles', 'https://use.typekit.net/lvk4mcl.css', array()); //Default is Horizon 4.0
}

//Enqueue JS
function ufm_enqueue_base_script() {
    wp_enqueue_script('jquery');
    wp_enqueue_script('site-bundle', get_stylesheet_directory_uri() . '/dist/bundle.js', array('jquery'));

    //if (get_field('captcha_secret', 'options') && get_field('captcha_public', 'options')) {
     //   wp_enqueue_script('captcha', 'https://www.google.com/recaptcha/api.js?render=' . get_field('captcha_public', 'options'), array()); 
    //}

    wp_localize_script('site-bundle', 'ajax_object', array('ajax_url' => admin_url('admin-ajax.php')));
}


add_action('wp_enqueue_scripts', 'ufm_enqueue_base_style');
add_action('wp_enqueue_scripts', 'ufm_enqueue_base_script');

function ufm_register_base_menu() {
    register_nav_menu('main-menu', __('Main Menu'));
}

add_action('init', 'ufm_register_base_menu');

//Limit Blocks!
add_filter('allowed_block_types', 'ufm_allowed_block_types');

function ufm_allowed_block_types($allowed_blocks) {

    $blocks = array(
        'core/image',
        'core/paragraph',
        'core/heading',
        'core/list',
        'ufm/strap-block'
    );

    return $blocks;
}

//Limit Block Features
function ufm_disable_gutenberg_features() {
    add_theme_support('editor-color-palette');
    add_theme_support('disable-custom-colors');
    add_theme_support('disable-custom-font-sizes');
    add_theme_support('editor-font-sizes', array(
        array(
            'name' => 'Normal',
            'size' => 16,
            'slug' => 'normal'
        )
    ) );
}

add_action('after_setup_theme', 'ufm_disable_gutenberg_features');

//Declare wooCommerce Support
function ufm_add_woocommerce_support() {
    add_theme_support( 'woocommerce', array(
        'thumbnail_image_width' => 150,
        'single_image_width'    => 300,

        'product_grid'          => array(
            'default_rows'    => 3,
            'min_rows'        => 2,
            'max_rows'        => 8,
            'default_columns' => 4,
            'min_columns'     => 2,
            'max_columns'     => 5,
        ),
    ) );
}

add_action( 'after_setup_theme', 'ufm_add_woocommerce_support' );

add_filter('woocommerce_form_field_args',  'ufm_wc_form_control',10,3);
  function ufm_wc_form_control($args, $key, $value) {
  $args['input_class'] = array( 'form-control' );
  return $args;
}

add_filter( 'body_class','ufm_body_classes' );
function ufm_body_classes( $classes ) {
 
    if (!get_field('page_hero')){
        $classes[] = 'no-hero';
    }
    return $classes;
     
}