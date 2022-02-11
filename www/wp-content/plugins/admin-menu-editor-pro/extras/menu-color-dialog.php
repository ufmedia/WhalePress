<div id="ws-ame-menu-color-settings" title="Colors">
	<div id="ame-color-preset-container">
		<label for="ame-menu-color-presets" class="hidden"><strong>Presets</strong></label>

		<select id="ame-menu-color-presets">
			<option value="" selected="selected" disabled="disabled" class="ame-meta-option">
				Select a preset
			</option>

			<option value="[global]" class="ame-meta-option" id="ame-global-colors-preset">
				Use default settings
			</option>

			<option disabled class="ame-meta-option" id="ame-color-preset-separator">
				<?php echo str_repeat('&#9472;', 25); ?>
			</option>

			<option value="[save_preset]" id="ws-ame-save-color-preset" class="ame-meta-option">
				Save current settings as a preset...
			</option>
		</select>

		<a id="ws-ame-delete-color-preset" href="#" class="hidden">Delete preset</a>
	</div>

	<?php
	$menuColors = array(
		'base-color'       => 'Background',
		'text-color'       => 'Text',
		'highlight-color'  => 'Highlight',
		'icon-color' => 'Icon',

		'menu-highlight-text' => 'Highlight text',
		'menu-highlight-icon' => 'Highlight icon',
		'menu-highlight-background' => 'Highlight background',

		'menu-current-text' => 'Current text',
		'menu-current-icon' => 'Current icon',
		'menu-current-background' => 'Current background',

		'menu-submenu-text' => 'Submenu text',
		'menu-submenu-background' => 'Submenu background',
		'menu-submenu-focus-text' => 'Submenu highlight text',
		'menu-submenu-current-text' => 'Submenu current text',

		'menu-bubble-text' => 'Bubble text',
		'menu-bubble-background' => 'Bubble background',
		'menu-bubble-current-text' => 'Bubble current text',
		'menu-bubble-current-background' => 'Bubble current background',
	);

	$basicColors = array(
		'base-color'       => true,
		'text-color'       => true,
		'highlight-color'  => true,
		'icon-color' => true,
	);

	$itemsPerColumn = 9;
	$count = 0;

	echo '<div id="ame-menu-color-list">';
	echo '<div class="ame-menu-color-column">';

	foreach($menuColors as $id => $title) {
		$count++;

		if ( $count > $itemsPerColumn ) {
			echo '</div><div class="ame-menu-color-column">';
			$count = 1;
		}

		printf(
			'<div class="ame-color-option %3$s">
				<label for="ame-color-%2$s">
					<span class="ame-menu-color-name">%1$s</span>
				</label>
				<input type="text" class="ame-color-picker" name="%2$s" id="ame-color-%2$s">
			</div>',
			$title,
			esc_attr($id),
			isset($basicColors[$id]) ? '' : 'ame-advanced-menu-color'
		);
	}

	echo '</div>';
	echo '<div style="clear: both;"></div>';
	echo '</div>';

	?>

	<a id="ws-ame-show-advanced-colors" href="javascript:void(0)">Show advanced options</a>


	<div class="ws_dialog_buttons">
		<?php submit_button('Save Changes', 'primary', 'ws-ame-save-menu-colors', false); ?>
		<?php submit_button('Apply to All', 'secondary', 'ws-ame-apply-colors-to-all', false); ?>
		<input type="button" class="button ws_close_dialog" value="Cancel" autofocus="autofocus">
	</div>
</div>