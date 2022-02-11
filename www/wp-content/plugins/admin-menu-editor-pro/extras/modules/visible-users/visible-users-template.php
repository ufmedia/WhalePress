<div id="ws_visible_users_dialog" title="Select Visible Users" class="hidden">

	<div id="ws_user_selection_panels">

		<div id="ws_user_selection_source_panel" class="ws_user_selection_panel">
			<label for="ws_available_user_query" class="hidden">Search users</label>
			<input type="text" name="ws_available_user_query" id="ws_available_user_query"
			       placeholder="Search and hit Enter to add a user">

			<div class="ws_user_list_wrapper">
				<table id="ws_available_users" class="widefat striped ws_user_selection_list" title="Add user"></table>
			</div>

			<div id="ws_loading_users_indicator" class="spinner"></div>
		</div>

		<div id="ws_user_selection_target_panel" class="ws_user_selection_panel">
			<div id="ws_selected_users_caption">Selected users</div>

			<div class="ws_user_list_wrapper" title="">
				<table id="ws_selected_users" class="widefat ws_user_selection_list"></table>
			</div>
		</div>

	</div>

	<div class="ws_dialog_buttons">
		<?php submit_button('Save Changes', 'primary', 'ws_ame_save_visible_users', false); ?>
		<input type="button" class="button ws_close_dialog" value="Cancel">
	</div>

</div>