

<div class="container-fluid footer bg-dark text-light py-3">
    <div class="container">
        <div class="row">
            <div class="col-12 text-center">
                <nav class="navbar navbar-expand-sm">
                    <?php
                    wp_nav_menu(array(
                        'menu' => 'main-menu',
                        'depth' => 2,
                        'container' => false,
                        'menu_class' => 'navbar-nav mx-auto mb-5',
                        'walker' => new wp_bootstrap_navwalker())
                    );
                    ?>
                </nav>
            </div>
            <div class="col-12 footer-icons text-center mb-5">
                <?php if (get_field('contact_email', 'options')) { ?> 
                    <a href="mailto:<?= antispambot(get_field('contact_email', 'options')) ?>" target="_blank" rel="noreferrer" title="Email Us"><i class="fas rounded-circle fa-envelope"></i></a>
                <?php } ?>
                <?php if (get_field('contact_phone', 'options')) { ?>
                    <a href="tel:<?= str_replace(" ", "", get_field('contact_phone', 'options')) ?>" target="_blank" rel="noreferrer" title="Call Us"><i class="fas rounded-circle fa-phone"></i></a>
                <?php } ?>
            </div>
            <div class="col-12 text-center footer-copy text-light">
                <p class="text-light"><i class="far fa-copyright"></i> <?= get_bloginfo('name') . ' ' . date('Y'); ?></p>
                <p class="text-light ufm-site "><small>A <a href="https://www.ufmedia.co.uk" class="link-light" target="_blank">UFMedia</a> Website</small></p>
            </div>
        </div>
    </div>
</div>


<?php wp_footer(); ?>
<?php if (strpos(get_site_url(), 'dev') == true) { ?>
    <div class="container-fluid">
        <div class="row theme-colors">
            <div class="col text-center bg-primary">Primary</div>
            <div class="col text-center bg-secondary">Secondary</div>
            <div class="col text-center bg-success">Success</div>
            <div class="col text-center bg-warning">Warning</div>
            <div class="col text-center bg-info">Info</div>
            <div class="col text-center bg-light">Light</div>
            <div class="col text-center bg-dark text-light">Dark</div>
        </div>
    </div>

<?php } ?>
<script>
    var publicKey = "<?= get_field('captcha_public', 'options') ?>";
</script>
</body>
</html>