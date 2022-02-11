<?php
/**
 * Variables set by ameModule when it outputs a template.
 *
 * @var string $moduleTabUrl
 * @var array $settingsErrors
 */

//Show errors encountered while saving changes.
if (!empty($settingsErrors)) {
	echo '<div class="notice notice-error">';
	foreach ($settingsErrors as $error) {
		/** @var WP_Error $error */
		if (!($error instanceof WP_Error)) {
			continue;
		}
		printf('<p title="%s">%s</p>', esc_attr($error->get_error_code()), esc_html($error->get_error_message()));
	}
	echo '</div>';
}

if (!empty($_GET['no-changes-made'])) {
	?>
	<div class="notice notice-info is-dismissible" id="ame-rex-no-changes">
		<p><strong>No changes were made.</strong></p>
	</div>
	<?php
}

require AME_ROOT_DIR . '/modules/actor-selector/actor-selector-template.php';
?>

<div id="ame-role-editor-root">
	<div data-bind="visible: !isLoaded()" id="rex-loading-message">Loading...</div>

	<div id="rex-main-ui" data-bind="visible: isLoaded" style="display: none;">
		<div id="rex-content-container">
			<div id="rex-user-role-list" data-bind="visible: userRoleModule.isVisible">
				<div data-bind="template: {name: 'rex-user-role-list-template', data: userRoleModule}"></div>
			</div>

			<div id="rex-category-sidebar">
				<div class="rex-dropdown-trigger"
				     data-target-dropdown-id="rex-category-list-options">
					<div class="dashicons dashicons-admin-generic"></div>
				</div>

				<ul data-bind="template: {name: 'rex-nav-item-template', data: rootCategory}"
				    id="rex-category-navigation"></ul>
			</div>

			<div id="rex-capability-view-container">
				<div id="rex-view-toolbar">
					<input type="search" title="Filter capabilities" placeholder="Search" id="rex-quick-search-query"
					       data-bind="textInput: searchQuery">
					<label for="rex-quick-search-query" class="screen-reader-text">Search capabilities</label>

					<label>
						<input type="checkbox" data-bind="checked: readableNamesEnabled"> Readable names
					</label>

					<button class="button rex-dropdown-trigger" id="rex-misc-view-options-button"
					        data-target-dropdown-id="rex-general-view-options">
						Options <span class="dashicons dashicons-arrow-down"></span>
					</button>

					<label for="rex-category-view-selector" class="screen-reader-text">Select the category view</label>
					<select id="rex-category-view-selector" title="Choose the category view"
					        data-bind="
					            options: categoryViewOptions,
								optionsText: 'label',
								value: categoryViewMode">
					</select>
				</div>
				<div id="rex-capability-view" data-bind="class: capabilityViewClasses,
					template: categoryViewMode().templateName">
				</div>
			</div>
		</div>

		<div id="rex-action-sidebar">
			<?php
			if (is_multisite() && is_super_admin() && is_network_admin()) {
				submit_button(
					'Update All Sites',
					'primary rex-action-button',
					'rex-global-save-changes-button',
					false,
					array(
						'disabled'  => 'disabled',
						'data-bind' => 'enable: (!$root.isSaving() && $root.isLoaded()), click: updateAllSites',
					)
				);
			} else {
				submit_button(
					'Save Changes',
					'primary rex-action-button',
					'rex-save-changes-button',
					false,
					array(
						'disabled'  => 'disabled',
						'data-bind' => 'enable: (!$root.isSaving() && $root.isLoaded()), click: saveChanges',
					)
				);
			}
			?>
			<div class="rex-action-separator"></div>
			<?php
			submit_button(
				'Add role',
				'rex-action-button',
				'rex-add-role-button',
				false,
				array('data-bind' => 'ameOpenDialog: "#rex-add-role-dialog"')
			);

			submit_button(
				'Rename role',
				'rex-action-button',
				'rex-rename-role-button',
				false,
				array('data-bind' => 'ameOpenDialog: "#rex-rename-role-dialog"')
			);

			submit_button(
				'Delete role',
				'rex-action-button',
				'rex-delete-role-button',
				false,
				array('data-bind' => 'ameOpenDialog: "#rex-delete-role-dialog"')
			);
			?>
			<div class="rex-action-separator"></div>
			<?php
			submit_button(
				'Add capability',
				'rex-action-button',
				'rex-add-capability-button',
				false,
				array('data-bind' => 'ameOpenDialog: "#rex-add-capability-dialog"')
			);

			submit_button(
				'Delete capability',
				'rex-action-button',
				'rex-delete-capability-button',
				false,
				array('data-bind' => 'ameOpenDialog: "#rex-delete-capability-dialog"')
			);

			?>
			<div class="rex-action-separator"></div>
			<?php
			submit_button(
				'Editable roles',
				'rex-action-button',
				'rex-editable-roles-button',
				false,
				array('data-bind' => 'ameOpenDialog: "#rex-editable-roles-dialog"')
			);
			?>

			<form action="<?php echo esc_attr(add_query_arg('noheader', '1', $moduleTabUrl)); ?>"
			      method="post"
			      id="rex-save-settings-form"
			      style="display: none;">

				<input type="hidden" name="action" value="ame-save-role-settings">
				<?php wp_nonce_field('ame-save-role-settings'); ?>

				<input type="hidden" name="settings" value="" data-bind="value: settingsFieldData">
				<input type="hidden" name="selectedActor" value=""
				       data-bind="value: selectedActor() ? selectedActor().id : ''">
				<input type="hidden" name="isGlobalUpdate" value=""
				       data-bind="value: (isGlobalSettingsUpdate() ? '1' : '')">
			</form>
		</div>

	</div>

	<div id="rex-category-list-options" class="rex-dropdown" style="display: none;">
		<label class="rex-dropdown-item">
			<input type="checkbox" data-bind="checked: showNumberOfCapsEnabled"> Show number of capabilities
		</label>
		<label class="rex-dropdown-item rex-dropdown-sub-item">
			<input type="checkbox" data-bind="checked: showGrantedCapCountEnabled, enable: showNumberOfCapsEnabled">
			Show granted
		</label>
		<label class="rex-dropdown-item rex-dropdown-sub-item">
			<input type="checkbox" data-bind="checked: showTotalCapCountEnabled, enable: showNumberOfCapsEnabled"> Show
			total
		</label>
		<label class="rex-dropdown-item rex-dropdown-sub-item">
			<input type="checkbox" data-bind="checked: showZerosEnabled, enable: showNumberOfCapsEnabled"> Show zeros
		</label>
	</div>

	<div id="rex-general-view-options" class="rex-dropdown" style="display: none;">
		<label class="rex-dropdown-item">
			<input type="checkbox" data-bind="checked: showOnlyCheckedEnabled"> Show only checked
		</label>
		<label class="rex-dropdown-item">
			<input type="checkbox" data-bind="checked: showDeprecatedEnabled"> Show deprecated
		</label>
		<label class="rex-dropdown-item">
			<input type="checkbox" data-bind="checked: showRedundantEnabled"> Show redundant
		</label>

		<label class="rex-dropdown-item">
			<input type="checkbox"
			       data-bind="checked: inheritanceOverrideEnabled, enable: (selectedActor() instanceof RexUser)">
			Allow editing inherited capabilities
		</label>

		<fieldset class="rex-dropdown-item">
			<strong class="rex-dropdown-item">Category box width</strong>
			<label class="rex-dropdown-item rex-dropdown-sub-item">
				<input type="radio" value="adaptive" data-bind="checked: categoryWidthMode">  Adaptive
			</label>
			<label class="rex-dropdown-item rex-dropdown-sub-item">
				<input type="radio" value="full" data-bind="checked: categoryWidthMode"> Full
			</label>
		</fieldset>
	</div>

	<!-- Permission tooltip content -->
	<div style="display: none;">
		<div id="rex-permission-tip" data-bind="if: permissionTipSubject">
			<div class="rex-permission-description"
			     data-bind="if: permissionTipSubject().mainDescription">
				<span data-bind="text: permissionTipSubject().mainDescription"></span>
			</div>
			<code data-bind="text: permissionTipSubject().capability.name"></code>

			<div class="rex-tooltip-section-container">
				<!-- ko if: (selectedActor() && selectedActor().canHaveRoles) -->
				<div class="rex-tooltip-section">
					<h4>Inheritance</h4>
					<table class="widefat rex-capability-inheritance-breakdown">
						<tbody
							data-bind="foreach: selectedActor().getInheritanceDetails(permissionTipSubject().capability)">
						<tr data-bind="css: {'rex-is-decisive-actor': isDecisive}">
							<td data-bind="text: name" class="rex-inheritance-actor-name"></td>
							<td data-bind="text: description"></td>
						</tr>
						</tbody>
					</table>
				</div>
				<!-- /ko -->

				<!-- ko if: permissionTipSubject().capability.notes -->
				<div class="rex-tooltip-section">
					<h4>Notes</h4>
					<span data-bind="text: permissionTipSubject().capability.notes"></span>
				</div>
				<!-- /ko -->

				<!-- ko if: permissionTipSubject().capability.grantedPermissions().length > 0 -->
				<div class="rex-tooltip-section">
					<h4>Permissions</h4>
					<ul data-bind="foreach: permissionTipSubject().capability.grantedPermissions()"
					    class="rex-tip-granted-permissions">
						<li data-bind="text: $data"></li>
					</ul>
				</div>
				<!-- /ko -->

				<div data-bind="if: permissionTipSubject().capability.originComponent" class="rex-tooltip-section">
					<h4>Origin</h4>
					<span data-bind="text: permissionTipSubject().capability.originComponent.name"></span>
				</div>

				<div data-bind="if: permissionTipSubject().capability.getDocumentationUrl()"
				     class="rex-tooltip-section">
					<h4>See also</h4>
					<span>
						<a href="#"
						   target="_blank"
						   class="rex-documentation-link"
						   data-bind="text: permissionTipSubject().capability.getDocumentationUrl(),
					    attr: {href: permissionTipSubject().capability.getDocumentationUrl()}"></a>
					</span>
				</div>
			</div>
		</div>
	</div>

	<div id="rex-delete-capability-dialog"
	     data-bind="ameDialog: deleteCapabilityDialog, ameEnableDialogButton: deleteCapabilityDialog.isDeleteButtonEnabled"
	     title="Delete capability"
	     style="display: none;" class="rex-dialog">
		<p class="rex-dialog-section">
			Select capabilities to remove from all roles:
		</p>

		<div class="rex-deletable-capability-container"
		     data-bind="visible: (deleteCapabilityDialog.deletableItems().length > 0)">
			<ul data-bind="foreach: deleteCapabilityDialog.deletableItems" class="rex-deletable-capability-list">
				<li>
					<label>
						<input type="checkbox" data-bind="checked: isSelected">
						<span data-bind="text: capability.displayName" class="rex-capability-name"></span>
					</label>
				</li>
			</ul>
		</div>

		<p class="rex-dialog-section" data-bind="visible: (deleteCapabilityDialog.deletableItems().length <= 0)">
			There are no custom capabilities that can be deleted.
		</p>
	</div>

	<div id="rex-add-capability-dialog"
	     data-bind="ameDialog: addCapabilityDialog, ameEnableDialogButton: addCapabilityDialog.isAddButtonEnabled"
	     title="Add capability"
	     style="display: none;" class="rex-dialog">

		<form data-bind="submit: addCapabilityDialog.onConfirm.bind(addCapabilityDialog)">
			<label for="rex-new-capability-name">
				Capability name:
			</label>
			<input type="text" data-bind="textInput: addCapabilityDialog.capabilityName" id="rex-new-capability-name"
			       maxlength="150">

			<p id="rex-add-capability-validation-message">
			<span class="dashicons dashicons-dismiss"
			      data-bind="visible: (addCapabilityDialog.validationState() === 'error')"></span>
				<span class="dashicons dashicons-info"
				      data-bind="visible: (addCapabilityDialog.validationState() === 'notice')"></span>
				<span data-bind="html: addCapabilityDialog.validationMessage"></span>
			</p>
		</form>
	</div>

	<div id="rex-add-role-dialog"
	     data-bind="ameDialog: addRoleDialog, ameEnableDialogButton: addRoleDialog.isAddButtonEnabled"
	     title="Add role"
	     style="display: none;" class="rex-dialog">

		<!-- ko if: addRoleDialog.isRendered -->
		<form data-bind="submit: addRoleDialog.onConfirm.bind(addRoleDialog)">
			<p class="rex-dialog-section">
				<label for="rex-new-role-display-name">
					Display name:
				</label>
				<input type="text" data-bind="textInput: addRoleDialog.roleDisplayName" id="rex-new-role-display-name"
				       maxlength="150" placeholder="New Role Name">
			</p>

			<p class="rex-dialog-section">
				<label for="rex-new-role-name">
					Role name (ID):
				</label>
				<input type="text" data-bind="textInput: addRoleDialog.roleName" id="rex-new-role-name"
				       maxlength="150" placeholder="new_role_name">
			</p>

			<p class="rex-dialog-section">
				<label for="rex-new-role-copy-caps">
					Copy capabilities from:
				</label>
				<select id="rex-new-role-copy-caps" data-bind="value: addRoleDialog.roleToCopyFrom">
					<option data-bind="value: null">None</option>

					<!-- ko if: $root.defaultRoles().length > 0 -->
					<optgroup label="Built-In" data-bind="foreach: $root.defaultRoles">
						<option data-bind="text: displayName, value: $data"></option>
					</optgroup>
					<!-- /ko -->

					<!-- ko if: $root.customRoles().length > 0 -->
					<optgroup label="Custom" data-bind="foreach: $root.customRoles">
						<option data-bind="text: displayName, value: $data"></option>
					</optgroup>
					<!-- /ko -->
				</select>
			</p>

			<!--
			As an alternative to clicking the "Add Role" button, the user can
			confirm their inputs by pressing Enter.
			-->
			<input type="submit" name="hidden-submit-trigger" style="display: none;">
		</form>
		<!-- /ko -->
	</div>

	<div id="rex-delete-role-dialog"
	     data-bind="ameDialog: deleteRoleDialog, ameEnableDialogButton: deleteRoleDialog.isDeleteButtonEnabled"
	     title="Delete role"
	     style="display: none;" class="rex-dialog">

		<!-- ko if: deleteRoleDialog.isRendered -->
		<span>Select roles to delete:</span>

		<div class="rex-deletable-role-list-container">
			<table class="widefat rex-deletable-role-list">
				<tbody>
				<!-- ko if: $root.roles().length > 0 -->
				<!-- ko template: {
					name: 'rex-deletable-role-template',
					foreach: $root.roles
				} -->
				<!-- /ko -->
				<!-- /ko -->
				</tbody>
			</table>
		</div>
		<!-- /ko -->

		<!-- ko if: !deleteRoleDialog.isRendered() -->
		<div style="height: 400px">(Placeholder.)</div>
		<!-- /ko -->
	</div>

	<div id="rex-rename-role-dialog"
	     data-bind="ameDialog: renameRoleDialog, ameEnableDialogButton: renameRoleDialog.isConfirmButtonEnabled"
	     title="Rename role"
	     style="display: none;" class="rex-dialog">

		<!-- ko if: renameRoleDialog.isRendered -->
		<form data-bind="submit: renameRoleDialog.onConfirm.bind(renameRoleDialog)">
			<p class="rex-dialog-section">
				<label for="rex-role-to-rename">
					Select role to rename:
				</label>
				<select id="rex-role-to-rename" data-bind="value: renameRoleDialog.selectedRole">
					<!-- ko if: $root.defaultRoles().length > 0 -->
					<optgroup label="Built-In" data-bind="foreach: $root.defaultRoles">
						<option data-bind="text: (displayName() + ' (' + name() + ')'), value: $data"></option>
					</optgroup>
					<!-- /ko -->

					<!-- ko if: $root.customRoles().length > 0 -->
					<optgroup label="Custom" data-bind="foreach: $root.customRoles">
						<option data-bind="text: (displayName() + ' (' + name() + ')'), value: $data"></option>
					</optgroup>
					<!-- /ko -->
				</select>
			</p>

			<p class="rex-dialog-section">
				<label for="rex-edited-role-display-name">
					New display name:
				</label>
				<input type="text" data-bind="textInput: renameRoleDialog.newDisplayName" id="rex-edited-role-display-name"
				       maxlength="150" placeholder="New Role Name">
			</p>

			<input type="submit" name="hidden-submit-trigger" style="display: none;">
		</form>
		<!-- /ko -->
	</div>

    <div id="rex-editable-roles-dialog" title="Editable roles" class="rex-dialog"
         style="display: none;"
         data-bind="ameDialog: editableRolesDialog">
	    <!-- ko template: {
	        name: 'rex-editable-roles-screen-template',
	        data: editableRolesDialog
	    } -->
	    <!-- /ko -->
    </div>
</div>

<script type="text/html" id="rex-nav-item-template">
	<li class="rex-nav-item" data-bind="css: navCssClasses, click: $root.selectedCategory, visible: isNavVisible">
		<span class="rex-nav-toggle" data-bind="
			visible: (parent !== null),
			click: toggleSubcategories.bind($data),
			clickBubble: false">
		</span>
		<span data-bind="text: name, attr: { title: subtitle }" class="rex-nav-item-header"></span>

		<!-- ko if: isCapCountVisible -->
		<span class="rex-capability-count"
		      data-bind="css: {'rex-all-capabilities-enabled': areAllPermissionsEnabled},
		      attr: {title: enabledCapabilityCount() + ' of ' + totalCapabilityCount() + ' capabilities' }"><!--
		    ko if: isEnabledCapCountVisible
			--><span data-bind="text: enabledCapabilityCount" class="rex-enabled-capability-count"></span><!-- /ko
			--><!--
			ko if: $root.showTotalCapCountEnabled()
			--><span data-bind="text: totalCapabilityCount" class="rex-total-capability-count"></span><!-- /ko
		--></span>
		<!-- /ko -->
	</li>

	<!-- ko if: (subcategories.length > 0) -->
	<!-- ko template: {
			name: 'rex-nav-item-template',
			foreach: navSubcategories
		} -->
	<!-- /ko -->
	<!-- /ko -->
</script>

<script type="text/html" id="rex-category-template">
	<div class="rex-category" data-bind="css: cssClasses(), visible: isVisible,
		attr: { 'id': htmlId }">
		<div class="rex-category-header">
			<div class="rex-category-name" data-bind="text: name, attr: {title: subtitle}"></div>
			<div class="rex-category-subheading" data-bind="text: subheading, attr: {title: subheading}"></div>
		</div>
		<div class="rex-category-contents" data-bind="template: { name: contentTemplate }">
		</div>
	</div>
</script>

<script type="text/html" id="rex-default-category-content-template">
	<!-- ko if: subcategories.length > 0 -->
	<!-- ko template: {
		name: 'rex-category-template',
		foreach: sortedSubcategories
	 } -->
	<!-- /ko -->
	<!-- /ko -->

	<!-- ko if: (permissions().length > 0) -->
	<div class="rex-permission-list" data-bind="template: {name: 'rex-permission-template', foreach: permissions}">
	</div>
	<!-- /ko -->
</script>

<script type="text/html" id="rex-permission-table-template">
	<table class="widefat rex-permission-table">
		<thead>
		<tr>
			<th class="rex-category-name-column"></th>
			<!-- ko foreach: tableColumns -->
			<th scope="col" data-bind="text: title"></th>
			<!-- /ko -->
		</tr>
		</thead>

		<tbody data-bind="foreach: {data: sortedSubcategories, as: 'category'}">
		<tr data-bind="visible: isVisible">
			<th scope="row" data-bind="attr: {title: subtitle}">
				<label>
					<input type="checkbox" data-bind="checked: areAllPermissionsEnabled, enable: areAnyPermissionsEditable">
					<span data-bind="text: name"></span>
				</label>

				<div data-bind="visible: (subtitle !== null)">
					<!--suppress HtmlFormInputWithoutLabel -->
					<input type="checkbox" readonly disabled style="visibility: hidden" title="Hidden placeholder">
					<span class="rex-category-subtitle" data-bind="text: subtitle"></span>
				</div>
			</th>

			<!-- ko foreach: {data: $parent.tableColumns, as: 'column'} -->
			<td data-bind="visible: !category.isBaseCapNoticeVisible()">
				<div data-bind="foreach: column.actions" class="">
					<!-- ko if: category.actions.hasOwnProperty($data) -->
					<!-- ko with: category.actions[$data] -->
					<!-- ko template: 'rex-permission-template' -->
					<!-- /ko -->
					<!-- /ko -->
					<!-- /ko -->
				</div>
			</td>
			<!-- /ko -->

			<!-- ko if: isBaseCapNoticeVisible -->
			<td class="rex-base-cap-notice" data-bind="attr: {colspan: $parent.tableColumns().length}">
				Uses "<span data-bind="text: getBaseCategory().name"></span>" capabilities.
			</td>
			<!-- /ko -->
		</tr>
		</tbody>
	</table>
</script>

<script type="text/html" id="rex-permission-template">
	<div class="rex-permission" data-bind="
					visible: isVisible,
					css: {
							'rex-is-redundant': isRedundant,
							'rex-is-deprecated-capability': capability.isDeprecated,
							'rex-is-explicitly-denied': capability.isExplicitlyDenied,
							'rex-is-inherited': capability.isInherited,
							'rex-is-personal-override': capability.isPersonalOverride
						}">
		<label data-bind="attr: {title: capability.name}">
			<input
				data-bind="checked: capability.isEnabledForSelectedActor, enable: capability.isEditable"
				type="checkbox">
			<span data-bind="html: labelHtml" class="rex-capability-name"></span>
		</label>
		<span class="rex-permission-tip-trigger"><span class="dashicons dashicons-info"></span></span>
	</div>
</script>

<script type="text/html" id="rex-hierarchy-view-template">
	<!-- ko template: {
		name: 'rex-category-template',
		foreach: rootCategory.sortedSubcategories
	} -->
	<!-- /ko -->
</script>

<script type="text/html" id="rex-list-view-template">
	<div class="rex-permission-list" id="rex-permission-list-view"
	     data-bind="template: {name: 'rex-permission-template', foreach: allCapabilitiesAsPermissions}">
	</div>
</script>

<script type="text/html" id="rex-single-category-view-template">
	<div id="rex-category-view-spacer"></div>
	<!-- ko template: {
		name: 'rex-category-template',
		foreach: leafCategories
	} -->
	<!-- /ko -->
</script>

<script type="text/html" id="rex-deletable-role-template">
	<tr>
		<td class="rex-role-name-column" data-bind="attr: { title: name }">
			<label>
				<input
					data-bind="enable: $root.canDeleteRole($data),
						checked: $root.deleteRoleDialog.getSelectionState(name())"
					type="checkbox">
				<span data-bind="text: displayName"></span>
			</label>
		</td>
		<td class="rex-role-usage-column">
			<span data-bind="if: $root.isDefaultRoleForNewUsers($data)"
			      title="This is the default role for new users">
				Default role
			</span>
			<span data-bind="if: hasUsers && !$root.isDefaultRoleForNewUsers($data)"
			      title="This role is still assigned to one or more users">
				In use
			</span>
		</td>
	</tr>
</script>

<script type="text/html" id="rex-editable-roles-screen-template">
	<div id="rex-editable-roles-container">
		<div class="ame-role-table-container">
			<table class="widefat ame-role-table">
				<tbody data-bind="foreach: visibleActors">
				<tr data-bind="css: {
					'alternate': (($index() % 2) === 0),
					'ame-selected-role-table-row': $data === $parent.selectedActor()
				}, click: $parent.selectItem.bind($parent)">
					<td class="ame-column-role-name">
						<span data-bind="text: $parent.getItemText($data)"></span>
					</td>
					<td class="ame-column-selected-role-tip">
						<div class="ame-selected-role-tip">
							<svg xmlns="http://www.w3.org/2000/svg" class="ame-rex-svg-triangle" viewBox="0 0 50 100">
								<polygon points="51,0 0,50 51,100"/>
							</svg>
						</div>
					</td>
				</tr>
				</tbody>
			</table>
		</div>
		<div id="rex-editable-roles-options">
			<fieldset>
				<p><label>
						<input type="radio" value="auto" data-bind="checked: editableRoleStrategy, enable: isAutoStrategyAllowed"
						       name="editable-roles-behaviour">
						Automatic
						<br><span class="description">
							Only allows to assign the roles that have the same or fewer capabilities.
						</span>
					</label></p>
				<p><label>
						<input type="radio" value="none" data-bind="checked: editableRoleStrategy"
						       name="editable-roles-behaviour">
						Leave unchanged
						<br><span class="description">
							Lets other plugins control this setting.
						</span>
					</label></p>
				<p><label>
						<input type="radio" value="user-defined-list" data-bind="checked: editableRoleStrategy, enable: isListStrategyAllowed"
						       name="editable-roles-behaviour">
						Custom
						<br><span class="description">
							Lets you manually choose the roles that the selected role or user can
							assign to other users.
						</span>
					</label></p>
			</fieldset>
			<!-- ko if: $root.roles().length > 0 -->
			<ul id="rex-editable-role-list" data-bind="foreach: editor.roles">
				<li>
					<label>
						<input type="checkbox"
						       data-bind="checked: $parent.isRoleSetToEditable($data), enable: $parent.isRoleEnabled($data)">
						<span data-bind="text: displayName"></span>
					</label>
				</li>
			</ul>
			<!-- /ko -->
		</div>

	</div>
</script>

<script type="text/html" id="rex-user-role-list-template">
	<p>
		<label for="rex-primary-user-role">
			<strong>Primary role</strong>
		</label>
		<select name="rex-primary-user-role" id="rex-primary-user-role" data-bind="value: primaryRole">
			<!-- ko if: sortedRoles().length > 0 -->
			<!-- ko foreach: sortedRoles -->
			<option value=""
			        data-bind="text: displayName, value: $data, enable: $parent.canAssignRoleToActor($data)"></option>
			<!-- /ko -->
			<!-- /ko -->

			<!-- Include a "no role" option because some users might have no roles, especially in Multisite. -->
			<option data-bind="text: '— No role for this site —', value: null"></option>
		</select>
	</p>

	<strong>Other roles</strong>
	<!-- ko if: sortedRoles().length > 0 -->
	<ul data-bind="foreach: sortedRoles" class="rex-user-role-option-list">
		<li>
			<label data-bind="attr: { title: name }">
				<input type="checkbox"
				       data-bind="checked: $parent.actorHasRole($data), enable: $parent.canAssignRoleToActor($data)">
				<span data-bind="text: displayName"></span>
			</label>
		</li>
	</ul>
	<!-- /ko -->
</script>