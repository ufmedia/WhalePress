'use strict';
jQuery(function ($) {
	const menuEditorNode = $('#ws_menu_editor');

	$(document).on('filterMenuFields.adminMenuEditor', function (event, knownMenuFields, baseField) {
		var scrollCheckboxField = $.extend({}, baseField, {
			caption: 'Hide the frame scrollbar',
			advanced: true,
			type: 'checkbox',
			standardCaption: false,

			visible: function (menuItem) {
				return wsEditorData.wsMenuEditorPro && (AmeEditorApi.getFieldValue(menuItem, 'open_in') === 'iframe');
			},

			display: function (menuItem, displayValue) {
				if (displayValue === 0 || displayValue === '0') {
					displayValue = false;
				}
				return displayValue;
			}
		});

		//Insert this field after the "iframe_height" field.
		//To do that, we back up and delete all properties.
		var backup = $.extend({}, knownMenuFields);
		$.each(backup, function (key) {
			delete knownMenuFields[key];
		});
		//Then re-insert all of the properties in the desired order.
		$.each(backup, function (key, value) {
			knownMenuFields[key] = value;
			if (key === 'iframe_height') {
				knownMenuFields['is_iframe_scroll_disabled'] = scrollCheckboxField;
			}
		});
	});

	$(document).on('filterVisibleMenuFields.adminMenuEditor', function (event, visibleMenuFieldsByType) {
		visibleMenuFieldsByType['heading'] = {
			file: false,
			open_in: false,
			hookname: false,
			page_heading: false,
			page_title: false,
			is_always_open: false,
			iframe_height: false,
			template_id: false
		};
	});

	//The "Reset permissions" toolbar button.
	menuEditorNode.on(
		'adminMenuEditor:action-reset-permissions',
		function (event) {
			event.preventDefault();

			var selectedActor = AmeEditorApi.actorSelectorWidget.selectedActor;
			if (selectedActor === null) {
				alert(
					'This button resets all permissions for the selected role. '
					+ 'To use it, click a role and then click this button again.'
				);
				return;
			}

			var displayName = AmeEditorApi.actorSelectorWidget.selectedDisplayName;
			if (!confirm('Reset all permissions for "' + displayName + '"?')) {
				return;
			}

			//Reset CPT/taxonomy permissions and other directly granted capabilities.
			var hadGrantedCaps = AmeCapabilityManager.resetActorCaps(selectedActor);

			//Reset permissions and visibility for all menu items.
			AmeEditorApi.forEachMenuItem(function (menuItem, containerNode) {
				var wasModified = hadGrantedCaps;

				//Reset the "hide without changing permissions" settings (aka "cosmetically hidden").
				if (
					menuItem.hidden_from_actor
					&& $.isPlainObject(menuItem.hidden_from_actor)
					&& menuItem.hidden_from_actor.hasOwnProperty(selectedActor)
				) {
					delete menuItem.hidden_from_actor[selectedActor];
					wasModified = true;
				}

				//Reset permissions.
				if (
					menuItem.grant_access
					&& $.isPlainObject(menuItem.grant_access)
					&& menuItem.grant_access.hasOwnProperty(selectedActor)
				) {
					delete menuItem.grant_access[selectedActor];
					wasModified = true;
				}

				if (wasModified) {
					AmeEditorApi.updateItemEditor(containerNode);
					AmeEditorApi.updateParentAccessUi(containerNode);
				}
			});
		}
	);

	//"New heading" toolbar button.
	let headingCount = 0;
	menuEditorNode.on(
		'adminMenuEditor:action-new-heading',
		/**
		 * @param event
		 * @param {JQuery|null} selectedItem
		 * @param {AmeEditorColumn} column
		 */
		function (event, selectedItem, column) {
			headingCount++;

			//The new menu starts out rather bare
			const randomId = AmeEditorApi.randomMenuId('heading-');
			let menu = $.extend(true, {}, wsEditorData.blankMenuItem, {
				sub_type: 'heading',
				menu_title: 'Heading ' + headingCount,
				custom: true,
				template_id: '',
				css_class: 'menu-top ame-menu-heading-item',
				file: randomId,
				hookname: randomId,
				access_level: 'read',
				items: []
			});

			column.outputItem(menu, selectedItem);

			$(document).trigger('adminMenuEditor:newHeadingCreated');
		}
	);

	//Three level menu confirmation dialog.
	let $deepNestingDialog;
	function initNestingDialog() {
		if ($deepNestingDialog) {
			return;
		}

		$deepNestingDialog = $('#ws_ame_deep_nesting_dialog');
		$deepNestingDialog.dialog({
			autoOpen: false,
			closeText: ' ',
			draggable: false,
			modal: true,
			minHeight: 300,
			minWidth: 400
		});
	}

	menuEditorNode.on(
		'adminMenuEditor:queryDeepNesting',
		/**
		 * @param event
		 * @param {Array} queue
		 */
		function(event, queue) {
			let isEnabled = $.Deferred();
			queue.push(isEnabled);

			initNestingDialog();
			$deepNestingDialog.dialog('open');

			$deepNestingDialog.find('#ame_allow_deep_nesting').one('click', function() {
				isEnabled.resolve();
				$deepNestingDialog.dialog('close');
				return false;
			});

			$deepNestingDialog.find('#ame_reject_deep_nesting').one('click', function() {
				isEnabled.reject();
				$deepNestingDialog.dialog('close');
				return false;
			});
		}
	);
});