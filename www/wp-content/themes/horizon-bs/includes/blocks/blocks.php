<?php

function horizon_blocks() {
  wp_enqueue_script('strap-block', get_template_directory_uri() . '/includes/blocks/strap-block.js', array('wp-blocks','wp-editor'), true);
  
}
add_action('enqueue_block_editor_assets', 'horizon_blocks');