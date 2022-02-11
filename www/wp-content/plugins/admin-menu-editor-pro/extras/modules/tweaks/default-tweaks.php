<?php
return array(
	'sections' => array(
		'profile'          => array('label' => 'Hide Profile Fields', 'priority' => 80),
		'sidebar-widgets'  => array('label' => 'Hide Sidebar Widgets', 'priority' => 100),
		'sidebars'         => array('label' => 'Hide Sidebars', 'priority' => 120),
		'environment-type' => array('label' => 'Environment Type', 'priority' => 30),
	),

	'tweaks' => array(
		'hide-screen-meta-links' => array(
			'label'    => 'Hide screen meta links',
			'selector' => '#screen-meta-links',
		),
		'hide-screen-options'    => array(
			'label'    => 'Hide the "Screen Options" button',
			'selector' => '#screen-options-link-wrap',
			'parent'   => 'hide-screen-meta-links',
		),
		'hide-help-panel'        => array(
			'label'    => 'Hide the "Help" button',
			'selector' => '#contextual-help-link-wrap',
			'parent'   => 'hide-screen-meta-links',
		),
		'hide-all-admin-notices' => array(
			'label'    => 'Hide ALL admin notices',
			'selector' => '#wpbody-content .notice, #wpbody-content .updated, #wpbody-content .update-nag',
		),

		'hide-gutenberg-options'    => array(
			'label'    => 'Hide the Gutenberg options menu (three vertical dots)',
			'selector' => '#editor .edit-post-header__settings .edit-post-more-menu',
		),
		'hide-gutenberg-fs-wp-logo' => array(
			'label'    => 'Hide the WordPress logo in Gutenberg fullscreen mode',
			'selector' => '#editor .edit-post-header a.components-button[href^="edit.php"]',
		),

		'hide-profile-visual-editor'         => array(
			'label'    => 'Visual Editor',
			'selector' => 'tr.user-rich-editing-wrap',
			'section'  => 'profile',
			'screens'  => array('profile'),
		),
		'hide-profile-syntax-higlighting'    => array(
			'label'    => 'Syntax Highlighting',
			'selector' => 'tr.user-syntax-highlighting-wrap',
			'section'  => 'profile',
			'screens'  => array('profile'),
		),
		'hide-profile-color-scheme-selector' => array(
			'label'    => 'Admin Color Scheme',
			'selector' => 'tr.user-admin-color-wrap',
			'section'  => 'profile',
			'screens'  => array('profile'),
		),
		'hide-profile-toolbar-toggle'        => array(
			'label'    => 'Toolbar',
			'selector' => 'tr.show-admin-bar.user-admin-bar-front-wrap',
			'section'  => 'profile',
			'screens'  => array('profile'),
		),

		'show-environment-in-toolbar'  => array(
			'label'       => 'Show environment type in the Toolbar',
			'section'     => 'environment-type',
			'className'   => 'ameEnvironmentNameTweak',
			'includeFile' => __DIR__ . '/ameEnvironmentNameTweak.php',
		),
		'environment-dependent-colors' => array(
			'label'       => 'Change menu color depending on the environment',
			'section'     => 'environment-type',
			'className'   => 'ameEnvironmentColorTweak',
			'includeFile' => __DIR__ . '/ameEnvironmentColorTweak.php',
		),
	),
);