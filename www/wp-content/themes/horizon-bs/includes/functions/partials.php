<?php

//Simple is active statement for navs
function partial_is_active($thisID, $targetID, $targetPT = null) {
    if ($thisID == $targetID || get_post_type() == $targetPT) {
        return ' active';
    }
}

//Quickly test for and grab the sidebar
function partial_sidebar() {
    if (get_field('sidebar_image')) {
        return get_field('sidebar_image');
    }
    return false;
}


//Generate Title or Alternative title if set
function partial_page_title() {
    if (get_field('alternative_title') != null) {
        the_field('alternative_title');
    } else {
        the_title();
    }
}

//Content Quick Links - used by content
function partial_page_quick_links() {
    if (have_rows('quick_links')) {
        echo '<div class="btn-container">';
        while (have_rows('quick_links')) {
            the_row();
            if (get_sub_field('internal_or_external') == 1) {
                echo '<a href="' . get_sub_field('internal_link') . '" class="btn btn-default">' . get_sub_field('quick_link_title') . '</a>';
            } else {
                echo '<a href="' . get_sub_field('external_link') . '" class="btn btn-default">' . get_sub_field('quick_link_title') . '</a>';
            }
        }
        echo '</div>';
    }
}
