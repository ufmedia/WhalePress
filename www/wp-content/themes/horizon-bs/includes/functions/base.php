<?php

function base_dir($type = null) {
    if ($type == null) {
        return get_template_directory_uri();
    } else {
        return get_template_directory_uri() . '/dist/' . $type;
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

//Generate back link
function base_back_link($fallBack) {
    if ((isset($_SERVER['HTTP_REFERER']) && !empty($_SERVER['HTTP_REFERER']) && (strpos($_SERVER['HTTP_REFERER'], get_site_url()) === 0))) {
        $linkurl = html_entity_decode($_SERVER['HTTP_REFERER']);
    } else {
        $linkurl = get_permalink($fallBack);
    }
    return $linkurl;
}

//Generate back link title
function base_back_link_title($fallBack) {
    $title = null;

    //Let's assume this is a page/pt
    $titleID = url_to_postid(html_entity_decode($_SERVER['HTTP_REFERER']));
    if ($titleID != 0 && $titleID != get_the_ID()) {
        $title = get_the_title($titleID);
    }

    //If we still dont have a title, we should probably make something up
    if ($title == null) { //No tax, so let's assume page and return that.
        $title = get_the_title($fallBack);
    }

    return $title;
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

//Standard WP pagination with a twist to support native Bootstrap links
function base_pagination() {

    global $wp_query;
    $paginationHTML = '';
    $big = 999999;
    $args = array(
        'base' => str_replace($big, '%#%', esc_url(get_pagenum_link($big))),
        'format' => '?paged=%#%',
        'current' => max(1, get_query_var('paged')),
        'total' => $wp_query->max_num_pages,
        'prev_next' => false,
        'type' => 'array',
        'prev_next' => TRUE,
        'prev_text' => __('«'),
        'next_text' => __('»'),
    );

    $pages = paginate_links($args);

    if (is_array($pages)) {
        $paged = ( get_query_var('paged') == 0 ) ? 1 : get_query_var('paged');
        $paginationHTML .= '<ul class="pagination justify-content-center">';
        foreach ($pages as $page) {
            $paginationHTML .= "<li class='page-item'>$page</li>";
        }
        $paginationHTML .= '</ul>';
    }

    $patchActive = str_replace("current", "active", $paginationHTML);
    return str_replace("page-numbers", "page-link", $patchActive);
}

//Ensure email is sent as HTML
function base_mail_content_type() {
    return "text/html";
}

add_filter('wp_mail_content_type', 'base_mail_content_type');

//Update the admin CSS when options are updated
function base_update_admin_css() {
    $screen = get_current_screen();
    if (strpos($screen->id, "site-general-settings") == true) {
        //Admin
        $template = file_get_contents(get_template_directory() . '/includes/admin/css/admin-style-template.css');
        $in = array('[ADMIN-#]', '[ADMIN-BG]');
        $out = array(get_field('admin_&_email_colour', 'option'), get_field('admin_login_background', 'option'));
        $templateOut = str_replace($in, $out, $template);
        file_put_contents(get_template_directory() . '/includes/admin/css/admin-style.css', $templateOut);

        //Email
        $template = file_get_contents(get_template_directory() . '/includes/admin/email/email-html-template.tpl');
        $in = array('[ADMIN-#]', '[ADMIN-LOGO]', '[BLOG-INFO]', '[SITE-URL]');
        $out = array(get_field('admin_&_email_colour', 'option'), get_field('admin_&_email_logo', 'option'), get_bloginfo('name'), get_bloginfo('wpurl'));
        $templateOut = str_replace($in, $out, $template);
        file_put_contents(get_template_directory() . '/includes/admin/email/email-html.tpl', $templateOut);
    }
}

add_action('acf/save_post', 'base_update_admin_css', 20);
