<?php
//This line reserved for future use.
?>
<div id="ws-ame-separator-style-settings" title="Menu Separators" style="display: none;">
	<div class="ws_dialog_panel">
		<ul class="ame-small-tab-container">
			<li class="ame-small-tab ame-active-tab" data-bind="css: {'ame-active-tab': (activeTab() === 'top')}">
				<!--suppress HtmlUnknownAnchorTarget -->
				<a href="#topmenu-separators" data-bind="click: selectTab.bind($root, 'top')">Top Level Separators</a>
			</li>
			<li class="ame-small-tab" data-bind="css: {'ame-active-tab': (activeTab() === 'submenu')}">
				<!--suppress HtmlUnknownAnchorTarget -->
				<a href="#submenu-separators" data-bind="click: selectTab.bind($root, 'submenu')">Submenu Separators</a>
			</li>
		</ul>

		<div class="ame-separator-settings-container">
			<div class="ws_dialog_subpanel" data-bind="visible: activeTab() === 'top'">
				<fieldset>
					<p>
						<label>
							<input type="checkbox" data-bind="checked: customSettingsEnabled">
							Use custom separator styles
						</label>
					</p>
					<p><label><input type="checkbox" data-bind="checked: previewEnabled"> Live preview</label></p>
				</fieldset>
			</div>

			<div class="ws_dialog_subpanel" data-bind="visible: activeTab() === 'submenu'" style="display: none;">
				<p>
					<label>
						<input type="checkbox" data-bind="checked: useTopLevelSettingsForSubmenus">
						Use the same settings as top level separators
					</label>
				</p>
			</div>

			<div class="ws_dialog_subpanel">
				<h3 class="ws-ame-dialog-subheading">Color</h3>
				<fieldset data-bind="enable: tabSettingsEnabled">
					<p>
						<label>
							<input type="radio" name="ame-separator-color-type" value="transparent"
							       data-bind="checked: currentTypeSettings().colorType">
							Transparent
						</label>
					</p>
					<p>
						<label>
							<input type="radio" name="ame-separator-color-type" value="custom"
							       data-bind="checked: currentTypeSettings().colorType">
							<span class="ame-sp-label-text">Custom</span>
						</label>
						<label for="ame-custom-separator-color" class="hidden">Custom separator color</label>
						<input type="text" id="ame-custom-separator-color"
						       data-bind="ameColorPicker: currentTypeSettings().customColor">
					</p>

				</fieldset>
			</div>

			<div class="ws_dialog_subpanel">
				<h3 class="ws-ame-dialog-subheading">Line style</h3>
				<fieldset id="ame-separator-border-styles" data-bind="enable: tabSettingsEnabled">
					<?php
					$styleOptions = array(
						'solid'  => 'Solid',
						'dashed' => 'Dashed',
						'double' => 'Double',
						'dotted' => 'Dotted',
					);
					foreach ($styleOptions as $style => $label):
						?>
						<p>
							<label>
								<input type="radio" name="ame-separator-style" value="<?php echo esc_attr($style); ?>"
								       data-bind="checked: currentTypeSettings().borderStyle">
								<span class="ame-sp-label-text"><?php echo $label; ?></span>
								<span class="ame-border-sample-container">
								<span class="ame-border-sample"
								      style="border-top-style: <?php echo esc_attr($style); ?>"></span>
							</span>
							</label>
						</p>
					<?php
					endforeach;
					?>
				</fieldset>
			</div>

			<div class="ws_dialog_subpanel">
				<h3 class="ws-ame-dialog-subheading"><label for="ws-ame-separator-height">Height</label></h3>
				<input type="number" id="ws-ame-separator-height" min="1" max="300"
				       data-bind="value: currentTypeSettings().height, enable: tabSettingsEnabled"> px
			</div>

			<div class="ws_dialog_subpanel" id="ame-separator-width-options">
				<h3 class="ws-ame-dialog-subheading">Width</h3>
				<fieldset data-bind="enable: tabSettingsEnabled">
					<p>
						<label>
							<input type="radio" name="ame-separator-width" value="full"
							       data-bind="checked: currentTypeSettings().widthStrategy">
							Full width
						</label>
					</p>
					<p>
						<label>
							<input type="radio" name="ame-separator-width" value="percentage"
							       data-bind="checked: currentTypeSettings().widthStrategy">
							<span class="ame-sp-label-text">Percentage</span>
						</label>
						<label for="ws-ame-separator-width-pct" class="hidden">
							Separator width as a percentage of menu width
						</label>
						<input type="number" id="ws-ame-separator-width-pct" min="1" max="100"
						       data-bind="value: currentTypeSettings().widthInPercent,
					       enable: (currentTypeSettings().widthStrategy() === 'percentage')"> %
					</p>
					<p>
						<label>
							<input type="radio" name="ame-separator-width" value="fixed"
							       data-bind="checked: currentTypeSettings().widthStrategy">
							<span class="ame-sp-label-text">Fixed width</span>
						</label>
						<label for="ws-ame-separator-width-px" class="hidden">Separator width in pixels</label>
						<input type="number" id="ws-ame-separator-width-px" min="1" max="300"
						       data-bind="value: currentTypeSettings().widthInPixels,
					       enable: (currentTypeSettings().widthStrategy() === 'fixed')"> px
					</p>
				</fieldset>
			</div>

			<div class="ws_dialog_subpanel">
				<h3 class="ws-ame-dialog-subheading">Margins</h3>
				<fieldset id="ame-separator-margins" data-bind="enable: tabSettingsEnabled">
					<label>
						<span class="ame-sp-label-text">Top:</span>
						<input type="number" min="0" max="300" data-bind="value: currentTypeSettings().marginTop"> px
					</label>
					<label>
						<span class="ame-sp-label-text">Bottom:</span>
						<input type="number" min="0" max="300" data-bind="value: currentTypeSettings().marginBottom"> px
					</label>
					<div class="ame-sp-flexbox-break"></div>
					<label>
						<span class="ame-sp-label-text">Left:</span>
						<input type="number" min="0" max="300" data-bind="value: currentTypeSettings().marginLeft"> px
					</label>
					<label>
						<span class="ame-sp-label-text">Right:</span>
						<input type="number" min="0" max="300" data-bind="value: currentTypeSettings().marginRight"> px
					</label>
				</fieldset>
			</div>

			<div class="ws_dialog_subpanel">
				<h3 class="ws-ame-dialog-subheading">Alignment</h3>
				<fieldset class="ws-ame-icon-radio-button-group" data-bind="enable: tabSettingsEnabled">
					<?php
					$options = array(
						'none'   => array('title' => 'None', 'icon' => 'dashicons-editor-justify'),
						'left'   => array('title' => 'Left', 'icon' => 'dashicons-editor-alignleft'),
						'center' => array('title' => 'Center', 'icon' => 'dashicons-editor-aligncenter'),
						'right'  => array('title' => 'Right', 'icon' => 'dashicons-editor-alignright'),
					);
					foreach ($options as $key => $properties):
						?>
						<label title="<?php echo esc_attr($properties['title']); ?>">
							<input type="radio" name="ame-separator-alignment" value="<?php echo esc_attr($key); ?>"
							       data-bind="checked: currentTypeSettings().alignment">
							<span class="dashicons <?php echo esc_attr($properties['icon']); ?>"></span>
						</label>
					<?php
					endforeach;
					?>
				</fieldset>
			</div>
		</div>
	</div>

	<div class="ws_dialog_buttons">
		<input type="button" class="button-primary" value="Save Changes" id="ws_save_separator_settings"
		       data-bind="click: onConfirm.bind($root)">
		<input type="button" class="button ws_close_dialog" value="Cancel" data-bind="click: onCancel.bind($root)">
	</div>
</div>
