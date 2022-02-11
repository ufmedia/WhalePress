///<reference path="../../js/jquery.d.ts"/>
///<reference path="../../js/lodash-3.10.d.ts"/>
///<reference path="../../js/common.d.ts"/>
//Idea: Maybe code generator that generates both TS/KO stuff and PHP classes with validation?
var AmePlainMenuHeadingSettings = /** @class */ (function () {
    function AmePlainMenuHeadingSettings() {
        this.fontWeight = 'normal';
        this.fontSizeValue = 14;
        this.fontSizeUnit = 'px';
        this.fontFamily = null;
        this.textTransform = 'none';
        this.textColorType = 'default';
        this.textColor = '';
        this.backgroundColorType = 'default';
        this.backgroundColor = '';
        this.paddingTop = 8;
        this.paddingBottom = 8;
        this.paddingLeft = 36;
        this.paddingRight = 8;
        this.paddingType = 'auto';
        this.iconVisibility = 'if-collapsed';
        this.bottomBorder = {
            style: 'none',
            width: 1,
            color: ''
        };
        this.collapsible = false;
        this.modificationTimestamp = 0;
    }
    return AmePlainMenuHeadingSettings;
}());
var AmeMenuHeadingSettings = /** @class */ (function () {
    function AmeMenuHeadingSettings() {
        this.defaults = new AmePlainMenuHeadingSettings();
        this.bottomBorder = {
            style: ko.observable(this.defaults.bottomBorder.style),
            color: ko.observable(this.defaults.bottomBorder.color),
            width: ko.observable(this.defaults.bottomBorder.width),
        };
        this.backgroundColor = ko.observable(this.defaults.backgroundColor);
        this.backgroundColorType = ko.observable(this.defaults.backgroundColorType);
        this.fontFamily = ko.observable(this.defaults.fontFamily);
        this.fontSizeUnit = ko.observable(this.defaults.fontSizeUnit);
        this.fontSizeValue = ko.observable(this.defaults.fontSizeValue);
        this.fontWeight = ko.observable(this.defaults.fontWeight);
        this.iconVisibility = ko.observable(this.defaults.iconVisibility);
        this.paddingBottom = ko.observable(this.defaults.paddingBottom);
        this.paddingTop = ko.observable(this.defaults.paddingTop);
        this.paddingLeft = ko.observable(this.defaults.paddingLeft);
        this.paddingRight = ko.observable(this.defaults.paddingRight);
        this.paddingType = ko.observable(this.defaults.paddingType);
        this.textColor = ko.observable(this.defaults.textColor);
        this.textTransform = ko.observable(this.defaults.textTransform);
        this.textColorType = ko.observable(this.defaults.textColorType);
        this.collapsible = ko.observable(this.defaults.collapsible);
        this.modificationTimestamp = ko.observable(this.defaults.modificationTimestamp);
    }
    AmeMenuHeadingSettings.prototype.setAll = function (settings) {
        var newSettings = wsAmeLodash.defaults({}, settings, this.defaults);
        //The default object has all of the valid properties. We can use that to ensure that
        //we only copy or create relevant properties.
        var properties = Object.keys(this.defaults);
        for (var i = 0; i < properties.length; i++) {
            var key = properties[i];
            if (typeof this[key] === 'undefined') {
                this[key] = ko.observable(null);
            }
            if (ko.isWriteableObservable(this[key])) {
                this[key](newSettings[key]);
            }
        }
        if (typeof settings['bottomBorder'] !== 'undefined') {
            this.bottomBorder.style(settings.bottomBorder.style || this.defaults.bottomBorder.style);
            this.bottomBorder.color((typeof settings.bottomBorder.color === 'string')
                ? settings.bottomBorder.color
                : this.defaults.bottomBorder.color);
            var width = this.defaults.bottomBorder.width;
            if (typeof settings.bottomBorder.width === 'string') {
                width = parseInt(settings.bottomBorder.width, 10);
            }
            else if (typeof settings.bottomBorder.width === 'number') {
                width = settings.bottomBorder.width;
            }
            this.bottomBorder.width(width);
        }
    };
    AmeMenuHeadingSettings.prototype.getAll = function () {
        var result = {};
        var properties = Object.keys(this.defaults);
        for (var i = 0; i < properties.length; i++) {
            var key = properties[i];
            if (ko.isObservable(this[key])) {
                result[key] = this[key]();
            }
        }
        result.bottomBorder = {
            style: this.bottomBorder.style(),
            color: this.bottomBorder.color(),
            width: this.bottomBorder.width()
        };
        return result;
    };
    AmeMenuHeadingSettings.prototype.resetToDefault = function () {
        for (var key in this.defaults) {
            if (!this.defaults.hasOwnProperty(key) || !ko.isObservable(this[key])) {
                continue;
            }
            this[key](this.defaults[key]);
        }
        this.bottomBorder.color(this.defaults.bottomBorder.color);
        this.bottomBorder.style(this.defaults.bottomBorder.style);
        this.bottomBorder.width(this.defaults.bottomBorder.width);
    };
    AmeMenuHeadingSettings.prototype.setDefaultFontSize = function (size, units) {
        this.defaults.fontSizeValue = size;
        this.defaults.fontSizeUnit = units;
    };
    return AmeMenuHeadingSettings;
}());
var AmeMenuHeadingSettingsScreen = /** @class */ (function () {
    function AmeMenuHeadingSettingsScreen() {
        this.currentSavedSettings = null;
        this.dialog = null;
        this.settings = new AmeMenuHeadingSettings();
        this.isOpen = ko.observable(false);
    }
    AmeMenuHeadingSettingsScreen.prototype.onConfirm = function () {
        //Change color settings back to default if the user hasn't specified a color.
        if (AmeMenuHeadingSettingsScreen.isEmptyColor(this.settings.textColor())) {
            this.settings.textColorType('default');
        }
        if (AmeMenuHeadingSettingsScreen.isEmptyColor(this.settings.backgroundColor())) {
            this.settings.backgroundColorType('default');
        }
        this.settings.modificationTimestamp(Math.round(Date.now() / 1000));
        this.currentSavedSettings = this.settings.getAll();
        this.closeDialog();
    };
    AmeMenuHeadingSettingsScreen.prototype.onCancel = function () {
        this.discardChanges();
        this.closeDialog();
    };
    AmeMenuHeadingSettingsScreen.prototype.closeDialog = function () {
        if (this.dialog) {
            this.dialog.dialog('close');
        }
    };
    AmeMenuHeadingSettingsScreen.isEmptyColor = function (color) {
        if (typeof color !== 'string') {
            return true;
        }
        return (color === '');
    };
    AmeMenuHeadingSettingsScreen.prototype.setSettings = function (settings) {
        this.currentSavedSettings = settings;
        if (settings === null) {
            this.settings.resetToDefault();
            return;
        }
        this.settings.setAll(settings);
    };
    AmeMenuHeadingSettingsScreen.prototype.getSettings = function () {
        return this.currentSavedSettings;
    };
    AmeMenuHeadingSettingsScreen.prototype.discardChanges = function () {
        if (this.currentSavedSettings !== null) {
            this.settings.setAll(this.currentSavedSettings);
        }
        else {
            this.settings.resetToDefault();
        }
    };
    AmeMenuHeadingSettingsScreen.prototype.setDialog = function ($dialog) {
        this.dialog = $dialog;
    };
    AmeMenuHeadingSettingsScreen.prototype.setDefaultFontSize = function (pixels) {
        this.settings.setDefaultFontSize(pixels, 'px');
    };
    return AmeMenuHeadingSettingsScreen;
}());
(function ($) {
    var screen = null;
    var currentSettings = null;
    $(document)
        .on('menuConfigurationLoaded.adminMenuEditor', function (event, menuConfiguration) {
        currentSettings = menuConfiguration['menu_headings'] || null;
        if (screen) {
            screen.setSettings(currentSettings);
        }
    })
        .on('getMenuConfiguration.adminMenuEditor', function (event, menuConfiguration) {
        var settings = (screen !== null) ? screen.getSettings() : currentSettings;
        if (settings !== null) {
            menuConfiguration['menu_headings'] = settings;
        }
        else {
            delete menuConfiguration['menu_headings'];
        }
    })
        .on('adminMenuEditor:newHeadingCreated', function () {
        //Populate heading settings with default values the first time the user creates a heading.
        //This is necessary to make the PHP module output heading CSS.
        if (!currentSettings && !screen) {
            var defaultSettings = new AmeMenuHeadingSettings();
            currentSettings = defaultSettings.getAll();
        }
    });
    $(function () {
        function getDefaultMenuFontSize() {
            var $menus = $('#adminmenumain #adminmenu li.menu-top')
                .not('.wp-menu-separator')
                .not('.ame-menu-heading-item')
                .slice(0, 5)
                .find('> a');
            var mostCommonSize = wsAmeLodash.chain($menus)
                .countBy(function (menu) {
                return $(menu).css('fontSize');
            })
                .pairs()
                .sortBy(1)
                .last()
                .value();
            if (mostCommonSize && (mostCommonSize.length >= 1) && wsAmeLodash.isString(mostCommonSize[0])) {
                var matches = mostCommonSize[0].match(/^(\d+)px$/i);
                if (matches.length > 0) {
                    var result = parseInt(matches[1], 10);
                    if (result > 0) {
                        return result;
                    }
                }
            }
            return 14; //Default menu font size in WP 5.6.
        }
        var headingDialog = $('#ws-ame-menu-heading-settings');
        var isDialogInitialized = false;
        function initializeHeadingDialog() {
            screen = new AmeMenuHeadingSettingsScreen();
            screen.setDefaultFontSize(getDefaultMenuFontSize());
            if (currentSettings !== null) {
                screen.setSettings(currentSettings);
            }
            headingDialog.dialog({
                autoOpen: false,
                closeText: ' ',
                draggable: false,
                modal: true,
                minHeight: 400,
                minWidth: 520
            });
            isDialogInitialized = true;
            screen.setDialog(headingDialog);
            ko.applyBindings(screen, headingDialog.get(0));
        }
        $('#ws_edit_heading_styles').on('click', function () {
            if (!isDialogInitialized) {
                initializeHeadingDialog();
            }
            screen.discardChanges();
            headingDialog.dialog('open');
        });
    });
})(jQuery);
