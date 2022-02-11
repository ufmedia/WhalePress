<div id="ws-ame-menu-heading-settings" title="Menu Headings" style="display: none;">
	<div class="ws_dialog_panel">
		<div class="ame-scrollable-dialog-content">

			<div class="ws_dialog_subpanel">
				<h3 class="ws-ame-dialog-subheading">Text color</h3>
				<fieldset>
					<p>
						<label>
							<input type="radio" name="ame-heading-text-color-type" value="default"
							       data-bind="checked: settings.textColorType">
							Use menu text color
						</label>
					</p>
					<p>
						<label>
							<input type="radio" name="ame-heading-text-color-type" value="custom"
							       data-bind="checked: settings.textColorType">
							<span class="ame-fixed-label-text">Custom</span>
						</label>
						<label for="ame-custom-heading-text-color" class="hidden">Custom heading text color</label>
						<input type="text" id="ame-custom-heading-text-color"
						       data-bind="ameColorPicker: settings.textColor">
					</p>

				</fieldset>
			</div>

			<div class="ws_dialog_subpanel">
				<h3 class="ws-ame-dialog-subheading">Background color</h3>
				<fieldset>
					<p>
						<label>
							<input type="radio" name="ame-heading-background-color-type" value="default"
							       data-bind="checked: settings.backgroundColorType">
							Use menu background color
						</label>
					</p>
					<p>
						<label>
							<input type="radio" name="ame-heading-background-color-type" value="custom"
							       data-bind="checked: settings.backgroundColorType">
							<span class="ame-fixed-label-text">Custom</span>
						</label>
						<label for="ame-custom-heading-text-color" class="hidden">Custom heading background
							color</label>
						<input type="text" id="ame-custom-heading-text-color"
						       data-bind="ameColorPicker: settings.backgroundColor">
					</p>

				</fieldset>
			</div>

			<div class="ws_dialog_subpanel">
				<h3 class="ws-ame-dialog-subheading">Font</h3>
				<fieldset>
					<p>
						<label for="ame-heading-font-size-value">
							<span class="ame-fixed-label-text">Font size</span>
						</label>
						<input type="number" name="ame-heading-font-size-value" id="ame-heading-font-size-value"
						       min="1" max="400" size="5"
						       data-bind="value: settings.fontSizeValue">

						<label for="ame-heading-font-size-unit" class="hidden">Font size units</label>
						<select name="ame-heading-font-size-unit" id="ame-heading-font-size-unit"
						        class="ame-inline-select-with-input"
						        data-bind="value: settings.fontSizeUnit">
							<option value="percentage">%</option>
							<option value="px">px</option>
							<option value="em">em</option>
						</select>
					</p>

					<p>
						<label>
							<span class="ame-fixed-label-text">Font weight</span>
							<select name="ame-heading-font-weight" data-bind="value: settings.fontWeight">
								<?php
								$weightOptions = ['inherit', 'normal', 'bold', 'lighter', 'bolder'];
								for ($i = 100; $i <= 900; $i = $i + 100) {
									$weightOptions[] = $i;
								}
								foreach ($weightOptions as $option) {
									printf('<option value="%s">%s</option>', esc_attr($option), esc_html(ucfirst($option)));
								}
								?>
							</select>
						</label>
					</p>

					<p>
						<label>
							<span class="ame-fixed-label-text">Transform</span>
							<select name="ame-heading-text-transform" id="ame-heading-text-transform"
							        data-bind="value: settings.textTransform">
								<?php
								$transformOptions = ['none', 'capitalize', 'uppercase', 'lowercase', 'full-width'];
								foreach ($transformOptions as $option) {
									printf('<option value="%s">%s</option>', esc_attr($option), esc_html(ucfirst($option)));
								}
								?>
							</select>
						</label>
					</p>
				</fieldset>
			</div>

			<div class="ws_dialog_subpanel">
				<h3 class="ws-ame-dialog-subheading">Bottom border</h3>
				<fieldset id="ame-heading-bottom-border-style" class="ame-css-border-styles">
					<?php
					$styleOptions = array(
						'none'   => 'No border',
						'solid'  => 'Solid',
						'dashed' => 'Dashed',
						'double' => 'Double',
						'dotted' => 'Dotted',
					);
					foreach ($styleOptions as $style => $label):
						?>
						<p>
							<label>
								<input type="radio" name="ame-heading-bb-style" value="<?php echo esc_attr($style); ?>"
								       data-bind="checked: settings.bottomBorder.style">
								<span class="ame-fixed-label-text"><?php echo $label; ?></span>
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
				<h3 class="ws-ame-dialog-subheading"><label for="ws-ame-heading-border-width">Border width</label></h3>
				<input type="number" id="ws-ame-heading-border-width" min="1" max="50" size="4" value="10"
				       data-bind="value: settings.bottomBorder.width"> px
			</div>

			<div class="ws_dialog_subpanel">
				<h3 class="ws-ame-dialog-subheading">Show the icon</h3>
				<label for="ame-heading-icon-visibility" class="hidden">Heading icon visibility setting</label>
				<select name="ame-heading-icon-visibility" id="ame-heading-icon-visibility"
				        data-bind="value: settings.iconVisibility">
					<?php
					$visibilityOptions = [
						'always'       => 'Always',
						'never'        => 'Never',
						'if-collapsed' => 'Only when the menu is collapsed',
					];
					foreach ($visibilityOptions as $option => $text) {
						printf('<option value="%s">%s</option>', esc_attr($option), esc_html($text));
					}
					?>
				</select>
			</div>

			<div class="ws_dialog_subpanel">
				<h3 class="ws-ame-dialog-subheading">Padding</h3>
				<fieldset>
					<p>
						<label>
							<input type="radio" name="ame-heading-padding-type" value="auto"
							       data-bind="checked: settings.paddingType">
							Automatic
						</label>
					</p>
					<p>
						<label>
							<input type="radio" name="ame-heading-padding-type" value="custom"
							       data-bind="checked: settings.paddingType">
							Custom
						</label>
					</p>
				</fieldset>
				<fieldset class="ame-box-side-sizes" data-bind="enable: (settings.paddingType() === 'custom')">
					<label>
						<span class="ame-fixed-label-text">Top:</span>
						<input type="number" min="0" max="300" data-bind="value: settings.paddingTop"> px
					</label>
					<label>
						<span class="ame-fixed-label-text">Bottom:</span>
						<input type="number" min="0" max="300" data-bind="value: settings.paddingBottom"> px
					</label>
					<div class="ame-flexbox-break"></div>
					<label>
						<span class="ame-fixed-label-text">Left:</span>
						<input type="number" min="0" max="300" data-bind="value: settings.paddingLeft"> px
					</label>
					<label>
						<span class="ame-fixed-label-text">Right:</span>
						<input type="number" min="0" max="300" data-bind="value: settings.paddingRight"> px
					</label>
				</fieldset>
			</div>

			<div class="ws_dialog_subpanel">
				<h3 class="ws-ame-dialog-subheading">Collapsible headings</h3>
				<fieldset>
					<p>
						<label>
							<input type="checkbox" data-bind="checked: settings.collapsible">
							Hide the menu items below the heading on click
						</label>
					</p>
				</fieldset>
			</div>
		</div>
	</div>

	<div class="ws_dialog_buttons">
		<input type="button" class="button-primary" value="Save Changes" id="ws_save_menu_heading_settings"
		       data-bind="click: onConfirm.bind($root)">
		<input type="button" class="button ws_close_dialog" value="Cancel" data-bind="click: onCancel.bind($root)">
	</div>
</div>