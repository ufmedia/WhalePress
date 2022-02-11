/// <reference path="../../../js/knockout.d.ts" />
/// <reference path="../../../js/lodash-3.10.d.ts" />
/// <reference path="../../../js/common.d.ts" />
/// <reference path="../../../js/actor-manager.ts" />
/// <reference path="../../../js/jquery.d.ts" />
/// <reference path="../../../js/jqueryui.d.ts" />
/// <reference path="../../../modules/actor-selector/actor-selector.ts" />
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
var RexPermission = /** @class */ (function () {
    function RexPermission(editor, capability) {
        this.readableAction = null;
        this.mainDescription = '';
        this.isRedundant = false;
        this.editor = editor;
        this.capability = capability;
        var self = this;
        this.labelHtml = ko.pureComputed({
            read: self.getLabelHtml,
            deferEvaluation: true,
            owner: this
        });
        //Prevent freezing when entering a search query. Highlighting keywords in hundreds of capabilities can be slow.
        this.labelHtml.extend({ rateLimit: { timeout: 50, method: "notifyWhenChangesStop" } });
        this.isVisible = ko.computed({
            read: function () {
                if (!editor.capabilityMatchesFilters(self.capability)) {
                    return false;
                }
                //When in list view, check if the capability is inside the selected category.
                if (editor.categoryViewMode() === RexRoleEditor.listView) {
                    if (!editor.isInSelectedCategory(self.capability.name)) {
                        return false;
                    }
                }
                if (self.capability.isDeleted()) {
                    return false;
                }
                return !(self.isRedundant && !editor.showRedundantEnabled());
            },
            owner: this,
            deferEvaluation: true
        });
    }
    RexPermission.prototype.getLabelHtml = function () {
        var text;
        if ((this.readableAction !== null) && this.editor.readableNamesEnabled()) {
            text = this.readableAction;
        }
        else {
            text = this.capability.displayName();
        }
        var html = wsAmeLodash.escape(text);
        if (this.isVisible()) {
            html = this.editor.highlightSearchKeywords(html);
        }
        //Let the browser break words on underscores.
        html = html.replace(/_/g, '_<wbr>');
        return html;
    };
    return RexPermission;
}());
/**
 * A basic representation of any component or extension that can add new capabilities.
 * This includes plugins, themes, and the WordPress core.
 */
var RexWordPressComponent = /** @class */ (function () {
    function RexWordPressComponent(id, name) {
        this.id = id;
        this.name = name;
    }
    RexWordPressComponent.fromJs = function (id, details) {
        var instance = new RexWordPressComponent(id, details.name ? details.name : id);
        if (details.capabilityDocumentationUrl) {
            instance.capabilityDocumentationUrl = details.capabilityDocumentationUrl;
        }
        return instance;
    };
    return RexWordPressComponent;
}());
var RexObservableCapabilityMap = /** @class */ (function () {
    function RexObservableCapabilityMap(initialCapabilities) {
        this.capabilities = {};
        if (initialCapabilities) {
            this.initialCapabilities = wsAmeLodash.clone(initialCapabilities);
        }
        else {
            this.initialCapabilities = {};
        }
    }
    RexObservableCapabilityMap.prototype.getCapabilityState = function (capabilityName) {
        var observable = this.getObservable(capabilityName);
        return observable();
    };
    RexObservableCapabilityMap.prototype.setCapabilityState = function (capabilityName, state) {
        var observable = this.getObservable(capabilityName);
        observable(state);
    };
    RexObservableCapabilityMap.prototype.getAllCapabilities = function () {
        var _ = wsAmeLodash;
        var result = this.initialCapabilities ? _.clone(this.initialCapabilities) : {};
        _.forEach(this.capabilities, function (observable, name) {
            var isGranted = observable();
            if (isGranted === null) {
                delete result[name];
            }
            else {
                result[name] = isGranted;
            }
        });
        return result;
    };
    RexObservableCapabilityMap.prototype.getObservable = function (capabilityName) {
        if (!this.capabilities.hasOwnProperty(capabilityName)) {
            var initialValue = null;
            if (this.initialCapabilities.hasOwnProperty(capabilityName)) {
                initialValue = this.initialCapabilities[capabilityName];
            }
            this.capabilities[capabilityName] = ko.observable(initialValue);
        }
        return this.capabilities[capabilityName];
    };
    return RexObservableCapabilityMap;
}());
var RexBaseActor = /** @class */ (function () {
    function RexBaseActor(id, name, displayName, capabilities) {
        this.canHaveRoles = false;
        this.id = ko.observable(id);
        this.name = ko.observable(name);
        this.displayName = ko.observable(displayName);
        this.capabilities = new RexObservableCapabilityMap(capabilities || {});
    }
    RexBaseActor.prototype.hasCap = function (capability) {
        return (this.capabilities.getCapabilityState(capability) === true);
    };
    RexBaseActor.prototype.getCapabilityState = function (capability) {
        return this.getOwnCapabilityState(capability);
    };
    RexBaseActor.prototype.getOwnCapabilityState = function (capability) {
        return this.capabilities.getCapabilityState(capability);
    };
    RexBaseActor.prototype.setCap = function (capability, enabled) {
        this.capabilities.setCapabilityState(capability, enabled);
    };
    RexBaseActor.prototype.deleteCap = function (capability) {
        this.capabilities.setCapabilityState(capability, null);
    };
    RexBaseActor.prototype.getDisplayName = function () {
        return this.displayName();
    };
    RexBaseActor.prototype.getId = function () {
        return this.id();
    };
    /**
     * Get capabilities that are explicitly assigned/denied to this actor.
     * Does not include capabilities that a user inherits from their role(s).
     */
    RexBaseActor.prototype.getOwnCapabilities = function () {
        return this.capabilities.getAllCapabilities();
    };
    return RexBaseActor;
}());
var RexRole = /** @class */ (function (_super) {
    __extends(RexRole, _super);
    function RexRole(name, displayName, capabilities) {
        var _this = _super.call(this, 'role:' + name, name, displayName, capabilities) || this;
        _this.hasUsers = false;
        return _this;
    }
    RexRole.fromRoleData = function (data) {
        var role = new RexRole(data.name, data.displayName, data.capabilities);
        role.hasUsers = data.hasUsers;
        return role;
    };
    /**
     * Is this one of the default roles that are part of WordPress core?
     *
     * Note: I'm calling this property "built-in" instead of "default" to distinguish it
     * from the default role for new users.
     */
    RexRole.prototype.isBuiltIn = function () {
        return RexRole.builtInRoleNames.indexOf(this.name()) >= 0;
    };
    RexRole.prototype.toJs = function () {
        return {
            name: this.name(),
            displayName: this.displayName(),
            capabilities: this.getOwnCapabilities()
        };
    };
    RexRole.builtInRoleNames = ['administrator', 'editor', 'author', 'subscriber', 'contributor'];
    return RexRole;
}(RexBaseActor));
var RexSuperAdmin = /** @class */ (function (_super) {
    __extends(RexSuperAdmin, _super);
    function RexSuperAdmin() {
        return _super.call(this, 'special:super_admin', 'Super Admin', 'Super Admin') || this;
    }
    RexSuperAdmin.getInstance = function () {
        if (RexSuperAdmin.instance === null) {
            RexSuperAdmin.instance = new RexSuperAdmin();
        }
        return RexSuperAdmin.instance;
    };
    RexSuperAdmin.instance = null;
    return RexSuperAdmin;
}(RexBaseActor));
var RexUser = /** @class */ (function (_super) {
    __extends(RexUser, _super);
    function RexUser(login, displayName, capabilities, userId) {
        var _this = _super.call(this, 'user:' + login, login, displayName, capabilities) || this;
        _this.isSuperAdmin = false;
        _this.userLogin = login;
        _this.canHaveRoles = true;
        _this.roles = ko.observableArray([]);
        _this.userId = userId;
        return _this;
    }
    RexUser.prototype.hasCap = function (capability, outGrantedBy) {
        return (this.getCapabilityState(capability, outGrantedBy) === true);
    };
    RexUser.prototype.getCapabilityState = function (capability, outGrantedBy) {
        if (capability === 'do_not_allow') {
            return false;
        }
        if (this.isSuperAdmin) {
            if (outGrantedBy) {
                outGrantedBy.push(RexSuperAdmin.getInstance());
            }
            return (capability !== 'do_not_allow');
        }
        var result = _super.prototype.getCapabilityState.call(this, capability);
        if (result !== null) {
            if (outGrantedBy) {
                outGrantedBy.push(this);
            }
            return result;
        }
        wsAmeLodash.each(this.roles(), function (role) {
            var roleHasCap = role.getCapabilityState(capability);
            if (roleHasCap !== null) {
                if (outGrantedBy) {
                    outGrantedBy.push(role);
                }
                result = roleHasCap;
            }
        });
        return result;
    };
    // noinspection JSUnusedGlobalSymbols Used in KO templates.
    RexUser.prototype.getInheritanceDetails = function (capability) {
        var _ = wsAmeLodash;
        var results = [];
        //Note: Alternative terms include "Assigned", "Granted", "Yes"/"No".
        if (this.isSuperAdmin) {
            var superAdmin = RexSuperAdmin.getInstance();
            var description_1 = 'Allow everything';
            if (capability.name === 'do_not_allow') {
                description_1 = 'Deny';
            }
            results.push({
                actor: superAdmin,
                name: superAdmin.displayName(),
                description: description_1
            });
        }
        _.each(this.roles(), function (role) {
            var roleHasCap = role.getCapabilityState(capability.name);
            var description;
            if (roleHasCap) {
                description = 'Allow';
            }
            else if (roleHasCap === null) {
                description = '—';
            }
            else {
                description = 'Deny';
            }
            results.push({
                actor: role,
                name: role.displayName(),
                description: description,
            });
        });
        var hasOwnCap = _super.prototype.getCapabilityState.call(this, capability.name);
        var description;
        if (hasOwnCap) {
            description = 'Allow';
        }
        else if (hasOwnCap === null) {
            description = '—';
        }
        else {
            description = 'Deny';
        }
        results.push({
            actor: this,
            name: 'User-specific setting',
            description: description,
        });
        var relevantActors = [];
        this.getCapabilityState(capability.name, relevantActors);
        var decidingActor = _.last(relevantActors);
        _.each(results, function (item) {
            item.isDecisive = (item.actor === decidingActor);
        });
        return results;
    };
    RexUser.fromAmeUser = function (data, editor) {
        var user = new RexUser(data.userLogin, data.displayName, data.capabilities, data.userId);
        wsAmeLodash.forEach(data.roles, function (roleId) {
            var role = editor.getRole(roleId);
            if (role) {
                user.roles.push(role);
            }
        });
        return user;
    };
    RexUser.fromAmeUserProperties = function (properties, editor) {
        var user = new RexUser(properties.user_login, properties.display_name, properties.capabilities);
        if (properties.id) {
            user.userId = properties.id;
        }
        wsAmeLodash.forEach(properties.roles, function (roleId) {
            var role = editor.getRole(roleId);
            if (role) {
                user.roles.push(role);
            }
        });
        return user;
    };
    RexUser.prototype.toJs = function () {
        var _ = wsAmeLodash;
        var roles = _.invoke(this.roles(), 'name');
        return {
            userId: this.userId,
            userLogin: this.userLogin,
            displayName: this.displayName(),
            capabilities: this.getOwnCapabilities(),
            roles: roles
        };
    };
    return RexUser;
}(RexBaseActor));
var RexCategory = /** @class */ (function () {
    function RexCategory(name, editor, slug, capabilities) {
        var _this = this;
        if (slug === void 0) { slug = null; }
        if (capabilities === void 0) { capabilities = []; }
        this.slug = null;
        this.origin = null;
        this.subtitle = null;
        this.htmlId = null;
        this.parent = null;
        this.subcategories = [];
        this.duplicates = [];
        var _ = wsAmeLodash;
        var self = this;
        this.editor = editor;
        this.name = name;
        this.slug = slug;
        if ((this.slug !== null) && (this.slug !== '')) {
            editor.categoriesBySlug[this.slug] = this;
        }
        var initialPermissions = _.map(capabilities, function (capabilityName) {
            return new RexPermission(editor, editor.getCapability(capabilityName));
        });
        this.permissions = ko.observableArray(initialPermissions);
        this.sortPermissions();
        this.contentTemplate = ko.observable('rex-default-category-content-template');
        this.isSelected = ko.observable(false);
        this.enabledCapabilityCount = ko.pureComputed({
            read: function () {
                return self.countUniqueCapabilities({}, function (capability) {
                    return capability.isEnabledForSelectedActor();
                });
            },
            deferEvaluation: true,
            owner: this
        });
        this.enabledCapabilityCount.extend({ rateLimit: { timeout: 5, method: "notifyWhenChangesStop" } });
        this.totalCapabilityCount = ko.pureComputed({
            read: function () {
                return self.countUniqueCapabilities();
            },
            deferEvaluation: true,
            owner: this
        });
        this.isCapCountVisible = ko.pureComputed({
            read: function () {
                if (!editor.showNumberOfCapsEnabled()) {
                    return false;
                }
                var totalCaps = self.totalCapabilityCount(), enabledCaps = self.enabledCapabilityCount();
                if (!editor.showZerosEnabled() && ((totalCaps === 0) || (enabledCaps === 0))) {
                    return false;
                }
                return editor.showTotalCapCountEnabled() || self.isEnabledCapCountVisible();
            },
            deferEvaluation: true,
            owner: this
        });
        this.isEnabledCapCountVisible = ko.pureComputed({
            read: function () {
                if (!editor.showGrantedCapCountEnabled()) {
                    return false;
                }
                return (self.enabledCapabilityCount() > 0) || editor.showZerosEnabled();
            },
            deferEvaluation: true,
            owner: this
        });
        this.areAllPermissionsEnabled = ko.computed({
            read: function () {
                var items = self.permissions();
                var len = items.length;
                for (var i = 0; i < len; i++) {
                    if (!items[i].capability.isEnabledForSelectedActor() && items[i].capability.isEditable()) {
                        return false;
                    }
                }
                for (var i = 0; i < self.subcategories.length; i++) {
                    if (!self.subcategories[i].areAllPermissionsEnabled()) {
                        return false;
                    }
                }
                return true;
            },
            write: function (enabled) {
                var items = self.permissions();
                for (var i = 0; i < items.length; i++) {
                    var item = items[i];
                    if (item.capability.isEditable()) {
                        item.capability.isEnabledForSelectedActor(enabled);
                    }
                }
                for (var i = 0; i < self.subcategories.length; i++) {
                    self.subcategories[i].areAllPermissionsEnabled(enabled);
                }
            },
            deferEvaluation: true,
            owner: this
        });
        this.areAllPermissionsEnabled.extend({ rateLimit: { timeout: 5, method: 'notifyWhenChangesStop' } });
        this.areAnyPermissionsEditable = ko.pureComputed({
            read: function () {
                var items = self.permissions();
                var len = items.length;
                for (var i = 0; i < len; i++) {
                    if (items[i].capability.isEditable()) {
                        return true;
                    }
                }
                for (var i = 0; i < self.subcategories.length; i++) {
                    if (!self.subcategories[i].areAnyPermissionsEditable()) {
                        return true;
                    }
                }
                return false;
            },
            deferEvaluation: true,
            owner: this
        });
        this.areAnyPermissionsEditable.extend({ rateLimit: { timeout: 5, method: 'notifyWhenChangesStop' } });
        this.isVisible = ko.computed({
            read: function () {
                var visible = false;
                var hasVisibleSubcategories = false;
                _.forEach(self.subcategories, function (category) {
                    if (category.isVisible()) {
                        hasVisibleSubcategories = true;
                        return false;
                    }
                });
                //Hide it if not inside the selected category.
                var isInSelectedCategory = false, temp = self;
                while (temp !== null) {
                    if (temp.isSelected()) {
                        isInSelectedCategory = true;
                        break;
                    }
                    temp = temp.parent;
                }
                //In single-category view, the category also counts as "selected"
                //if one of its duplicates is selected.
                if (!isInSelectedCategory
                    && (self.duplicates.length > 0)
                    && (editor.categoryViewMode() === RexRoleEditor.singleCategoryView)) {
                    for (var i = 0; i < self.duplicates.length; i++) {
                        temp = self.duplicates[i];
                        while (temp !== null) {
                            if (temp.isSelected()) {
                                isInSelectedCategory = true;
                                break;
                            }
                            temp = temp.parent;
                        }
                        if (isInSelectedCategory) {
                            break;
                        }
                    }
                }
                if (!isInSelectedCategory && !hasVisibleSubcategories) {
                    return false;
                }
                //Stay visible as long as at least one subcategory or permission is visible.
                visible = hasVisibleSubcategories;
                _.forEach(self.permissions(), function (permission) {
                    if (permission.isVisible()) {
                        visible = true;
                        return false;
                    }
                });
                return visible;
            },
            deferEvaluation: true,
            owner: this,
        });
        this.isVisible.extend({
            rateLimit: {
                timeout: 10,
                method: 'notifyWhenChangesStop'
            }
        });
        this.desiredColumnCount = ko.computed({
            read: function () {
                var visiblePermissions = 0;
                _.forEach(self.permissions(), function (permission) {
                    if (permission.isVisible()) {
                        visiblePermissions++;
                    }
                });
                var minItemsPerColumn = 12;
                if (editor.categoryWidthMode() === 'full') {
                    minItemsPerColumn = 3;
                }
                var desiredColumns = Math.max(Math.ceil(visiblePermissions / minItemsPerColumn), 1);
                //Avoid situations where the last column has only one item (an orphan).
                if ((desiredColumns >= 2) && (visiblePermissions % minItemsPerColumn === 1)) {
                    desiredColumns--;
                }
                if (desiredColumns > 3) {
                    return 'max';
                }
                return desiredColumns.toString(10);
            },
            deferEvaluation: true
        });
        this.nestingDepth = ko.pureComputed({
            read: function () {
                if (self.parent !== null) {
                    return self.parent.nestingDepth() + 1;
                }
                return 1;
            },
            deferEvaluation: true
        });
        this.isNavExpanded = ko.observable((this.slug !== null) ? !editor.userPreferences.collapsedCategories.peek(this.slug) : true);
        if (this.slug) {
            this.isNavExpanded.subscribe(function (newValue) {
                editor.userPreferences.collapsedCategories.toggle(_this.slug, !newValue);
            });
        }
        this.isNavVisible = ko.pureComputed({
            read: function () {
                if (self.parent === null) {
                    return true;
                }
                return self.parent.isNavVisible() && self.parent.isNavExpanded();
                //Idea: We could hide it if all of the capabilities it contains have been deleted.
            },
            deferEvaluation: true
        });
        this.cssClasses = ko.computed({
            read: function () {
                var classes = [];
                if (self.subcategories.length > 0) {
                    classes.push('rex-has-subcategories');
                }
                if (self.parent) {
                    if (self.parent === editor.rootCategory) {
                        classes.push('rex-top-category');
                    }
                    else {
                        classes.push('rex-sub-category');
                    }
                }
                if (self.permissions().length > 0) {
                    classes.push('rex-desired-columns-' + self.desiredColumnCount());
                }
                return classes.join(' ');
            },
            deferEvaluation: true
        });
        this.navCssClasses = ko.pureComputed({
            read: function () {
                var classes = [];
                if (self.isSelected()) {
                    classes.push('rex-selected-nav-item');
                }
                if (self.isNavExpanded()) {
                    classes.push('rex-nav-is-expanded');
                }
                if (self.subcategories.length > 0) {
                    classes.push('rex-nav-has-children');
                }
                classes.push('rex-nav-level-' + self.nestingDepth());
                return classes.join(' ');
            },
            deferEvaluation: true
        });
        this.subcategoryModificationFlag = ko.observable(this.subcategories.length);
        this.sortedSubcategories = ko.pureComputed({
            read: function () {
                //Refresh the sorted list when categories are added or removed.
                _this.subcategoryModificationFlag();
                return _this.getSortedSubcategories();
            },
            deferEvaluation: true
        });
        this.navSubcategories = ko.pureComputed({
            read: function () {
                _this.subcategoryModificationFlag();
                return _this.subcategories;
            },
            deferEvaluation: true
        });
        this.subheading = ko.pureComputed({
            read: function () {
                return _this.getSubheadingItems().join(', ');
            },
            deferEvaluation: true
        });
    }
    RexCategory.prototype.addSubcategory = function (category, afterName) {
        category.parent = this;
        if (afterName) {
            var index = wsAmeLodash.findIndex(this.subcategories, { 'name': afterName });
            if (index > -1) {
                this.subcategories.splice(index + 1, 0, category);
                this.subcategoryModificationFlag(this.subcategories.length);
                return;
            }
        }
        this.subcategories.push(category);
        this.subcategoryModificationFlag(this.subcategories.length);
    };
    // noinspection JSUnusedGlobalSymbols Used in KO templates.
    RexCategory.prototype.toggleSubcategories = function () {
        this.isNavExpanded(!this.isNavExpanded());
    };
    RexCategory.prototype.getSortedSubcategories = function () {
        //In most cases, the subcategory list is already sorted either alphabetically or in a predefined order
        //chosen for specific category. Subcategories can override this method to change the sort order.
        return this.subcategories;
    };
    /**
     * Sort the permissions in this category. Doesn't affect subcategories.
     * The default sort is alphabetical, but subclasses can override this method to specify a custom order.
     */
    RexCategory.prototype.sortPermissions = function () {
        this.permissions.sort(function (a, b) {
            return a.capability.name.toLowerCase().localeCompare(b.capability.name.toLowerCase());
        });
    };
    RexCategory.prototype.countUniqueCapabilities = function (accumulator, predicate) {
        if (accumulator === void 0) { accumulator = {}; }
        if (predicate === void 0) { predicate = null; }
        var total = 0;
        var permissions = this.permissions();
        for (var i = 0; i < permissions.length; i++) {
            var capability = permissions[i].capability;
            if (accumulator.hasOwnProperty(capability.name)) {
                continue;
            }
            if (predicate && !predicate(capability)) {
                continue;
            }
            if (capability.isDeleted()) {
                continue;
            }
            accumulator[capability.name] = true;
            total++;
        }
        for (var i = 0; i < this.subcategories.length; i++) {
            total = total + this.subcategories[i].countUniqueCapabilities(accumulator, predicate);
        }
        return total;
    };
    RexCategory.prototype.findCategoryBySlug = function (slug) {
        if (this.editor.categoriesBySlug.hasOwnProperty(slug)) {
            return this.editor.categoriesBySlug[slug];
        }
        return null;
    };
    RexCategory.fromJs = function (details, editor) {
        var category;
        if (details.variant && details.variant === 'post_type') {
            category = new RexPostTypeCategory(details.name, editor, details.contentTypeId, details.slug, details.permissions);
        }
        else if (details.variant && details.variant === 'taxonomy') {
            category = new RexTaxonomyCategory(details.name, editor, details.contentTypeId, details.slug, details.permissions);
        }
        else {
            category = new RexCategory(details.name, editor, details.slug, details.capabilities);
        }
        if (details.componentId) {
            category.origin = editor.getComponent(details.componentId);
        }
        if (details.subcategories) {
            wsAmeLodash.forEach(details.subcategories, function (childDetails) {
                var subcategory = RexCategory.fromJs(childDetails, editor);
                category.addSubcategory(subcategory);
            });
        }
        return category;
    };
    RexCategory.prototype.usesBaseCapabilities = function () {
        return false;
    };
    RexCategory.prototype.getDeDuplicationKey = function () {
        var _a;
        var key = (_a = this.slug) !== null && _a !== void 0 ? _a : this.name;
        if (this.parent) {
            key = this.parent.getDeDuplicationKey() + '>' + key;
        }
        return key;
    };
    RexCategory.prototype.addDuplicate = function (category) {
        if (this.duplicates.indexOf(category) === -1) {
            this.duplicates.push(category);
        }
    };
    RexCategory.prototype.getSubheadingItems = function () {
        var items = [];
        if (this.parent !== null) {
            items.push(this.parent.name);
        }
        if (this.duplicates.length > 0) {
            for (var i = 0; i < this.duplicates.length; i++) {
                var category = this.duplicates[i];
                if (category.parent) {
                    items.push(category.parent.name);
                }
            }
        }
        return items;
    };
    RexCategory.prototype.getAbsoluteName = function () {
        var components = [this.name];
        var parent = this.parent;
        while (parent !== null) {
            components.unshift(parent.name);
            parent = parent.parent;
        }
        return components.join(' > ');
    };
    RexCategory.defaultSubcategoryComparison = function (a, b) {
        return a.name.toLowerCase().localeCompare(b.name.toLowerCase());
    };
    return RexCategory;
}());
var RexContentTypeCategory = /** @class */ (function (_super) {
    __extends(RexContentTypeCategory, _super);
    function RexContentTypeCategory(name, editor, slug) {
        if (slug === void 0) { slug = null; }
        var _this = _super.call(this, name, editor, slug) || this;
        _this.actions = {};
        _this.baseCategorySlug = null;
        _this.isBaseCapNoticeVisible = ko.pureComputed({
            read: function () {
                if (editor.showBaseCapsEnabled()) {
                    return false;
                }
                return _this.usesBaseCapabilities();
            },
            deferEvaluation: true
        });
        return _this;
    }
    /**
     * Check if the post type or taxonomy represented by this category uses the same capabilities
     * as the built-in "post" type or the "category" taxonomy.
     */
    RexContentTypeCategory.prototype.usesBaseCapabilities = function () {
        var baseCategory = this.getBaseCategory();
        if (baseCategory === null || this === baseCategory) {
            return false;
        }
        var allCapsMatch = true;
        wsAmeLodash.forEach(this.actions, function (item) {
            var isMatch = item.action
                && baseCategory.actions.hasOwnProperty(item.action)
                && (item.capability === baseCategory.actions[item.action].capability);
            if (!isMatch) {
                allCapsMatch = false;
                return false;
            }
        });
        return allCapsMatch;
    };
    RexContentTypeCategory.prototype.getBaseCategory = function () {
        if (this.baseCategorySlug !== null) {
            var result = this.findCategoryBySlug(this.baseCategorySlug);
            if (result instanceof RexContentTypeCategory) {
                return result;
            }
        }
        return null;
    };
    return RexContentTypeCategory;
}(RexCategory));
var RexPostTypePermission = /** @class */ (function (_super) {
    __extends(RexPostTypePermission, _super);
    function RexPostTypePermission(editor, capability, action, pluralNoun) {
        if (pluralNoun === void 0) { pluralNoun = ''; }
        var _this = _super.call(this, editor, capability) || this;
        _this.action = action;
        _this.readableAction = wsAmeLodash.capitalize(_this.action.replace('_posts', '').replace('_', ' '));
        if (RexPostTypePermission.actionDescriptions.hasOwnProperty(action) && pluralNoun) {
            _this.mainDescription = RexPostTypePermission.actionDescriptions[action].replace('%s', pluralNoun);
        }
        return _this;
    }
    RexPostTypePermission.actionDescriptions = {
        'edit_and_create': 'Edit and create %s',
        'edit_posts': 'Edit %s',
        'create_posts': 'Create new %s',
        'edit_published_posts': 'Edit published %s',
        'edit_others_posts': 'Edit %s created by others',
        'edit_private_posts': 'Edit private %s created by others',
        'publish_posts': 'Publish %s',
        'read_private_posts': 'Read private %s',
        'delete_posts': 'Delete %s',
        'delete_published_posts': 'Delete published %s',
        'delete_others_posts': 'Delete %s created by others',
        'delete_private_posts': 'Delete private %s created by others',
    };
    return RexPostTypePermission;
}(RexPermission));
var RexPostTypeCategory = /** @class */ (function (_super) {
    __extends(RexPostTypeCategory, _super);
    function RexPostTypeCategory(name, editor, postTypeId, slug, permissions, isDefault) {
        if (slug === void 0) { slug = null; }
        if (isDefault === void 0) { isDefault = false; }
        var _this = _super.call(this, name, editor, slug) || this;
        _this.pluralLabel = '';
        _this.actions = {};
        var _ = wsAmeLodash;
        _this.baseCategorySlug = 'postTypes/post';
        _this.postType = postTypeId;
        _this.isDefault = isDefault;
        _this.subtitle = _this.postType;
        if (editor.postTypes[postTypeId].pluralLabel) {
            _this.pluralLabel = editor.postTypes[postTypeId].pluralLabel;
        }
        else {
            _this.pluralLabel = name.toLowerCase();
        }
        _this.permissions = ko.observableArray(_.map(permissions, function (capability, action) {
            var permission = new RexPostTypePermission(editor, editor.getCapability(capability), action, _this.pluralLabel);
            //The "read" capability is already shown in the core category and every role has it by default.
            if (capability === 'read') {
                permission.isRedundant = true;
            }
            _this.actions[action] = permission;
            return permission;
        }));
        _this.sortPermissions();
        //The "create" capability is often the same as the "edit" capability.
        var editPerm = _.get(_this.actions, 'edit_posts', null), createPerm = _.get(_this.actions, 'create_posts', null);
        if (editPerm && createPerm && (createPerm.capability.name === editPerm.capability.name)) {
            createPerm.isRedundant = true;
        }
        return _this;
    }
    RexPostTypeCategory.prototype.getDeDuplicationKey = function () {
        return 'postType:' + this.postType;
    };
    RexPostTypeCategory.prototype.sortPermissions = function () {
        this.permissions.sort(function (a, b) {
            var priorityA = RexPostTypeCategory.desiredActionOrder.hasOwnProperty(a.action) ? RexPostTypeCategory.desiredActionOrder[a.action] : 1000;
            var priorityB = RexPostTypeCategory.desiredActionOrder.hasOwnProperty(b.action) ? RexPostTypeCategory.desiredActionOrder[b.action] : 1000;
            var delta = priorityA - priorityB;
            if (delta !== 0) {
                return delta;
            }
            return a.capability.name.localeCompare(b.capability.name);
        });
    };
    RexPostTypeCategory.prototype.getSubheadingItems = function () {
        var items = _super.prototype.getSubheadingItems.call(this);
        items.push(this.postType);
        return items;
    };
    RexPostTypeCategory.desiredActionOrder = {
        'edit_posts': 1,
        'edit_others_posts': 2,
        'edit_published_posts': 3,
        'edit_private_posts': 4,
        'publish_posts': 5,
        'delete_posts': 6,
        'delete_others_posts': 7,
        'delete_published_posts': 8,
        'delete_private_posts': 9,
        'read_private_posts': 10,
        'create_posts': 11,
    };
    return RexPostTypeCategory;
}(RexContentTypeCategory));
var RexTaxonomyPermission = /** @class */ (function (_super) {
    __extends(RexTaxonomyPermission, _super);
    function RexTaxonomyPermission(editor, capability, action, pluralNoun) {
        if (pluralNoun === void 0) { pluralNoun = ''; }
        var _this = _super.call(this, editor, capability) || this;
        _this.action = action;
        _this.readableAction = wsAmeLodash.capitalize(_this.action.replace('_terms', '').replace('_', ' '));
        if (RexTaxonomyPermission.actionDescriptions.hasOwnProperty(action) && pluralNoun) {
            _this.mainDescription = RexTaxonomyPermission.actionDescriptions[action].replace('%s', pluralNoun);
        }
        return _this;
    }
    RexTaxonomyPermission.actionDescriptions = {
        'manage_terms': 'Manage %s',
        'edit_terms': 'Edit %s',
        'delete_terms': 'Delete %s',
        'assign_terms': 'Assign %s',
    };
    return RexTaxonomyPermission;
}(RexPermission));
var RexTaxonomyCategory = /** @class */ (function (_super) {
    __extends(RexTaxonomyCategory, _super);
    function RexTaxonomyCategory(name, editor, taxonomyId, slug, permissions) {
        if (slug === void 0) { slug = null; }
        var _this = _super.call(this, name, editor, slug) || this;
        _this.actions = {};
        var _ = wsAmeLodash;
        _this.baseCategorySlug = 'taxonomies/category';
        _this.taxonomy = taxonomyId;
        _this.subtitle = taxonomyId;
        var noun = name.toLowerCase();
        _this.permissions = ko.observableArray(_.map(permissions, function (capability, action) {
            var permission = new RexTaxonomyPermission(editor, editor.getCapability(capability), action, noun);
            _this.actions[action] = permission;
            return permission;
        }));
        _this.sortPermissions();
        //Permissions that use the same capability as the "manage_terms" permission are redundant.
        if (_this.actions.manage_terms) {
            var manageCap = _this.actions.manage_terms.capability.name;
            for (var action in _this.actions) {
                if (!_this.actions.hasOwnProperty(action)) {
                    continue;
                }
                if ((action !== 'manage_terms') && (_this.actions[action].capability.name === manageCap)) {
                    _this.actions[action].isRedundant = true;
                }
            }
        }
        return _this;
    }
    RexTaxonomyCategory.prototype.getDeDuplicationKey = function () {
        return 'taxonomy:' + this.taxonomy;
    };
    RexTaxonomyCategory.prototype.sortPermissions = function () {
        this.permissions.sort(function (a, b) {
            var priorityA = RexTaxonomyCategory.desiredActionOrder.hasOwnProperty(a.action) ? RexTaxonomyCategory.desiredActionOrder[a.action] : 1000;
            var priorityB = RexTaxonomyCategory.desiredActionOrder.hasOwnProperty(b.action) ? RexTaxonomyCategory.desiredActionOrder[b.action] : 1000;
            var delta = priorityA - priorityB;
            if (delta !== 0) {
                return delta;
            }
            return a.capability.name.localeCompare(b.capability.name);
        });
    };
    RexTaxonomyCategory.prototype.getSubheadingItems = function () {
        var items = _super.prototype.getSubheadingItems.call(this);
        items.push(this.taxonomy);
        return items;
    };
    RexTaxonomyCategory.desiredActionOrder = {
        'manage_terms': 1,
        'edit_terms': 2,
        'delete_terms': 3,
        'assign_terms': 4,
    };
    return RexTaxonomyCategory;
}(RexContentTypeCategory));
var RexTableViewCategory = /** @class */ (function (_super) {
    __extends(RexTableViewCategory, _super);
    function RexTableViewCategory(name, editor, slug) {
        if (slug === void 0) { slug = null; }
        var _this = _super.call(this, name, editor, slug) || this;
        _this.subcategoryComparisonCallback = null;
        _this.contentTemplate = ko.pureComputed(function () {
            if (editor.categoryViewMode() === RexRoleEditor.hierarchyView) {
                return 'rex-permission-table-template';
            }
            return 'rex-default-category-content-template';
        });
        _this.subcategoryComparisonCallback = RexCategory.defaultSubcategoryComparison;
        return _this;
    }
    RexTableViewCategory.prototype.getSortedSubcategories = function () {
        var _this = this;
        if (this.editor.showBaseCapsEnabled()) {
            return _super.prototype.getSortedSubcategories.call(this);
        }
        var cats = wsAmeLodash.clone(this.subcategories);
        return cats.sort(function (a, b) {
            //Special case: Put categories that use base capabilities at the end.
            var aEqualsBase = a.usesBaseCapabilities();
            var bEqualsBase = b.usesBaseCapabilities();
            if (aEqualsBase && !bEqualsBase) {
                return 1;
            }
            else if (!aEqualsBase && bEqualsBase) {
                return -1;
            }
            //Otherwise just sort in the default order.
            return _this.subcategoryComparisonCallback(a, b);
        });
    };
    /**
     * Sort the underlying category array.
     */
    RexTableViewCategory.prototype.sortSubcategories = function () {
        this.subcategories.sort(this.subcategoryComparisonCallback);
    };
    return RexTableViewCategory;
}(RexCategory));
var RexTaxonomyContainerCategory = /** @class */ (function (_super) {
    __extends(RexTaxonomyContainerCategory, _super);
    function RexTaxonomyContainerCategory(name, editor, slug) {
        if (slug === void 0) { slug = null; }
        var _this = _super.call(this, name, editor, slug) || this;
        _this.htmlId = 'rex-taxonomy-summary-category';
        _this.tableColumns = ko.pureComputed({
            read: function () {
                var _ = wsAmeLodash;
                var defaultTaxonomyActions = ['manage_terms', 'assign_terms', 'edit_terms', 'delete_terms'];
                var columns = [
                    {
                        title: 'Manage',
                        actions: ['manage_terms']
                    },
                    {
                        title: 'Assign',
                        actions: ['assign_terms']
                    },
                    {
                        title: 'Edit',
                        actions: ['edit_terms']
                    },
                    {
                        title: 'Delete',
                        actions: ['delete_terms']
                    }
                ];
                var misColumnExists = false, miscColumn = null;
                for (var i = 0; i < _this.subcategories.length; i++) {
                    var category = _this.subcategories[i];
                    if (!(category instanceof RexTaxonomyCategory)) {
                        continue;
                    }
                    //Display any unrecognized actions in a "Misc" column.
                    var customActions = _.omit(category.actions, defaultTaxonomyActions);
                    if (!_.isEmpty(customActions)) {
                        if (!misColumnExists) {
                            miscColumn = { title: 'Misc', actions: [] };
                            columns.push(miscColumn);
                        }
                        miscColumn.actions = _.union(miscColumn.actions, _.keys(customActions));
                    }
                }
                return columns;
            },
            deferEvaluation: true,
        });
        return _this;
    }
    return RexTaxonomyContainerCategory;
}(RexTableViewCategory));
var RexPostTypeContainerCategory = /** @class */ (function (_super) {
    __extends(RexPostTypeContainerCategory, _super);
    function RexPostTypeContainerCategory(name, editor, slug) {
        if (slug === void 0) { slug = null; }
        var _this = _super.call(this, name, editor, slug) || this;
        /* Note: This seems like poor design because the superclass overrides subclass
         * behaviour (subcategory comparison) in some situations. Unfortunately, I haven't
         * come up with anything better so far. Might be something to revisit later.
         */
        _this.subcategoryComparisonCallback = function (a, b) {
            //Special case: Put "Posts" at the top.
            if (a.postType === 'post') {
                return -1;
            }
            else if (b.postType === 'post') {
                return 1;
            }
            //Put other built-in post types above custom post types.
            if (a.isDefault && !b.isDefault) {
                return -1;
            }
            else if (b.isDefault && !a.isDefault) {
                return 1;
            }
            var labelA = a.name.toLowerCase(), labelB = b.name.toLowerCase();
            return labelA.localeCompare(labelB);
        };
        _this.tableColumns = ko.pureComputed({
            read: function () {
                var _ = wsAmeLodash;
                var defaultPostTypeActions = _.keys(RexPostTypePermission.actionDescriptions);
                var columns = [
                    {
                        title: 'Own items',
                        actions: ['create_posts', 'edit_posts', 'delete_posts', 'publish_posts', 'edit_published_posts', 'delete_published_posts']
                    },
                    {
                        title: 'Other\'s items',
                        actions: ['edit_others_posts', 'delete_others_posts', 'edit_private_posts', 'delete_private_posts', 'read_private_posts']
                    }
                ];
                var metaColumn = {
                    title: 'Meta',
                    actions: ['edit_post', 'delete_post', 'read_post']
                };
                columns.push(metaColumn);
                for (var i = 0; i < _this.subcategories.length; i++) {
                    var category = _this.subcategories[i];
                    if (!(category instanceof RexPostTypeCategory)) {
                        continue;
                    }
                    //Display any unrecognized actions in a "Misc" column.
                    var customActions = _.omit(category.actions, defaultPostTypeActions);
                    if (!_.isEmpty(customActions)) {
                        metaColumn.actions = _.union(metaColumn.actions, _.keys(customActions));
                    }
                }
                return columns;
            },
            deferEvaluation: true,
        });
        return _this;
    }
    return RexPostTypeContainerCategory;
}(RexTableViewCategory));
var RexCapability = /** @class */ (function () {
    function RexCapability(name, editor) {
        var _this = this;
        this.originComponent = null;
        this.usedByComponents = [];
        this.menuItems = [];
        this.usedByPostTypeActions = {};
        this.usedByTaxonomyActions = {};
        this.predefinedPermissions = [];
        this.documentationUrl = null;
        this.notes = null;
        this.name = String(name);
        this.editor = editor;
        var self = this;
        this.readableName = wsAmeLodash.capitalize(this.name.replace(/[_\-\s]+/g, ' '));
        this.displayName = ko.pureComputed({
            read: function () {
                return editor.readableNamesEnabled() ? self.readableName : self.name;
            },
            deferEvaluation: true,
            owner: this
        });
        this.isDeleted = ko.observable(false);
        this.responsibleActors = ko.computed({
            read: function () {
                var actor = editor.selectedActor(), list = [];
                if (actor instanceof RexUser) {
                    actor.hasCap(self.name, list);
                }
                return list;
            },
            owner: this,
            deferEvaluation: true
        });
        this.isInherited = ko.computed({
            read: function () {
                var actor = editor.selectedActor();
                if (!actor.canHaveRoles) {
                    return false;
                }
                var responsibleActors = self.responsibleActors();
                return responsibleActors
                    && (responsibleActors.length > 0)
                    && (wsAmeLodash.indexOf(responsibleActors, actor) < (responsibleActors.length - 1));
            },
            owner: this,
            deferEvaluation: true
        });
        this.isPersonalOverride = ko.pureComputed({
            read: function () {
                //This flag applies only to actors that can inherit permissions.
                var actor = editor.selectedActor();
                if (!actor.canHaveRoles) {
                    return false;
                }
                return !self.isInherited();
            },
            owner: this,
            deferEvaluation: true
        });
        this.isEditable = ko.pureComputed({
            read: function () {
                if (self.isInherited() && !editor.inheritanceOverrideEnabled()) {
                    return false;
                }
                return !self.isDeleted();
            },
            deferEvaluation: true
        });
        this.isEnabledForSelectedActor = ko.computed({
            read: function () {
                return editor.selectedActor().hasCap(self.name);
            },
            write: function (newState) {
                var actor = editor.selectedActor();
                if (editor.isShiftKeyDown()) {
                    //Hold the shift key while clicking to cycle the capability between 3 states:
                    //Granted -> Denied -> Not granted.
                    var oldState = actor.getOwnCapabilityState(self.name);
                    if (newState) {
                        if (oldState === false) {
                            actor.deleteCap(self.name); //Denied -> Not granted.
                        }
                        else if (oldState === null) {
                            actor.setCap(self.name, true); //Not granted -> Granted.
                        }
                    }
                    else {
                        if (oldState === true) {
                            actor.setCap(self.name, false); //Granted -> Denied.
                        }
                        else if (oldState === null) {
                            actor.setCap(self.name, true); //Not granted (inherited = Granted) -> Granted.
                        }
                    }
                    //Update the checkbox state.
                    if (actor.hasCap(self.name) !== newState) {
                        self.isEnabledForSelectedActor.notifySubscribers();
                    }
                    return;
                }
                if (newState) {
                    //TODO: If it's a user and the cap is explicitly negated, consider removing that state.
                    actor.setCap(self.name, newState);
                }
                else {
                    //The default is to remove the capability instead of explicitly setting it to false.
                    actor.deleteCap(self.name);
                    //If we're removing a capability from a user but one of their roles also has it,
                    //we have to set it to false after all or it will stay enabled.
                    if (actor.canHaveRoles && actor.hasCap(self.name)) {
                        actor.setCap(self.name, newState);
                    }
                }
            },
            owner: this,
            deferEvaluation: true
        });
        //this.isEnabledForSelectedActor.extend({rateLimit: {timeout: 10, method: "notifyWhenChangesStop"}});
        this.isExplicitlyDenied = ko.pureComputed({
            read: function () {
                var actor = editor.selectedActor();
                if (actor) {
                    return (actor.getCapabilityState(self.name) === false);
                }
                return false;
            },
            deferEvaluation: true
        });
        this.grantedPermissions = ko.computed({
            read: function () {
                var _ = wsAmeLodash;
                var results = [];
                if (_this.predefinedPermissions.length > 0) {
                    results = _this.predefinedPermissions.slice();
                }
                function localeAwareCompare(a, b) {
                    return a.localeCompare(b);
                }
                function actionsToPermissions(actionGroups, labelMap, descriptions) {
                    return _.map(actionGroups, function (ids, action) {
                        var labels = _.map(ids, function (id) { return labelMap[id].pluralLabel; })
                            .sort(localeAwareCompare);
                        var template = descriptions[action];
                        if (!template) {
                            template = action + ': %s';
                        }
                        return template.replace('%s', RexCapability.formatNounList(labels));
                    }).sort(localeAwareCompare);
                }
                //Post permissions.
                var postActionGroups = _.transform(_this.usedByPostTypeActions, function (accumulator, actions, postType) {
                    var actionKeys = _.keys(actions);
                    //Combine "edit" and "create" permissions because they usually use the same capability.
                    var editEqualsCreate = actions.hasOwnProperty('edit_posts') && actions.hasOwnProperty('create_posts');
                    if (editEqualsCreate) {
                        actionKeys = _.without(actionKeys, 'edit_posts', 'create_posts');
                        actionKeys.unshift('edit_and_create');
                    }
                    _.forEach(actionKeys, function (action) {
                        if (!accumulator.hasOwnProperty(action)) {
                            accumulator[action] = [];
                        }
                        accumulator[action].push(postType);
                    });
                }, {});
                var postPermissions = actionsToPermissions(postActionGroups, _this.editor.postTypes, RexPostTypePermission.actionDescriptions);
                Array.prototype.push.apply(results, postPermissions);
                //Taxonomy permissions.
                var taxonomyActionGroups = _.transform(_this.usedByTaxonomyActions, function (accumulator, actions, taxonomy) {
                    var actionKeys = _.keys(actions);
                    //Most taxonomies use the same capability for manage_terms, edit_terms, and delete_terms.
                    //In those cases, let's show only manage_terms.
                    if (actions.hasOwnProperty('manage_terms')) {
                        actionKeys = _.without(actionKeys, 'edit_terms', 'delete_terms');
                    }
                    _.forEach(actionKeys, function (action) {
                        if (!accumulator.hasOwnProperty(action)) {
                            accumulator[action] = [];
                        }
                        accumulator[action].push(taxonomy);
                    });
                }, {});
                var taxonomyPermissions = actionsToPermissions(taxonomyActionGroups, _this.editor.taxonomies, RexTaxonomyPermission.actionDescriptions);
                Array.prototype.push.apply(results, taxonomyPermissions);
                Array.prototype.push.apply(results, _this.menuItems);
                return results;
            },
            deferEvaluation: true,
            owner: this,
        });
    }
    // noinspection JSUnusedGlobalSymbols Used in KO templates.
    RexCapability.prototype.getDocumentationUrl = function () {
        if (this.documentationUrl) {
            return this.documentationUrl;
        }
        if (this.originComponent && this.originComponent.capabilityDocumentationUrl) {
            this.documentationUrl = this.originComponent.capabilityDocumentationUrl;
            return this.documentationUrl;
        }
        return null;
    };
    RexCapability.fromJs = function (name, data, editor) {
        var capability = new RexCapability(name, editor);
        capability.menuItems = data.menuItems.sort(function (a, b) {
            return a.localeCompare(b);
        });
        if (data.componentId) {
            capability.originComponent = editor.getComponent(data.componentId);
        }
        if (data.usedByComponents) {
            for (var id in data.usedByComponents) {
                var component = editor.getComponent(id);
                if (component) {
                    capability.usedByComponents.push(component);
                }
            }
        }
        if (data.documentationUrl) {
            capability.documentationUrl = data.documentationUrl;
        }
        if (data.permissions && (data.permissions.length > 0)) {
            capability.predefinedPermissions = data.permissions;
        }
        if ((capability.originComponent === editor.coreComponent) && (capability.documentationUrl === null)) {
            capability.documentationUrl = 'https://wordpress.org/support/article/roles-and-capabilities/#'
                + encodeURIComponent(capability.name);
        }
        if (data.readableName) {
            capability.readableName = data.readableName;
        }
        return capability;
    };
    RexCapability.formatNounList = function (items) {
        if (items.length <= 2) {
            return items.join(' and ');
        }
        return items.slice(0, -1).join(', ') + ', and ' + items[items.length - 1];
    };
    return RexCapability;
}());
var RexDoNotAllowCapability = /** @class */ (function (_super) {
    __extends(RexDoNotAllowCapability, _super);
    function RexDoNotAllowCapability(editor) {
        var _this = _super.call(this, 'do_not_allow', editor) || this;
        _this.notes = '"do_not_allow" is a special capability. '
            + 'WordPress uses it internally to indicate that access is denied. '
            + 'Normally, it should not be assigned to any roles or users.';
        //Normally, it's impossible to grant this capability to anyone. Doing so would break things.
        //However, if it's already granted, you can remove it.
        _this.isEditable = ko.computed(function () {
            return _this.isEnabledForSelectedActor();
        });
        return _this;
    }
    return RexDoNotAllowCapability;
}(RexCapability));
var RexExistCapability = /** @class */ (function (_super) {
    __extends(RexExistCapability, _super);
    function RexExistCapability(editor) {
        var _this = _super.call(this, 'exist', editor) || this;
        _this.notes = '"exist" is a special capability. '
            + 'WordPress uses it internally to indicate that a role or user exists. '
            + 'Normally, everyone has this capability by default, and it is not necessary '
            + '(or possible) to assign it directly.';
        //Everyone must have this capability. However, if it has somehow become disabled,
        //we'll let the user enable it.
        _this.isEditable = ko.computed(function () {
            return !_this.isEnabledForSelectedActor();
        });
        return _this;
    }
    return RexExistCapability;
}(RexCapability));
var RexInvalidCapability = /** @class */ (function (_super) {
    __extends(RexInvalidCapability, _super);
    function RexInvalidCapability(fakeName, value, editor) {
        var _this = _super.call(this, fakeName, editor) || this;
        var startsWithVowel = /^[aeiou]/i;
        var theType = (typeof value);
        var nounPhrase = (startsWithVowel.test(theType) ? 'an' : 'a') + ' ' + theType;
        _this.notes = 'This is not a valid capability. A capability name must be a string (i.e. text),'
            + ' but this is ' + nounPhrase + '. It was probably created by a bug in another plugin or theme.';
        _this.isEditable = ko.computed(function () {
            return false;
        });
        return _this;
    }
    return RexInvalidCapability;
}(RexCapability));
var RexUserPreferences = /** @class */ (function () {
    function RexUserPreferences(initialPreferences, ajaxUrl, updateNonce) {
        var _this = this;
        var _ = wsAmeLodash;
        initialPreferences = initialPreferences || {};
        if (_.isArray(initialPreferences)) {
            initialPreferences = {};
        }
        this.preferenceObservables = _.mapValues(initialPreferences, ko.observable, ko);
        this.preferenceCount = ko.observable(_.size(this.preferenceObservables));
        this.collapsedCategories = new RexCollapsedCategorySet(_.get(initialPreferences, 'collapsedCategories', []));
        this.plainPreferences = ko.computed(function () {
            //By creating a dependency on the number of preferences, we ensure that the observable will be re-evaluated
            //whenever a preference is added or removed.
            _this.preferenceCount();
            //This converts preferences to a plain JS object and establishes dependencies on all individual observables.
            var result = _.mapValues(_this.preferenceObservables, function (observable) {
                return observable();
            });
            result.collapsedCategories = _this.collapsedCategories.toJs();
            return result;
        });
        //Avoid excessive AJAX requests.
        this.plainPreferences.extend({ rateLimit: { timeout: 5000, method: "notifyWhenChangesStop" } });
        //Save preferences when they change.
        if (ajaxUrl && updateNonce) {
            this.plainPreferences.subscribe(function (preferences) {
                //console.info('Saving user preferences', preferences);
                jQuery.post(ajaxUrl, {
                    action: 'ws_ame_rex_update_user_preferences',
                    _ajax_nonce: updateNonce,
                    preferences: ko.toJSON(preferences)
                });
            });
        }
    }
    RexUserPreferences.prototype.getObservable = function (name, defaultValue) {
        if (defaultValue === void 0) { defaultValue = null; }
        if (this.preferenceObservables.hasOwnProperty(name)) {
            return this.preferenceObservables[name];
        }
        var newPreference = ko.observable(defaultValue || null);
        this.preferenceObservables[name] = newPreference;
        this.preferenceCount(this.preferenceCount() + 1);
        return newPreference;
    };
    return RexUserPreferences;
}());
/**
 * An observable collection of unique strings. In this case, they're category slugs.
 */
var RexCollapsedCategorySet = /** @class */ (function () {
    function RexCollapsedCategorySet(items) {
        if (items === void 0) { items = []; }
        this.isItemInSet = {};
        items = wsAmeLodash.uniq(items);
        for (var i = 0; i < items.length; i++) {
            this.isItemInSet[items[i]] = ko.observable(true);
        }
        this.items = ko.observableArray(items);
    }
    RexCollapsedCategorySet.prototype.getItemObservable = function (item) {
        if (!this.isItemInSet.hasOwnProperty(item)) {
            this.isItemInSet[item] = ko.observable(false);
        }
        return this.isItemInSet[item];
    };
    RexCollapsedCategorySet.prototype.add = function (item) {
        if (!this.contains(item)) {
            this.getItemObservable(item)(true);
            this.items.push(item);
        }
    };
    RexCollapsedCategorySet.prototype.remove = function (item) {
        if (this.contains(item)) {
            this.isItemInSet[item](false);
            this.items.remove(item);
        }
    };
    RexCollapsedCategorySet.prototype.toggle = function (item, addToSet) {
        if (addToSet) {
            this.add(item);
        }
        else {
            this.remove(item);
        }
    };
    RexCollapsedCategorySet.prototype.contains = function (item) {
        return this.getItemObservable(item)();
    };
    RexCollapsedCategorySet.prototype.peek = function (item) {
        if (!this.isItemInSet.hasOwnProperty(item)) {
            return false;
        }
        return this.isItemInSet[item].peek();
    };
    RexCollapsedCategorySet.prototype.toJs = function () {
        return this.items();
    };
    return RexCollapsedCategorySet;
}());
var RexBaseDialog = /** @class */ (function () {
    function RexBaseDialog() {
        var _this = this;
        this.isOpen = ko.observable(false);
        this.isRendered = ko.observable(false);
        this.title = null;
        this.options = {
            buttons: []
        };
        this.isOpen.subscribe(function (isOpenNow) {
            if (isOpenNow && !_this.isRendered()) {
                _this.isRendered(true);
            }
        });
    }
    RexBaseDialog.prototype.setupValidationTooltip = function (inputSelector, message) {
        //Display validation messages next to the input field.
        var element = this.jQueryWidget.find(inputSelector).qtip({
            overwrite: false,
            content: '(Validation errors will appear here.)',
            //Show the tooltip when the input is focused.
            show: {
                event: '',
                ready: false,
                effect: false
            },
            hide: {
                event: '',
                effect: false
            },
            position: {
                my: 'center left',
                at: 'center right',
                effect: false
            },
            style: {
                classes: 'qtip-bootstrap qtip-shadow rex-tooltip'
            }
        });
        message.subscribe(function (newMessage) {
            if (newMessage == '') {
                element.qtip('option', 'content.text', 'OK');
                element.qtip('option', 'show.event', '');
                element.qtip('hide');
            }
            else {
                element.qtip('option', 'content.text', newMessage);
                element.qtip('option', 'show.event', 'focus');
                element.qtip('show');
            }
        });
        //Hide the tooltip when the dialog is closed and prevent it from automatically re-appearing.
        this.isOpen.subscribe(function (isDialogOpen) {
            if (!isDialogOpen) {
                element.qtip('option', 'show.event', '');
                element.qtip('hide');
            }
        });
    };
    ;
    return RexBaseDialog;
}());
var RexDeleteCapDialog = /** @class */ (function (_super) {
    __extends(RexDeleteCapDialog, _super);
    function RexDeleteCapDialog(editor) {
        var _this = _super.call(this) || this;
        _this.options = {
            buttons: [],
            minWidth: 380
        };
        _this.wasEverOpen = ko.observable(false);
        var _ = wsAmeLodash;
        _this.options.buttons.push({
            text: 'Delete Capability',
            'class': 'button button-primary rex-delete-selected-caps',
            click: function () {
                var selectedCapabilities = _.chain(_this.deletableItems())
                    .filter(function (item) {
                    return item.isSelected();
                })
                    .pluck('capability')
                    .value();
                //Note: We could remove confirmation if we get an "Undo" feature.
                var noun = (selectedCapabilities.length === 1) ? 'capability' : 'capabilities';
                var warning = 'Caution: Deleting capabilities could break plugins that use those capabilities. '
                    + 'Delete ' + selectedCapabilities.length + ' ' + noun + '?';
                if (!confirm(warning)) {
                    return;
                }
                _this.isOpen(false);
                editor.deleteCapabilities(selectedCapabilities);
                alert(selectedCapabilities.length + ' capabilities deleted');
            },
            disabled: true
        });
        _this.isOpen.subscribe(function (open) {
            if (open && !_this.wasEverOpen()) {
                _this.wasEverOpen(true);
            }
        });
        _this.deletableItems = ko.pureComputed({
            read: function () {
                var wpCore = editor.getComponent(':wordpress:');
                return _.chain(editor.capabilities)
                    .filter(function (capability) {
                    if (capability.originComponent === wpCore) {
                        return false;
                    }
                    return !capability.isDeleted();
                })
                    //Pre-populate part of the list when the dialog is closed to ensure it has a non-zero height.
                    .take(_this.wasEverOpen() ? 1000000 : 30)
                    .sortBy(function (capability) {
                    return capability.name.toLowerCase();
                })
                    .map(function (capability) {
                    return {
                        'capability': capability,
                        'isSelected': ko.observable(false)
                    };
                })
                    .value();
            },
            deferEvaluation: true
        });
        _this.selectedItemCount = ko.pureComputed({
            read: function () { return _.filter(_this.deletableItems(), function (item) {
                return item.isSelected();
            }).length; },
            deferEvaluation: true
        });
        var deleteButtonText = ko.pureComputed({
            read: function () {
                var count = _this.selectedItemCount();
                if (count <= 0) {
                    return 'Delete Capability';
                }
                else {
                    if (count === 1) {
                        return 'Delete 1 Capability';
                    }
                    else {
                        return ('Delete ' + count + ' Capabilities');
                    }
                }
            },
            deferEvaluation: true
        });
        deleteButtonText.subscribe(function (newText) {
            _this.jQueryWidget
                .closest('.ui-dialog')
                .find('.ui-dialog-buttonset .button-primary .ui-button-text')
                .text(newText);
        });
        _this.isDeleteButtonEnabled = ko.pureComputed({
            read: function () {
                return _this.selectedItemCount() > 0;
            },
            deferEvaluation: true
        });
        return _this;
    }
    RexDeleteCapDialog.prototype.onOpen = function () {
        //Deselect all items when the dialog is opened.
        var items = this.deletableItems();
        for (var i = 0; i < items.length; i++) {
            if (items[i].isSelected()) {
                items[i].isSelected(false);
            }
        }
    };
    return RexDeleteCapDialog;
}(RexBaseDialog));
var RexAddCapabilityDialog = /** @class */ (function (_super) {
    __extends(RexAddCapabilityDialog, _super);
    function RexAddCapabilityDialog(editor) {
        var _this = _super.call(this) || this;
        _this.autoCancelButton = true;
        _this.options = {
            minWidth: 380
        };
        _this.validationState = ko.observable(RexAddCapabilityDialog.states.empty);
        _this.validationMessage = ko.observable('');
        var _ = wsAmeLodash;
        _this.editor = editor;
        var excludedCaps = ['do_not_allow', 'exist', 'customize'];
        var newCapabilityName = ko.observable('');
        _this.capabilityName = ko.computed({
            read: function () {
                return newCapabilityName();
            },
            write: function (value) {
                value = _.trimRight(value);
                //Validate and sanitize the capability name.
                var state = _this.validationState, message = _this.validationMessage;
                //WP API allows completely arbitrary capability names, but this plugin forbids some characters
                //for sanity's sake and to avoid XSS.
                var invalidCharacters = /[><&\r\n\t]/g;
                //While all other characters are allowed, it's recommended to stick to alphanumerics,
                //underscores and dashes. Spaces are also OK because some other plugins use them.
                var suspiciousCharacters = /[^a-z0-9_ -]/ig;
                //PHP doesn't allow numeric string keys, and there's no conceivable reason to start the name with a space.
                var invalidFirstCharacter = /^[\s0-9]/i;
                var foundInvalid = value.match(invalidCharacters);
                var foundSuspicious = value.match(suspiciousCharacters);
                if (foundInvalid !== null) {
                    state(RexAddCapabilityDialog.states.error);
                    message('Sorry, <code>' + _.escape(_.last(foundInvalid)) + '</code> is not allowed here.');
                }
                else if (value.match(invalidFirstCharacter) !== null) {
                    state(RexAddCapabilityDialog.states.error);
                    message('Capability name should start with a letter or an underscore.');
                }
                else if (editor.capabilityExists(value)) {
                    //Duplicates are not allowed.
                    state(RexAddCapabilityDialog.states.error);
                    message('That capability already exists.');
                }
                else if (editor.getRole(value) !== null) {
                    state(RexAddCapabilityDialog.states.error);
                    message('Capability name can\'t be the same as the name of a role.');
                }
                else if (excludedCaps.indexOf(value) >= 0) {
                    state(RexAddCapabilityDialog.states.error);
                    message('That is a meta capability or a reserved capability name.');
                }
                else if (foundSuspicious !== null) {
                    state(RexAddCapabilityDialog.states.notice);
                    message('For best compatibility, we recommend using only English letters, numbers, and underscores.');
                }
                else if (value === '') {
                    //Empty input, nothing to validate.
                    state(RexAddCapabilityDialog.states.empty);
                    message('');
                }
                else {
                    state(RexAddCapabilityDialog.states.valid);
                    message('');
                }
                newCapabilityName(value);
            }
        });
        var acceptableStates = [RexAddCapabilityDialog.states.valid, RexAddCapabilityDialog.states.notice];
        _this.isAddButtonEnabled = ko.pureComputed(function () {
            return (acceptableStates.indexOf(_this.validationState()) >= 0);
        });
        _this.options.buttons = [{
                text: 'Add Capability',
                'class': 'button button-primary',
                click: function () {
                    _this.onConfirm();
                },
                disabled: true
            }];
        return _this;
    }
    RexAddCapabilityDialog.prototype.onOpen = function (event, ui) {
        //Clear the input when the dialog is opened.
        this.capabilityName('');
    };
    RexAddCapabilityDialog.prototype.onConfirm = function () {
        if (!this.isAddButtonEnabled()) {
            return;
        }
        var category = this.editor.addCapability(this.capabilityName().trim());
        this.isOpen(false);
        //Note: Maybe the user doesn't need this alert? Hmm.
        if (!category || (this.editor.categoryViewMode() === RexRoleEditor.listView)) {
            alert('Capability added');
        }
        else {
            alert('Capability added to the "' + category.getAbsoluteName() + '" category.');
        }
    };
    RexAddCapabilityDialog.states = {
        valid: 'valid',
        empty: 'empty',
        notice: 'notice',
        error: 'error'
    };
    return RexAddCapabilityDialog;
}(RexBaseDialog));
var RexAddRoleDialog = /** @class */ (function (_super) {
    __extends(RexAddRoleDialog, _super);
    function RexAddRoleDialog(editor) {
        var _this = _super.call(this) || this;
        _this.roleName = ko.observable('');
        _this.roleDisplayName = ko.observable('');
        _this.roleToCopyFrom = ko.observable(null);
        _this.nameValidationMessage = ko.observable('');
        _this.displayNameValidationMessage = ko.observable('');
        _this.areTooltipsInitialised = false;
        var _ = wsAmeLodash;
        _this.editor = editor;
        _this.options.minWidth = 380;
        _this.options.buttons.push({
            text: 'Add Role',
            'class': 'button button-primary',
            click: _this.onConfirm.bind(_this),
            disabled: true
        });
        _this.roleDisplayName.extend({ rateLimit: 10 });
        _this.roleName.extend({ rateLimit: 10 });
        //Role names are restricted - you can only use lowercase Latin letters, numbers and underscores.
        var roleNameCharacterGroup = 'a-z0-9_';
        var invalidCharacterRegex = new RegExp('[^' + roleNameCharacterGroup + ']', 'g');
        var numbersOnlyRegex = /^[0-9]+$/;
        _this.isNameValid = ko.computed(function () {
            var name = _this.roleName().trim();
            var message = _this.nameValidationMessage;
            //Name must not be empty.
            if (name === '') {
                message('');
                return false;
            }
            //Name can only contain certain characters.
            var invalidChars = name.match(invalidCharacterRegex);
            if (invalidChars !== null) {
                var lastInvalidChar = _.last(invalidChars);
                if (lastInvalidChar === ' ') {
                    lastInvalidChar = 'space';
                }
                message('Sorry, <code>' + _.escape(lastInvalidChar) + '</code> is not allowed here.<br>'
                    + 'Please enter only lowercase English letters, numbers, and underscores.');
                return false;
            }
            //Numeric names could cause problems with how PHP handles associative arrays.
            if (numbersOnlyRegex.test(name)) {
                message('Numeric names are not allowed. Please add at least one letter or underscore.');
                return false;
            }
            //Name must not be a duplicate.
            var existingRole = editor.getRole(name);
            if (existingRole) {
                message('Duplicate role name.');
                return false;
            }
            //WP stores capabilities and role names in the same associative array,
            //so they must be unique with respect to each other.
            if (editor.capabilityExists(name)) {
                message('Role name can\'t be the same as a capability name.');
                return false;
            }
            message('');
            return true;
        });
        _this.isDisplayNameValid = ko.computed(function () {
            var name = _this.roleDisplayName();
            var message = _this.displayNameValidationMessage;
            return RexAddRoleDialog.validateDisplayName(name, message);
        });
        //Automatically generate a role name from the display name. Basically, turn it into a slug.
        var lastAutoRoleName = null;
        _this.roleDisplayName.subscribe(function (displayName) {
            var slug = _.snakeCase(displayName);
            //Use the auto-generated role name only if the user hasn't entered their own.
            var currentValue = _this.roleName();
            if ((currentValue === '') || (currentValue === lastAutoRoleName)) {
                _this.roleName(slug);
            }
            lastAutoRoleName = slug;
        });
        _this.isAddButtonEnabled = ko.pureComputed({
            read: function () {
                return (_this.roleName() !== '') && (_this.roleDisplayName() !== '')
                    && _this.isNameValid() && _this.isDisplayNameValid();
            },
            deferEvaluation: true
        });
        return _this;
    }
    RexAddRoleDialog.validateDisplayName = function (name, validationMessage) {
        name = name.trim();
        if (name === '') {
            validationMessage('');
            return false;
        }
        //You can choose pretty much any display name you like, but we'll forbid special characters
        //that might cause problems for plugins that don't escape output for HTML.
        if (RexAddRoleDialog.invalidDisplayNameRegex.test(name)) {
            validationMessage('Sorry, these characters are not allowed: <code>&lt; &gt; &amp;</code>');
            return false;
        }
        validationMessage('');
        return true;
    };
    RexAddRoleDialog.prototype.onOpen = function (event, ui) {
        //Clear dialog fields when it's opened.
        this.roleName('');
        this.roleDisplayName('');
        this.roleToCopyFrom(null);
        if (!this.areTooltipsInitialised) {
            this.setupValidationTooltip('#rex-new-role-display-name', this.displayNameValidationMessage);
            this.setupValidationTooltip('#rex-new-role-name', this.nameValidationMessage);
            this.areTooltipsInitialised = true;
        }
    };
    RexAddRoleDialog.prototype.onConfirm = function () {
        if (!this.isAddButtonEnabled()) {
            return;
        }
        this.isOpen(false);
        var caps = {};
        if (this.roleToCopyFrom()) {
            caps = this.roleToCopyFrom().getOwnCapabilities();
        }
        this.editor.addRole(this.roleName(), this.roleDisplayName(), caps);
    };
    RexAddRoleDialog.invalidDisplayNameRegex = /[><&\r\n\t]/;
    return RexAddRoleDialog;
}(RexBaseDialog));
var RexDeleteRoleDialog = /** @class */ (function (_super) {
    __extends(RexDeleteRoleDialog, _super);
    function RexDeleteRoleDialog(editor) {
        var _this = _super.call(this) || this;
        _this.isRoleSelected = {};
        _this.editor = editor;
        _this.options.minWidth = 420;
        _this.options.buttons.push({
            text: 'Delete Role',
            'class': 'button button-primary',
            click: _this.onConfirm.bind(_this),
            disabled: true
        });
        _this.isDeleteButtonEnabled = ko.pureComputed({
            read: function () {
                return _this.getSelectedRoles().length > 0;
            },
            deferEvaluation: true
        });
        return _this;
    }
    RexDeleteRoleDialog.prototype.onConfirm = function () {
        var _ = wsAmeLodash;
        var rolesToDelete = this.getSelectedRoles();
        //Warn about the dangers of deleting built-in roles.
        var selectedBuiltInRoles = _.filter(rolesToDelete, _.method('isBuiltIn'));
        if (selectedBuiltInRoles.length > 0) {
            var warning = 'Caution: Deleting default roles like ' + _.first(selectedBuiltInRoles).displayName()
                + ' can prevent you from using certain plugins. This is because some plugins look for specific'
                + ' role names to determine if a user is allowed to access the plugin.'
                + '\nDelete ' + selectedBuiltInRoles.length + ' default role(s)?';
            if (!confirm(warning)) {
                return;
            }
        }
        this.editor.deleteRoles(rolesToDelete);
        this.isOpen(false);
    };
    RexDeleteRoleDialog.prototype.onOpen = function (event, ui) {
        //Deselect all previously selected roles.
        wsAmeLodash.forEach(this.isRoleSelected, function (isSelected) {
            isSelected(false);
        });
    };
    RexDeleteRoleDialog.prototype.getSelectionState = function (roleName) {
        if (!this.isRoleSelected.hasOwnProperty(roleName)) {
            this.isRoleSelected[roleName] = ko.observable(false);
        }
        return this.isRoleSelected[roleName];
    };
    RexDeleteRoleDialog.prototype.getSelectedRoles = function () {
        var _this = this;
        var _ = wsAmeLodash;
        var rolesToDelete = [];
        _.forEach(this.editor.roles(), function (role) {
            if (_this.getSelectionState(role.name())()) {
                rolesToDelete.push(role);
            }
        });
        return rolesToDelete;
    };
    return RexDeleteRoleDialog;
}(RexBaseDialog));
var RexRenameRoleDialog = /** @class */ (function (_super) {
    __extends(RexRenameRoleDialog, _super);
    function RexRenameRoleDialog(editor) {
        var _this = _super.call(this) || this;
        _this.selectedRole = ko.observable(null);
        _this.newDisplayName = ko.observable('');
        _this.displayNameValidationMessage = ko.observable('');
        _this.isTooltipInitialised = false;
        _this.editor = editor;
        _this.options.minWidth = 380;
        _this.options.buttons.push({
            text: 'Rename Role',
            'class': 'button button-primary',
            click: _this.onConfirm.bind(_this),
            disabled: true
        });
        _this.selectedRole.subscribe(function (role) {
            if (role) {
                _this.newDisplayName(role.displayName());
            }
        });
        _this.isConfirmButtonEnabled = ko.computed({
            read: function () {
                return RexAddRoleDialog.validateDisplayName(_this.newDisplayName(), _this.displayNameValidationMessage);
            },
            deferEvaluation: true
        });
        return _this;
    }
    RexRenameRoleDialog.prototype.onOpen = function (event, ui) {
        var _ = wsAmeLodash;
        if (!this.isTooltipInitialised) {
            this.setupValidationTooltip('#rex-edited-role-display-name', this.displayNameValidationMessage);
            this.isTooltipInitialised = true;
        }
        //Select either the currently selected role or the first available role.
        var selectedActor = this.editor.selectedActor();
        if (selectedActor && (selectedActor instanceof RexRole)) {
            this.selectedRole(selectedActor);
        }
        else {
            this.selectedRole(_.first(this.editor.roles()));
        }
    };
    RexRenameRoleDialog.prototype.onConfirm = function () {
        if (!this.isConfirmButtonEnabled()) {
            return;
        }
        if (this.selectedRole()) {
            var name_1 = this.newDisplayName().trim();
            this.selectedRole().displayName(name_1);
            this.editor.actorSelector.repopulate();
        }
        this.isOpen(false);
    };
    return RexRenameRoleDialog;
}(RexBaseDialog));
var RexEagerObservableStringSet = /** @class */ (function () {
    function RexEagerObservableStringSet() {
        this.items = {};
    }
    RexEagerObservableStringSet.prototype.contains = function (item) {
        if (!this.items.hasOwnProperty(item)) {
            this.items[item] = ko.observable(false);
            return false;
        }
        return this.items[item]();
    };
    RexEagerObservableStringSet.prototype.add = function (item) {
        if (!this.items.hasOwnProperty(item)) {
            this.items[item] = ko.observable(true);
        }
        else {
            this.items[item](true);
        }
    };
    RexEagerObservableStringSet.prototype.remove = function (item) {
        if (this.items.hasOwnProperty(item)) {
            this.items[item](false);
        }
    };
    RexEagerObservableStringSet.prototype.clear = function () {
        var _ = wsAmeLodash;
        _.forEach(this.items, function (isInSet) {
            isInSet(false);
        });
    };
    RexEagerObservableStringSet.prototype.getPresenceObservable = function (item) {
        if (!this.items.hasOwnProperty(item)) {
            this.items[item] = ko.observable(false);
        }
        return this.items[item];
    };
    RexEagerObservableStringSet.prototype.getAsObject = function (fillValue) {
        if (fillValue === void 0) { fillValue = true; }
        var _ = wsAmeLodash;
        var output = {};
        _.forEach(this.items, function (isInSet, item) {
            if (isInSet()) {
                output[item] = fillValue;
            }
        });
        return output;
    };
    return RexEagerObservableStringSet;
}());
var RexObservableEditableRoleSettings = /** @class */ (function () {
    function RexObservableEditableRoleSettings() {
        this.strategy = ko.observable('auto');
        this.userDefinedList = new RexEagerObservableStringSet();
    }
    RexObservableEditableRoleSettings.prototype.toPlainObject = function () {
        var roleList = this.userDefinedList.getAsObject(true);
        if (wsAmeLodash.isEmpty(roleList)) {
            roleList = null;
        }
        return {
            strategy: this.strategy(),
            userDefinedList: roleList
        };
    };
    return RexObservableEditableRoleSettings;
}());
var RexUserRoleModule = /** @class */ (function () {
    function RexUserRoleModule(selectedActor, roles) {
        var _this = this;
        this.roleObservables = {};
        this.selectedActor = selectedActor;
        this.sortedRoles = ko.computed(function () {
            return roles();
        });
        this.primaryRole = ko.computed({
            read: function () {
                var actor = selectedActor();
                if ((actor === null) || !actor.canHaveRoles) {
                    return null;
                }
                if (actor instanceof RexUser) {
                    var roles_1 = actor.roles();
                    if (roles_1.length < 1) {
                        return null;
                    }
                    return roles_1[0];
                }
                return null;
            },
            write: function (newRole) {
                var actor = selectedActor();
                if ((actor === null) || !actor.canHaveRoles || !(actor instanceof RexUser)) {
                    return;
                }
                //No primary role = no roles at all.
                if (newRole === null) {
                    actor.roles.removeAll();
                    return;
                }
                //Sanity check.
                if (!(newRole instanceof RexRole)) {
                    return;
                }
                if (!_this.canAssignRoleToActor(newRole)) {
                    return;
                }
                //Remove the previous primary role.
                var oldPrimaryRole = (actor.roles().length > 0) ? actor.roles()[0] : null;
                if (oldPrimaryRole !== null) {
                    actor.roles.remove(oldPrimaryRole);
                }
                //If the user already has the new role, remove it from its old position first.
                if (actor.roles.indexOf(newRole) !== -1) {
                    actor.roles.remove(newRole);
                }
                //Add the role to the top of the list.
                actor.roles.unshift(newRole);
            }
        });
        this.isVisible = ko.pureComputed(function () {
            var actor = _this.selectedActor();
            return (actor !== null) && actor.canHaveRoles;
        });
    }
    // noinspection JSUnusedGlobalSymbols Used in Knockout templates.
    RexUserRoleModule.prototype.actorHasRole = function (role) {
        var _this = this;
        var roleActorId = role.getId();
        if (this.roleObservables.hasOwnProperty(roleActorId) && (this.roleObservables[roleActorId].role === role)) {
            return this.roleObservables[roleActorId].selectedActorHasRole;
        }
        var selectedActorHasRole = ko.computed({
            read: function () {
                var actor = _this.selectedActor();
                if ((actor === null) || !actor.canHaveRoles) {
                    return false;
                }
                if (actor instanceof RexUser) {
                    return (actor.roles.indexOf(role) !== -1);
                }
                return false;
            },
            write: function (shouldHaveRole) {
                var actor = _this.selectedActor();
                if ((actor === null) || !actor.canHaveRoles || !(actor instanceof RexUser)) {
                    return;
                }
                if (!_this.canAssignRoleToActor(role)) {
                    return;
                }
                var alreadyHasRole = (actor.roles.indexOf(role) !== -1);
                if (shouldHaveRole !== alreadyHasRole) {
                    if (shouldHaveRole) {
                        actor.roles.push(role);
                    }
                    else {
                        actor.roles.remove(role);
                    }
                }
            }
        });
        this.roleObservables[roleActorId] = {
            role: role,
            selectedActorHasRole: selectedActorHasRole
        };
        return selectedActorHasRole;
    };
    RexUserRoleModule.prototype.canAssignRoleToActor = function (role) {
        //This is a stub. The role editor currently doesn't check editable role settings at edit time.
        var actor = this.selectedActor();
        if ((actor === null) || !actor.canHaveRoles) {
            return false;
        }
        return (role instanceof RexRole);
    };
    return RexUserRoleModule;
}());
var RexEditableRolesDialog = /** @class */ (function (_super) {
    __extends(RexEditableRolesDialog, _super);
    function RexEditableRolesDialog(editor) {
        var _this = _super.call(this) || this;
        _this.selectedActor = ko.observable(null);
        _this.actorSettings = {};
        _this.editor = editor;
        _this.visibleActors = ko.observableArray([]);
        _this.options.minWidth = 600;
        _this.options.buttons.push({
            text: 'Save Changes',
            'class': 'button button-primary',
            click: _this.onConfirm.bind(_this),
            disabled: false
        });
        //Super Admin is always set to "leave unchanged" because
        //they can edit all roles.
        var superAdmin = editor.getSuperAdmin();
        var superAdminSettings = new RexObservableEditableRoleSettings();
        superAdminSettings.strategy('none');
        var dummySettings = new RexObservableEditableRoleSettings();
        _this.selectedActorSettings = ko.computed(function () {
            if (_this.selectedActor() === null) {
                return dummySettings;
            }
            if (_this.selectedActor() === superAdmin) {
                return superAdminSettings;
            }
            var actorId = _this.selectedActor().getId();
            if (!_this.actorSettings.hasOwnProperty(actorId)) {
                //This should never happen; the dictionary should be initialised when opening the dialog.
                _this.actorSettings[actorId] = new RexObservableEditableRoleSettings();
            }
            return _this.actorSettings[actorId];
        });
        _this.editableRoleStrategy = ko.computed({
            read: function () {
                return _this.selectedActorSettings().strategy();
            },
            write: function (newValue) {
                _this.selectedActorSettings().strategy(newValue);
            }
        });
        _this.isAutoStrategyAllowed = ko.computed(function () {
            var actor = _this.selectedActor();
            if (actor == null) {
                return true;
            }
            return !((actor === superAdmin)
                || ((actor instanceof RexUser) && actor.isSuperAdmin));
        });
        _this.isListStrategyAllowed = _this.isAutoStrategyAllowed;
        return _this;
    }
    RexEditableRolesDialog.prototype.onOpen = function (event, ui) {
        var _this = this;
        var _ = wsAmeLodash;
        //Copy editable role settings into observables.
        _.forEach(this.editor.actorEditableRoles, function (settings, actorId) {
            if (!_this.actorSettings.hasOwnProperty(actorId)) {
                _this.actorSettings[actorId] = new RexObservableEditableRoleSettings();
            }
            var observableSettings = _this.actorSettings[actorId];
            observableSettings.strategy(settings.strategy);
            observableSettings.userDefinedList.clear();
            if (settings.userDefinedList !== null) {
                _.forEach(settings.userDefinedList, function (ignored, roleId) {
                    observableSettings.userDefinedList.add(roleId);
                });
            }
        });
        this.visibleActors(this.editor.actorSelector.getVisibleActors());
        //Select either the currently selected actor or the first role.
        var selectedActor = this.editor.selectedActor();
        if (selectedActor) {
            this.selectedActor(selectedActor);
        }
        else {
            this.selectedActor(_.first(this.editor.roles()));
        }
    };
    RexEditableRolesDialog.prototype.onConfirm = function () {
        //Save editable roles
        var _ = wsAmeLodash;
        var settings = this.editor.actorEditableRoles;
        _.forEach(this.actorSettings, function (observableSettings, actorId) {
            if (observableSettings.strategy() === 'auto') {
                //"auto" is the default so we don't need to store anything.
                delete settings[actorId];
            }
            else {
                settings[actorId] = observableSettings.toPlainObject();
            }
        });
        this.isOpen(false);
    };
    RexEditableRolesDialog.prototype.isRoleSetToEditable = function (role) {
        return this.selectedActorSettings().userDefinedList.getPresenceObservable(role.name());
    };
    RexEditableRolesDialog.prototype.isRoleEnabled = function (role) {
        return this.editableRoleStrategy() === 'user-defined-list';
    };
    RexEditableRolesDialog.prototype.selectItem = function (actor) {
        this.selectedActor(actor);
    };
    RexEditableRolesDialog.prototype.getItemText = function (actor) {
        return this.editor.actorSelector.getNiceName(actor);
    };
    return RexEditableRolesDialog;
}(RexBaseDialog));
var RexRoleEditor = /** @class */ (function () {
    function RexRoleEditor(data) {
        var _this = this;
        // noinspection JSUnusedGlobalSymbols
        this.categoryViewOptions = [
            RexRoleEditor.hierarchyView,
            RexRoleEditor.singleCategoryView,
            RexRoleEditor.listView
        ];
        this.deprecatedCapabilities = {};
        this.userDefinedCapabilities = {};
        this.categoriesBySlug = {};
        this.actorLookup = {};
        var self = this;
        var _ = wsAmeLodash;
        this.areBindingsApplied = ko.observable(false);
        this.isLoaded = ko.computed(function () {
            return _this.areBindingsApplied();
        });
        this.userPreferences = new RexUserPreferences(data.userPreferences, data.adminAjaxUrl, data.updatePreferencesNonce);
        var preferences = this.userPreferences;
        this.showDeprecatedEnabled = preferences.getObservable('showDeprecatedEnabled', true);
        this.showRedundantEnabled = preferences.getObservable('showRedundantEnabled', false);
        this.showBaseCapsEnabled = ko.computed(this.showRedundantEnabled);
        this.showOnlyCheckedEnabled = preferences.getObservable('showOnlyCheckedEnabled', false);
        this.categoryWidthMode = preferences.getObservable('categoryWidthMode', 'adaptive');
        this.readableNamesEnabled = preferences.getObservable('readableNamesEnabled', true);
        this.showNumberOfCapsEnabled = preferences.getObservable('showNumberOfCapsEnabled', true);
        this.showGrantedCapCountEnabled = preferences.getObservable('showGrantedCapCountEnabled', true);
        this.showTotalCapCountEnabled = preferences.getObservable('showTotalCapCountEnabled', true);
        this.showZerosEnabled = preferences.getObservable('showZerosEnabled', false);
        this.inheritanceOverrideEnabled = preferences.getObservable('inheritanceOverrideEnabled', false);
        //Remember and restore the selected view mode.
        var viewModeId = preferences.getObservable('categoryVewMode', 'hierarchy');
        var initialViewMode = _.find(this.categoryViewOptions, 'id', viewModeId());
        if (!initialViewMode) {
            initialViewMode = RexRoleEditor.hierarchyView;
        }
        this.categoryViewMode = ko.observable(initialViewMode);
        this.categoryViewMode.subscribe(function (newMode) {
            viewModeId(newMode.id);
        });
        this.isShiftKeyDown = ko.observable(false);
        this.capabilityViewClasses = ko.pureComputed({
            read: function () {
                var viewMode = _this.categoryViewMode();
                var classes = ['rex-category-view-mode-' + viewMode.id];
                if (viewMode === RexRoleEditor.singleCategoryView) {
                    classes.push('rex-show-category-subheadings');
                }
                if (_this.readableNamesEnabled()) {
                    classes.push('rex-readable-names-enabled');
                }
                if (_this.categoryWidthMode() === 'full') {
                    classes.push('rex-full-width-categories');
                }
                return classes.join(' ');
            },
            deferEvaluation: true
        });
        this.searchQuery = ko.observable('').extend({ rateLimit: { timeout: 100, method: "notifyWhenChangesStop" } });
        this.searchKeywords = ko.computed(function () {
            var query = self.searchQuery().trim();
            if (query === '') {
                return [];
            }
            return wsAmeLodash(query.split(' '))
                .map(function (keyword) {
                return keyword.trim();
            })
                .filter(function (keyword) {
                return (keyword !== '');
            })
                .value();
        });
        this.components = _.mapValues(data.knownComponents, function (details, id) {
            return RexWordPressComponent.fromJs(id, details);
        });
        this.coreComponent = new RexWordPressComponent(':wordpress:', 'WordPress core');
        this.components[':wordpress:'] = this.coreComponent;
        //Populate roles and users.
        var tempRoleList = [];
        _.forEach(data.roles, function (roleData) {
            var role = new RexRole(roleData.name, roleData.displayName, roleData.capabilities);
            role.hasUsers = roleData.hasUsers;
            tempRoleList.push(role);
            _this.actorLookup[role.id()] = role;
        });
        this.roles = ko.observableArray(tempRoleList);
        var tempUserList = [];
        _.forEach(AmeActors.getUsers(), function (data) {
            var user = RexUser.fromAmeUser(data, self);
            tempUserList.push(user);
            _this.actorLookup[user.id()] = user;
        });
        this.users = ko.observableArray(tempUserList);
        this.dummyActor = new RexRole('rex-invalid-role', 'Invalid Role');
        this.defaultNewUserRoleName = data.defaultRoleName;
        this.trashedRoles = ko.observableArray(_.map(data.trashedRoles, function (roleData) {
            return RexRole.fromRoleData(roleData);
        }));
        this.actorSelector = new AmeActorSelector(this, true, false);
        //Wrap the selected actor in a computed observable so that it can be used with Knockout.
        var _selectedActor = ko.observable(this.getActor(this.actorSelector.selectedActor));
        this.selectedActor = ko.computed({
            read: function () {
                return _selectedActor();
            },
            write: function (newActor) {
                _this.actorSelector.setSelectedActor(newActor.id());
            }
        });
        this.actorSelector.onChange(function (newSelectedActor) {
            _selectedActor(_this.getActor(newSelectedActor));
        });
        //Refresh the actor selector when roles are added or removed.
        this.roles.subscribe(function () {
            _this.actorSelector.repopulate();
        });
        //Re-select the previously selected actor if possible.
        var initialActor = null;
        if (data.selectedActor) {
            initialActor = this.getActor(data.selectedActor);
        }
        if (!initialActor || (initialActor === this.dummyActor)) {
            initialActor = this.roles()[0];
        }
        this.selectedActor(initialActor);
        //Populate capabilities.
        this.deprecatedCapabilities = data.deprecatedCapabilities;
        this.metaCapabilityMap = data.metaCapMap;
        this.userDefinedCapabilities = data.userDefinedCapabilities;
        this.capabilities = _.mapValues(data.capabilities, function (metadata, name) {
            return RexCapability.fromJs(name, metadata, self);
        });
        //Add the special "do_not_allow" capability. Normally, it's impossible to assign it to anyone,
        //but it can still be used in post type permissions and other places.
        var doNotAllow = new RexDoNotAllowCapability(this);
        doNotAllow.originComponent = this.components[':wordpress:'];
        this.capabilities['do_not_allow'] = doNotAllow;
        //Similarly, "exist" is always enabled for all roles and users. Everyone can exist.
        if (this.capabilities.hasOwnProperty('exist')) {
            this.capabilities['exist'] = new RexExistCapability(this);
            this.capabilities['exist'].originComponent = this.components[':wordpress:'];
        }
        //Store editable roles.
        this.actorEditableRoles = (!_.isEmpty(data.editableRoles)) ? data.editableRoles : {};
        this.rootCategory = new RexCategory('All', this);
        var coreCategory = RexCategory.fromJs(data.coreCategory, this);
        this.rootCategory.addSubcategory(coreCategory);
        var postTypeCategory = new RexPostTypeContainerCategory('Post Types', this, 'postTypes');
        this.postTypes = _.indexBy(data.postTypes, 'name');
        _.forEach(this.postTypes, function (details, id) {
            var category = new RexPostTypeCategory(details.label, self, id, 'postTypes/' + id, details.permissions, details.isDefault);
            if (details.componentId) {
                category.origin = _this.getComponent(details.componentId);
            }
            postTypeCategory.addSubcategory(category);
            //Record the post type actions associated with each capability.
            for (var action in details.permissions) {
                var capability = self.getCapability(details.permissions[action]);
                _.set(capability.usedByPostTypeActions, [details.name, action], true);
            }
        });
        //Sort the actual subcategory array.
        postTypeCategory.sortSubcategories();
        this.rootCategory.addSubcategory(postTypeCategory);
        //Taxonomies.
        this.taxonomies = data.taxonomies;
        var taxonomyCategory = new RexTaxonomyContainerCategory('Taxonomies', this, 'taxonomies');
        _.forEach(data.taxonomies, function (details, id) {
            var category = new RexTaxonomyCategory(details.label, self, id, 'taxonomies/' + id, details.permissions);
            taxonomyCategory.addSubcategory(category);
            //Record taxonomy type actions associated with each capability.
            for (var action in details.permissions) {
                var capability = self.getCapability(details.permissions[action]);
                _.set(capability.usedByTaxonomyActions, [details.name, action], true);
            }
        });
        taxonomyCategory.subcategories.sort(function (a, b) {
            return a.name.toLowerCase().localeCompare(b.name.toLowerCase());
        });
        this.rootCategory.addSubcategory(taxonomyCategory);
        var customParentCategory = new RexCategory('Plugins', this, 'custom');
        function initCustomCategory(details, parent) {
            var category = RexCategory.fromJs(details, self);
            //Sort subcategories by title.
            category.subcategories.sort(function (a, b) {
                //Keep the "General" category at the top if there is one.
                if (a.name === b.name) {
                    return 0;
                }
                else if (a.name === 'General') {
                    return -1;
                }
                else if (b.name === 'General') {
                    return 1;
                }
                return a.name.localeCompare(b.name);
            });
            parent.addSubcategory(category);
        }
        _.forEach(data.customCategories, function (details) {
            initCustomCategory(details, customParentCategory);
        });
        customParentCategory.subcategories.sort(function (a, b) {
            return a.name.toLowerCase().localeCompare(b.name.toLowerCase());
        });
        this.rootCategory.addSubcategory(customParentCategory);
        //Make a category for uncategorized capabilities. This one is always at the bottom.
        var uncategorizedCategory = new RexCategory('Uncategorized', self, 'custom/uncategorized', data.uncategorizedCapabilities);
        customParentCategory.addSubcategory(uncategorizedCategory);
        var _selectedCategory = ko.observable(null);
        this.selectedCategory = ko.computed({
            read: function () {
                return _selectedCategory();
            },
            write: function (newSelection) {
                var oldSelection = _selectedCategory();
                if (newSelection === oldSelection) {
                    return;
                }
                if (newSelection) {
                    newSelection.isSelected(true);
                }
                if (oldSelection) {
                    oldSelection.isSelected(false);
                }
                _selectedCategory(newSelection);
            }
        });
        this.selectedCategory(this.rootCategory);
        this.permissionTipSubject = ko.observable(null);
        this.allCapabilitiesAsPermissions = ko.pureComputed({
            read: function () {
                //Create a permission for each unique, non-deleted capability.
                //Exclude special caps like do_not_allow and exist because they can't be enabled.
                var excludedCaps = ['do_not_allow', 'exist'];
                return _.chain(_this.capabilities)
                    .map(function (capability) {
                    if (excludedCaps.indexOf(capability.name) >= 0) {
                        return null;
                    }
                    return new RexPermission(self, capability);
                })
                    .filter(function (value) {
                    return value !== null;
                })
                    .value();
            },
            deferEvaluation: true
        });
        this.capsInSelectedCategory = ko.pureComputed({
            read: function () {
                var category = _this.selectedCategory();
                if (!category) {
                    return {};
                }
                var caps = {};
                category.countUniqueCapabilities(caps);
                return caps;
            },
            deferEvaluation: true
        });
        this.leafCategories = ko.computed({
            read: function () {
                //So what we want here is a depth-first traversal of the category tree.
                var results = [];
                var addedUniqueCategories = {};
                function traverse(category) {
                    if (category.subcategories.length < 1) {
                        //Eliminate duplicates, like CPTs that show up in the post type category and a plugin category.
                        var key = category.getDeDuplicationKey();
                        if (!addedUniqueCategories.hasOwnProperty(key)) {
                            results.push(category);
                            addedUniqueCategories[key] = category;
                        }
                        else {
                            addedUniqueCategories[key].addDuplicate(category);
                        }
                        return;
                    }
                    for (var i = 0; i < category.subcategories.length; i++) {
                        traverse(category.subcategories[i]);
                    }
                }
                traverse(_this.rootCategory);
                results.sort(function (a, b) {
                    return a.name.toLowerCase().localeCompare(b.name.toLowerCase());
                });
                return results;
            },
            deferEvaluation: true
        });
        var compareRoleDisplayNames = function (a, b) {
            return a.displayName().toLowerCase().localeCompare(b.displayName().toLowerCase());
        };
        this.defaultRoles = ko.pureComputed({
            read: function () {
                return _.filter(self.roles(), function (role) {
                    return role.isBuiltIn();
                }).sort(compareRoleDisplayNames);
            },
            deferEvaluation: true
        });
        this.customRoles = ko.computed({
            read: function () {
                return _.difference(self.roles(), self.defaultRoles()).sort(compareRoleDisplayNames);
            },
            deferEvaluation: true
        });
        this.deleteCapabilityDialog = new RexDeleteCapDialog(this);
        this.addCapabilityDialog = new RexAddCapabilityDialog(this);
        this.addRoleDialog = new RexAddRoleDialog(this);
        this.deleteRoleDialog = new RexDeleteRoleDialog(this);
        this.renameRoleDialog = new RexRenameRoleDialog(this);
        this.editableRolesDialog = new RexEditableRolesDialog(this);
        this.userRoleModule = new RexUserRoleModule(this.selectedActor, this.roles);
        this.settingsFieldData = ko.observable('');
        this.isSaving = ko.observable(false);
        this.isGlobalSettingsUpdate = ko.observable(false);
    }
    RexRoleEditor.prototype.capabilityMatchesFilters = function (capability) {
        if (!this.showDeprecatedEnabled() && this.isDeprecated(capability.name)) {
            return false;
        }
        if (this.showOnlyCheckedEnabled() && !capability.isEnabledForSelectedActor()) {
            return false;
        }
        var keywords = this.searchKeywords(), capabilityName = capability.name;
        if (keywords.length > 0) {
            var haystack_1 = capabilityName.toLowerCase();
            var matchesKeywords = wsAmeLodash.all(keywords, function (keyword) {
                return haystack_1.indexOf(keyword) >= 0;
            });
            if (!matchesKeywords) {
                return false;
            }
        }
        return true;
    };
    RexRoleEditor.prototype.isDeprecated = function (capability) {
        return this.deprecatedCapabilities.hasOwnProperty(capability);
    };
    RexRoleEditor.prototype.getComponent = function (componentId) {
        if (this.components.hasOwnProperty(componentId)) {
            return this.components[componentId];
        }
        return null;
    };
    /**
     * Get or create a capability instance.
     */
    RexRoleEditor.prototype.getCapability = function (capabilityName, recursionDepth) {
        if (recursionDepth === void 0) { recursionDepth = 0; }
        //Un-map meta capabilities where possible.
        if (this.metaCapabilityMap.hasOwnProperty(capabilityName) && (recursionDepth < 10)) {
            return this.getCapability(this.metaCapabilityMap[capabilityName], recursionDepth + 1);
        }
        if (!this.capabilities.hasOwnProperty(capabilityName)) {
            var _1 = wsAmeLodash;
            if (!_1.isString(capabilityName) && !_1.isFinite(capabilityName)) {
                return this.getInvalidCapability(capabilityName);
            }
            if (console && console.info) {
                console.info('Capability not found: "' + capabilityName + '". It will be created.');
            }
            capabilityName = String(capabilityName);
            this.capabilities[capabilityName] = new RexCapability(capabilityName, this);
        }
        return this.capabilities[capabilityName];
    };
    RexRoleEditor.prototype.getInvalidCapability = function (invalidName) {
        var capabilityName = '[Invalid capability: ' + String(invalidName) + ']';
        if (!this.capabilities.hasOwnProperty(capabilityName)) {
            if (console && console.error) {
                console.error('Invalid capability detected - expected a string but got this: ', invalidName);
            }
            this.capabilities[capabilityName] = new RexInvalidCapability(capabilityName, invalidName, this);
        }
        return this.capabilities[capabilityName];
    };
    RexRoleEditor.prototype.getActor = function (actorId) {
        if (this.actorLookup.hasOwnProperty(actorId)) {
            return this.actorLookup[actorId];
        }
        return this.dummyActor;
    };
    RexRoleEditor.prototype.getRole = function (name) {
        var actorId = 'role:' + name;
        if (this.actorLookup.hasOwnProperty(actorId)) {
            var role = this.actorLookup[actorId];
            if (role instanceof RexRole) {
                return role;
            }
        }
        return null;
    };
    // noinspection JSUnusedGlobalSymbols Testing method used in KO templates.
    RexRoleEditor.prototype.setSubjectPermission = function (permission) {
        this.permissionTipSubject(permission);
    };
    /**
     * Search a string for the current search keywords and add the "rex-search-highlight" CSS class to each match.
     *
     * @param inputString
     */
    RexRoleEditor.prototype.highlightSearchKeywords = function (inputString) {
        var _ = wsAmeLodash;
        var keywordList = this.searchKeywords();
        if (keywordList.length === 0) {
            return inputString;
        }
        var keywordGroup = _.map(keywordList, _.escapeRegExp).join('|');
        var regex = new RegExp('((?:' + keywordGroup + ')(?:\\s*))+', 'gi');
        return inputString.replace(regex, function (foundKeywords) {
            //Don't highlight the trailing space after the keyword(s).
            var trailingSpace = '';
            var parts = foundKeywords.match(/^(.+?)(\s+)$/);
            if (parts) {
                foundKeywords = parts[1];
                trailingSpace = parts[2];
            }
            return '<mark class="rex-search-highlight">' + foundKeywords + '</mark>' + trailingSpace;
        });
    };
    RexRoleEditor.prototype.actorExists = function (actorId) {
        return this.actorLookup.hasOwnProperty(actorId);
    };
    RexRoleEditor.prototype.addUsers = function (newUsers) {
        var _this = this;
        wsAmeLodash.forEach(newUsers, function (user) {
            if (!(user instanceof RexUser)) {
                if (console.error) {
                    console.error('Cannot add a user. Expected an instance of RexUser, got this:', user);
                }
                return;
            }
            if (!_this.actorLookup.hasOwnProperty(user.getId())) {
                _this.users.push(user);
                _this.actorLookup[user.getId()] = user;
            }
        });
    };
    RexRoleEditor.prototype.createUserFromProperties = function (properties) {
        return RexUser.fromAmeUserProperties(properties, this);
    };
    RexRoleEditor.prototype.getRoles = function () {
        return wsAmeLodash.indexBy(this.roles(), function (role) {
            return role.name();
        });
    };
    RexRoleEditor.prototype.getSuperAdmin = function () {
        return RexSuperAdmin.getInstance();
    };
    RexRoleEditor.prototype.getUser = function (login) {
        var actorId = 'user:' + login;
        if (this.actorLookup.hasOwnProperty(actorId)) {
            var user = this.actorLookup[actorId];
            if (user instanceof RexUser) {
                return user;
            }
        }
        return null;
    };
    RexRoleEditor.prototype.getUsers = function () {
        return wsAmeLodash.indexBy(this.users(), 'userLogin');
    };
    RexRoleEditor.prototype.isInSelectedCategory = function (capabilityName) {
        var caps = this.capsInSelectedCategory();
        return caps.hasOwnProperty(capabilityName);
    };
    RexRoleEditor.prototype.addCapability = function (capabilityName) {
        var capability;
        if (this.capabilities.hasOwnProperty(capabilityName)) {
            capability = this.capabilities[capabilityName];
            if (!capability.isDeleted()) {
                throw 'Cannot add capability "' + capabilityName + '" because it already exists.';
            }
            capability.isDeleted(false);
            this.userDefinedCapabilities[capabilityName] = true;
            return null;
        }
        else {
            capability = new RexCapability(capabilityName, this);
            capability.notes = 'This capability has not been saved yet. Click the "Save Changes" button to save it.';
            this.capabilities[capabilityName] = capability;
            //Add the new capability to the "Other" or "Uncategorized" category.
            var category = this.categoriesBySlug['custom/uncategorized'];
            var permission = new RexPermission(this, capability);
            category.permissions.push(permission);
            category.sortPermissions();
            this.userDefinedCapabilities[capabilityName] = true;
            return category;
        }
    };
    RexRoleEditor.prototype.deleteCapabilities = function (selectedCapabilities) {
        var self = this, _ = wsAmeLodash;
        var targetActors = _.union(this.roles(), this.users());
        _.forEach(selectedCapabilities, function (capability) {
            //Remove it from all roles and visible users.
            _.forEach(targetActors, function (actor) {
                actor.deleteCap(capability.name);
            });
            capability.isDeleted(true);
            delete self.userDefinedCapabilities[capability.name];
        });
    };
    RexRoleEditor.prototype.capabilityExists = function (capabilityName) {
        return this.capabilities.hasOwnProperty(capabilityName) && !this.capabilities[capabilityName].isDeleted();
    };
    RexRoleEditor.prototype.addRole = function (name, displayName, capabilities) {
        if (capabilities === void 0) { capabilities = {}; }
        var role = new RexRole(name, displayName, capabilities);
        this.actorLookup[role.id()] = role;
        this.roles.push(role);
        //Select the new role.
        this.selectedActor(role);
        return role;
    };
    RexRoleEditor.prototype.deleteRoles = function (roles) {
        var _this = this;
        var _ = wsAmeLodash;
        _.forEach(roles, function (role) {
            if (!_this.canDeleteRole(role)) {
                throw 'Cannot delete role "' + role.name() + '"';
            }
        });
        this.roles.removeAll(roles);
        this.trashedRoles.push.apply(this.trashedRoles, roles);
        //TODO: Later, add an option to restore deleted roles.
    };
    RexRoleEditor.prototype.canDeleteRole = function (role) {
        //Was the role already assigned to any users when the editor was opened?
        if (role.hasUsers) {
            return false;
        }
        //We also need to take into account any unsaved user role changes.
        //Is the role assigned to any of the users currently loaded in the editor?
        var _ = wsAmeLodash;
        if (_.some(this.users(), function (user) {
            return (user.roles.indexOf(role) !== -1);
        })) {
            return false;
        }
        return !this.isDefaultRoleForNewUsers(role);
    };
    RexRoleEditor.prototype.isDefaultRoleForNewUsers = function (role) {
        return (role.name() === this.defaultNewUserRoleName);
    };
    // noinspection JSUnusedGlobalSymbols Used in KO templates.
    RexRoleEditor.prototype.saveChanges = function () {
        this.isSaving(true);
        var _ = wsAmeLodash;
        var data = {
            'roles': _.invoke(this.roles(), 'toJs'),
            'users': _.invoke(this.users(), 'toJs'),
            'trashedRoles': _.invoke(this.trashedRoles(), 'toJs'),
            'userDefinedCaps': _.keys(this.userDefinedCapabilities),
            'editableRoles': this.actorEditableRoles
        };
        this.settingsFieldData(ko.toJSON(data));
        jQuery('#rex-save-settings-form').submit();
    };
    RexRoleEditor.prototype.updateAllSites = function () {
        if (!confirm('Apply these role settings to ALL sites? Any changes that you\'ve made to individual sites will be lost.')) {
            return false;
        }
        this.isGlobalSettingsUpdate(true);
        this.saveChanges();
    };
    RexRoleEditor.hierarchyView = {
        label: 'Hierarchy view',
        id: 'hierarchy',
        templateName: 'rex-hierarchy-view-template'
    };
    RexRoleEditor.singleCategoryView = {
        label: 'Category view',
        id: 'category',
        templateName: 'rex-single-category-view-template'
    };
    RexRoleEditor.listView = { label: 'List view', id: 'list', templateName: 'rex-list-view-template' };
    return RexRoleEditor;
}());
(function () {
    jQuery(function ($) {
        var rootElement = jQuery('#ame-role-editor-root');
        //Initialize the application.
        var app = new RexRoleEditor(wsRexRoleEditorData);
        //The input data can be quite large, so let's give the browser a chance to free up that memory.
        wsRexRoleEditorData = null;
        window['ameRoleEditor'] = app;
        //console.time('Apply Knockout bindings');
        //ko.options.deferUpdates = true;
        ko.applyBindings(app, rootElement.get(0));
        app.areBindingsApplied(true);
        //console.timeEnd('Apply Knockout bindings');
        //Track the state of the Shift key.
        var isShiftKeyDown = false;
        function handleKeyboardEvent(event) {
            var newState = !!(event.shiftKey);
            if (newState !== isShiftKeyDown) {
                isShiftKeyDown = newState;
                app.isShiftKeyDown(isShiftKeyDown);
            }
        }
        $(document).on('keydown.adminMenuEditorRex keyup.adminMenuEditorRex mousedown.adminMenuEditorRex', handleKeyboardEvent);
        //Initialize permission tooltips.
        var visiblePermissionTooltips = [];
        rootElement.find('#rex-capability-view').on('mouseenter click', '.rex-permission-tip-trigger', function (event) {
            $(this).qtip({
                overwrite: false,
                content: {
                    text: 'Loading...'
                },
                //Show the tooltip on focus.
                show: {
                    event: 'click mouseenter',
                    delay: 80,
                    solo: '#ame-role-editor-root',
                    ready: true,
                    effect: false
                },
                hide: {
                    event: 'mouseleave unfocus',
                    fixed: true,
                    delay: 300,
                    leave: false,
                    effect: false
                },
                position: {
                    my: 'center left',
                    at: 'center right',
                    effect: false,
                    viewport: $(window),
                    adjust: {
                        method: 'flipinvert shift',
                        scroll: false,
                    }
                },
                style: {
                    classes: 'qtip-bootstrap qtip-shadow rex-tooltip'
                },
                events: {
                    show: function (event, api) {
                        //Immediately hide all other permission tooltips.
                        for (var i = visiblePermissionTooltips.length - 1; i >= 0; i--) {
                            visiblePermissionTooltips[i].hide();
                        }
                        var permission = ko.dataFor(api.target.get(0));
                        if (permission && (permission instanceof RexPermission)) {
                            app.permissionTipSubject(permission);
                        }
                        //Move the content container to the current tooltip.
                        var tipContent = $('#rex-permission-tip');
                        if (!$.contains(api.elements.content.get(0), tipContent.get(0))) {
                            api.elements.content.empty().append(tipContent);
                        }
                        visiblePermissionTooltips.push(api);
                    },
                    hide: function (event, api) {
                        var index = visiblePermissionTooltips.indexOf(api);
                        if (index >= 0) {
                            visiblePermissionTooltips.splice(index, 1);
                        }
                    }
                }
            }, event);
        });
        //Tooltips must have a higher z-index than the modal widget overlay and the Toolbar.
        jQuery.fn.qtip.zindex = 100101 + 5000;
        //Set up dropdown menus.
        $('.rex-dropdown-trigger').on('click', function (event) {
            var $trigger = $(this);
            var $dropdown = $('#' + $trigger.data('target-dropdown-id'));
            event.stopPropagation();
            event.preventDefault();
            function hideThisDropdown(event) {
                //Only do it if the user clicked something outside the dropdown.
                var $clickedDropdown = $(event.target).closest($dropdown.get(0));
                if ($clickedDropdown.length < 1) {
                    $dropdown.hide();
                    $(document).off('click', hideThisDropdown);
                }
            }
            if ($dropdown.is(':visible')) {
                $dropdown.hide();
                $(document).off('click', hideThisDropdown);
                return;
            }
            $dropdown.show().position({
                my: 'left top',
                at: 'left bottom',
                of: $trigger
            });
            $(document).on('click', hideThisDropdown);
        });
    });
})();
