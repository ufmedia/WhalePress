<?php

class ameCoreShortcodes {
	protected static $allowedUserFields = array(
		'ID',
		'user_login',
		'display_name',
		'first_name',
		'last_name',
		'nickname',
		'description',
		'locale',
		'user_nicename',
		'user_url',
		'user_registered',
		'user_status',
	);

	public function register() {
		add_shortcode('ame-wp-admin', array($this, 'handleAdminUrl'));
		add_shortcode('ame-home-url', array($this, 'handleHomeUrl'));
		add_shortcode('ame-user-info', array($this, 'handleUserInfo'));
	}

	/** @noinspection PhpUnusedParameterInspection Parameters are required by the shortcode API. */
	public function handleAdminUrl($attributes = array(), $content = null, $tag = 'ame-wp-admin') {
		if ( is_callable('self_admin_url') ) {
			return self_admin_url();
		}
		return '[' . $tag . ']';
	}

	/** @noinspection PhpUnusedParameterInspection */
	public function handleHomeUrl($attributes = array(), $content = null, $tag = 'ame-home-url') {
		if ( is_callable('home_url') ) {
			return home_url();
		}
		return '[' . $tag . ']';
	}

	public function handleUserInfo(
		$attributes = array(), /** @noinspection PhpUnusedParameterInspection */
		$content = null,
		$tag = 'ame-user-info'
	) {
		$attributes = shortcode_atts(
			array(
				'field'       => 'user_login',
				'placeholder' => '(No user)',
				'escape'      => 'auto',
			),
			$attributes,
			$tag
		);

		$placeholder = $attributes['placeholder'];

		$field = strtolower($attributes['field']);
		if ( $field === 'id' ) {
			$field = 'ID';
		}
		if ( !in_array($field, self::$allowedUserFields) ) {
			return '(Error: Unsupported field)';
		}

		//Get the currently logged-in user.
		$user = null;
		if ( is_callable('wp_get_current_user') ) {
			$user = wp_get_current_user();
		}

		//Display the placeholder text if nobody is logged in or the user doesn't exist.
		if ( empty($user) || !isset($user->ID) || ($user->ID === 0) ) {
			return $placeholder;
		}

		$escapingHandlers = array(
			'html' => 'esc_html',
			'attr' => 'esc_attr',
			'js'   => 'esc_js',
			'none' => array($this, 'identity'),
		);

		$escape = $attributes['escape'];
		//By default, escape HTML special characters only if in the Loop.
		if ( $escape === 'auto' ) {
			if ( is_callable('in_the_loop') && in_the_loop() ) {
				$escape = 'html';
			} else {
				$escape = 'none';
			}
		}
		if ( !array_key_exists($escape, $escapingHandlers) ) {
			return '(Error: Unsupported escape setting)';
		}
		if ( is_callable($escapingHandlers[$escape]) ) {
			$escapeCallback = $escapingHandlers[$escape];
		} else {
			return '(Error: The specified escape function is not available)';
		}

		if ( isset($user->$field) ) {
			return call_user_func($escapeCallback, $user->$field);
		}
		return $placeholder;
	}

	protected function identity($value) {
		return $value;
	}
}

$wsAmeShortcodes = new ameCoreShortcodes();
$wsAmeShortcodes->register();
