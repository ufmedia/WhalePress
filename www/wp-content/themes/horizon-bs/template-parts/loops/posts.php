<?php
if (get_query_var('paged')) {
    $paged = get_query_var('paged');
} elseif (get_query_var('page')) {
    $paged = get_query_var('page');
} else {
    $paged = 1;
}

$isSingle = false;
$isPage = false;
$ppp = 3;

if (get_post_type() == 'post') {
    $isSingle = true;
}

if (get_the_ID() == 22) {
    $isPage = true;
    $ppp = 6;
}

$args = array(
    'post_type' => 'post',
    'paged' => $paged,
    'orderby' => 'date',
    'order' => 'DESC',
    'posts_per_page' => $ppp,
    'post__not_in' => array(get_the_ID()),
);

$i = 0;

$wp_query = new WP_Query($args);
$pagination = base_pagination();

if (have_posts()) :
    ?>

    <div class="card-group shadow-sm">
        <?php
        while (have_posts()) : the_post();
            ?>
            
                <div class="card">
                    <div class="card-header">
                        <h5 class="card-title"><?= get_the_title($id) ?></h5>
                    </div>
                    <img src="https://via.placeholder.com/1200x600" class="" alt="<?= get_the_title($id) ?>">
                    <div class="card-body">
                        <p class="card-text"><?= base_strip_and_limit(get_post_field('post_content'), 200) ?></p>
                        <a href="<?= get_permalink() ?>" class="btn btn-secondary stretched-link">Go somewhere</a>
                    </div>
                </div>
            
            <?php
            $i++;
        endwhile;
        if (!$isSingle && $isPage && $pagination) {
            ?>
            <div class="btn-container text-center pagination-container">
                <?= $pagination; ?>
            </div>
        <?php } ?>
    </div>
    <?php if (!$isPage) { ?>
        <div class="btn-container text-center pt-5 pb-5">
            <a href="#" class="btn btn-secondary ">More from our blog</a>
        </div>
    <?php } ?>

    <?php
endif;

wp_reset_query();
