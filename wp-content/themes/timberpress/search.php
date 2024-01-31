<?php
/**
 * Search results page
 *
 * @package TimberPress
 * @since   TimberPress 1.0
 */

$templates = array( 'search.twig', 'archive.twig', 'index.twig' );

$context          = Timber::context();
$context['title'] = 'Search results for ' . get_search_query();
$context['posts'] = new Timber\PostQuery();

Timber::render( $templates, $context );
