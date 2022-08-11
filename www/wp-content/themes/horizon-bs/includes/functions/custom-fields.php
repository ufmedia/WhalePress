<?php

//Build the options page for general site settings
if (function_exists('acf_add_options_page')) {

    acf_add_options_page(array(
        'page_title' => 'General Site Settings',
        'menu_title' => 'Site Settings',
        'menu_slug' => 'site-general-settings',
        'capability' => 'edit_posts',
        'redirect' => false
    ));
}

//Build admin and email settings
if (function_exists('acf_add_local_field_group')):

    acf_add_local_field_group(array(
        'key' => 'group_58d5129941b89',
        'title' => 'Email & Admin Settings',
        'fields' => array(
            array(
                'force_crop' => 'yes',
                'crop_type' => 'hard',
                'preview_size' => 'thumbnail',
                'save_format' => 'url',
                'save_in_media_library' => 'no',
                'target_size' => 'custom',
                'library' => 'all',
                'retina_mode' => 'no',
                'key' => 'field_58d512ae95829',
                'label' => 'Admin & Email Logo',
                'name' => 'admin_&_email_logo',
                'type' => 'image_crop',
                'instructions' => 'The image will be used on the admin login page, the admin menu and as an email header. It will appear on multiple backgrounds including white, so it\'s best as block colour. This image should be 201x201',
                'required' => 0,
                'conditional_logic' => 0,
                'wrapper' => array(
                    'width' => '',
                    'class' => '',
                    'id' => '',
                ),
                'width' => 201,
                'height' => 201,
            ),
            array(
                'return_format' => 'url',
                'preview_size' => 'thumbnail',
                'library' => 'all',
                'min_width' => '',
                'min_height' => '',
                'min_size' => '',
                'max_width' => '',
                'max_height' => '',
                'max_size' => '',
                'mime_types' => '',
                'key' => 'field_58d51503d8721',
                'label' => 'Admin Login Background',
                'name' => 'admin_login_background',
                'type' => 'image',
                'instructions' => '',
                'required' => 0,
                'conditional_logic' => 0,
                'wrapper' => array(
                    'width' => '',
                    'class' => '',
                    'id' => '',
                ),
            ),
            array(
                'default_value' => '#268FBB',
                'key' => 'field_58d5147d9582a',
                'label' => 'Admin & Email Colour',
                'name' => 'admin_&_email_colour',
                'type' => 'color_picker',
                'instructions' => '',
                'required' => 0,
                'conditional_logic' => 0,
                'wrapper' => array(
                    'width' => '',
                    'class' => '',
                    'id' => '',
                ),
            ),
            array(
                'tabs' => 'all',
                'toolbar' => 'basic',
                'media_upload' => 0,
                'default_value' => '',
                'delay' => 0,
                'key' => 'field_58d515d5a8980',
                'label' => 'Footer Link',
                'name' => 'footer_link',
                'type' => 'text',
                'instructions' => '',
                'required' => 0,
                'conditional_logic' => 0,
                'wrapper' => array(
                    'width' => '',
                    'class' => '',
                    'id' => '',
                ),
            ),
            array(
                'tabs' => 'all',
                'toolbar' => 'basic',
                'media_upload' => 0,
                'default_value' => '',
                'delay' => 0,
                'key' => 'field_58d515d7a8260',
                'label' => 'Contact Email Address',
                'name' => 'contact_email',
                'type' => 'text',
                'instructions' => '',
                'required' => 0,
                'conditional_logic' => 0,
                'wrapper' => array(
                    'width' => '',
                    'class' => '',
                    'id' => '',
                ),
            ),
            array(
                'tabs' => 'all',
                'toolbar' => 'basic',
                'media_upload' => 0,
                'default_value' => '',
                'delay' => 0,
                'key' => 'field_98d415d7a8220',
                'label' => 'Contact Phone Number',
                'name' => 'contact_phone',
                'type' => 'text',
                'instructions' => '',
                'required' => 0,
                'conditional_logic' => 0,
                'wrapper' => array(
                    'width' => '',
                    'class' => '',
                    'id' => '',
                ),
            ),
            array(
                'tabs' => 'all',
                'toolbar' => 'basic',
                'media_upload' => 0,
                'default_value' => '6LegSeUUAAAAAPEXuB3n7D9vc5X8RHRPw9nlW5-H',
                'delay' => 0,
                'key' => 'field_68d915d7a8210',
                'label' => 'Captcha Secret Key',
                'name' => 'captcha_secret',
                'type' => 'text',
                'instructions' => '',
                'required' => 0,
                'conditional_logic' => 0,
                'wrapper' => array(
                    'width' => '',
                    'class' => '',
                    'id' => '',
                ),
            ),
            array(
                'tabs' => 'all',
                'toolbar' => 'basic',
                'media_upload' => 0,
                'default_value' => '6LegSeUUAAAAAPFFlr-njrTodUG2hGbWGZHet_yO',
                'delay' => 0,
                'key' => 'field_78d915d7a1260',
                'label' => 'Captcha Public Key',
                'name' => 'captcha_public',
                'type' => 'text',
                'instructions' => '',
                'required' => 0,
                'conditional_logic' => 0,
                'wrapper' => array(
                    'width' => '',
                    'class' => '',
                    'id' => '',
                ),
            ),
        ),
        'location' => array(
            array(
                array(
                    'param' => 'options_page',
                    'operator' => '==',
                    'value' => 'site-general-settings',
                ),
                array(
                    'param' => 'current_user_role',
                    'operator' => '==',
                    'value' => 'administrator',
                ),
            ),
        ),
        'menu_order' => 0,
        'position' => 'normal',
        'style' => 'default',
        'label_placement' => 'top',
        'instruction_placement' => 'label',
        'hide_on_screen' => '',
        'active' => 1,
        'description' => '',
    ));

endif;



//Alternative Title and Strap + Page options
if (function_exists('acf_add_local_field_group')):

    acf_add_local_field_group(array(
        'key' => 'group_586beb267fd72',
        'title' => 'Quick Links',
        'fields' => array(
            array(
                'key' => 'field_5676ff291b226',
                'label' => 'Quick Links',
                'name' => 'quick_links',
                'type' => 'repeater',
                'instructions' => 'You can create quick links here, these appear at the bottom of your written content.',
                'required' => 0,
                'conditional_logic' => 0,
                'wrapper' => array(
                    'width' => '',
                    'class' => '',
                    'id' => '',
                ),
                'row_min' => '',
                'row_limit' => '',
                'layout' => 'table',
                'button_label' => 'Add Link',
                'min' => 0,
                'max' => 0,
                'collapsed' => '',
                'sub_fields' => array(
                    array(
                        'key' => 'field_5676ff641b227',
                        'label' => 'Quick Link Title',
                        'name' => 'quick_link_title',
                        'type' => 'text',
                        'instructions' => '',
                        'required' => 1,
                        'conditional_logic' => 0,
                        'wrapper' => array(
                            'width' => '',
                            'class' => '',
                            'id' => '',
                        ),
                        'default_value' => '',
                        'placeholder' => '',
                        'prepend' => '',
                        'append' => '',
                        'formatting' => 'html',
                        'maxlength' => '',
                        'readonly' => 0,
                        'disabled' => 0,
                    ),
                    array(
                        'key' => 'field_56827f1165a8e',
                        'label' => 'Internal or External',
                        'name' => 'internal_or_external',
                        'type' => 'radio',
                        'instructions' => 'Please select a link type',
                        'required' => 0,
                        'conditional_logic' => 0,
                        'wrapper' => array(
                            'width' => '',
                            'class' => '',
                            'id' => '',
                        ),
                        'choices' => array(
                            1 => 'Internal',
                            2 => 'External',
                        ),
                        'other_choice' => 0,
                        'save_other_choice' => 0,
                        'default_value' => '',
                        'layout' => 'vertical',
                        'allow_null' => 0,
                        'return_format' => 'value',
                    ),
                    array(
                        'key' => 'field_5676ff6e1b228',
                        'label' => 'Internal Link',
                        'name' => 'internal_link',
                        'type' => 'page_link',
                        'instructions' => '',
                        'required' => 1,
                        'conditional_logic' => array(
                            array(
                                array(
                                    'field' => 'field_56827f1165a8e',
                                    'operator' => '==',
                                    'value' => '1',
                                ),
                            ),
                        ),
                        'wrapper' => array(
                            'width' => '',
                            'class' => '',
                            'id' => '',
                        ),
                        'post_type' => array(
                            0 => 'page',
                        ),
                        'allow_null' => 0,
                        'multiple' => 0,
                        'taxonomy' => array(
                        ),
                        'allow_archives' => 1,
                    ),
                    array(
                        'key' => 'field_56827ec665a8d',
                        'label' => 'External Link',
                        'name' => 'external_link',
                        'type' => 'url',
                        'instructions' => '',
                        'required' => 0,
                        'conditional_logic' => array(
                            array(
                                array(
                                    'field' => 'field_56827f1165a8e',
                                    'operator' => '==',
                                    'value' => '2',
                                ),
                            ),
                        ),
                        'wrapper' => array(
                            'width' => '',
                            'class' => '',
                            'id' => '',
                        ),
                        'default_value' => '',
                        'placeholder' => '',
                        'prepend' => '',
                        'append' => '',
                        'formatting' => 'html',
                        'maxlength' => '',
                        'readonly' => 0,
                        'disabled' => 0,
                    ),
                ),
            ),
        ),
        'location' => array(
            array(
                array(
                    'param' => 'post_type',
                    'operator' => '==',
                    'value' => 'page',
                ),
            ),
        ),
        'menu_order' => 0,
        'position' => 'acf_after_title',
        'style' => 'default',
        'label_placement' => 'top',
        'instruction_placement' => 'label',
        'hide_on_screen' => array(
        ),
        'active' => 1,
        'description' => '',
        'old_ID' => 34,
    ));

endif;


if (function_exists('acf_add_local_field_group')):

    acf_add_local_field_group(array(
        'key' => 'group_5e4ade4ce45ce',
        'title' => 'Page Hero Image',
        'fields' => array(
            array(
                'key' => 'field_5e4ade5073b22',
                'label' => 'Page Hero Image',
                'name' => 'page_hero',
                'type' => 'image',
                'instructions' => '',
                'required' => 0,
                'conditional_logic' => 0,
                'wrapper' => array(
                    'width' => '',
                    'class' => '',
                    'id' => '',
                ),
                'return_format' => 'array',
                'preview_size' => 'thumbnail',
                'library' => 'all',
                'min_width' => '',
                'min_height' => '',
                'min_size' => '',
                'max_width' => '',
                'max_height' => '',
                'max_size' => '',
                'mime_types' => '',
            ),
        ),
        'location' => array(
            array(
                array(
                    'param' => 'post_type',
                    'operator' => '==',
                    'value' => 'page',
                ),
            ),
        ),
        'menu_order' => 0,
        'position' => 'side',
        'style' => 'default',
        'label_placement' => 'top',
        'instruction_placement' => 'label',
        'hide_on_screen' => '',
        'active' => true,
        'description' => '',
    ));

    acf_add_local_field_group(array(
        'key' => 'group_5e4d160cebaf1',
        'title' => 'Page Sidebar Image',
        'fields' => array(
            array(
                'key' => 'field_5e4d1616afd49',
                'label' => 'Sidebar Image',
                'name' => 'sidebar_image',
                'type' => 'image',
                'instructions' => '',
                'required' => 0,
                'conditional_logic' => 0,
                'wrapper' => array(
                    'width' => '',
                    'class' => '',
                    'id' => '',
                ),
                'return_format' => 'array',
                'preview_size' => 'thumbnail',
                'library' => 'all',
                'min_width' => '',
                'min_height' => '',
                'min_size' => '',
                'max_width' => '',
                'max_height' => '',
                'max_size' => '',
                'mime_types' => '',
            ),
        ),
        'location' => array(
            array(
                array(
                    'param' => 'post_type',
                    'operator' => '==',
                    'value' => 'page',
                ),
            ),
        ),
        'menu_order' => 0,
        'position' => 'side',
        'style' => 'default',
        'label_placement' => 'top',
        'instruction_placement' => 'label',
        'hide_on_screen' => '',
        'active' => true,
        'description' => '',
    ));

endif;