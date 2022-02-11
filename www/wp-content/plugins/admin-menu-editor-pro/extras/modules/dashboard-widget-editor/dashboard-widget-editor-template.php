<div id="ame-dashboard-widget-editor">

	<?php require AME_ROOT_DIR . '/modules/actor-selector/actor-selector-template.php'; ?>

	<div id="ame-dashboard-widgets" data-bind="foreach: widgets">
		<div class="ame-dashboard-widget" data-bind="css: {'ame-open-dashboard-widget' : isOpen}">

			<div class="ame-widget-top">
				<a class="ame-widget-title-action" data-bind="click: toggle, if: false"></a>
				<div class="ame-widget-flags">
					<div class="ame-widget-flag ame-missing-widget-flag"
					     data-bind="visible: !isPresent, attr: {title: missingWidgetTooltip}"></div></div>
				<div class="ame-widget-title">
					<h3>
						<input type="checkbox" class="ame-widget-access-checkbox"
						       data-bind="checked: isEnabled, indeterminate: isIndeterminate" title="Visibility">
						<span data-bind="text: safeTitle"></span>&nbsp;
					</h3>
				</div>
			</div>

			<div class="ame-widget-properties">
				<ame-widget-property params="widget: $data, label: 'Title'">
					<input data-bind="value: title, enable: canChangeTitle" type="text"
					       class="ame-widget-property-value" title="Title">
				</ame-widget-property>

				<!-- ko template: { if: propertyTemplate, name: propertyTemplate, data: $data } --><!-- /ko -->

				<div data-bind="visible: areAdvancedPropertiesVisible">
					<ame-widget-property params="widget: $data, label: 'ID'">
						<input data-bind="value: id" type="text" class="ame-widget-property-value" readonly title="ID">
					</ame-widget-property>

					<ame-widget-property params="widget: $data, label: 'Location'">
						<input data-bind="value: location" type="text" class="ame-widget-property-value" readonly
						       title="Location">
					</ame-widget-property>

					<ame-widget-property params="widget: $data, label: 'Priority'">
						<select data-bind="value: priority, enable: canChangePriority"
						        class="ame-widget-property-value" title="Priority">
							<option value="high">high</option>
							<option value="sorted">sorted</option>
							<option value="core">core</option>
							<option value="default">default</option>
							<option value="low">low</option>
						</select>
					</ame-widget-property>
				</div>

				<div class="ame-widget-control-actions">
					<a href="#" class="ame-close-widget" data-bind="click: toggle">Close</a>
					<span data-bind="if: canBeDeleted">
						|
						<a href="#" class="ame-delete-widget"
						   data-bind="click: $parent.removeWidget.bind($parent)">Delete</a>
					</span>
				</div>
			</div>
		</div>
	</div>

	<div id="ame-major-widget-actions">
		<form method="post" data-bind="submit: saveChanges" action="<?php
			echo esc_attr(add_query_arg(
				array(
					'page' => 'menu_editor',
					'noheader' => '1',
					'sub_section' => 'dashboard-widgets',
				),
				admin_url('options-general.php')
			));
		?>">
			<?php
			submit_button('Save Changes', 'primary', 'submit', false);
			wp_nonce_field('save_widgets');
			?>

			<input type="hidden" name="action" value="save_widgets">
			<input type="hidden" name="data" value="" data-bind="value: widgetData">
			<input type="hidden" name="data_length" value="" data-bind="value: widgetDataLength">
			<input type="hidden" name="selected_actor" value="" data-bind="value: selectedActor">
		</form>

		<?php
		submit_button(
			'Add HTML Widget',
			'secondary',
			'ame-add-html-widget',
			false,
			array(
				'data-bind' => 'click: addHtmlWidget'
			)
		);

		submit_button(
			'Add RSS Widget',
			'secondary',
			'ame-add-rss-widget',
			false,
			array(
				'data-bind' => 'click: addRssWidget'
			)
		);
		?>

		<!-- Export form -->
		<?php
		$formActionUrl = admin_url('admin-ajax.php');
		?>

		<form
			action="<?php echo esc_attr($formActionUrl); ?>"
			method="post"
			target="ame-widget-export-frame"
			data-bind="submit: exportWidgets"
		>
			<?php wp_nonce_field('ws-ame-export-widgets'); ?>
			<input type="hidden" name="action" value="ws-ame-export-widgets">
			<input type="hidden" name="widgetData" value="" data-bind="value: widgetData">

			<?php submit_button(
				'Export',
				'secondary',
				'ame-export-widgets',
				false,
				array('data-bind' => 'enable: isExportButtonEnabled')
			); ?>
		</form>
		<!--suppress HtmlUnknownTarget -->
		<iframe name="ame-widget-export-frame" src="about:blank" style="display:none;"></iframe>

		<!-- Import button -->
		<?php
		submit_button(
			'Import',
			'secondary',
			'ame-import-widgets',
			false,
			array('data-bind' => 'click: openImportDialog')
		);
		?>
	</div>

	<div class="clear"></div>

	<?php require dirname(__FILE__) . '/import-dialog-template.php'; ?>
</div>

<div style="display: none;">
	<template id="ame-widget-property-template">
		<label>
			<!-- ko if: label -->
				<span class="ame-widget-property-name" data-bind="text: label"></span><br>
			<!-- /ko -->
			<!-- ko template: { nodes: $componentTemplateNodes, data: widget } --><!-- /ko -->
		</label>
	</template>

	<template id="ame-custom-html-widget-template">
		<ame-widget-property params="widget: $data, label: 'Content'">
			<textarea data-bind="value: content"
			          class="ame-widget-property-value"
			          title="Content"
			          rows="10">
			</textarea>
		</ame-widget-property>

		<ame-widget-property params="widget: $data, label: ''">
			<input type="checkbox"
			       data-bind="checked: filtersEnabled"
			       class="ame-widget-property-value"
			       title="Enable filters like automatic paragraphs, smart quotes and automatic tag balancing">
			Apply content filters
		</ame-widget-property>
	</template>

	<template id="ame-custom-rss-widget-template">
		<ame-widget-property params="widget: $data, label: 'Feed URL'">
			<input type="url"
			       data-bind="value: feedUrl"
			       class="ame-widget-property-value"
			       title="The URL of the RSS feed">
		</ame-widget-property>

		<ame-widget-property params="widget: $data, label: 'Max. items to show'">
			<input type="number"
			       data-bind="value: maxItems"
			       min="1"
			       max="20"
			       class="ame-widget-property-value"
			       title="Max items">
		</ame-widget-property>

		<ame-widget-property params="widget: $data, label: ''">
			<input type="checkbox"
			       data-bind="checked: showAuthor"
			       class="ame-widget-property-value"
			       title="Show author">
			Show author
		</ame-widget-property>

		<ame-widget-property params="widget: $data, label: ''">
			<input type="checkbox"
			       data-bind="checked: showDate"
			       class="ame-widget-property-value"
			       title="Show date">
			Show date
		</ame-widget-property>

		<ame-widget-property params="widget: $data, label: ''">
			<input type="checkbox"
			       data-bind="checked: showSummary"
			       class="ame-widget-property-value"
			       title="Show summary">
			Show summary
		</ame-widget-property>
	</template>

	<template id="ame-welcome-widget-template">
		<p class="howto">
			This is a special widget. It can't be renamed or moved. Only users who have
			the <code>edit_theme_options</code> capability can see it.
		</p>
	</template>
</div>