/// <reference path="../../../js/knockout.d.ts" />
/// <reference path="../../../js/jquery.d.ts" />
/// <reference path="../../../js/jquery.biscuit.d.ts" />
/// <reference path="../../../js/lodash-3.10.d.ts" />
/// <reference path="../../../modules/actor-selector/actor-selector.ts" />
var AmeSuperUsers = /** @class */ (function () {
    function AmeSuperUsers(settings) {
        var _this = this;
        this.addButtonText = 'Add User';
        this.userEditUrl = settings.userEditUrl;
        this.currentUserLogin = settings.currentUserLogin;
        this.superUsers = ko.observableArray([]);
        AmeSuperUsers._.forEach(settings.superUsers, function (userDetails) {
            var user = AmeUser.createFromProperties(userDetails);
            if (!AmeActors.getUser(user.userLogin)) {
                AmeActors.addUsers([user]);
            }
            _this.superUsers.push(user);
        });
        this.superUsers.sort(AmeSuperUsers.compareLogins);
        this.settingsData = ko.computed(function () {
            return AmeSuperUsers._.map(_this.superUsers(), 'userId').join(',');
        });
        //Store the state of the info box in a cookie.
        var initialState = jQuery.cookie('ame_su_info_box_open');
        var _isBoxOpen = ko.observable((typeof initialState === 'undefined') ? true : (initialState === '1'));
        this.isInfoBoxOpen = ko.computed({
            read: function () {
                return _isBoxOpen();
            },
            write: function (value) {
                jQuery.cookie('ame_su_info_box_open', value ? '1' : '0', { expires: 90 });
                _isBoxOpen(value);
            }
        });
    }
    AmeSuperUsers.prototype.removeUser = function (user) {
        this.superUsers.remove(user);
    };
    AmeSuperUsers.prototype.getEditLink = function (user) {
        return this.userEditUrl + '?user_id=' + user.userId;
    };
    AmeSuperUsers.prototype.selectHiddenUsers = function () {
        var _this = this;
        AmeSelectUsersDialog.open({
            selectedUsers: AmeSuperUsers._.map(this.superUsers(), 'userLogin'),
            users: AmeSuperUsers._.indexBy(this.superUsers(), 'userLogin'),
            actorManager: AmeActors,
            currentUserLogin: this.currentUserLogin,
            alwaysIncludeCurrentUser: false,
            save: function (selectedUsers) {
                selectedUsers.sort(AmeSuperUsers.compareLogins);
                _this.superUsers(selectedUsers);
            }
        });
    };
    AmeSuperUsers.compareLogins = function (a, b) {
        if (a.userLogin > b.userLogin) {
            return 1;
        }
        else if (a.userLogin < b.userLogin) {
            return -1;
        }
        return 0;
    };
    AmeSuperUsers.prototype.formatUserRoles = function (user) {
        var displayNames = AmeSuperUsers._.map(user.roles, function (roleId) {
            var actor = AmeActors.getActor('role:' + roleId);
            if (actor) {
                return actor.displayName;
            }
            else {
                return '[Unknown role]';
            }
        });
        return displayNames.join(', ');
    };
    AmeSuperUsers.prototype.toggleInfoBox = function () {
        this.isInfoBoxOpen(!this.isInfoBoxOpen());
    };
    AmeSuperUsers._ = wsAmeLodash;
    return AmeSuperUsers;
}());
jQuery(function () {
    var superUserVM = new AmeSuperUsers(wsAmeSuperUserSettings);
    ko.applyBindings(superUserVM, document.getElementById('ame-super-user-settings'));
});
