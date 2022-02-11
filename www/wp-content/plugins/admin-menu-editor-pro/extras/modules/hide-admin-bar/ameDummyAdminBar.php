<?php
if ( class_exists('WP_Admin_bar') ) {

	class ameDummyAdminBar extends WP_Admin_Bar {
		public function render() {
			//Set up internal data structures in case some plugin wants to use them.
			$this->_bind();

			//WordPress uses the height of the admin bar in the calculation that determines if the admin menu
			//should be scrollable or not. See the setPinMenu() function in /wp-admin/js/common.js. This means
			//we can't completely get rid of the admin bar because the calculation will fail if the height is
			//undefined. To avoid that, let's output an empty, hidden element.
			?>
			<div id="wpadminbar" style="display: none !important; height: 0; width: 0;"></div>
			<?php
		}
	}

}
