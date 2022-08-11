<?php

//A prebuilt post/page query for quickly accessing content and constructing feature content
function query_post_type($postType, $count=-1, $orderby='date', $order='ASC', $notIn=null, $taxId=null, $tax=null) {

    $args = array(
        'post_type' => $postType,
        'numberposts' => $count,
        'orderby' => $orderby,
        'order' => $order,
        'post__not_in' => $notIn,
    );

    if ($taxId != null) {
        $args['tax_query'] = array(
            array(
                'taxonomy' => $tax,
                'field' => 'id',
                'terms' => array($taxId)
            ),
        );
    }

    return get_posts($args);
}
