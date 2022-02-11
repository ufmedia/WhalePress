/// <reference path="../../../js/knockout.d.ts" />
/// <reference path="../../../js/lodash-3.10.d.ts" />
/// <reference path="dashboard-widget-editor.ts" />
/// <reference path="../../../js/common.d.ts" />
var __extends = (this && this.__extends) || (function () {
    var extendStatics = function (d, b) {
        extendStatics = Object.setPrototypeOf ||
            ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
            function (d, b) { for (var p in b) if (Object.prototype.hasOwnProperty.call(b, p)) d[p] = b[p]; };
        return extendStatics(d, b);
    };
    return function (d, b) {
        if (typeof b !== "function" && b !== null)
            throw new TypeError("Class extends value " + String(b) + " is not a constructor or null");
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
var AmeDashboardWidget = /** @class */ (function () {
    function AmeDashboardWidget(settings, widgetEditor) {
        var _this = this;
        this.isPresent = true;
        this.missingWidgetTooltip = "N/A";
        this.canBeDeleted = false;
        this.canChangePriority = false;
        this.canChangeTitle = true;
        this.propertyTemplate = '';
        this.widgetType = null;
        this.rawProperties = settings;
        this.widgetEditor = widgetEditor;
        this.id = settings['id'];
        this.isPresent = !!(settings['isPresent']);
        this.canBeDeleted = !this.isPresent;
        var self = this;
        this.safeTitle = ko.computed({
            read: function () {
                return AmeDashboardWidget.stripAllTags(self.title());
            },
            deferEvaluation: true //this.title might not be initialised at this point, so skip it until later.
        });
        this.isOpen = ko.observable(false);
        this.areAdvancedPropertiesVisible = ko.observable(true);
        this.grantAccess = new AmeActorAccessDictionary(settings.hasOwnProperty('grantAccess') ? settings['grantAccess'] : {});
        //Indeterminate checkbox state: when the widget is enabled for some roles and disabled for others.
        var _isIndeterminate = ko.observable(false);
        this.isIndeterminate = ko.computed(function () {
            if (widgetEditor.selectedActor() !== null) {
                return false;
            }
            return _isIndeterminate();
        });
        //Is the widget enabled for the selected actor?
        this.isEnabled = ko.computed({
            read: function () {
                var actor = widgetEditor.selectedActor();
                if (actor !== null) {
                    return _this.actorHasAccess(actor);
                }
                else {
                    //Check if any actors have this widget enabled.
                    //We only care about visible actors. There might be some users that are loaded but not visible.
                    var actors = widgetEditor.actorSelector.getVisibleActors();
                    var areAnyActorsEnabled = false, areAnyActorsDisabled = false;
                    for (var index = 0; index < actors.length; index++) {
                        var hasAccess = _this.actorHasAccess(actors[index].getId(), actors[index]);
                        if (hasAccess) {
                            areAnyActorsEnabled = true;
                        }
                        else if (hasAccess === false) {
                            areAnyActorsDisabled = true;
                        }
                    }
                    _isIndeterminate(areAnyActorsEnabled && areAnyActorsDisabled);
                    return areAnyActorsEnabled;
                }
            },
            write: function (enabled) {
                var actor = widgetEditor.selectedActor();
                if (actor !== null) {
                    _this.grantAccess.set(actor, enabled);
                }
                else {
                    //Enable/disable all.
                    var actors = widgetEditor.actorSelector.getVisibleActors();
                    for (var index = 0; index < actors.length; index++) {
                        _this.grantAccess.set(actors[index].getId(), enabled);
                    }
                }
            }
        });
    }
    AmeDashboardWidget.stripAllTags = function (input) {
        //Based on: http://phpjs.org/functions/strip_tags/
        var tags = /<\/?([a-z][a-z0-9]*)\b[^>]*>/gi, commentsAndPhpTags = /<!--[\s\S]*?-->|<\?(?:php)?[\s\S]*?\?>/gi;
        return input.replace(commentsAndPhpTags, '').replace(tags, '');
    };
    AmeDashboardWidget.prototype.createObservableWithDefault = function (customValue, defaultValue, writeCallback) {
        //Sentinel value: '' (the empty string). Null is also accepted and automatically converted to ''.
        var sentinel = '';
        customValue = writeCallback(customValue, sentinel);
        if ((customValue === defaultValue) || (customValue === null)) {
            customValue = sentinel;
        }
        var _customValue = ko.observable(customValue);
        var observable = ko.computed({
            read: function () {
                var customValue = _customValue();
                if (customValue === sentinel) {
                    return defaultValue;
                }
                else {
                    return customValue;
                }
            },
            write: function (newValue) {
                var oldValue = _customValue();
                var valueToWrite = writeCallback(newValue, oldValue);
                if ((valueToWrite === defaultValue) || (valueToWrite === null)) {
                    valueToWrite = sentinel;
                }
                if (valueToWrite !== oldValue) {
                    _customValue(valueToWrite);
                }
                else if ((valueToWrite !== newValue) || (valueToWrite === sentinel)) {
                    observable.notifySubscribers();
                }
            }
        });
        observable.resetToDefault = function () {
            _customValue(sentinel);
        };
        observable.getCustomValue = function () {
            return _customValue();
        };
        return observable;
    };
    AmeDashboardWidget.prototype.toggle = function () {
        this.isOpen(!this.isOpen());
    };
    AmeDashboardWidget.prototype.toPropertyMap = function () {
        var properties = {
            'id': this.id,
            'title': this.title(),
            'location': this.location(),
            'priority': this.priority(),
            'grantAccess': this.grantAccess.getAll()
        };
        properties = AmeDashboardWidget._.merge({}, this.rawProperties, properties);
        if (this.widgetType !== null) {
            properties['widgetType'] = this.widgetType;
        }
        return properties;
    };
    AmeDashboardWidget.prototype.actorHasAccess = function (actorId, actor, defaultAccess) {
        if (defaultAccess === void 0) { defaultAccess = true; }
        //Is there a setting for this actor specifically?
        var hasAccess = this.grantAccess.get(actorId, null);
        if (hasAccess !== null) {
            return hasAccess;
        }
        if (!actor) {
            actor = AmeActors.getActor(actorId);
        }
        if (actor instanceof AmeUser) {
            //The Super Admin has access to everything by default, and it takes priority over roles.
            if (actor.isSuperAdmin) {
                return this.grantAccess.get('special:super_admin', true);
            }
            //Allow access if at least one role has access.
            var result = false;
            for (var index = 0; index < actor.roles.length; index++) {
                var roleActor = 'role:' + actor.roles[index], roleHasAccess = this.grantAccess.get(roleActor, true);
                result = result || roleHasAccess;
            }
            return result;
        }
        //By default, all widgets are visible to everyone.
        return defaultAccess;
    };
    AmeDashboardWidget._ = wsAmeLodash;
    return AmeDashboardWidget;
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
    // noinspection JSUnusedGlobalSymbols
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
var AmeStandardWidgetWrapper = /** @class */ (function (_super) {
    __extends(AmeStandardWidgetWrapper, _super);
    function AmeStandardWidgetWrapper(settings, widgetEditor) {
        var _this = _super.call(this, settings, widgetEditor) || this;
        _this.wrappedWidget = settings['wrappedWidget'];
        _this.title = _this.createObservableWithDefault(settings['title'], _this.wrappedWidget.title, function (value) {
            //Trim leading and trailing whitespace.
            value = value.replace(/^\s+|\s+$/g, "");
            if (value === '') {
                return null;
            }
            return value;
        });
        _this.location = _this.createObservableWithDefault(settings['location'], _this.wrappedWidget.location, function () {
            return null;
        });
        _this.priority = _this.createObservableWithDefault(settings['priority'], _this.wrappedWidget.priority, function () {
            return null;
        });
        if (!_this.isPresent) {
            //Note: This is not intended to be perfectly accurate.
            var wasCreatedByTheme = _this.rawProperties.hasOwnProperty('callbackFileName')
                && _this.rawProperties['callbackFileName'].match(/[/\\]wp-content[/\\]themes[/\\]/);
            _this.missingWidgetTooltip = (wasCreatedByTheme ? 'The theme' : 'The plugin')
                + ' that created this widget is not active.'
                + '\nTo remove the widget, open it and click "Delete".';
        }
        return _this;
    }
    AmeStandardWidgetWrapper.prototype.toPropertyMap = function () {
        var properties = _super.prototype.toPropertyMap.call(this);
        properties['wrappedWidget'] = this.wrappedWidget;
        properties['title'] = this.title.getCustomValue();
        properties['location'] = this.location.getCustomValue();
        properties['priority'] = this.priority.getCustomValue();
        return properties;
    };
    return AmeStandardWidgetWrapper;
}(AmeDashboardWidget));
var AmeCustomHtmlWidget = /** @class */ (function (_super) {
    __extends(AmeCustomHtmlWidget, _super);
    function AmeCustomHtmlWidget(settings, widgetEditor) {
        var _this = this;
        var _ = AmeDashboardWidget._;
        settings = _.merge({
            id: 'new-untitled-widget',
            isPresent: true,
            grantAccess: {}
        }, settings);
        _this = _super.call(this, settings, widgetEditor) || this;
        _this.widgetType = 'custom-html';
        _this.canChangePriority = true;
        _this.title = ko.observable(_.get(settings, 'title', 'New Widget'));
        _this.location = ko.observable(_.get(settings, 'location', 'normal'));
        _this.priority = ko.observable(_.get(settings, 'priority', 'high'));
        _this.content = ko.observable(_.get(settings, 'content', ''));
        _this.filtersEnabled = ko.observable(_.get(settings, 'filtersEnabled', true));
        //Custom widgets are always present and can always be deleted.
        _this.isPresent = true;
        _this.canBeDeleted = true;
        _this.propertyTemplate = 'ame-custom-html-widget-template';
        return _this;
    }
    AmeCustomHtmlWidget.prototype.toPropertyMap = function () {
        var properties = _super.prototype.toPropertyMap.call(this);
        properties['content'] = this.content();
        properties['filtersEnabled'] = this.filtersEnabled();
        return properties;
    };
    return AmeCustomHtmlWidget;
}(AmeDashboardWidget));
var AmeCustomRssWidget = /** @class */ (function (_super) {
    __extends(AmeCustomRssWidget, _super);
    function AmeCustomRssWidget(settings, widgetEditor) {
        var _this = this;
        var _ = AmeDashboardWidget._;
        settings = _.merge({
            id: 'new-untitled-rss-widget',
            isPresent: true,
            grantAccess: {}
        }, settings);
        _this = _super.call(this, settings, widgetEditor) || this;
        _this.widgetType = 'custom-rss';
        _this.canChangePriority = true;
        _this.title = ko.observable(_.get(settings, 'title', 'New RSS Widget'));
        _this.location = ko.observable(_.get(settings, 'location', 'normal'));
        _this.priority = ko.observable(_.get(settings, 'priority', 'high'));
        _this.feedUrl = ko.observable(_.get(settings, 'feedUrl', ''));
        _this.maxItems = ko.observable(_.get(settings, 'maxItems', 5));
        _this.showAuthor = ko.observable(_.get(settings, 'showAuthor', true));
        _this.showDate = ko.observable(_.get(settings, 'showDate', true));
        _this.showSummary = ko.observable(_.get(settings, 'showSummary', true));
        _this.isPresent = true;
        _this.canBeDeleted = true;
        _this.propertyTemplate = 'ame-custom-rss-widget-template';
        return _this;
    }
    AmeCustomRssWidget.prototype.toPropertyMap = function () {
        var properties = _super.prototype.toPropertyMap.call(this);
        var storedProps = ['feedUrl', 'showAuthor', 'showDate', 'showSummary', 'maxItems'];
        for (var i = 0; i < storedProps.length; i++) {
            var name_1 = storedProps[i];
            properties[name_1] = this[name_1]();
        }
        return properties;
    };
    return AmeCustomRssWidget;
}(AmeDashboardWidget));
var AmeWelcomeWidget = /** @class */ (function (_super) {
    __extends(AmeWelcomeWidget, _super);
    function AmeWelcomeWidget(settings, widgetEditor) {
        var _this = this;
        var _ = AmeDashboardWidget._;
        if (_.isArray(settings)) {
            settings = {};
        }
        settings = _.merge({
            id: AmeWelcomeWidget.permanentId,
            isPresent: true,
            grantAccess: {}
        }, settings);
        _this = _super.call(this, settings, widgetEditor) || this;
        _this.title = ko.observable('Welcome');
        _this.location = ko.observable('normal');
        _this.priority = ko.observable('high');
        _this.canChangeTitle = false;
        _this.canChangePriority = false;
        _this.areAdvancedPropertiesVisible(false);
        //The "Welcome" widget is part of WordPress core. It's always present and can't be deleted.
        _this.isPresent = true;
        _this.canBeDeleted = false;
        _this.propertyTemplate = 'ame-welcome-widget-template';
        return _this;
    }
    AmeWelcomeWidget.prototype.actorHasAccess = function (actorId, actor, defaultAccess) {
        if (defaultAccess === void 0) { defaultAccess = true; }
        //Only people who have the "edit_theme_options" capability can see the "Welcome" panel.
        //See /wp-admin/index.php, line #108 or thereabouts.
        defaultAccess = AmeActors.hasCapByDefault(actorId, 'edit_theme_options');
        return _super.prototype.actorHasAccess.call(this, actorId, actor, defaultAccess);
    };
    AmeWelcomeWidget.permanentId = 'special:welcome-panel';
    return AmeWelcomeWidget;
}(AmeDashboardWidget));
var AmeWidgetPropertyComponent = /** @class */ (function () {
    function AmeWidgetPropertyComponent(params) {
        this.widget = params['widget'];
        this.label = params['label'] || '';
    }
    return AmeWidgetPropertyComponent;
}());
//Custom element: <ame-widget-property>
ko.components.register('ame-widget-property', {
    viewModel: AmeWidgetPropertyComponent,
    template: {
        element: 'ame-widget-property-template'
    }
});
