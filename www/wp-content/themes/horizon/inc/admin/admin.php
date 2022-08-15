<?php

/* * ************************** ADMIN.PHP ****************************** */


// Remove default WP Welcome panel
remove_action('welcome_panel', 'wp_welcome_panel');


//Enqueue custom admin styles
function horizon_admin_styles()
{
    wp_register_style('horizon-admin-css', get_template_directory_uri() . '/inc/admin/css/admin-style.css');
    wp_enqueue_style('horizon-admin-css');
}

add_action('admin_enqueue_scripts', 'horizon_admin_styles');
add_action('login_enqueue_scripts', 'horizon_admin_styles');


//Change the default login logo to site logo
function horizon_admin_login_logo()
{
    if (has_custom_logo()) {
        $custom_logo_url = wp_get_attachment_image_url(get_theme_mod('custom_logo'), 'full');

        echo '<style  type="text/css"> h1 a {  background-image:url(' . $custom_logo_url . ') !important; background-size: 170px 170px !important; width: 201px !important; height: 201px !important; margin-bottom: -20px !important;} </style>';
    }
}

add_action('login_head', 'horizon_admin_login_logo');


//Add site logo to wp admin menu
function horizon_admin_menu_logo()
{

    if (has_custom_logo()) {

        $custom_logo_url = wp_get_attachment_image_url(get_theme_mod('custom_logo'), 'full');

        $image = '<a href="#"><img src="' . $custom_logo_url . '" style="max-width:100%"/></a>';
        add_menu_page("client-logo", $image, "edit_posts", "client-logo", "displayPage", null, 1);
    }
}

add_action('admin_menu', 'horizon_admin_menu_logo');


//Remove various unused nodes from WP admin bar
function horizon_remove_admin_nodes($wp_admin_bar)
{
    $updates_node = $wp_admin_bar->get_node('updates');
    if ($updates_node) {
        $wp_admin_bar->remove_node('updates');
    }
    $wp_admin_bar->remove_node('wp-logo');
    $wp_admin_bar->remove_node('comments');
    //$wp_admin_bar->remove_node('new-content');
    //$wp_admin_bar->remove_node('customize-themes');
    //$wp_admin_bar->remove_node('customize');
    //$wp_admin_bar->remove_node('search');
    //$wp_admin_bar->remove_node('themes');
}
add_action('admin_bar_menu', 'horizon_remove_admin_nodes', 999);


//Remove unused/messy admin dashboard options
function horizon_admin_remove_dashboard_meta()
{
    remove_meta_box('dashboard_incoming_links', 'dashboard', 'normal');
    remove_meta_box('dashboard_plugins', 'dashboard', 'normal');
    remove_meta_box('rg_forms_dashboard', 'dashboard', 'normal');
    remove_meta_box('dashboard_primary', 'dashboard', 'side');
    remove_meta_box('dashboard_secondary', 'dashboard', 'normal');
    remove_meta_box('dashboard_quick_press', 'dashboard', 'side');
    remove_meta_box('dashboard_recent_drafts', 'dashboard', 'side');
    remove_meta_box('dashboard_recent_comments', 'dashboard', 'normal');
    remove_meta_box('dashboard_right_now', 'dashboard', 'normal');
    remove_meta_box('dashboard_site_health', 'dashboard', 'normal');
    remove_meta_box('dashboard_activity', 'dashboard', 'normal');
}
add_action('admin_init', 'horizon_admin_remove_dashboard_meta');


//Add site name to dashboard welcome
function horizon_admin_dash_name()
{
    if ($GLOBALS['title'] != 'Dashboard') {
        return;
    }
    $GLOBALS['title'] = __('Welcome to the ' . get_bloginfo() . ' Dashboard');
}
add_action('admin_head', 'horizon_admin_dash_name');


//Hide update notices from non-admin users.
function horizon_admin_hide_update_notice()
{
    if (!current_user_can('update_core')) {
        remove_action('admin_notices', 'update_nag', 3);
    }
}
add_action('admin_head', 'horizon_admin_hide_update_notice', 1);

function horizon_admin_home_url()
{
    return home_url();
}
add_filter('login_headerurl', 'horizon_admin_home_url');


// Remove/edit admin footer notice
function horizon_footer_admin()
{
    echo '';
}

add_filter('admin_footer_text', 'horizon_footer_admin');


//Remove additional css option from site customiser.
function horizon_remove_css_section($wp_customize)
{
    $wp_customize->remove_section('custom_css');
}
add_action('customize_register', 'horizon_remove_css_section', 15);
