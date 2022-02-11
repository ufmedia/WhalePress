<!-- Import dialog -->
<div id="ame-import-widgets-dialog" title="Import" style="display: none;">
	<form id="ame-import-widgets-form"
	      action="<?php echo esc_attr(admin_url('admin-ajax.php')); ?>"
	      method="post">

		<input type="hidden" name="action" value="ws-ame-import-widgets">
		<?php wp_nonce_field('ws-ame-import-widgets'); ?>

		<div class="ws_dialog_panel" id="ame-import-panel" data-bind="visible: (importState() !== 'unexpected-error')">
			<?php
			$spinnerUrl = plugins_url('images/spinner.gif', AME_ROOT_DIR . '/stub');
			?>
			<div id="ame-import-progress-notice" data-bind="visible: (importState() === 'uploading')">
				<img src="<?php echo esc_attr($spinnerUrl); ?>" alt="in progress">
				Importing widgets...
			</div>
			<div id="ame-import-complete-notice" data-bind="visible: (importState() === 'complete')">
				<div class="dashicons dashicons-yes"></div>
				Import complete.
			</div>


			<div data-bind="visible: (importState() === 'start')">
				Choose as widget file (.json) to import:
				<input type="hidden" name="MAX_FILE_SIZE"
				       value="<?php echo esc_attr(ameWidgetEditor::MAX_IMPORT_FILE_SIZE); ?>">
				<input type="file" name="widgetFile" id="ame-import-file-selector">
			</div>
		</div>

		<div id="ame-import-error" data-bind="visible: (importState() === 'unexpected-error')">
			<div class="ws_dialog_subpanel">
				<strong>Error:</strong><br>
				<span id="ws_import_error_message" data-bind="text: importErrorMessage">N/A</span>
			</div>

			<div class="ws_dialog_subpanel">
				<strong>HTTP code:</strong><br>
				<span id="ws_import_error_http_code" data-bind="text: importErrorHttpCode">N/A</span>
			</div>

			<div class="ws_dialog_subpanel">
				<label for="ws_import_error_response"><strong>Server response:</strong></label><br>
				<textarea id="ws_import_error_response" rows="8" data-bind="val: importErrorResponse"></textarea>
			</div>
		</div>

		<div class="ws_dialog_buttons">
			<input type="submit" name="upload" class="button-primary"
			       value="Upload File" id="ame-start-widget-import" data-bind="enable: uploadButtonEnabled">
			<input type="button" name="cancel" class="button" value="Close" id="ame-cancel-widget-import">
		</div>
	</form>
</div>