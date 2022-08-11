<?php

function base_dir($type = null) {
    if ($type == null) {
        return get_template_directory_uri();
    } else {
        return get_template_directory_uri() . '/assets/dist/' . $type;
    }
}

//Strip HTML and then limit a string
function base_strip_and_limit($in, $length) {

    $input = wp_strip_all_tags($in);
    if (strlen($input) <= $length) {
        return $input;
    }
    $last_space = strrpos(substr($input, 0, $length), ' ');
    $trimmed_text = substr($input, 0, $last_space);
    $trimmed_text .= '...';

    return $trimmed_text;
}

//Return a ready to go html image element
function base_image($image, $classes = null) {
    if ($classes) {
        $classes = ' ' . $classes;
    }
    if (\strpos($classes, 'b-lazy') !== false) {
        ?>    
        <img src="data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==" data-src="<?= base_image_url($image, null) ?>" alt="<?= base_image_alt($image) ?>" width="<?= base_image_width($image) ?>" height="<?= base_image_height($image) ?>" class="img-fluid<?= $classes ?>">
    <?php } else { ?>
        <img src="<?= base_image_url($image, null) ?>" alt="<?= base_image_alt($image) ?>" width="<?= base_image_width($image) ?>" height="<?= base_image_height($image) ?>" class="img-fluid<?= $classes ?>">
        <?php
    }
}

// Return the alt tag for an image
function base_image_alt($image) {

    $alt = '';
    if ($image['alt'] != null) {
        $alt = $image['alt'];
    } else if ($image['title'] != null) {
        $alt = $image['title'];
    } else {
        $alt = get_the_title();
    }
    return $alt;
}

//Return the image object URL
function base_image_url($image, $size) {
    if ($size == 'url' || $size == null) {
        return $image['url'];
    } else {
        return $image['sizes'][$size];
    }
}

//Return image width
function base_image_width($image) {

    return $image['width'];
}

//Return image height
function base_image_height($image) {

    return $image['height'];
}

//Add the Site Owner Role
add_filter('admin_init', 'base_add_site_owner');

function base_add_site_owner() {
    global $wp_roles;

    //remove_role( 'site_owner' ); // uncomment this to reset the site owner role to admin caps

    $roles = $wp_roles->get_names();
    if (!isset($roles['site_owner'])) {
        $admin_role = get_role('administrator');
        add_role('site_owner', 'Site Owner', $admin_role->capabilities);
    }
}

//Move Yoast to the bottom
function base_yoast_to_bottom() {
    return 'low';
}

add_filter('wpseo_metabox_prio', 'base_yoast_to_bottom');


//Ensure email is sent as HTML
function base_mail_content_type() {
    return "text/html";
}

add_filter('wp_mail_content_type', 'base_mail_content_type');
