/// <reference path="../js/common.d.ts" />
/// <reference path="../js/knockout.d.ts" />
/// <reference path="../js/jquery.d.ts" />
/// <reference path="../js/lodash-3.10.d.ts" />

declare var wsAmeLodash: _.LoDashStatic;

interface AmeKnockoutDialog {
	isOpen: KnockoutObservable<boolean>;

	options?: Record<string, any>;
	autoCancelButton?: boolean;
	jQueryWidget: JQuery;
	title: KnockoutObservable<string>;

	onOpen?(event, ui);

	onClose?(event, ui);
}

/*
 * jQuery Dialog binding for Knockout.
 *
 * The main parameter of the binding is an instance of AmeKnockoutDialog. In addition to the standard
 * options provided by jQuery UI, the binding supports two additional properties:
 *
 *  isOpen - Required. A boolean observable that controls whether the dialog is open or closed.
 *  autoCancelButton - Set to true to add a WordPress-style "Cancel" button that automatically closes the dialog.
 *
 * Usage example:
 * <div id="my-dialog" data-bind="ameDialog: {isOpen: anObservable, autoCancelButton: true, options: {minWidth: 400}}">...</div>
 */
ko.bindingHandlers.ameDialog = {
	init: function (element, valueAccessor) {
		const dialog = ko.utils.unwrapObservable(valueAccessor()) as AmeKnockoutDialog;
		const _ = wsAmeLodash;

		let options = dialog.options ? dialog.options : {};
		if (!dialog.hasOwnProperty('isOpen')) {
			dialog.isOpen = ko.observable(false);
		}

		options = _.defaults(options, {
			autoCancelButton: _.get(dialog, 'autoCancelButton', true),
			autoOpen: dialog.isOpen(),
			modal: true,
			closeText: ' '
		});

		//Update isOpen when the dialog is opened or closed.
		options.open = function (event, ui) {
			dialog.isOpen(true);
			if (dialog.onOpen) {
				dialog.onOpen(event, ui);
			}
		};
		options.close = function (event, ui) {
			dialog.isOpen(false);
			if (dialog.onClose) {
				dialog.onClose(event, ui);
			}
		};

		let buttons = (typeof options['buttons'] !== 'undefined') ? ko.utils.unwrapObservable(options.buttons) : [];
		if (options.autoCancelButton) {
			//In WordPress, the "Cancel" option is usually on the left side of the form/dialog/pop-up.
			buttons.unshift({
				text: 'Cancel',
				'class': 'button button-secondary ame-dialog-cancel-button',
				click: function () {
					jQuery(this).closest('.ui-dialog-content').dialog('close');
				}
			});
		}
		options.buttons = buttons;

		if (!dialog.hasOwnProperty('title') || (dialog.title === null)) {
			dialog.title = ko.observable(_.get(options, 'title', null));
		} else if (dialog.title()) {
			options.title = dialog.title();
		}

		//Do in a setTimeout so that applyBindings doesn't bind twice from element being copied and moved to bottom.
		window.setTimeout(function () {
			jQuery(element).dialog(options);

			dialog.jQueryWidget = jQuery(element).dialog('widget');
			dialog.title(jQuery(element).dialog('option', 'title'));

			dialog.title.subscribe(function (newTitle) {
				jQuery(element).dialog('option', 'title', newTitle);
			});

			if (ko.utils.unwrapObservable(dialog.isOpen)) {
				jQuery(element).dialog('open');
			}
		}, 0);


		ko.utils.domNodeDisposal.addDisposeCallback(element, function () {
			jQuery(element).dialog('destroy');
		});
	},

	update: function (element, valueAccessor) {
		const dialog = ko.utils.unwrapObservable(valueAccessor()) as AmeKnockoutDialog;
		const $element = jQuery(element);
		const shouldBeOpen = ko.utils.unwrapObservable(dialog.isOpen);

		//Do nothing if the dialog hasn't been initialized yet.
		const $widget = $element.dialog('instance');
		if (!$widget) {
			return;
		}

		if (shouldBeOpen !== $element.dialog('isOpen')) {
			$element.dialog(shouldBeOpen ? 'open' : 'close');
		}
	}
};

ko.bindingHandlers.ameOpenDialog = {
	init: function (element, valueAccessor) {
		const clickHandler = function (event) {
			const dialogSelector = ko.utils.unwrapObservable(valueAccessor());

			//Do nothing if the dialog hasn't been initialized yet.
			const $widget = jQuery(dialogSelector);
			if (!$widget.dialog('instance')) {
				return;
			}

			$widget.dialog('open');
			event.stopPropagation();
		};
		jQuery(element).on('click', clickHandler);

		ko.utils.domNodeDisposal.addDisposeCallback(element, function () {
			jQuery(element).off('click', clickHandler);
		});
	}
};

/*
 * The ameEnableDialogButton binding enables the specified jQuery UI button only when the "enabled" parameter is true.
 *
 * It's tricky to bind directly to dialog buttons because they're created dynamically and jQuery UI places them
 * outside dialog content. This utility binding takes a jQuery selector, letting you bind to a button indirectly.
 * You can apply it to any element inside a dialog, or the dialog itself.
 *
 * Usage:
 * <div data-bind="ameDialogButtonEnabled: { selector: '.my-button', enabled: anObservable }">...</div>
 * <div data-bind="ameDialogButtonEnabled: justAnObservable">...</div>
 *
 * If you omit the selector, the binding will enable/disable the first button that has the "button-primary" CSS class.
 */
ko.bindingHandlers.ameEnableDialogButton = {
	init: function (element, valueAccessor, allBindings, viewModel, bindingContext) {
		//This binding could be applied before the dialog is initialised. In this case, the button won't exist yet.
		//Wait for the dialog to be created and then update the button.
		const dialogNode = jQuery(element).closest('.ui-dialog');
		if (dialogNode.length < 1) {
			const body = jQuery(element).closest('body');

			function setInitialButtonState() {
				//Is this our dialog?
				let dialogNode = jQuery(element).closest('.ui-dialog');
				if (dialogNode.length < 1) {
					return; //Nope.
				}

				//Yes. Remove the event handler and update the binding.
				body.off('dialogcreate', setInitialButtonState);
				ko.bindingHandlers.ameEnableDialogButton.update(element, valueAccessor, allBindings, viewModel, bindingContext);
			}

			body.on('dialogcreate', setInitialButtonState);
			//If our dialog never gets created, we still want to clean up the event handler eventually.
			ko.utils.domNodeDisposal.addDisposeCallback(element, function () {
				body.off('dialogcreate', setInitialButtonState);
			});
		}
	},

	update: function (element, valueAccessor) {
		const _ = wsAmeLodash;
		let options = ko.unwrap(valueAccessor());
		if (!_.isPlainObject(options)) {
			options = {enabled: options};
		}

		options = _.defaults(
			options,
			{
				selector: '.button-primary:first',
				enabled: false
			}
		);

		jQuery(element)
			.closest('.ui-dialog')
			.find('.ui-dialog-buttonset')
			.find(options.selector)
			.button('option', 'disabled', !ko.utils.unwrapObservable(options.enabled));
	}
};

ko.bindingHandlers.ameColorPicker = {
	init: function (element, valueAccessor) {
		let valueUnwrapped = ko.unwrap(valueAccessor());

		const input = jQuery(element);
		input.val(valueUnwrapped);

		input.wpColorPicker({
			change: function (event, ui) {
				let value = valueAccessor();
				value(ui.color.toString());
			},
			clear: function () {
				let value = valueAccessor();
				value('');
			}
		});
	},
	update: function (element, valueAccessor) {
		let newValue = ko.unwrap(valueAccessor());
		if (typeof newValue !== 'string') {
			newValue = '';
		}
		if (newValue === '') {
			//Programmatically click the "Clear" button. It's not elegant, but I haven't found
			//a way to do this using the Iris API.
			jQuery(element).closest('.wp-picker-input-wrap').find('.wp-picker-clear').trigger('click');
		} else {
			jQuery(element).iris('color', newValue);
		}
	}
};

//A one-way binding for indeterminate checkbox states.
ko.bindingHandlers.indeterminate = {
	update: function (element, valueAccessor) {
		element.indeterminate = !!(ko.unwrap(valueAccessor()));
	}
};