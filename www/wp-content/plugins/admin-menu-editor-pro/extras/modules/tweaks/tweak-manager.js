/// <reference path="../../../js/knockout.d.ts" />
/// <reference path="../../../js/jquery.d.ts" />
/// <reference path="../../../js/lodash-3.10.d.ts" />
/// <reference path="../../../modules/actor-selector/actor-selector.ts" />
/// <reference path="../../../js/jquery.biscuit.d.ts" />
/// <reference path="../../ko-extensions.ts" />
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
var AmeNamedNode = /** @class */ (function () {
    function AmeNamedNode(properties) {
        this.htmlId = '';
        this.id = properties.id;
        this.label = properties.label;
    }
    return AmeNamedNode;
}());
function isAmeSettingsGroupProperties(thing) {
    var group = thing;
    return (typeof group.children !== 'undefined');
}
function isAmeSettingProperties(thing) {
    return (typeof thing.dataType === 'string');
}
var AmeSetting = /** @class */ (function (_super) {
    __extends(AmeSetting, _super);
    function AmeSetting(properties, store, path) {
        if (path === void 0) { path = []; }
        var _this = _super.call(this, properties) || this;
        var defaultValue = null;
        if (typeof properties.defaultValue !== 'undefined') {
            defaultValue = properties.defaultValue;
        }
        _this.inputValue = store.getObservableProperty(properties.id, defaultValue, path);
        AmeSetting.idCounter++;
        _this.uniqueInputId = 'ws-ame-gen-setting-' + AmeSetting.idCounter;
        return _this;
    }
    AmeSetting.idCounter = 0;
    return AmeSetting;
}(AmeNamedNode));
var AmeStringSetting = /** @class */ (function (_super) {
    __extends(AmeStringSetting, _super);
    function AmeStringSetting(properties, module, store, path) {
        if (path === void 0) { path = []; }
        var _this = _super.call(this, properties, store, path) || this;
        _this.syntaxHighlightingOptions = null;
        _this.templateName = 'ame-tweak-textarea-input-template';
        if (properties.syntaxHighlighting && module) {
            _this.syntaxHighlightingOptions = module.getCodeMirrorOptions(properties.syntaxHighlighting);
        }
        return _this;
    }
    return AmeStringSetting;
}(AmeSetting));
var AmeColorSetting = /** @class */ (function (_super) {
    __extends(AmeColorSetting, _super);
    function AmeColorSetting(properties, store, path) {
        if (path === void 0) { path = []; }
        var _this = _super.call(this, properties, store, path) || this;
        _this.templateName = 'ame-tweak-color-input-template';
        return _this;
    }
    return AmeColorSetting;
}(AmeSetting));
var AmeBooleanSetting = /** @class */ (function (_super) {
    __extends(AmeBooleanSetting, _super);
    function AmeBooleanSetting(properties, store, path) {
        if (path === void 0) { path = []; }
        var _this = _super.call(this, properties, store, path) || this;
        _this.templateName = 'ame-tweak-boolean-input-template';
        //Ensure that the value is always a boolean.
        var _internalValue = _this.inputValue;
        if (typeof _internalValue() !== 'boolean') {
            _internalValue(!!_internalValue());
        }
        _this.inputValue = ko.computed({
            read: function () {
                return _internalValue();
            },
            write: function (newValue) {
                if (typeof newValue !== 'boolean') {
                    newValue = !!newValue;
                }
                _internalValue(newValue);
            },
            owner: _this
        });
        return _this;
    }
    return AmeBooleanSetting;
}(AmeSetting));
function isAmeActorFeatureProperties(thing) {
    return (typeof thing.hasAccessMap === 'boolean');
}
var AmeSettingStore = /** @class */ (function () {
    function AmeSettingStore(initialProperties) {
        if (initialProperties === void 0) { initialProperties = {}; }
        this.observableProperties = {};
        this.accessMaps = {};
        this.initialProperties = initialProperties;
    }
    AmeSettingStore.prototype.getObservableProperty = function (name, defaultValue, path) {
        if (path === void 0) { path = []; }
        path = this.getFullPath(name, path);
        if (this.observableProperties.hasOwnProperty(path)) {
            return this.observableProperties[path];
        }
        var _ = AmeTweakManagerModule._;
        var value = _.get(this.initialProperties, path, defaultValue);
        var observable = ko.observable(value);
        this.observableProperties[path] = observable;
        return observable;
    };
    AmeSettingStore.prototype.getFullPath = function (name, path) {
        if (typeof path !== 'string') {
            path = path.join('.');
        }
        if (path === '') {
            path = name;
        }
        else {
            path = path + '.' + name;
        }
        return path;
    };
    AmeSettingStore.prototype.propertiesToJs = function () {
        var _ = AmeTweakManagerModule._;
        var newProps = {};
        _.forOwn(this.observableProperties, function (observable, path) {
            _.set(newProps, path, observable());
        });
        _.forOwn(this.accessMaps, function (map, path) {
            //Since all tweaks are disabled by default, having a tweak disabled for a role is the same
            //as not having a setting, so we can save some space by removing it. This does not always
            //apply to users/Super Admins because they can have precedence over roles.
            var temp = map.getAll();
            var enabled = {};
            var areAllFalse = true;
            for (var actorId in temp) {
                if (!temp.hasOwnProperty(actorId)) {
                    continue;
                }
                areAllFalse = areAllFalse && (!temp[actorId]);
                if (!temp[actorId]) {
                    var actor = AmeActors.getActor(actorId);
                    if (actor instanceof AmeRole) {
                        continue;
                    }
                }
                enabled[actorId] = temp[actorId];
            }
            if (areAllFalse) {
                enabled = {};
            }
            _.set(newProps, path, enabled);
        });
        return newProps;
    };
    AmeSettingStore.prototype.getAccessMap = function (name, path, defaultAccessMap) {
        if (path === void 0) { path = []; }
        if (defaultAccessMap === void 0) { defaultAccessMap = null; }
        path = this.getFullPath(name, path);
        var _ = AmeTweakManagerModule._;
        var value = _.get(this.initialProperties, path, defaultAccessMap);
        if (!this.accessMaps.hasOwnProperty(path)) {
            this.accessMaps[path] = new AmeObservableActorSettings(value);
        }
        return this.accessMaps[path];
    };
    return AmeSettingStore;
}());
function isSettingStore(thing) {
    var maybe = thing;
    return (typeof maybe.getObservableProperty !== 'undefined') && (typeof maybe.propertiesToJs !== 'undefined');
}
var AmeCompositeNode = /** @class */ (function (_super) {
    __extends(AmeCompositeNode, _super);
    function AmeCompositeNode(properties, module, store, path) {
        if (store === void 0) { store = null; }
        if (path === void 0) { path = []; }
        var _this = _super.call(this, properties) || this;
        _this.children = null;
        _this.id = properties.id;
        _this.label = properties.label;
        if (store === 'self') {
            if (!_this.properties) {
                _this.properties = new AmeSettingStore(properties);
            }
            store = _this.properties;
        }
        if (isAmeSettingsGroupProperties(properties)) {
            if ((typeof properties.propertyPath === 'string') && (properties.propertyPath !== '')) {
                _this.propertyPath = properties.propertyPath.split('.');
            }
            else {
                _this.propertyPath = [];
            }
            if (path.length > 0) {
                _this.propertyPath = path.concat(_this.propertyPath);
            }
            var children = [];
            if (properties.children && (properties.children.length > 0)) {
                for (var i = 0; i < properties.children.length; i++) {
                    var props = properties.children[i];
                    var child = void 0;
                    if (isAmeSettingProperties(props)) {
                        child = AmeCompositeNode.createSetting(props, module, store, _this.propertyPath);
                    }
                    else {
                        child = new AmeCompositeNode(props, module, store, _this.propertyPath);
                    }
                    if (child) {
                        children.push(child);
                    }
                }
            }
            _this.children = ko.observableArray(children);
        }
        if (isAmeActorFeatureProperties(properties)) {
            var name_1 = (store === _this.properties) ? 'enabledForActor' : _this.id;
            var defaultAccess = (typeof properties.defaultAccessMap !== 'undefined') ? properties.defaultAccessMap : null;
            _this.actorAccess = new AmeActorAccess(store.getAccessMap(name_1, path, defaultAccess), module, _this.children);
        }
        return _this;
    }
    AmeCompositeNode.createSetting = function (properties, module, store, path) {
        if (path === void 0) { path = []; }
        var inputType = properties.inputType ? properties.inputType : properties.dataType;
        switch (inputType) {
            case 'text':
            case 'textarea':
            case 'string':
                return new AmeStringSetting(properties, module, store, path);
            case 'color':
                return new AmeColorSetting(properties, store, path);
            case 'boolean':
                return new AmeBooleanSetting(properties, store, path);
            default:
                if (console && console.error) {
                    console.error('Unknown setting input type "%s"', inputType);
                }
                return null;
        }
    };
    return AmeCompositeNode;
}(AmeNamedNode));
var AmeActorAccess = /** @class */ (function () {
    function AmeActorAccess(actorSettings, module, children) {
        var _this = this;
        if (children === void 0) { children = null; }
        this.module = module;
        this.enabledForActor = actorSettings;
        var _isIndeterminate = ko.observable(false);
        this.isIndeterminate = ko.computed(function () {
            if (module.selectedActor() !== null) {
                return false;
            }
            return _isIndeterminate();
        });
        this.isChecked = ko.computed({
            read: function () {
                var selectedActor = _this.module.selectedActor();
                if (selectedActor === null) {
                    //All: Checked only if it's checked for all actors.
                    var allActors = _this.module.actorSelector.getVisibleActors();
                    var isEnabledForAll = true, isEnabledForAny = false;
                    for (var index = 0; index < allActors.length; index++) {
                        if (_this.enabledForActor.get(allActors[index].getId(), false)) {
                            isEnabledForAny = true;
                        }
                        else {
                            isEnabledForAll = false;
                        }
                    }
                    _isIndeterminate(isEnabledForAny && !isEnabledForAll);
                    return isEnabledForAll;
                }
                //Is there an explicit setting for this actor?
                var ownSetting = _this.enabledForActor.get(selectedActor.getId(), null);
                if (ownSetting !== null) {
                    return ownSetting;
                }
                if (selectedActor instanceof AmeUser) {
                    //The "Super Admin" setting takes precedence over regular roles.
                    if (selectedActor.isSuperAdmin) {
                        var superAdminSetting = _this.enabledForActor.get(AmeSuperAdmin.permanentActorId, null);
                        if (superAdminSetting !== null) {
                            return superAdminSetting;
                        }
                    }
                    //Is it enabled for any of the user's roles?
                    for (var i = 0; i < selectedActor.roles.length; i++) {
                        var groupSetting = _this.enabledForActor.get('role:' + selectedActor.roles[i], null);
                        if (groupSetting === true) {
                            return true;
                        }
                    }
                }
                //All tweaks are unchecked by default.
                return false;
            },
            write: function (checked) {
                var selectedActor = _this.module.selectedActor();
                if (selectedActor === null) {
                    //Enable/disable this tweak for all actors.
                    if (checked === false) {
                        //Since false is the default, this is the same as removing/resetting all values.
                        _this.enabledForActor.resetAll();
                    }
                    else {
                        var allActors = _this.module.actorSelector.getVisibleActors();
                        for (var i = 0; i < allActors.length; i++) {
                            _this.enabledForActor.set(allActors[i].getId(), checked);
                        }
                    }
                }
                else {
                    _this.enabledForActor.set(selectedActor.getId(), checked);
                }
                //Apply the same setting to all children.
                if (children) {
                    var childrenArray = children();
                    for (var i = 0; i < childrenArray.length; i++) {
                        var child = childrenArray[i];
                        if ((child instanceof AmeCompositeNode) && child.actorAccess) {
                            child.actorAccess.isChecked(checked);
                        }
                    }
                }
            }
        });
    }
    return AmeActorAccess;
}());
var AmeTweakItem = /** @class */ (function (_super) {
    __extends(AmeTweakItem, _super);
    function AmeTweakItem(properties, module) {
        var _this = _super.call(this, properties, module, 'self') || this;
        _this.initialProperties = null;
        _this.section = null;
        _this.parent = null;
        _this.isUserDefined = properties.isUserDefined ? properties.isUserDefined : false;
        if (_this.isUserDefined) {
            _this.initialProperties = properties;
        }
        if (_this.isUserDefined) {
            _this.label = ko.observable(properties.label);
        }
        else {
            _this.label = ko.pureComputed(function () {
                return properties.label;
            });
        }
        _this.htmlId = 'ame-tweak-' + AmeTweakManagerModule.slugify(_this.id);
        return _this;
    }
    AmeTweakItem.prototype.toJs = function () {
        var result = {
            id: this.id
        };
        var _ = AmeTweakManagerModule._;
        if (this.properties) {
            result = _.defaults(result, this.properties.propertiesToJs());
        }
        if (!this.isUserDefined) {
            return result;
        }
        else {
            var props = result;
            props.isUserDefined = this.isUserDefined;
            props.label = this.label();
            props.sectionId = this.section ? this.section.id : null;
            props.parentId = this.parent ? this.parent.id : null;
            props = _.defaults(props, _.omit(this.initialProperties, 'userInputValue', 'enabledForActor'));
            return props;
        }
    };
    AmeTweakItem.prototype.setSection = function (section) {
        this.section = section;
        return this;
    };
    AmeTweakItem.prototype.setParent = function (tweak) {
        this.parent = tweak;
        return this;
    };
    AmeTweakItem.prototype.getSection = function () {
        return this.section;
    };
    AmeTweakItem.prototype.getParent = function () {
        return this.parent;
    };
    AmeTweakItem.prototype.addChild = function (tweak) {
        this.children.push(tweak);
        tweak.setParent(this);
        return this;
    };
    AmeTweakItem.prototype.removeChild = function (tweak) {
        this.children.remove(tweak);
    };
    AmeTweakItem.prototype.getEditableProperty = function (key) {
        if (this.properties) {
            return this.properties.getObservableProperty(key, '');
        }
    };
    AmeTweakItem.prototype.getTypeId = function () {
        if (!this.isUserDefined || !this.initialProperties) {
            return null;
        }
        if (this.initialProperties.typeId) {
            return this.initialProperties.typeId;
        }
        return null;
    };
    return AmeTweakItem;
}(AmeCompositeNode));
var AmeTweakSection = /** @class */ (function () {
    function AmeTweakSection(properties) {
        this.footerTemplateName = null;
        this.id = properties.id;
        this.label = properties.label;
        this.isOpen = ko.observable(true);
        this.tweaks = ko.observableArray([]);
    }
    AmeTweakSection.prototype.addTweak = function (tweak) {
        this.tweaks.push(tweak);
        tweak.setSection(this);
    };
    AmeTweakSection.prototype.removeTweak = function (tweak) {
        this.tweaks.remove(tweak);
    };
    AmeTweakSection.prototype.hasContent = function () {
        return this.tweaks().length > 0;
    };
    AmeTweakSection.prototype.toggle = function () {
        this.isOpen(!this.isOpen());
    };
    return AmeTweakSection;
}());
var AmeTweakManagerModule = /** @class */ (function () {
    function AmeTweakManagerModule(scriptData) {
        var _this = this;
        this.tweaksById = {};
        this.sectionsById = {};
        this.sections = [];
        this.lastUserTweakSuffix = 0;
        var _ = AmeTweakManagerModule._;
        this.actorSelector = new AmeActorSelector(AmeActors, scriptData.isProVersion);
        this.selectedActorId = this.actorSelector.createKnockoutObservable(ko);
        this.selectedActor = ko.computed(function () {
            var id = _this.selectedActorId();
            if (id === null) {
                return null;
            }
            return AmeActors.getActor(id);
        });
        //Reselect the previously selected actor.
        this.selectedActorId(scriptData.selectedActor);
        //Set syntax highlighting options.
        this.cssHighlightingOptions = _.merge({}, scriptData.defaultCodeEditorSettings, {
            'codemirror': {
                'mode': 'css',
                'lint': true,
                'autoCloseBrackets': true,
                'matchBrackets': true
            }
        });
        //Sort sections by priority, then by label.
        var sectionData = _.sortByAll(scriptData.sections, ['priority', 'label']);
        //Register sections.
        _.forEach(sectionData, function (properties) {
            var section = new AmeTweakSection(properties);
            _this.sectionsById[section.id] = section;
            _this.sections.push(section);
        });
        var firstSection = this.sections[0];
        _.forEach(scriptData.tweaks, function (properties) {
            var tweak = new AmeTweakItem(properties, _this);
            _this.tweaksById[tweak.id] = tweak;
            if (properties.parentId && _this.tweaksById.hasOwnProperty(properties.parentId)) {
                _this.tweaksById[properties.parentId].addChild(tweak);
            }
            else {
                var ownerSection = firstSection;
                if (properties.sectionId && _this.sectionsById.hasOwnProperty(properties.sectionId)) {
                    ownerSection = _this.sectionsById[properties.sectionId];
                }
                ownerSection.addTweak(tweak);
            }
        });
        //Remove empty sections.
        this.sections = _.filter(this.sections, function (section) {
            return section.hasContent();
        });
        //Add the tweak creation button to the Admin CSS section.
        if (this.sectionsById.hasOwnProperty('admin-css')) {
            this.sectionsById['admin-css'].footerTemplateName = 'ame-admin-css-section-footer';
        }
        //By default, all sections except the first one are closed.
        //The user can open/close sections and we automatically remember their state.
        this.openSectionIds = ko.computed({
            read: function () {
                var result = [];
                _.forEach(_this.sections, function (section) {
                    if (section.isOpen()) {
                        result.push(section.id);
                    }
                });
                return result;
            },
            write: function (sectionIds) {
                var openSections = _.indexBy(sectionIds);
                _.forEach(_this.sections, function (section) {
                    section.isOpen(openSections.hasOwnProperty(section.id));
                });
            }
        });
        this.openSectionIds.extend({ rateLimit: { timeout: 1000, method: 'notifyWhenChangesStop' } });
        var initialState = null;
        var cookieValue = jQuery.cookie(AmeTweakManagerModule.openSectionCookieName);
        if ((typeof cookieValue === 'string') && JSON && JSON.parse) {
            var storedState = JSON.parse(cookieValue);
            if (_.isArray(storedState)) {
                initialState = _.intersection(_.keys(this.sectionsById), storedState);
            }
        }
        if (initialState !== null) {
            this.openSectionIds(initialState);
        }
        else {
            this.openSectionIds([_.first(this.sections).id]);
        }
        this.openSectionIds.subscribe(function (sectionIds) {
            jQuery.cookie(AmeTweakManagerModule.openSectionCookieName, ko.toJSON(sectionIds), { expires: 90 });
        });
        if (scriptData.lastUserTweakSuffix) {
            this.lastUserTweakSuffix = scriptData.lastUserTweakSuffix;
        }
        this.adminCssEditorDialog = new AmeEditAdminCssDialog(this);
        this.settingsData = ko.observable('');
        this.isSaving = ko.observable(false);
    }
    AmeTweakManagerModule.prototype.saveChanges = function () {
        this.isSaving(true);
        var _ = wsAmeLodash;
        var data = {
            'tweaks': _.indexBy(_.invoke(this.tweaksById, 'toJs'), 'id'),
            'lastUserTweakSuffix': this.lastUserTweakSuffix
        };
        this.settingsData(ko.toJSON(data));
        return true;
    };
    AmeTweakManagerModule.prototype.addAdminCssTweak = function (label, css) {
        this.lastUserTweakSuffix++;
        var slug = AmeTweakManagerModule.slugify(label);
        if (slug !== '') {
            slug = '-' + slug;
        }
        var props = {
            label: label,
            id: 'utw-' + this.lastUserTweakSuffix + slug,
            isUserDefined: true,
            sectionId: 'admin-css',
            typeId: 'admin-css',
            children: [],
            hasAccessMap: true
        };
        props['css'] = css;
        var cssInput = {
            id: 'css',
            label: '',
            dataType: 'string',
            inputType: 'textarea',
            syntaxHighlighting: 'css'
        };
        props.children.push(cssInput);
        var newTweak = new AmeTweakItem(props, this);
        this.tweaksById[newTweak.id] = newTweak;
        this.sectionsById['admin-css'].addTweak(newTweak);
    };
    AmeTweakManagerModule.slugify = function (input) {
        var _ = AmeTweakManagerModule._;
        var output = _.deburr(input);
        output = output.replace(/[^a-zA-Z0-9 \-]/, '');
        return _.kebabCase(output);
    };
    AmeTweakManagerModule.prototype.launchTweakEditor = function (tweak) {
        // noinspection JSRedundantSwitchStatement
        switch (tweak.getTypeId()) {
            case 'admin-css':
                this.adminCssEditorDialog.selectedTweak = tweak;
                this.adminCssEditorDialog.open();
                break;
            default:
                alert('Error: Editor not implemented! This is probably a bug.');
        }
    };
    AmeTweakManagerModule.prototype.confirmDeleteTweak = function (tweak) {
        if (!tweak.isUserDefined || !confirm('Delete this tweak?')) {
            return;
        }
        this.deleteTweak(tweak);
    };
    AmeTweakManagerModule.prototype.deleteTweak = function (tweak) {
        var section = tweak.getSection();
        if (section) {
            section.removeTweak(tweak);
        }
        var parent = tweak.getParent();
        if (parent) {
            parent.removeChild(tweak);
        }
        delete this.tweaksById[tweak.id];
    };
    AmeTweakManagerModule.prototype.getCodeMirrorOptions = function (mode) {
        if (mode === 'css') {
            return this.cssHighlightingOptions;
        }
        return null;
    };
    AmeTweakManagerModule._ = wsAmeLodash;
    AmeTweakManagerModule.openSectionCookieName = 'ame_tmce_open_sections';
    return AmeTweakManagerModule;
}());
var AmeEditAdminCssDialog = /** @class */ (function () {
    function AmeEditAdminCssDialog(manager) {
        var _this = this;
        this.autoCancelButton = false;
        this.options = {
            minWidth: 400
        };
        this.selectedTweak = null;
        var _ = AmeTweakManagerModule._;
        this.manager = manager;
        this.tweakLabel = ko.observable('');
        this.cssCode = ko.observable('');
        this.confirmButtonText = ko.observable('Add Snippet');
        this.title = ko.observable(null);
        this.isAddButtonEnabled = ko.computed(function () {
            return !((_.trim(_this.tweakLabel()) === '') || (_.trim(_this.cssCode()) === ''));
        });
        this.isOpen = ko.observable(false);
    }
    AmeEditAdminCssDialog.prototype.onOpen = function (event, ui) {
        if (this.selectedTweak) {
            this.tweakLabel(this.selectedTweak.label());
            this.title('Edit admin CSS snippet');
            this.confirmButtonText('Save Changes');
            var cssProperty = this.selectedTweak.getEditableProperty('css');
            this.cssCode(cssProperty ? cssProperty() : '');
        }
        else {
            this.tweakLabel('');
            this.cssCode('');
            this.title('Add admin CSS snippet');
            this.confirmButtonText('Add Snippet');
        }
    };
    AmeEditAdminCssDialog.prototype.onConfirm = function () {
        if (this.selectedTweak) {
            //Update the existing tweak.
            this.selectedTweak.label(this.tweakLabel());
            this.selectedTweak.getEditableProperty('css')(this.cssCode());
        }
        else {
            //Create a new tweak.
            this.manager.addAdminCssTweak(this.tweakLabel(), this.cssCode());
        }
        this.close();
    };
    AmeEditAdminCssDialog.prototype.onClose = function () {
        this.selectedTweak = null;
    };
    AmeEditAdminCssDialog.prototype.close = function () {
        this.isOpen(false);
    };
    AmeEditAdminCssDialog.prototype.open = function () {
        this.isOpen(true);
    };
    return AmeEditAdminCssDialog;
}());
ko.bindingHandlers.ameCodeMirror = {
    init: function (element, valueAccessor, allBindings) {
        if (!wp.hasOwnProperty('codeEditor') || !wp.codeEditor.initialize) {
            return;
        }
        var parameters = ko.unwrap(valueAccessor());
        if (!parameters) {
            return;
        }
        var options;
        var refreshTrigger;
        if (parameters.options) {
            options = parameters.options;
            if (parameters.refreshTrigger) {
                refreshTrigger = parameters.refreshTrigger;
            }
        }
        else {
            options = parameters;
        }
        var result = wp.codeEditor.initialize(element, options);
        var cm = result.codemirror;
        //Synchronise the editor contents with the observable passed to the "value" binding.
        var valueObservable = allBindings.get('value');
        if (!ko.isObservable(valueObservable)) {
            valueObservable = null;
        }
        var subscription = null;
        var changeHandler = null;
        if (valueObservable !== null) {
            //Update the observable when the contents of the editor change.
            var ignoreNextUpdate_1 = false;
            changeHandler = function () {
                //This will trigger our observable subscription (see below).
                //We need to ignore that trigger to avoid recursive or duplicated updates.
                ignoreNextUpdate_1 = true;
                valueObservable(cm.doc.getValue());
            };
            cm.on('changes', changeHandler);
            //Update the editor when the observable changes.
            subscription = valueObservable.subscribe(function (newValue) {
                if (ignoreNextUpdate_1) {
                    ignoreNextUpdate_1 = false;
                    return;
                }
                cm.doc.setValue(newValue);
                ignoreNextUpdate_1 = false;
            });
        }
        //Refresh the size of the editor element when an observable changes value.
        var refreshSubscription = null;
        if (refreshTrigger) {
            refreshSubscription = refreshTrigger.subscribe(function () {
                cm.refresh();
            });
        }
        //If the editor starts out hidden - for example, because it's inside a collapsed section - it will
        //render incorrectly. To fix that, let's refresh it the first time it becomes visible.
        if (!jQuery(element).is(':visible') && (typeof IntersectionObserver !== 'undefined')) {
            var observer_1 = new IntersectionObserver(function (entries) {
                for (var i = 0; i < entries.length; i++) {
                    if (entries[i].isIntersecting) {
                        //The editor is at least partially visible now.
                        observer_1.disconnect();
                        cm.refresh();
                        break;
                    }
                }
            }, {
                //Use the browser viewport.
                root: null,
                //The threshold is somewhat arbitrary. Any value will work, but a lower setting means
                //that the user is less likely to see an incorrectly rendered editor.
                threshold: 0.05
            });
            observer_1.observe(cm.getWrapperElement());
        }
        ko.utils.domNodeDisposal.addDisposeCallback(element, function () {
            //Remove subscriptions and event handlers.
            if (subscription) {
                subscription.dispose();
            }
            if (refreshSubscription) {
                refreshSubscription.dispose();
            }
            if (changeHandler) {
                cm.off('changes', changeHandler);
            }
            //Destroy the CodeMirror instance.
            jQuery(cm.getWrapperElement()).remove();
        });
    }
};
jQuery(function () {
    ameTweakManager = new AmeTweakManagerModule(wsTweakManagerData);
    ko.applyBindings(ameTweakManager, document.getElementById('ame-tweak-manager'));
});
