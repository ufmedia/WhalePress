<?php

class Init
{

    /**
     * __construct
     *
     * @return void
     */
    public function __construct()
    {
        add_action('wp_enqueue_scripts', array($this, 'timberpress_enqueue_scripts'));
        add_action('init', array($this, 'timberpress_register_menus'));
    }

    /**
     * Enqueue theme assets.
     */
    public function timberpress_enqueue_scripts()
    {
        $theme = wp_get_theme();

        wp_enqueue_style('google-fonts', 'https://fonts.googleapis.com/css2?family=Inter:wght@400;700&display=swap', null, null);
        wp_enqueue_script('jquery', null, null, null, true);
        wp_enqueue_style('timberpress-styles', $this->timberpress_asset('style-index.css'), null, null);
        wp_enqueue_script('timberpress-scripts', $this->timberpress_asset('index.js'), array('jquery'), $theme->get('Version'), false);
        wp_localize_script('timberpress-scripts', 'timberpressAjax', array('ajaxurl' => admin_url('admin-ajax.php'), 'nonce' => wp_create_nonce('ajax-nonce')));
    }

    /**
     * Get asset path.
     *
     * @param string  $path Path to asset.
     *
     * @return string
     */
    public function timberpress_asset($path)
    {
        if (wp_get_environment_type() === 'production') {
            return get_stylesheet_directory_uri() . '/public/build/' . $path;
        }

        return add_query_arg('time', time(),  get_stylesheet_directory_uri() . '/public/build/' . $path);
    }

    public function timberpress_register_menus()
    {
        register_nav_menu('main-menu', __('Main Menu'));
    }
}

new Init();
