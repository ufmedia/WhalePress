/// <reference path="../../../js/knockout.d.ts" />
/// <reference path="../../../js/jquery.d.ts" />
/// <reference path="../../../js/jqueryui.d.ts" />
/// <reference path="../../../js/jquery.form.d.ts" />
/// <reference path="../../../js/lodash-3.10.d.ts" />
/// <reference path="./dashboard-widget.ts" />
/// <reference path="../../../modules/actor-selector/actor-selector.ts" />
var AmeDashboardWidgetEditor = /** @class */ (function () {
    function AmeDashboardWidgetEditor(widgetSettings, selectedActor, isMultisite) {
        var _this = this;
        if (selectedActor === void 0) { selectedActor = null; }
        if (isMultisite === void 0) { isMultisite = false; }
        this.isMultisite = false;
        this.newWidgetCounter = 0;
        this.isMultisite = isMultisite;
        this.actorSelector = new AmeActorSelector(AmeActors, true);
        //Wrap the selected actor in a computed observable so that it can be used with Knockout.
        var _selectedActor = ko.observable(this.actorSelector.selectedActor);
        this.selectedActor = ko.computed({
            read: function () {
                return _selectedActor();
            },
            write: function (newActor) {
                _this.actorSelector.setSelectedActor(newActor);
            }
        });
        this.actorSelector.onChange(function (newSelectedActor) {
            _selectedActor(newSelectedActor);
        });
        //Re-select the previously selected actor, or select "All" (null) by default.
        this.selectedActor(selectedActor);
        this.widgets = ko.observableArray([]);
        this.loadSettings(widgetSettings);
        //These are only updated when saving or exporting widget settings.
        this.widgetData = ko.observable('');
        this.widgetDataLength = ko.observable(0);
        this.isExportButtonEnabled = ko.observable(true);
        //Similarly, these are used when importing settings.
        this.importState = ko.observable('start');
        this.uploadButtonEnabled = ko.observable(false);
        this.importErrorHttpCode = ko.observable(0);
        this.importErrorMessage = ko.observable('');
        this.importErrorResponse = ko.observable('');
        this.setupImportDialog();
    }
    AmeDashboardWidgetEditor.prototype.loadSettings = function (widgetSettings) {
        var _ = AmeDashboardWidgetEditor._;
        this.widgets.removeAll();
        this.welcomePanel = new AmeWelcomeWidget(_.get(widgetSettings, 'welcomePanel', {}), this);
        this.widgets.push(this.welcomePanel);
        for (var i = 0; i < widgetSettings.widgets.length; i++) {
            var properties = widgetSettings.widgets[i], widget = null;
            if (properties.hasOwnProperty('wrappedWidget')) {
                widget = new AmeStandardWidgetWrapper(properties, this);
            }
            else if (_.get(properties, 'widgetType') === 'custom-html') {
                widget = new AmeCustomHtmlWidget(properties, this);
            }
            else if (_.get(properties, 'widgetType') === 'custom-rss') {
                widget = new AmeCustomRssWidget(properties, this);
            }
            else {
                throw { message: 'Unknown widget type', widgetProperties: properties };
            }
            //On a normal site we don't have to worry about plugins that are active on some sites but not others,
            //so we can just remove/filter out widgets that are not present. Just to be safe, however, these changes
            //won't be saved unless the user saves the filtered widget list.
            if (!this.isMultisite && !widget.isPresent && AmeDashboardWidgetEditor.autoCleanupEnabled) {
                continue;
            }
            this.widgets.push(widget);
            //The custom ID counter should be high enough not to clash with existing widgets.
            if (widget.id.indexOf(AmeDashboardWidgetEditor.customIdPrefix) === 0) {
                var idNum = parseInt(widget.id.substr(AmeDashboardWidgetEditor.customIdPrefix.length), 10);
                if (!isNaN(idNum)) {
                    this.newWidgetCounter = Math.max(idNum, this.newWidgetCounter);
                }
            }
        }
        this.initialWidgetSettings = widgetSettings;
    };
    // noinspection JSUnusedGlobalSymbols Used in Knockout templates.
    AmeDashboardWidgetEditor.prototype.removeWidget = function (widget, event) {
        var _this = this;
        jQuery(event.target).closest('.ame-dashboard-widget').slideUp(300, function () {
            _this.widgets.remove(widget);
        });
    };
    // noinspection JSUnusedGlobalSymbols Used in Knockout templates.
    AmeDashboardWidgetEditor.prototype.addHtmlWidget = function () {
        this.newWidgetCounter++;
        var widget = new AmeCustomHtmlWidget({
            id: AmeDashboardWidgetEditor.customIdPrefix + this.newWidgetCounter,
            title: 'New Widget ' + this.newWidgetCounter
        }, this);
        //Expand the new widget.
        widget.isOpen(true);
        this.insertAfterWelcomePanel(widget);
    };
    // noinspection JSUnusedGlobalSymbols Used in Knockout templates.
    AmeDashboardWidgetEditor.prototype.addRssWidget = function () {
        this.newWidgetCounter++;
        var widget = new AmeCustomRssWidget({
            id: AmeDashboardWidgetEditor.customIdPrefix + this.newWidgetCounter,
            title: 'New RSS Widget ' + this.newWidgetCounter
        }, this);
        //Expand the new widget.
        widget.isOpen(true);
        this.insertAfterWelcomePanel(widget);
    };
    AmeDashboardWidgetEditor.prototype.insertAfterWelcomePanel = function (widget) {
        //The "Welcome" panel is always first, so we can cheat for performance.
        if (this.widgets.indexOf(this.welcomePanel) === 0) {
            var welcomePanel = this.widgets.shift();
            this.widgets.unshift(widget);
            this.widgets.unshift(welcomePanel);
        }
        else {
            //But just in case it's not first for some odd reason,
            //let's fall back to inserting the widget at the beginning.
            this.widgets.unshift(widget);
        }
    };
    // noinspection JSUnusedGlobalSymbols Used in Knockout templates.
    AmeDashboardWidgetEditor.prototype.saveChanges = function () {
        var settings = this.getCurrentSettings();
        //Set the hidden form fields.
        this.widgetData(JSON.stringify(settings));
        this.widgetDataLength(this.widgetData().length);
        //Submit the form.
        return true;
    };
    AmeDashboardWidgetEditor.prototype.getCurrentSettings = function () {
        var collectionFormatName = 'Admin Menu Editor dashboard widgets';
        var collectionFormatVersion = '1.1';
        var _ = AmeDashboardWidgetEditor._;
        var settings = {
            format: {
                name: collectionFormatName,
                version: collectionFormatVersion
            },
            widgets: [],
            welcomePanel: {
                grantAccess: _.pick(this.welcomePanel.grantAccess.getAll(), function (hasAccess, actorId) {
                    //Remove "allow" settings for actors that can't actually see the panel.
                    return AmeActors.hasCapByDefault(actorId, 'edit_theme_options') || !hasAccess;
                }),
            },
            siteComponentHash: this.initialWidgetSettings.siteComponentHash
        };
        _.forEach(_.without(this.widgets(), this.welcomePanel), function (widget) {
            settings.widgets.push(widget.toPropertyMap());
        });
        return settings;
    };
    // noinspection JSUnusedGlobalSymbols Used in Knockout templates.
    AmeDashboardWidgetEditor.prototype.exportWidgets = function () {
        var _this = this;
        //Temporarily disable the export button to prevent accidental repeated clicks.
        this.isExportButtonEnabled(false);
        this.widgetData(JSON.stringify(this.getCurrentSettings()));
        //Re-enable the export button after a few seconds.
        window.setTimeout(function () {
            _this.isExportButtonEnabled(true);
        }, 3000);
        //Explicitly allow form submission.
        return true;
    };
    AmeDashboardWidgetEditor.prototype.setupImportDialog = function () {
        //Note to self: Refactor this as a separate view-model, perhaps.
        var _this = this;
        this.importDialog = jQuery('#ame-import-widgets-dialog');
        var importForm = this.importDialog.find('#ame-import-widgets-form');
        this.importDialog.dialog({
            autoOpen: false,
            modal: true,
            closeText: ' ',
            open: function () {
                importForm.resetForm();
                _this.importState('start');
                _this.uploadButtonEnabled(false);
            }
        });
        //jQuery moves the dialog to the end of the DOM tree, which puts it outside our KO root node.
        //This means we must apply bindings directly to the dialog node.
        ko.applyBindings(this, this.importDialog.get(0));
        //Enable the upload button only when the user selects a file.
        importForm.find('#ame-import-file-selector').on('change', function (event) {
            _this.uploadButtonEnabled(!!jQuery(event.target).val());
        });
        //This function displays unhandled server side errors. In theory, our upload handler always returns a well-formed
        //response even if there's an error. In practice, stuff can go wrong in unexpected ways (e.g. plugin conflicts).
        var handleUnexpectedImportError = function (xhr, errorMessage) {
            //The server-side code didn't catch this error, so it's probably something serious
            //and retrying won't work.
            importForm.resetForm();
            _this.importState('unexpected-error');
            //Display error information.
            _this.importErrorMessage(errorMessage);
            _this.importErrorHttpCode(xhr.status);
            _this.importErrorResponse((xhr.responseText !== '') ? xhr.responseText : '[Empty response]');
        };
        importForm.ajaxForm({
            dataType: 'json',
            beforeSubmit: function (formData) {
                //Check if the user has selected a file
                for (var i = 0; i < formData.length; i++) {
                    if (formData[i].name === 'widget_file') {
                        if ((typeof formData[i].value === 'undefined') || !formData[i].value) {
                            alert('Select a file first!');
                            return false;
                        }
                    }
                }
                _this.importState('uploading');
                _this.uploadButtonEnabled(false);
                return true;
            },
            success: function (data, status, xhr) {
                if (!_this.importDialog.dialog('isOpen')) {
                    //Whoops, the user closed the dialog while the upload was in progress.
                    //Discard the response silently.
                    return;
                }
                if ((data === null) || (typeof data !== 'object')) {
                    handleUnexpectedImportError(xhr, 'Invalid response from server. Please check your PHP error log.');
                    return;
                }
                if (typeof data.error !== 'undefined') {
                    alert(data.error.message || data.error.code);
                    //Let the user try again.
                    importForm.resetForm();
                    _this.importState('start');
                }
                if ((typeof data.widgets !== 'undefined') && data.widgets) {
                    //Lets load these widgets into the editor.
                    _this.loadSettings(data);
                    //Display a success message, then automatically close the window after a few moments.
                    _this.importState('complete');
                    setTimeout(function () {
                        _this.importDialog.dialog('close');
                    }, 700);
                }
            },
            error: function (xhr, status, errorMessage) {
                handleUnexpectedImportError(xhr, errorMessage);
            }
        });
        this.importDialog.find('#ame-cancel-widget-import').on('click', function () {
            _this.importDialog.dialog('close');
        });
    };
    // noinspection JSUnusedGlobalSymbols Used in Knockout templates.
    AmeDashboardWidgetEditor.prototype.openImportDialog = function () {
        this.importDialog.dialog('open');
    };
    AmeDashboardWidgetEditor._ = wsAmeLodash;
    AmeDashboardWidgetEditor.autoCleanupEnabled = true;
    AmeDashboardWidgetEditor.customIdPrefix = 'ame-custom-widget-';
    return AmeDashboardWidgetEditor;
}());
jQuery(function () {
    ameWidgetEditor = new AmeDashboardWidgetEditor(wsWidgetEditorData.widgetSettings, wsWidgetEditorData.selectedActor, wsWidgetEditorData.isMultisite);
    ko.applyBindings(ameWidgetEditor, document.getElementById('ame-dashboard-widget-editor'));
});
