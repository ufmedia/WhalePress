<?php
/* * ************************** TEMPLATE-CONTACT.PHP ****************************** */
/** This is the contact template * */
/** Author: John Thompson * */
// Template name: Contact


get_header();
get_template_part('includes/templates/components/hero');
?>

<div class="container page-content py-5">
    <div class="row">
        <div class="col-12 col-lg-7">
            <h1><?= partial_page_title(); ?></h1>
            <div class="copy me-5">
                <?php if (get_field('sub_heading')) { ?>
                    <p class="lead"><?= the_field('sub_heading') ?></p>
                    <?php
                }
                get_template_part('includes/templates/loops/default');
                ?>
                <?php if (get_field('contact_email', 'options')) { ?>    
                    <h5 class="pt-3"><a href="mailto:<?= antispambot(get_field('contact_email', 'options')) ?>"><i class="fas fa-envelope"></i> <?= antispambot(get_field('contact_email', 'options')) ?></a></h5>
                <?php } ?>
                <?php if (get_field('contact_phone', 'options')) { ?>
                    <h5 class="pt-3"><a href="tel:<?= str_replace(" ", "", get_field('contact_phone', 'options')) ?>"><i class="fas fa-phone"></i> <?= get_field('contact_phone', 'options') ?></a></h5>
                <?php } ?>

            </div>
            <?php
            partial_page_quick_links();
            ?>
        </div>
        <div class="col-12 col-lg-5 d-flex align-items-center">
            <div class="form-container w-100">
                <h3 class="mb-3">Contact Form</h3>
                <form onsubmit="event.preventDefault();" id="contactForm">
                    <div class="mb-3">
                        <label for="name" class="form-label">Your Name</label>
                        <input type="name" class="form-control" id="name" name="name" required>
                    </div>
                    <div class="mb-3">
                        <label for="email" class="form-label">Email address</label>
                        <input type="email" class="form-control" id="email" name="email" required>
                    </div>
                    <div class="mb-3">
                        <label for="message" class="form-label">Message</label>
                        <textarea id="message" class="form-control" name="message" required></textarea>
                    </div>
                    <div class="mb-3">
                        <label class="checkbox terms-container">
                            <input type="checkbox" id="terms" name="terms" required>
                            <span>Agree to our Privacy Policy</span>
                        </label>
                    </div>
                    <input type="hidden" name="subject" value="<?= get_option('blogname') ?> Website - Someone has contacted you">
                    <div class="btn-container">
                        <button class="btn btn-primary js-form-submit">Submit</button>
                    </div>
                </form>
            </div>
        </div>
    </div>
</div>

<?php
get_footer();