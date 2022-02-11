<?php
$sidebarImage = partial_sidebar();
?>
<div class="container page-content<?= $class ?>">
    <div class="row no-gutters">
        <div class="col-12 <?php if ($sidebarImage) { ?> col-lg-8<?php } ?> copy">
            <h1><?= partial_page_title(); ?></h1>
            <?php if (get_field('sub_heading')) { ?>
                <p class="strap"><?= the_field('sub_heading') ?></p>
                <?php
            }
			get_template_part('includes/template-parts/loops/default');
            partial_page_quick_links();
            ?>
        </div>
        <?php if ($sidebarImage) { ?>
            <div class="col-12 col-lg-4 d-flex text-center align-items-center">
                <div class="feature-img ml-auto mr-auto slide-left">
                    <?= base_image($sidebarImage, 'b-lazy img-fit') ?>
                </div>
            </div>
        <?php } ?>
    </div>
</div>
    <?php
