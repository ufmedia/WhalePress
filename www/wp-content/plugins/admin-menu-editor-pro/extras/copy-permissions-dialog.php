<div id="ws-ame-copy-permissions-dialog" title="Copy Permissions" class="hidden">

	<div class="ws_dialog_subpanel">
		<label for="ame-copy-source-actor">
			Copy all menu permissions from:
		</label><br>
		<select id="ame-copy-source-actor">
			<option selected disabled>Choose source role</option>
		</select>
	</div>

	<div class="ws_dialog_subpanel">
		<label for="ame-copy-destination-actor">
			To:
		</label><br>
		<select id="ame-copy-destination-actor">
			<option selected disabled>Choose destination role</option>
		</select>
	</div>


	<div class="ws_dialog_buttons">
		<?php submit_button('Copy Permissions', 'primary', 'ws-ame-confirm-copy-permissions', false); ?>
		<input type="button" class="button ws_close_dialog" value="Cancel">
	</div>
</div>