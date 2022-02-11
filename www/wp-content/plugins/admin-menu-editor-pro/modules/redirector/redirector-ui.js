/// <reference path="../../js/knockout.d.ts" />
/// <reference path="../../js/jquery.d.ts" />
/// <reference path="../../js/jqueryui.d.ts" />
/// <reference path="../../js/actor-manager.ts" />
/// <reference path="../actor-selector/actor-selector.ts" />
/// <reference path="../../js/common.d.ts" />
/// <reference path="../../ajax-wrapper/ajax-action-wrapper.d.ts" />
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
var AmeRedirectorUi;
(function (AmeRedirectorUi) {
    var AllKnownTriggers = {
        login: null,
        logout: null,
        registration: null,
        firstLogin: null
    };
    var _ = wsAmeLodash;
    var AbstractTriggerDictionary = /** @class */ (function () {
        function AbstractTriggerDictionary() {
        }
        return AbstractTriggerDictionary;
    }());
    var DefaultActorId = 'special:default';
    var defaultActor = {
        getDisplayName: function () {
            return 'Default';
        },
        getId: function () {
            return DefaultActorId;
        }
    };
    var Redirect = /** @class */ (function () {
        function Redirect(properties, actorProvider) {
            var _this = this;
            if (actorProvider === void 0) { actorProvider = null; }
            this.actorId = properties.actorId;
            this.trigger = properties.trigger;
            this.urlTemplate = ko.observable(properties.urlTemplate);
            this.menuTemplateId = ko.observable(properties.hasOwnProperty('menuTemplateId') ? properties.menuTemplateId : '');
            this.canToggleShortcodes = ko.pureComputed(function () {
                return (_this.menuTemplateId().trim() === '');
            });
            this.inputHasFocus = ko.observable(false);
            var internalShortcodesEnabled = ko.observable(properties.shortcodesEnabled);
            this.shortcodesEnabled = ko.computed({
                read: function () {
                    //All of the menu items use shortcodes to generate the admin page URL,
                    //so shortcodes must be enabled when a menu item is selected.
                    var menu = _this.menuTemplateId().trim();
                    if (menu !== '') {
                        return true;
                    }
                    return internalShortcodesEnabled();
                },
                write: function (value) {
                    if (!_this.canToggleShortcodes()) {
                        return;
                    }
                    internalShortcodesEnabled(value);
                },
                deferEvaluation: true
            });
            if (this.actorId === DefaultActorId) {
                this.actor = defaultActor;
            }
            else {
                var provider = actorProvider ? actorProvider : AmeActors;
                this.actor = provider.getActor(this.actorId);
            }
            this.actorTypeNoun = ko.pureComputed(function () {
                var prefix = _this.actorId.substring(0, _this.actorId.indexOf(':'));
                if (prefix === 'user') {
                    return 'user';
                }
                else if (prefix === 'role') {
                    return 'role';
                }
                return 'item';
            });
            this.urlDropdownEnabled = ko.pureComputed(function () {
                //If a menu item is already selected in the dropdown, the dropdown has to be enabled
                //to give the user the ability to select something else.
                var menu = _this.menuTemplateId().trim();
                if (menu !== '') {
                    return true;
                }
                //The dropdown only contains admin menu items, so it's only useful if the user
                //can access the admin dashboard after the trigger happens.
                //Note: This may need to change if we add other options to the dropdown.
                return (_this.trigger === 'login') || (_this.trigger === 'firstLogin');
            });
            Redirect.inputCounter++;
            this.inputElementId = 'ame-rui-unique-input-' + Redirect.inputCounter;
        }
        Redirect.prototype.toJs = function () {
            var result = {
                actorId: this.actorId,
                urlTemplate: this.urlTemplate().trim(),
                shortcodesEnabled: this.shortcodesEnabled(),
                trigger: this.trigger
            };
            var menu = this.menuTemplateId().trim();
            if (menu !== '') {
                result.menuTemplateId = menu;
            }
            return result;
        };
        Redirect.prototype.displayName = function () {
            if (this.actor.hasOwnProperty('userLogin')) {
                var user = this.actor;
                return user.userLogin;
            }
            else {
                return this.actor.getDisplayName();
            }
        };
        Redirect.inputCounter = 0;
        return Redirect;
    }());
    AmeRedirectorUi.Redirect = Redirect;
    var TriggerView = /** @class */ (function () {
        function TriggerView(trigger, supportsUserSettings, supportsRoleSettings) {
            var _this = this;
            if (supportsUserSettings === void 0) { supportsUserSettings = null; }
            if (supportsRoleSettings === void 0) { supportsRoleSettings = null; }
            this.users = ko.observableArray([]);
            this.roles = ko.observableArray([]);
            this.supportsUserSettings = true;
            this.supportsRoleSettings = true;
            if (supportsUserSettings !== null) {
                this.supportsUserSettings = supportsUserSettings;
            }
            if (supportsRoleSettings !== null) {
                this.supportsRoleSettings = supportsRoleSettings;
            }
            this.supportsActorSettings = ko.pureComputed(function () {
                return _this.supportsUserSettings || _this.supportsRoleSettings;
            });
            this.defaultRedirect = ko.observable(new Redirect({
                actorId: 'special:default',
                trigger: trigger,
                shortcodesEnabled: true,
                urlTemplate: ''
            }));
        }
        TriggerView.prototype.add = function (item) {
            var actorId = item.actorId;
            if (actorId === DefaultActorId) {
                this.defaultRedirect(item);
            }
            else if (actorId === 'special:super_admin') {
                this.roles.push(item);
            }
            else {
                var actorType = actorId.substring(0, actorId.indexOf(':'));
                switch (actorType) {
                    case 'user':
                        this.users.push(item);
                        break;
                    case 'role':
                        this.roles.push(item);
                        break;
                    default:
                        console.log('Unknown actor type for a trigger view: ' + actorType);
                }
            }
        };
        TriggerView.prototype.toArray = function () {
            var results = [];
            results.push.apply(results, this.users());
            results.push.apply(results, this.roles());
            //Include the default redirect only if it's not empty.
            var defaultRedirect = this.defaultRedirect();
            var url = defaultRedirect.urlTemplate().trim();
            if (url !== '') {
                results.push(defaultRedirect);
            }
            return results;
        };
        return TriggerView;
    }());
    var MenuCollection = /** @class */ (function () {
        function MenuCollection(usableMenuItems) {
            this.menusByTemplate = {};
            this.menusByTemplate = {};
            for (var i = 0; i < usableMenuItems.length; i++) {
                this.menusByTemplate[usableMenuItems[i].templateId] = usableMenuItems[i];
            }
        }
        MenuCollection.prototype.findSelectedMenu = function (redirect) {
            var templateId = redirect.menuTemplateId();
            if (templateId === '') {
                return null;
            }
            if (!this.menusByTemplate.hasOwnProperty(templateId)) {
                return null;
            }
            var menu = this.menusByTemplate[templateId];
            var url = redirect.urlTemplate();
            if (menu.url === url) {
                return menu;
            }
            return null;
        };
        return MenuCollection;
    }());
    var RedirectsByTrigger = /** @class */ (function (_super) {
        __extends(RedirectsByTrigger, _super);
        function RedirectsByTrigger() {
            var _this = _super.call(this) || this;
            _this.login = new TriggerView('login');
            _this.logout = new TriggerView('logout');
            _this.registration = new TriggerView('registration', false, false);
            _this.firstLogin = new TriggerView('firstLogin', false, true);
            return _this;
        }
        RedirectsByTrigger.fromArray = function (redirects) {
            var instance = new RedirectsByTrigger();
            var length = redirects.length;
            for (var i = 0; i < length; i++) {
                var item = redirects[i];
                if (instance.hasOwnProperty(item.trigger)) {
                    var view = instance[item.trigger];
                    view.add(item);
                }
            }
            return instance;
        };
        RedirectsByTrigger.prototype.toArray = function () {
            var results = [];
            for (var key in AllKnownTriggers) {
                if (this.hasOwnProperty(key)) {
                    var view = this[key];
                    results.push.apply(results, view.toArray());
                }
            }
            //Remove redirects that don't have a URL.
            results = results.filter(function (redirect) {
                var url = redirect.urlTemplate().trim();
                return ((typeof url) === 'string') && (url !== '');
            });
            return results;
        };
        return RedirectsByTrigger;
    }(AbstractTriggerDictionary));
    var RedirectUrlInputComponent = /** @class */ (function () {
        function RedirectUrlInputComponent(params) {
            var _this = this;
            this.redirect = ko.unwrap(params.redirect);
            this.menuItems = params.menuItems;
            this.displayValue = ko.computed({
                read: function () {
                    var menu = _this.menuItems.findSelectedMenu(_this.redirect);
                    if (menu) {
                        return menu.title;
                    }
                    else {
                        return _this.redirect.urlTemplate();
                    }
                },
                write: function (value) {
                    var menu = _this.menuItems.findSelectedMenu(_this.redirect);
                    if (menu !== null) {
                        //Can't manually edit the URL because a menu item is selected.
                        return;
                    }
                    _this.redirect.urlTemplate(value);
                }
            });
            this.isUrlReadonly = ko.pureComputed(function () {
                if (_this.menuItems.findSelectedMenu(_this.redirect) !== null) {
                    return true;
                }
                return null;
            });
        }
        return RedirectUrlInputComponent;
    }());
    AmeRedirectorUi.RedirectUrlInputComponent = RedirectUrlInputComponent;
    /**
     * Proxy class that automatically creates placeholders for missing actors.
     */
    var ActorProviderProxy = /** @class */ (function () {
        function ActorProviderProxy(realProvider) {
            this.provider = realProvider;
            this.placeholders = {};
        }
        ActorProviderProxy.prototype.getActor = function (actorId) {
            if (actorId === DefaultActorId) {
                return defaultActor;
            }
            var existingActor = this.provider.getActor(actorId);
            if (existingActor) {
                return existingActor;
            }
            else if (this.placeholders.hasOwnProperty(actorId)) {
                return this.placeholders[actorId];
            }
            //If the actor hasn't been loaded or created by now, that means it has been deleted
            //or it was invalid to begin with. Let's use a placeholder object to represent it.
            var missingActor;
            if (_.startsWith(actorId, 'user:')) {
                missingActor = new MissingUserPlaceholder(actorId);
            }
            else if (_.startsWith(actorId, 'role:')) {
                missingActor = new MissingRolePlaceholder(actorId);
            }
            else {
                missingActor = new MissingActorPlaceholder(actorId);
            }
            this.placeholders[actorId] = missingActor;
            return missingActor;
        };
        return ActorProviderProxy;
    }());
    var MinimalUser = /** @class */ (function (_super) {
        __extends(MinimalUser, _super);
        function MinimalUser() {
            return _super !== null && _super.apply(this, arguments) || this;
        }
        MinimalUser.createFromProperties = function (properties) {
            return new MinimalUser(properties.user_login, properties.display_name, {}, [], false);
        };
        return MinimalUser;
    }(AmeUser));
    AmeRedirectorUi.MinimalUser = MinimalUser;
    var MissingActorPlaceholder = /** @class */ (function () {
        function MissingActorPlaceholder(id, displayName) {
            if (displayName === void 0) { displayName = null; }
            this.actorId = id;
            if (displayName !== null) {
                this.displayName = displayName;
            }
            else {
                this.displayName = this.idWithoutPrefix(id);
            }
        }
        MissingActorPlaceholder.prototype.getDisplayName = function () {
            return this.displayName;
        };
        MissingActorPlaceholder.prototype.getId = function () {
            return this.actorId;
        };
        MissingActorPlaceholder.prototype.idWithoutPrefix = function (actorId) {
            var delimiterPos = actorId.indexOf(':');
            if (delimiterPos < 0) {
                return actorId;
            }
            return actorId.substring(delimiterPos + 1);
        };
        return MissingActorPlaceholder;
    }());
    var MissingRolePlaceholder = /** @class */ (function (_super) {
        __extends(MissingRolePlaceholder, _super);
        function MissingRolePlaceholder() {
            return _super !== null && _super.apply(this, arguments) || this;
        }
        return MissingRolePlaceholder;
    }(MissingActorPlaceholder));
    var MissingUserPlaceholder = /** @class */ (function (_super) {
        __extends(MissingUserPlaceholder, _super);
        function MissingUserPlaceholder(actorId) {
            var _this = _super.call(this, actorId) || this;
            _this.isSuperAdmin = false;
            _this.userLogin = _this.idWithoutPrefix(actorId);
            return _this;
        }
        return MissingUserPlaceholder;
    }(MissingActorPlaceholder));
    var App = /** @class */ (function () {
        function App(settings) {
            var _this = this;
            this.isLoaded = ko.observable(false);
            this.availableTriggers = [
                { trigger: 'login', label: 'Login Redirect' },
                { trigger: 'logout', label: 'Logout Redirect' },
                { trigger: 'registration', label: 'Registration Redirect' },
                { trigger: 'firstLogin', label: 'First Login Redirect' }
            ];
            this.customUrlOption = {
                templateId: '',
                url: '',
                title: '[ Custom URL ]'
            };
            this.ignoreNextDropdownClick = null;
            this.userSelectionUi = 'dropdown';
            var self = this;
            this.actorProvider = new ActorProviderProxy(AmeActors);
            //Users need to be loaded before redirects because redirects use actor objects.
            var loadedUsers = settings.users.map(function (props) {
                var existingInstance = AmeActors.getUser(props.user_login);
                if (existingInstance) {
                    return existingInstance;
                }
                else {
                    var newUser = MinimalUser.createFromProperties(props);
                    AmeActors.addUsers([newUser]);
                    return newUser;
                }
            });
            loadedUsers.sort(function (a, b) {
                return a.userLogin.localeCompare(b.userLogin);
            });
            this.redirects = ko.observableArray(settings.redirects.map(function (props) { return new Redirect(props, _this.actorProvider); }));
            this.menuItems = new MenuCollection(settings.usableMenuItems);
            this.menuDropdownOptions = [this.customUrlOption].concat(settings.usableMenuItems);
            this.menuDropdownParent = ko.observable(null);
            this.selectedMenuDropdownItem = ko.computed({
                read: function () {
                    var currentRedirect = _this.menuDropdownParent();
                    if (currentRedirect === null) {
                        return _this.customUrlOption;
                    }
                    else {
                        //Find the option that matches this template ID and URL.
                        var foundMenu = _this.menuItems.findSelectedMenu(currentRedirect);
                        if (foundMenu === null) {
                            foundMenu = _this.customUrlOption;
                        }
                        return foundMenu;
                    }
                },
                write: function (newValue) {
                    var currentRedirect = _this.menuDropdownParent();
                    if (!currentRedirect) {
                        return; //Nothing to do!
                    }
                    if (!newValue) {
                        newValue = _this.customUrlOption;
                    }
                    currentRedirect.menuTemplateId(newValue.templateId);
                    if (newValue.templateId !== '') {
                        currentRedirect.urlTemplate(newValue.url);
                    }
                },
                owner: self,
                deferEvaluation: true
            });
            this.menuDropdown = jQuery('#ame-rui-menu-items');
            //Hide the dropdown when it loses focus.
            this.menuDropdown.on('blur', function () {
                _this.closeMenuDropdown();
            });
            this.menuDropdown.on('keydown', function (event) {
                //Also hide the dropdown if the user presses Esc.
                if (event.which === 27) {
                    _this.closeMenuDropdown(true);
                }
                else if (event.which === 13) {
                    //Close the dropdown when the user presses Enter.
                    //Since we currently update the redirect on every change, there's no difference between
                    //this and pressing Esc.
                    _this.closeMenuDropdown(true);
                }
            });
            //Close the dropdown when the user selects an option by clicking it.
            this.menuDropdown.on('click', 'option', function () {
                _this.closeMenuDropdown();
            });
            //this.addTestData();
            this.byTrigger = ko.observable(RedirectsByTrigger.fromArray(this.redirects()));
            //Reselect the previous trigger, or just the first trigger.
            this.selectedTrigger = ko.observable(settings.selectedTrigger ? settings.selectedTrigger : this.availableTriggers[0].trigger);
            this.currentTriggerView = ko.pureComputed(function () {
                var trigger = _this.selectedTrigger();
                var mapping = _this.byTrigger();
                if (mapping.hasOwnProperty(trigger) && (mapping[trigger] instanceof TriggerView)) {
                    return mapping[trigger];
                }
                else {
                    return mapping.login;
                }
            });
            this.addableRoles = ko.pureComputed(function () {
                var allRoles = _.values(AmeActors.getRoles());
                var usedRoles = _.map(_this.currentTriggerView().roles(), function (redirect) {
                    return redirect.actor;
                });
                return _.difference(allRoles, usedRoles);
            });
            this.selectedRoleToAdd = ko.observable(void 0);
            this.roleSelectorHasFocus = ko.observable(false);
            this.addableUsers = ko.pureComputed(function () {
                var usedUsers = _.map(_this.currentTriggerView().users(), function (redirect) {
                    return redirect.actor;
                });
                return _.difference(loadedUsers, usedUsers);
            });
            this.selectedUserToAdd = ko.observable(void 0);
            this.userSelectorHasFocus = ko.observable(false);
            this.selectedRoleToAdd.subscribe(function (newSelection) {
                _this.addSelectedActorTo(newSelection, _this.currentTriggerView().roles);
                _this.roleSelectorHasFocus(false);
                _this.selectedRoleToAdd(void 0);
            });
            this.selectedUserToAdd.subscribe(function (newSelection) {
                _this.addSelectedActorTo(newSelection, _this.currentTriggerView().users);
                _this.userSelectorHasFocus(false);
                _this.selectedUserToAdd(void 0);
            });
            this.userLoginQuery = ko.observable('');
            this.addUserButtonEnabled = ko.pureComputed(function () {
                return (_this.userLoginQuery().trim() !== '');
            });
            if (settings.hasMoreUsers) {
                this.userSelectionUi = 'search';
            }
            this.isSaving = ko.observable(false);
            this.settingsData = ko.observable('');
            this.isLoaded(true);
        }
        App.prototype.getSettings = function () {
            return {
                redirects: this.byTrigger().toArray().map(function (redirect) { return redirect.toJs(); })
            };
        };
        App.prototype.onDropdownTrigger = function (event) {
            //Note: There probably is some jQuery feature or library that makes dropdowns easier,
            //but I already did this the hard way.
            var $input = jQuery(event.target).closest('.ame-rui-url-template,ame-redirect-url-input').find('input').first();
            var $node = $input.closest('.ame-rui-redirect');
            if ($node.length < 1) {
                return;
            }
            var redirect = ko.dataFor($node.get(0));
            if (!(redirect instanceof AmeRedirectorUi.Redirect)) {
                return;
            }
            //Clicking the same trigger a second time closes the dropdown.
            if (event.type === 'mousedown') {
                var isSameTrigger = this.menuDropdown.is(':visible') && (this.menuDropdownParent() === redirect);
                if (isSameTrigger) {
                    //The dropdown will be automatically closed by its "blur" event handler,
                    //but we need to ignore the next click event on this element.
                    this.ignoreNextDropdownClick = event.target;
                }
                else {
                    this.ignoreNextDropdownClick = null;
                }
                return;
            }
            if ((event.type === 'click') && (event.target === this.ignoreNextDropdownClick)) {
                return;
            }
            //Move the drop-down near the input box.
            this.menuDropdown
                .css({
                position: 'absolute',
                zIndex: 100 //The dropdown should be displayed above other elements. This may not be required.
            })
                .show()
                .outerWidth(Math.max($input.outerWidth(), 100))
                .position({
                my: 'right top',
                at: 'right bottom',
                of: $input
            });
            //Move focus to the dropdown.
            var $select = this.menuDropdown;
            if (!this.menuDropdown.is('select, input')) {
                $select = this.menuDropdown.find('select, input').first();
            }
            $select.trigger('focus');
            //Select the current option and scroll it into view. It looks like the browser will automatically
            //scroll to the selected option, but only if the select element is already visible, so we need to
            //do this *after* we show the dropdown.
            this.menuDropdownParent(redirect);
        };
        App.prototype.closeMenuDropdown = function (moveFocusToInput) {
            if (moveFocusToInput === void 0) { moveFocusToInput = false; }
            var currentRedirect = this.menuDropdownParent();
            this.menuDropdown.hide();
            this.menuDropdownParent(null);
            //Refocus on the URL input after closing the dropdown.
            if (moveFocusToInput && currentRedirect) {
                currentRedirect.inputHasFocus(true);
            }
        };
        App.prototype.addSelectedActorTo = function (actor, list) {
            //The list includes a caption item that is displayed when nothing is selected.
            //The value of that option is supposed to be undefined.
            if ((typeof actor === 'undefined') || (actor === null) || !this.currentTriggerView()) {
                return;
            }
            //Add a redirect for the selected role.
            var newRedirect = new Redirect({
                actorId: actor.getId(),
                shortcodesEnabled: true,
                urlTemplate: '',
                trigger: this.selectedTrigger()
            }, this.actorProvider);
            list.push(newRedirect);
            newRedirect.inputHasFocus(true);
        };
        App.prototype.addEnteredUserLogin = function () {
            var userLogin = this.userLoginQuery().trim();
            if (userLogin === '') {
                return;
            }
            var actorId = 'user:' + userLogin;
            if (!AmeActors.actorExists(actorId)) {
                if (console && console.warn) {
                    console.warn('User "' + userLogin + '" has not been initialized. Creating a minimal actor now.');
                }
                AmeActors.addUsers([
                    MinimalUser.createFromProperties({
                        user_login: userLogin,
                        display_name: userLogin
                    })
                ]);
            }
            //Only add each user once.
            var alreadyAdded = _.some(this.currentTriggerView().users(), function (redirect) {
                return redirect.actorId === actorId;
            });
            if (alreadyAdded) {
                alert('Error: Duplicate entry. User "' + userLogin + '" has already been added.');
                return;
            }
            var newRedirect = new Redirect({
                actorId: actorId,
                shortcodesEnabled: true,
                urlTemplate: '',
                trigger: this.selectedTrigger()
            }, this.actorProvider);
            this.currentTriggerView().users.push(newRedirect);
            this.userLoginQuery('');
        };
        App.prototype.filterUserAutocompleteResults = function (results) {
            //Filter out users that are already in the current list.
            var usedLogins = _.indexBy(this.currentTriggerView().users(), function (redirect) {
                return redirect.actor.userLogin;
            });
            return _.filter(results, function (props) {
                return !(usedLogins.hasOwnProperty(props.user_login));
            });
        };
        App.prototype.isMissingActor = function (actor) {
            return (actor instanceof MissingActorPlaceholder);
        };
        App.prototype.saveChanges = function () {
            this.isSaving(true);
            this.settingsData(ko.toJSON(this.getSettings()));
            return true;
        };
        App.prototype.addTestData = function () {
            //Add some test data.
            this.redirects.push(new Redirect({
                actorId: 'role:editor',
                urlTemplate: '[wp-admin]edit.php',
                trigger: 'login',
                shortcodesEnabled: true
            }, this.actorProvider));
            this.redirects.push(new Redirect({
                actorId: 'role:author',
                urlTemplate: '[wp-admin]profile.php',
                trigger: 'login',
                shortcodesEnabled: true
            }, this.actorProvider));
            this.redirects.push(new Redirect({
                actorId: 'user:admin',
                urlTemplate: '[wp-admin]index.php',
                trigger: 'login',
                shortcodesEnabled: true
            }, this.actorProvider));
            this.redirects.push(new Redirect({
                actorId: 'role:contributor',
                urlTemplate: '[wp-admin]index.php',
                trigger: 'login',
                shortcodesEnabled: true
            }, this.actorProvider));
            this.redirects.push(new Redirect({
                actorId: 'role:nonexistent',
                urlTemplate: '[wp-admin]options-general.php',
                trigger: 'login',
                shortcodesEnabled: true
            }, this.actorProvider));
            this.redirects.push(new Redirect({
                actorId: 'user:notarealuser',
                urlTemplate: '[wp-admin]index.php',
                trigger: 'login',
                shortcodesEnabled: true
            }, this.actorProvider));
            this.redirects.push(new Redirect({
                actorId: DefaultActorId,
                urlTemplate: '[wp-admin]index.php?this-is-the-default=yep',
                trigger: 'login',
                shortcodesEnabled: true
            }, this.actorProvider));
            this.redirects.push(new Redirect({
                actorId: 'role:administrator',
                urlTemplate: '[wp-admin]options-general.php',
                trigger: 'login',
                shortcodesEnabled: true
            }, this.actorProvider));
        };
        return App;
    }());
    AmeRedirectorUi.App = App;
})(AmeRedirectorUi || (AmeRedirectorUi = {}));
jQuery(function ($) {
    ko.components.register('ame-redirect-url-input', {
        viewModel: AmeRedirectorUi.RedirectUrlInputComponent,
        template: { element: 'ame-redirect-url-component' }
    });
    //The user autocomplete feature is implemented as a custom binding only because that makes it easier
    //to correctly initialise it when Knockout changes the DOM. The binding is not intended to be reusable.
    ko.bindingHandlers.ameRuiUserAutocomplete = {
        init: function (element, valueAccessor) {
            var options = ko.unwrap(valueAccessor());
            options = wsAmeLodash.defaults(options, {
                filter: function (suggestions) {
                    return suggestions;
                }
            });
            jQuery(element).autocomplete({
                minLength: 2,
                source: function (request, response) {
                    var action = AjawV1.getAction('ws-ame-rui-search-users');
                    action.get({ term: request.term }, function (results) {
                        //Filter received users.
                        if (options.filter) {
                            results = options.filter(results);
                        }
                        response(results);
                    }, function (error) {
                        response([]);
                        if (console && console.error) {
                            console.error(error);
                        }
                    });
                },
                select: function (unusedEvent, ui) {
                    var props = ui.item;
                    var existingUser = AmeActors.getUser(props.user_login);
                    if (existingUser === null) {
                        AmeActors.addUsers([AmeRedirectorUi.MinimalUser.createFromProperties(props)]);
                    }
                },
                classes: {
                    'ui-autocomplete': 'ame-rui-found-users'
                }
            });
            ko.utils.domNodeDisposal.addDisposeCallback(element, function () {
                jQuery(element).autocomplete('destroy');
            });
        }
    };
    var $container = $('#ame-redirector-ui-root');
    var ameRedirectorApp = new AmeRedirectorUi.App(wsAmeRedirectorSettings);
    ko.applyBindings(ameRedirectorApp, $container.get(0));
    //Open the menu dropdown when the user clicks the trigger icon or presses
    //the down arrow key in the redirect input field.
    $container.on('mousedown click', '.ame-rui-url-dropdown-trigger', function (event) {
        ameRedirectorApp.onDropdownTrigger(event);
    });
    /*
    Releasing the "down" key only opens the dropdown if the key was pressed in the same input.
    This is to avoid a confusing situation where the user selects a role from the "add a role"
    dropdown using arrow keys and then the menu dropdown immediately shows up because the focus
    moved to the redirect input before the user could release the key.
    */
    var redirectInputSelector = '.ame-rui-url-template input[type=text].ame-rui-has-url-dropdown';
    var lastDownArrowTarget = null;
    $container.on('focus', redirectInputSelector, function () {
        lastDownArrowTarget = null;
    });
    $container.on('keydown', redirectInputSelector, function (event) {
        //Ignore repeated "keydown" events. These will happen even if the key was originally
        //pressed in a different element.
        if ((typeof event.originalEvent['repeat'] !== 'undefined') && (event.originalEvent['repeat'] === true)) {
            return;
        }
        if (event.which === 40) {
            lastDownArrowTarget = event.target;
        }
    });
    $container.on('keyup', redirectInputSelector, function (event) {
        if ((event.which === 40) && (event.target === lastDownArrowTarget)) {
            ameRedirectorApp.onDropdownTrigger(event);
        }
    });
});
