<!DOCTYPE html>
<html lang="en">
    <head>
        <meta charset="utf-8">
        <meta http-equiv="X-UA-Compatible" content="IE=edge">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <meta name="theme-color" content="#ffffff">
        <title><?= wp_title() ?></title>
        <link rel="stylesheet" href="<?php bloginfo('stylesheet_url'); ?>" type="text/css" media="screen" />
        <?php wp_head(); ?>
        <?php if (strpos(get_site_url(), 'dev') == false) { ?>
            <!-- GTM -->
        <?php } ?>
    </head>
    <body <?= body_class() ?>>
        <?php if (strpos(get_site_url(), 'dev') == false) { ?>
            <!-- GTM -->
        <?php } ?>
        <div class="container-fluid head py-2">
            
            <nav class="navbar navbar-expand-lg">
                <div class="container-fluid">
                    <a class="navbar-brand" href="<?= home_url() ?>">
                        <img src="<?= base_dir('img') ?>/logo-dark.svg" class="img-fluid">
                    </a>
                    <div class="offcanvas offcanvas-end d-lg-none" tabindex="-1" id="offcanvasNavbar" aria-labelledby="offcanvasNavbarLabel">
                        <div class="offcanvas-header">
                            <h5 class="offcanvas-title" id="offcanvasNavbarLabel">Offcanvas</h5>
                            <button type="button" class="btn-close text-reset" data-bs-dismiss="offcanvas" aria-label="Close"></button>
                        </div>
                        <div class="offcanvas-body">
                            <?php
                            wp_nav_menu(array(
                                'menu' => 'main-menu',
                                'depth' => 2,
                                'container' => false,
                                'menu_class' => 'navbar-nav ms-auto',
                                'walker' => new wp_bootstrap_navwalker())
                            );
                            ?>
                        </div>
                    </div>
                    <button class="navbar-toggler" type="button" data-bs-toggle="offcanvas" data-bs-target="#offcanvasNavbar" aria-controls="offcanvasNavbar">
                        <span class="hamburger-box">
                            <span class="hamburger-inner"></span>
                        </span>
                    </button>
                    <div class="collapse navbar-collapse d-none d-lg-flex" id="navbarSupportedContent">
                        <?php
                        wp_nav_menu(array(
                            'menu' => 'main-menu',
                            'depth' => 2,
                            'container' => false,
                            'menu_class' => 'navbar-nav ms-auto',
                            'walker' => new wp_bootstrap_navwalker())
                        );
                        ?>
                    </div>
                </div>
            </nav>
        </div>