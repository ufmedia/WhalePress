///<reference path="../../js/jquery.d.ts"/>
///<reference path="../../js/lodash-3.10.d.ts"/>
///<reference path="../../js/common.d.ts"/>

declare var wsAmeLodash: _.LoDashStatic;

type AmeCssFontWeight = number | 'bold' | 'lighter' | 'bolder' | 'normal' | 'inherit';
type AmeFontSizeUnit = 'px' | 'percentage' | 'em';
type AmeTextTransformOption = 'none' | 'capitalize' | 'uppercase' | 'lowercase' | 'full-width';
type AmeHeadingIconVisibility = 'always' | 'never' | 'if-collapsed';

type AmeHeadingColorType = 'default' | 'custom';
type AmeHeadingPaddingType = 'auto' | 'custom';

//Idea: Maybe code generator that generates both TS/KO stuff and PHP classes with validation?
class AmePlainMenuHeadingSettings {
	fontWeight: AmeCssFontWeight = 'normal';
	fontSizeValue: number = 14;
	fontSizeUnit: AmeFontSizeUnit = 'px';
	fontFamily: string = null;

	textTransform: AmeTextTransformOption = 'none';

	textColorType: AmeHeadingColorType = 'default';
	textColor: string = '';
	backgroundColorType: AmeHeadingColorType = 'default';
	backgroundColor: string = '';

	paddingTop: number = 8;
	paddingBottom: number = 8;
	paddingLeft: number = 36;
	paddingRight: number = 8;
	paddingType: AmeHeadingPaddingType = 'auto';

	iconVisibility: AmeHeadingIconVisibility = 'if-collapsed';

	bottomBorder: AmeCssBorderSettings = {
		style: 'none',
		width: 1,
		color: ''
	};

	collapsible: boolean = false;

	modificationTimestamp: number = 0;
}

interface IAmePlainMenuHeadingSettings extends AmePlainMenuHeadingSettings {
}

class AmeMenuHeadingSettings implements AmeRecursiveObservablePropertiesOf<IAmePlainMenuHeadingSettings> {
	protected defaults: IAmePlainMenuHeadingSettings;

	backgroundColor: KnockoutObservable<IAmePlainMenuHeadingSettings["backgroundColor"]>;
	bottomBorder: {
		style: KnockoutObservable<AmeCssBorderSettings["style"]>;
		color: KnockoutObservable<AmeCssBorderSettings["color"]>;
		width: KnockoutObservable<AmeCssBorderSettings["width"]>;
	};
	fontFamily: KnockoutObservable<IAmePlainMenuHeadingSettings["fontFamily"]>;
	fontSizeUnit: KnockoutObservable<IAmePlainMenuHeadingSettings["fontSizeUnit"]>;
	fontSizeValue: KnockoutObservable<IAmePlainMenuHeadingSettings["fontSizeValue"]>;
	fontWeight: KnockoutObservable<IAmePlainMenuHeadingSettings["fontWeight"]>;
	iconVisibility: KnockoutObservable<IAmePlainMenuHeadingSettings["iconVisibility"]>;
	paddingBottom: KnockoutObservable<IAmePlainMenuHeadingSettings["paddingBottom"]>;
	paddingLeft: KnockoutObservable<IAmePlainMenuHeadingSettings["paddingLeft"]>;
	paddingRight: KnockoutObservable<IAmePlainMenuHeadingSettings["paddingRight"]>;
	paddingTop: KnockoutObservable<IAmePlainMenuHeadingSettings["paddingTop"]>;
	paddingType: KnockoutObservable<IAmePlainMenuHeadingSettings["paddingType"]>;
	textColor: KnockoutObservable<IAmePlainMenuHeadingSettings["textColor"]>;
	textTransform: KnockoutObservable<IAmePlainMenuHeadingSettings["textTransform"]>;
	backgroundColorType: KnockoutObservable<IAmePlainMenuHeadingSettings["backgroundColorType"]>;
	textColorType: KnockoutObservable<IAmePlainMenuHeadingSettings["textColorType"]>;
	collapsible: KnockoutObservable<IAmePlainMenuHeadingSettings["collapsible"]>;
	modificationTimestamp: KnockoutObservable<IAmePlainMenuHeadingSettings["modificationTimestamp"]>;

	constructor() {
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

	setAll(settings: AmePlainMenuHeadingSettings) {
		const newSettings = wsAmeLodash.defaults({}, settings, this.defaults);

		//The default object has all of the valid properties. We can use that to ensure that
		//we only copy or create relevant properties.
		const properties = Object.keys(this.defaults);

		for (let i = 0; i < properties.length; i++) {
			const key = properties[i];
			if (typeof this[key] === 'undefined') {
				this[key] = ko.observable(null);
			}
			if (ko.isWriteableObservable(this[key])) {
				this[key](newSettings[key]);
			}
		}

		if (typeof settings['bottomBorder'] !== 'undefined') {
			this.bottomBorder.style(settings.bottomBorder.style || this.defaults.bottomBorder.style);
			this.bottomBorder.color(
				(typeof settings.bottomBorder.color === 'string')
					? settings.bottomBorder.color
					: this.defaults.bottomBorder.color
			);

			let width = this.defaults.bottomBorder.width;
			if (typeof settings.bottomBorder.width === 'string') {
				width = parseInt(settings.bottomBorder.width, 10);
			} else if (typeof settings.bottomBorder.width === 'number') {
				width = settings.bottomBorder.width;
			}
			this.bottomBorder.width(width);
		}
	}

	getAll(): AmePlainMenuHeadingSettings {
		let result: Partial<AmePlainMenuHeadingSettings> = {};
		const properties = Object.keys(this.defaults);
		for (let i = 0; i < properties.length; i++) {
			const key = properties[i];
			if (ko.isObservable(this[key])) {
				result[key] = this[key]();
			}
		}

		result.bottomBorder = {
			style: this.bottomBorder.style(),
			color: this.bottomBorder.color(),
			width: this.bottomBorder.width()
		};

		return result as AmePlainMenuHeadingSettings;
	}

	resetToDefault() {
		for (let key in this.defaults) {
			if (!this.defaults.hasOwnProperty(key) || !ko.isObservable(this[key])) {
				continue;
			}
			this[key](this.defaults[key]);
		}

		this.bottomBorder.color(this.defaults.bottomBorder.color);
		this.bottomBorder.style(this.defaults.bottomBorder.style);
		this.bottomBorder.width(this.defaults.bottomBorder.width);
	}

	setDefaultFontSize(size: number, units: AmeFontSizeUnit) {
		this.defaults.fontSizeValue = size;
		this.defaults.fontSizeUnit = units;
	}
}

class AmeMenuHeadingSettingsScreen {
	private currentSavedSettings: AmePlainMenuHeadingSettings = null;
	settings: AmeMenuHeadingSettings;

	dialog: JQuery = null;
	isOpen: KnockoutObservable<boolean>;

	constructor() {
		this.settings = new AmeMenuHeadingSettings();
		this.isOpen = ko.observable(false);
	}

	onConfirm() {
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
	}

	onCancel() {
		this.discardChanges();
		this.closeDialog();
	}

	protected closeDialog() {
		if (this.dialog) {
			this.dialog.dialog('close');
		}
	}

	private static isEmptyColor(color: any): boolean {
		if (typeof color !== 'string') {
			return true;
		}
		return (color === '');
	}

	setSettings(settings: IAmePlainMenuHeadingSettings) {
		this.currentSavedSettings = settings;
		if (settings === null) {
			this.settings.resetToDefault();
			return;
		}

		this.settings.setAll(settings);
	}

	getSettings(): IAmePlainMenuHeadingSettings {
		return this.currentSavedSettings;
	}

	discardChanges() {
		if (this.currentSavedSettings !== null) {
			this.settings.setAll(this.currentSavedSettings);
		} else {
			this.settings.resetToDefault();
		}
	}

	setDialog($dialog: JQuery) {
		this.dialog = $dialog;
	}

	setDefaultFontSize(pixels: number) {
		this.settings.setDefaultFontSize(pixels, 'px');
	}
}

(function ($) {
	let screen: AmeMenuHeadingSettingsScreen = null;
	let currentSettings: IAmePlainMenuHeadingSettings = null;

	$(document)
		.on('menuConfigurationLoaded.adminMenuEditor', function (event, menuConfiguration) {
			currentSettings = menuConfiguration['menu_headings'] || null;
			if (screen) {
				screen.setSettings(currentSettings);
			}
		})
		.on('getMenuConfiguration.adminMenuEditor', function (event, menuConfiguration) {
			const settings = (screen !== null) ? screen.getSettings() : currentSettings;
			if (settings !== null) {
				menuConfiguration['menu_headings'] = settings;
			} else {
				delete menuConfiguration['menu_headings'];
			}
		})
		.on('adminMenuEditor:newHeadingCreated', function () {
			//Populate heading settings with default values the first time the user creates a heading.
			//This is necessary to make the PHP module output heading CSS.
			if (!currentSettings && !screen) {
				const defaultSettings = new AmeMenuHeadingSettings();
				currentSettings = defaultSettings.getAll();
			}
		});

	$(function () {
		function getDefaultMenuFontSize(): number {
			const $menus = $('#adminmenumain #adminmenu li.menu-top')
				.not('.wp-menu-separator')
				.not('.ame-menu-heading-item')
				.slice(0, 5)
				.find('> a');

			const mostCommonSize = wsAmeLodash.chain($menus)
				.countBy(function (menu) {
					return $(menu).css('fontSize');
				})
				.pairs()
				.sortBy(1)
				.last()
				.value();

			if (mostCommonSize && (mostCommonSize.length >= 1) && wsAmeLodash.isString(mostCommonSize[0])) {
				let matches = mostCommonSize[0].match(/^(\d+)px$/i);
				if (matches.length > 0) {
					let result = parseInt(matches[1], 10);
					if (result > 0) {
						return result;
					}
				}
			}
			return 14; //Default menu font size in WP 5.6.
		}

		const headingDialog = $('#ws-ame-menu-heading-settings');
		let isDialogInitialized = false;

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