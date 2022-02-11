<?php

 if (get_field('page_hero')) {
        $image = base_image_url(get_field('page_hero'), null);
    } else {
        $image = "https://via.placeholder.com/1500";
    }
    ?>
    <div class="container-fluid hero position-relative p-0 <?php if (is_front_page()) { ?> home<?php } ?>">
        <img src="data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==" data-src="<?= $image ?>" class="b-lazy img-fit">
        <?php if (is_front_page()) { ?>
        <div class="hero-content position-absolute top-50 start-50 translate-middle text-center"><p class="display-1">Design | Survey | Manage</p></div>
        <?php } ?>
    </div>

<?php

