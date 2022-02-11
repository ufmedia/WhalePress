<?php
/**
 * @var string $moduleTabUrl Fully qualified URL of the tab.
 */

?>
<div id="ame-tweak-manager">
	<?php require AME_ROOT_DIR . '/modules/actor-selector/actor-selector-template.php'; ?>

	<div data-bind="foreach: sections">
		<div class="ame-twm-section" data-bind="css: { 'ws-ame-closed-postbox': !isOpen() }">
			<div class="ws-ame-postbox-header">
				<h3 data-bind="text: label"></h3>
				<button class="ws-ame-postbox-toggle" data-bind="click: toggle"></button>
			</div>
			<div class="ws-ame-postbox-content">
				<div data-bind="template: {name: 'ame-named-node-template', foreach: tweaks}"></div>
				<!-- ko if: footerTemplateName -->
				<!-- ko template: {
					name: $data.footerTemplateName,
					data: $data
				} -->
				<!-- /ko -->
				<!-- /ko -->
			</div>
		</div>
	</div>

	<form method="post" data-bind="submit: saveChanges" class="ame-twm-save-form" action="<?php
	echo esc_attr(add_query_arg(array('noheader' => '1'), $moduleTabUrl));
	?>">

		<?php
		submit_button(
			'Save Changes',
			'primary',
			'submit',
			true,
			array(
				'data-bind' => 'disable: isSaving',
				'disabled'  => 'disabled',
			)
		);
		?>

		<input type="hidden" name="action" value="ame-save-tweak-settings">
		<?php wp_nonce_field('ame-save-tweak-settings'); ?>

		<input type="hidden" name="settings" value="" data-bind="value: settingsData">
		<input type="hidden" name="selected_actor" value="" data-bind="value: selectedActorId">
	</form>

	<div id="ame-twm-add-admin-css-dialog"
	     data-bind="ameDialog: adminCssEditorDialog"
	     title="Add admin CSS snippet"
	     style="display: none;" class="ame-twm-dialog">
		<div class="ws_dialog_subpanel">
			<label for="ame-twm-new-css-tweak-label"><strong>Name</strong></label><br>
			<input type="text" id="ame-twm-new-css-tweak-label" class="large-text"
			       data-bind="textInput: adminCssEditorDialog.tweakLabel">
		</div>

		<div class="ws_dialog_subpanel">
			<label for="ame-twm-new-css-tweak-code"><strong>CSS code</strong></label><br>
			<textarea id="ame-twm-new-css-tweak-code" cols="40" rows="6"
			          data-bind="value: adminCssEditorDialog.cssCode,
			          ameCodeMirror: {options: $root.cssHighlightingOptions, refreshTrigger: adminCssEditorDialog.isOpen}"></textarea>
		</div>

		<div class="ws_dialog_buttons">
			<?php
			submit_button(
				'Add Snippet',
				'primary',
				'ame-twm-confirm-css-addition',
				false,
				array(
					'data-bind' =>
						'enable : adminCssEditorDialog.isAddButtonEnabled, '
						. 'click: adminCssEditorDialog.onConfirm.bind(adminCssEditorDialog), '
						. 'value: adminCssEditorDialog.confirmButtonText',
				)
			);

			submit_button(
				'Cancel',
				'secondary',
				'ame-twm-cancel-css-addition',
				false,
				array('data-bind' => 'click: adminCssEditorDialog.close.bind(adminCssEditorDialog)')
			);
			?>
		</div>
	</div>
</div>

<div style="display: none;">
	<template id="ame-named-node-template">
		<!-- ko if: ($data.templateName) -->
		<!-- ko template: {
			name: $data.templateName,
			data: $data
		} -->
		<!-- /ko -->
		<!-- /ko -->

		<!-- ko ifnot: ($data.templateName) -->
		<div class="ame-twm-named-node"
		     data-bind="css: {'ame-twm-tweak': ($data instanceof AmeTweakItem)}, attr: {'id': $data.htmlId}">
			<label class="ame-twm-tweak-label">
				<!-- ko if: $data.actorAccess -->
				<input type="checkbox"
				       data-bind="checked: actorAccess.isChecked, indeterminate: actorAccess.isIndeterminate">
				<!-- /ko -->
				<span data-bind="text: label"></span>
			</label>
			<!-- ko if: $data.isUserDefined -->
			<span class="ame-twm-tweak-actions">
				<a href="#" class="ame-twm-action ame-twm-edit-tweak" title="Edit tweak"
				   data-bind="click: $root.launchTweakEditor.bind($root)"
				><span class="dashicons dashicons-edit">
					</span></a
				><a href="#"
				    class="ame-twm-action ame-twm-delete-tweak"
				    title="Delete tweak"
				    data-bind="click: $root.confirmDeleteTweak.bind($root)"
				><span class="dashicons dashicons-trash"></span></a>
			</span>
			<!-- /ko -->

			<!-- ko if: ($data.userInput) -->
			<!-- ko template: {
				name: $data.userInput.templateName,
				data: $data.userInput
			} -->
			<!-- /ko -->
			<!-- /ko -->

			<!-- ko if: $data.children && (children().length > 0) -->
			<div class="ame-twm-tweak-children"
			     data-bind="template: {name: 'ame-named-node-template', foreach: children}"></div>
			<!-- /ko -->
		</div>
		<!-- /ko -->
	</template>

	<template id="ame-tweak-item-template">
		<div class="ame-twm-tweak">
			<label class="ame-twm-tweak-label">
				<!-- ko if: $data.actorAccess -->
				<input type="checkbox"
				       data-bind="checked: actorAccess.isChecked, indeterminate: actorAccess.isIndeterminate">
				<!-- /ko -->
				<span data-bind="text: label"></span>
			</label>
			<!-- ko if: $data.isUserDefined -->
			<span class="ame-twm-tweak-actions">
				<a href="#" class="ame-twm-action ame-twm-edit-tweak" title="Edit tweak"
				   data-bind="click: $root.launchTweakEditor.bind($root)"
				><span class="dashicons dashicons-edit">
					</span></a
				><a href="#"
				    class="ame-twm-action ame-twm-delete-tweak"
				    title="Delete tweak"
				    data-bind="click: $root.confirmDeleteTweak.bind($root)"
				><span class="dashicons dashicons-trash"></span></a>
			</span>
			<!-- /ko -->

			<!-- ko if: ($data.userInput) -->
			<!-- ko template: {
				name: $data.userInput.templateName,
				data: $data.userInput
			} -->
			<!-- /ko -->
			<!-- /ko -->

			<!-- ko if: $data.children && (children().length > 0) -->
			<div class="ame-twm-tweak-children"
			     data-bind="template: {name: 'ame-tweak-item-template', foreach: children}"></div>
			<!-- /ko -->
		</div>
	</template>

	<template id="ame-tweak-textarea-input-template">
		<div class="ame-twm-user-input">
			<label>
				<span class="screen-reader-text" data-bind="text: $data.label"></span>
				<textarea cols="80" rows="5" class="large-text code"
				          data-bind="value: $data.inputValue,
				          ameCodeMirror: $data.syntaxHighlightingOptions"></textarea>
			</label>
		</div>
	</template>

	<template id="ame-tweak-color-input-template">
		<div class="ame-twm-user-input ame-twm-color-input">
			<label data-bind="attr: {'for': $data.uniqueInputId}" class="ame-twm-color-label">
				<span data-bind="text: $data.label"></span>
			</label>
			<!--suppress HtmlFormInputWithoutLabel -->
			<input type="text" data-bind="ameColorPicker: $data.inputValue, attr: {'id': $data.uniqueInputId}">
		</div>
	</template>

	<template id="ame-tweak-boolean-input-template">
		<div class="ame-twm-user-input ame-twm-boolean-input">
			<label>
				<input type="checkbox" data-bind="checked: $data.inputValue">
				<span data-bind="text: $data.label"></span>
			</label>
		</div>
	</template>

	<template id="ame-admin-css-section-footer">
		<p>
			<?php
			submit_button(
				'Add CSS snippet',
				'secondary',
				'ame-twm-add-css-tweak',
				false,
				array(
					'data-bind' => 'ameOpenDialog: "#ame-twm-add-admin-css-dialog"',
				)
			);
			?>
		</p>
	</template>
</div>