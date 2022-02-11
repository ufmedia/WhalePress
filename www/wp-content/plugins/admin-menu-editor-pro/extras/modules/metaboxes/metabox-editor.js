/// <reference path="../../../js/lodash-3.10.d.ts" />
/// <reference path="../../../js/knockout.d.ts" />
/// <reference path="../../../modules/actor-selector/actor-selector.ts" />
/// <reference path="../../../js/common.d.ts" />
var AmeMetaBoxEditor = /** @class */ (function () {
    function AmeMetaBoxEditor(settings, forceRefreshUrl) {
        var _this = this;
        this.canAnyBoxesBeDeleted = false;
        this.actorSelector = new AmeActorSelector(AmeActors, true);
        //Wrap the selected actor in a computed observable so that it can be used with Knockout.
        var _selectedActor = ko.observable(this.actorSelector.selectedActor
            ? AmeActors.getActor(this.actorSelector.selectedActor)
            : null);
        this.selectedActor = ko.computed({
            read: function () {
                return _selectedActor();
            },
            write: function (newActor) {
                _this.actorSelector.setSelectedActor(newActor ? newActor.id : null);
            }
        });
        this.actorSelector.onChange(function (newSelectedActorId) {
            if (newSelectedActorId === null) {
                _selectedActor(null);
            }
            else {
                _selectedActor(AmeActors.getActor(newSelectedActorId));
            }
        });
        this.screens = AmeMetaBoxEditor._.map(settings.screens, function (screenData, id) {
            var metaBoxes = screenData['metaBoxes:'];
            if (AmeMetaBoxEditor._.isEmpty(metaBoxes)) {
                metaBoxes = {};
            }
            if (screenData['postTypeFeatures:'] && !AmeMetaBoxEditor._.isEmpty(screenData['postTypeFeatures:'])) {
                var features = screenData['postTypeFeatures:'];
                for (var featureName in features) {
                    if (features.hasOwnProperty(featureName)) {
                        metaBoxes['cpt-feature:' + featureName] = features[featureName];
                    }
                }
            }
            return new AmeMetaBoxCollection(id, metaBoxes, _this);
        });
        this.screens.sort(function (a, b) {
            return a.formattedTitle.localeCompare(b.formattedTitle);
        });
        this.canAnyBoxesBeDeleted = AmeMetaBoxEditor._.some(this.screens, 'canAnyBeDeleted');
        this.settingsData = ko.observable('');
        this.forceRefreshUrl = forceRefreshUrl;
        this.isSlugWarningEnabled = ko.observable(true);
    }
    //noinspection JSUnusedGlobalSymbols It's actually used in the KO template, but PhpStorm doesn't realise that.
    AmeMetaBoxEditor.prototype.saveChanges = function () {
        var settings = this.getCurrentSettings();
        //Set the hidden form fields.
        this.settingsData(JSON.stringify(settings));
        //Submit the form.
        return true;
    };
    AmeMetaBoxEditor.prototype.getCurrentSettings = function () {
        var collectionFormatName = 'Admin Menu Editor meta boxes', collectionFormatVersion = '1.0';
        var settings = {
            format: {
                name: collectionFormatName,
                version: collectionFormatVersion
            },
            screens: {},
            isInitialRefreshDone: true
        };
        var _ = AmeMetaBoxEditor._;
        _.forEach(this.screens, function (collection) {
            var thisScreenData = {
                'metaBoxes:': {},
                'postTypeFeatures:': {}
            };
            _.forEach(collection.boxes(), function (metaBox) {
                var key = metaBox.parentCollectionKey ? metaBox.parentCollectionKey : 'metaBoxes:';
                thisScreenData[key][metaBox.id] = metaBox.toPropertyMap();
            });
            settings.screens[collection.screenId] = thisScreenData;
        });
        return settings;
    };
    //noinspection JSUnusedGlobalSymbols It's used in the KO template.
    AmeMetaBoxEditor.prototype.promptForRefresh = function () {
        if (confirm('Refresh the list of available meta boxes?\n\nWarning: Unsaved changes will be lost.')) {
            window.location.href = this.forceRefreshUrl;
        }
    };
    AmeMetaBoxEditor._ = wsAmeLodash;
    return AmeMetaBoxEditor;
}());
var AmeMetaBox = /** @class */ (function () {
    function AmeMetaBox(settings, metaBoxEditor) {
        var _this = this;
        this.isHiddenByDefault = false;
        this.canBeDeleted = false;
        this.isVirtual = false;
        this.tooltipText = null;
        AmeMetaBox.counter++;
        this.uniqueHtmlId = 'ame-mb-item-' + AmeMetaBox.counter;
        var _ = AmeMetaBox._;
        this.metaBoxEditor = metaBoxEditor;
        this.initialProperties = settings;
        if (settings['parentCollectionKey']) {
            this.parentCollectionKey = settings['parentCollectionKey'];
        }
        this.id = settings['id'];
        this.title = _.get(settings, 'title', '[Untitled widget]');
        this.context = _.get(settings, 'context', 'normal');
        this.isHiddenByDefault = _.get(settings, 'isHiddenByDefault', false);
        this.grantAccess = new AmeActorAccessDictionary(_.get(settings, 'grantAccess', {}));
        this.defaultVisibility = new AmeActorAccessDictionary(_.get(settings, 'defaultVisibility', {}));
        this.canBeDeleted = !_.get(settings, 'isPresent', true);
        this.isVirtual = _.get(settings, 'isVirtual', false);
        if (this.isVirtual) {
            this.tooltipText = 'Technically, this is not a meta box, but it\'s included here for convenience.';
        }
        this.isAvailable = ko.computed({
            read: function () {
                var actor = metaBoxEditor.selectedActor();
                if (actor !== null) {
                    return AmeMetaBox.actorHasAccess(actor, _this.grantAccess, true, true);
                }
                else {
                    //Check if any actors have this widget enabled.
                    //We only care about visible actors. There might be some users that are loaded but not visible.
                    var actors = metaBoxEditor.actorSelector.getVisibleActors();
                    return _.some(actors, function (anActor) {
                        return AmeMetaBox.actorHasAccess(anActor, _this.grantAccess, true, true);
                    });
                }
            },
            write: function (checked) {
                if ((_this.id === 'slugdiv') && !checked && _this.metaBoxEditor.isSlugWarningEnabled()) {
                    var warningMessage = 'Hiding the "Slug" metabox can prevent the user from changing the post slug.\n'
                        + 'This is caused by a known bug in WordPress core.\n'
                        + 'Do you want to hide this metabox anyway?';
                    if (confirm(warningMessage)) {
                        //Suppress the warning.
                        _this.metaBoxEditor.isSlugWarningEnabled(false);
                    }
                    else {
                        _this.isAvailable.notifySubscribers();
                        return;
                    }
                }
                var actor = metaBoxEditor.selectedActor();
                if (actor !== null) {
                    _this.grantAccess.set(actor.getId(), checked);
                }
                else {
                    //Enable/disable all.
                    _.forEach(metaBoxEditor.actorSelector.getVisibleActors(), function (anActor) { _this.grantAccess.set(anActor.getId(), checked); });
                }
            }
        });
        this.isVisibleByDefault = ko.computed({
            read: function () {
                var actor = metaBoxEditor.selectedActor();
                if (actor !== null) {
                    return AmeMetaBox.actorHasAccess(actor, _this.defaultVisibility, !_this.isHiddenByDefault, null);
                }
                else {
                    var actors = metaBoxEditor.actorSelector.getVisibleActors();
                    return _.some(actors, function (anActor) {
                        return AmeMetaBox.actorHasAccess(anActor, _this.defaultVisibility, !_this.isHiddenByDefault, null);
                    });
                }
            },
            write: function (checked) {
                var actor = metaBoxEditor.selectedActor();
                if (actor !== null) {
                    _this.defaultVisibility.set(actor.getId(), checked);
                }
                else {
                    //Enable/disable all.
                    _.forEach(metaBoxEditor.actorSelector.getVisibleActors(), function (anActor) { _this.defaultVisibility.set(anActor.getId(), checked); });
                }
            }
        });
        this.canChangeDefaultVisibility = ko.computed(function () {
            return _this.isAvailable() && !_this.isVirtual;
        });
        this.safeTitle = ko.computed(function () {
            return AmeMetaBox.stripAllTags(_this.title);
        });
    }
    AmeMetaBox.actorHasAccess = function (actor, grants, roleDefault, superAdminDefault) {
        if (roleDefault === void 0) { roleDefault = true; }
        if (superAdminDefault === void 0) { superAdminDefault = true; }
        //Is there a setting for this actor specifically?
        var hasAccess = grants.get(actor.getId(), null);
        if (hasAccess !== null) {
            return hasAccess;
        }
        if (actor instanceof AmeUser) {
            //The Super Admin has access to everything by default, and it takes priority over roles.
            if (actor.isSuperAdmin) {
                var adminHasAccess = grants.get('special:super_admin', null);
                if (adminHasAccess !== null) {
                    return adminHasAccess;
                }
                else if (superAdminDefault !== null) {
                    return superAdminDefault;
                }
            }
            //Allow access if at least one role has access.
            var result = false;
            for (var index = 0; index < actor.roles.length; index++) {
                var roleActor = 'role:' + actor.roles[index], roleHasAccess = grants.get(roleActor, roleDefault);
                result = result || roleHasAccess;
            }
            return result;
        }
        return roleDefault;
    };
    AmeMetaBox.prototype.toPropertyMap = function () {
        var properties = {
            'id': this.id,
            'title': this.title,
            'context': this.context,
            'grantAccess': this.grantAccess.getAll(),
            'defaultVisibility': this.defaultVisibility.getAll(),
            'isHiddenByDefault': this.isHiddenByDefault
        };
        //Preserve unused properties on round-trip.
        properties = AmeMetaBox._.merge({}, this.initialProperties, properties);
        return properties;
    };
    AmeMetaBox.stripAllTags = function (input) {
        //Based on: http://phpjs.org/functions/strip_tags/
        var tags = /<\/?([a-z][a-z0-9]*)\b[^>]*>/gi, commentsAndPhpTags = /<!--[\s\S]*?-->|<\?(?:php)?[\s\S]*?\?>/gi;
        return input.replace(commentsAndPhpTags, '').replace(tags, '');
    };
    AmeMetaBox._ = wsAmeLodash;
    AmeMetaBox.counter = 0;
    return AmeMetaBox;
}());
var AmeActorAccessDictionary = /** @class */ (function () {
    function AmeActorAccessDictionary(initialData) {
        this.items = {};
        this.numberOfObservables = ko.observable(0);
        if (initialData) {
            this.setAll(initialData);
        }
    }
    AmeActorAccessDictionary.prototype.get = function (actor, defaultValue) {
        if (defaultValue === void 0) { defaultValue = null; }
        if (this.items.hasOwnProperty(actor)) {
            return this.items[actor]();
        }
        this.numberOfObservables(); //Establish a dependency.
        return defaultValue;
    };
    AmeActorAccessDictionary.prototype.set = function (actor, value) {
        if (!this.items.hasOwnProperty(actor)) {
            this.items[actor] = ko.observable(value);
            this.numberOfObservables(this.numberOfObservables() + 1);
        }
        else {
            this.items[actor](value);
        }
    };
    AmeActorAccessDictionary.prototype.getAll = function () {
        var result = {};
        for (var actorId in this.items) {
            if (this.items.hasOwnProperty(actorId)) {
                result[actorId] = this.items[actorId]();
            }
        }
        return result;
    };
    AmeActorAccessDictionary.prototype.setAll = function (values) {
        for (var actorId in values) {
            if (values.hasOwnProperty(actorId)) {
                this.set(actorId, values[actorId]);
            }
        }
    };
    return AmeActorAccessDictionary;
}());
var AmeMetaBoxCollection = /** @class */ (function () {
    function AmeMetaBoxCollection(screenId, metaBoxes, metaBoxEditor) {
        this.canAnyBeDeleted = false;
        this.screenId = screenId;
        this.formattedTitle = screenId.charAt(0).toUpperCase() + screenId.slice(1);
        this.boxes = ko.observableArray(AmeMetaBoxCollection._.map(metaBoxes, function (properties) {
            return new AmeMetaBox(properties, metaBoxEditor);
        }));
        this.boxes.sort(function (a, b) {
            return a.id.localeCompare(b.id);
        });
        this.canAnyBeDeleted = AmeMetaBoxCollection._.some(this.boxes(), 'canBeDeleted');
    }
    //noinspection JSUnusedGlobalSymbols Use by KO.
    AmeMetaBoxCollection.prototype.deleteBox = function (item) {
        this.boxes.remove(item);
    };
    AmeMetaBoxCollection._ = wsAmeLodash;
    return AmeMetaBoxCollection;
}());
jQuery(function () {
    var metaBoxEditor = new AmeMetaBoxEditor(wsAmeMetaBoxEditorData.settings, wsAmeMetaBoxEditorData.refreshUrl);
    ko.applyBindings(metaBoxEditor, document.getElementById('ame-meta-box-editor'));
    //Make the column widths the same in all tables.
    var $ = jQuery;
    var tables = $('.ame-meta-box-list'), columnCount = tables.find('thead').first().find('th').length, maxWidths = wsAmeLodash.fill(Array(columnCount), 0);
    tables.find('tr').each(function () {
        $(this).find('td,th').each(function (index) {
            var width = $(this).width();
            if (maxWidths[index]) {
                maxWidths[index] = Math.max(width, maxWidths[index]);
            }
            else {
                maxWidths[index] = width;
            }
        });
    });
    tables.each(function () {
        $(this).find('thead th').each(function (index) {
            $(this).width(maxWidths[index]);
        });
    });
    //Set up tooltips.
    if ($['qtip']) {
        $('#ame-meta-box-editor .ws_tooltip_trigger').qtip({
            style: {
                classes: 'qtip qtip-rounded ws_tooltip_node'
            }
        });
    }
});
