<?php
get_header();
get_template_part('includes/template-parts/components/hero');
get_template_part('includes/template-parts/layouts/page');
?>
    <div class="container">
        <h3>Post Grid</h3>
        <p class="lead">Lead introduction</p>
        <?= get_template_part('includes/template-parts/loops/posts') ?>
    </div>
<?php
get_footer();
?> 