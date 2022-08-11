<?php

/* * ************************** ADMIN.PHP ****************************** */

remove_action('welcome_panel', 'wp_welcome_panel');

function horizon_admin_styles() {
    wp_register_style('horizon-admin-css', get_template_directory_uri() . '/includes/admin/css/admin-style.css');
    wp_enqueue_style('horizon-admin-css');
}

add_action('admin_enqueue_scripts', 'horizon_admin_styles');
add_action('login_enqueue_scripts', 'horizon_admin_styles');

function horizon_admin_login_logo() {
    echo '<style  type="text/css"> h1 a {  background-image:url(' . get_field("admin_&_email_logo", "option") . ') !important; background-size: 170px 170px !important; width: 201px !important; height: 201px !important; margin-bottom: -20px !important;} </style>';
}

add_action('login_head', 'horizon_admin_login_logo');

function horizon_admin_footer() {
    echo '<span id="footer-thankyou">' . get_field("footer_link", "option") . '</span>';
}

add_filter('admin_footer_text', 'horizon_admin_footer');

function horizon_admin_menu_logo() {
    $logopath = get_field("admin_&_email_logo", "option");
    $image = '<a href="#"><img src="' . $logopath . '" /></a>';
    add_menu_page("client-logo", $image, "edit_posts", "client-logo", "displayPage", null, 1);
}

add_action('admin_menu', 'horizon_admin_menu_logo');

function horizon_remove_admin_nodes($wp_admin_bar) {
    $updates_node = $wp_admin_bar->get_node('updates');
    if ($updates_node) {
        $wp_admin_bar->remove_node('updates');
    }
    $wp_admin_bar->remove_node('wp-logo');
    $wp_admin_bar->remove_node('comments');
    $wp_admin_bar->remove_node('new-content');
    $wp_admin_bar->remove_node('customize-themes');
    $wp_admin_bar->remove_node('customize');
    $wp_admin_bar->remove_node('search');
    $wp_admin_bar->remove_node('themes');
}
add_action('admin_bar_menu', 'horizon_remove_admin_nodes', 999);


function horizon_hide_admin_bar() {
    if (!current_user_can('edit_posts')) {
        show_admin_bar(false);
    }
}
add_action('set_current_user', 'horizon_hide_admin_bar');


function horizon_admin_hide_help() {
    echo '<style type="text/css">
            #contextual-help-link-wrap { display: none !important; }
          </style>';
}
add_action('admin_head', 'horizon_admin_hide_help');


function horizon_admin_remove_dashboard_meta() {
    remove_meta_box('dashboard_incoming_links', 'dashboard', 'normal');
    remove_meta_box('dashboard_plugins', 'dashboard', 'normal');
    remove_meta_box('rg_forms_dashboard', 'dashboard', 'normal');
    remove_meta_box('dashboard_primary', 'dashboard', 'side');
    remove_meta_box('dashboard_secondary', 'dashboard', 'normal');
    remove_meta_box('dashboard_quick_press', 'dashboard', 'side');
    remove_meta_box('dashboard_recent_drafts', 'dashboard', 'side');
    remove_meta_box('dashboard_recent_comments', 'dashboard', 'normal');
    remove_meta_box('dashboard_right_now', 'dashboard', 'normal');
    remove_meta_box('dashboard_activity', 'dashboard', 'normal'); //since 3.8
}
add_action('admin_init', 'horizon_admin_remove_dashboard_meta');


function horizon_admin_dash_name() {
    if ($GLOBALS['title'] != 'Dashboard') {
        return;
    }
    $GLOBALS['title'] = __('Welcome to the ' . get_bloginfo() . ' Dashboard');
}
add_action('admin_head', 'horizon_admin_dash_name');


function horizon_admin_hide_update_notice() {
    if (!current_user_can('update_core')) {
        remove_action('admin_notices', 'update_nag', 3);
    }
}
add_action('admin_head', 'horizon_admin_hide_update_notice', 1);

function horizon_admin_home_url() {
    return home_url();
}
add_filter('login_headerurl', 'horizon_admin_home_url');


