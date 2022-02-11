///<reference path="../../../js/jquery.d.ts"/>
///<reference path="../../../js/common.d.ts"/>
///<reference path="../../../js/lodash-3.10.d.ts"/>

declare var wsAmeLodash: _.LoDashStatic;

ko.extenders['boundedInteger'] = function (
	target: KnockoutObservable<any>,
	options: { minValue: number, maxValue: number }
) {
	if (options.minValue > options.maxValue) {
		throw new Error('Minimum value must be smaller than the maximum value');
	}

	//Create a writable computed observable to intercept writes to our observable.
	let result = ko.pureComputed({
		read: target,
		write: function (newValue) {
			let current = target(),
				newInteger = parseInt(newValue);

			if (isNaN(newInteger)) {
				newInteger = current;
			}

			if (newInteger < options.minValue) {
				newInteger = options.minValue;
			}
			if (newInteger > options.maxValue) {
				newInteger = options.maxValue;
			}

			if (newInteger !== current) {
				target(newInteger);
			} else {
				//If the parsed number is the same as the current value but different from the new value,
				//the new value is probably invalid or incorrectly formatted. Trigger a notification to update
				//the input field with the old number.
				if (String(newValue) !== String(newInteger)) {
					target.notifySubscribers(current);
				}
			}
		}
	}).extend({notify: 'always'});

	//Initialize with the current value.
	result(target());

	return result;
}

type AmeSeparatorColorType = 'transparent' | 'custom';
type AmeSeparatorBorderStyle = 'solid' | 'dashed' | 'dotted' | 'double';
type AmeSeparatorWidthOption = 'full' | 'percentage' | 'fixed';
type AmeSeparatorAlignmentOption = 'none' | 'left' | 'center' | 'right';

interface AmePlainSeparatorTypeSettings {
	colorType: AmeSeparatorColorType;
	customColor: string;

	borderStyle: AmeSeparatorBorderStyle;
	height: number;
	widthStrategy: AmeSeparatorWidthOption;
	widthInPercent: number;
	widthInPixels: number;

	marginTop: number;
	marginBottom: number;
	marginLeft: number;
	marginRight: number;

	alignment: AmeSeparatorAlignmentOption;
}

interface AmePlainSeparatorSettings {
	topLevelSeparators: AmePlainSeparatorTypeSettings;
	submenuSeparators: AmePlainSeparatorTypeSettings;
	useTopLevelSettingsForSubmenus: boolean;
	customSettingsEnabled: boolean;
}

class AmeSeparatorTypeSettings implements AmeObservablePropertiesOf<AmePlainSeparatorTypeSettings> {
	private readonly defaults: AmePlainSeparatorTypeSettings = {
		alignment: 'none',
		borderStyle: 'solid',
		colorType: 'transparent',
		customColor: '',
		height: 5,
		marginBottom: 6,
		marginLeft: 0,
		marginRight: 0,
		marginTop: 0,
		widthInPercent: 100,
		widthInPixels: 160,
		widthStrategy: 'full'
	}

	colorType: KnockoutObservable<AmePlainSeparatorTypeSettings["colorType"]>;
	customColor: KnockoutObservable<AmePlainSeparatorTypeSettings["customColor"]>;
	borderStyle: KnockoutObservable<AmePlainSeparatorTypeSettings["borderStyle"]>;

	height: KnockoutObservable<AmePlainSeparatorTypeSettings["height"]>;
	widthStrategy: KnockoutObservable<AmePlainSeparatorTypeSettings["widthStrategy"]>;
	widthInPercent: KnockoutObservable<AmePlainSeparatorTypeSettings["widthInPercent"]>;
	widthInPixels: KnockoutObservable<AmePlainSeparatorTypeSettings["widthInPixels"]>;

	marginTop: KnockoutObservable<AmePlainSeparatorTypeSettings["marginTop"]>;
	marginLeft: KnockoutObservable<AmePlainSeparatorTypeSettings["marginLeft"]>;
	marginBottom: KnockoutObservable<AmePlainSeparatorTypeSettings["marginBottom"]>;
	marginRight: KnockoutObservable<AmePlainSeparatorTypeSettings["marginRight"]>;

	alignment: KnockoutObservable<AmePlainSeparatorTypeSettings["alignment"]>;

	constructor() {
		this.colorType = ko.observable(this.defaults.colorType);
		this.customColor = ko.observable(this.defaults.customColor);
		this.borderStyle = ko.observable(this.defaults.borderStyle);

		this.height = ko.observable(this.defaults.height).extend({
			boundedInteger: {minValue: 0, maxValue: 300}
		});

		this.widthStrategy = ko.observable(this.defaults.widthStrategy);
		this.widthInPercent = ko.observable(this.defaults.widthInPercent).extend({
			boundedInteger: {minValue: 1, maxValue: 100}
		});
		this.widthInPixels = ko.observable(this.defaults.widthInPixels).extend({
			boundedInteger: {minValue: 1, maxValue: 300}
		});

		this.marginTop = ko.observable(this.defaults.marginTop).extend({
			boundedInteger: {minValue: 0, maxValue: 300}
		});
		this.marginBottom = ko.observable(this.defaults.marginBottom).extend({
			boundedInteger: {minValue: 0, maxValue: 300}
		});
		this.marginLeft = ko.observable(this.defaults.marginLeft).extend({
			boundedInteger: {minValue: 0, maxValue: 300}
		});
		this.marginRight = ko.observable(this.defaults.marginRight).extend({
			boundedInteger: {minValue: 0, maxValue: 300}
		});

		this.alignment = ko.observable(this.defaults.alignment);
	}

	setAll(settings: AmePlainSeparatorTypeSettings) {
		const newSettings: AmePlainSeparatorTypeSettings = wsAmeLodash.defaults({}, settings, this.defaults);

		this.colorType(newSettings.colorType);
		this.customColor(newSettings.customColor);
		this.borderStyle(newSettings.borderStyle);

		this.height(newSettings.height);
		this.widthStrategy(newSettings.widthStrategy)
		this.widthInPixels(newSettings.widthInPixels);
		this.widthInPercent(newSettings.widthInPercent);

		this.marginTop(newSettings.marginTop);
		this.marginBottom(newSettings.marginBottom);
		this.marginLeft(newSettings.marginLeft);
		this.marginRight(newSettings.marginRight);

		this.alignment(newSettings.alignment);
	}

	getAll(): AmePlainSeparatorTypeSettings {
		return {
			colorType: this.colorType(),
			customColor: this.customColor(),
			borderStyle: this.borderStyle(),

			height: this.height(),
			widthStrategy: this.widthStrategy(),
			widthInPercent: this.widthInPercent(),
			widthInPixels: this.widthInPixels(),

			marginBottom: this.marginBottom(),
			marginLeft: this.marginLeft(),
			marginRight: this.marginRight(),
			marginTop: this.marginTop(),

			alignment: this.alignment()
		};
	}

	resetToDefault() {
		this.colorType(this.defaults.colorType);
		this.customColor(this.defaults.customColor);
		this.borderStyle(this.defaults.borderStyle);

		this.height(this.defaults.height);
		this.widthStrategy(this.defaults.widthStrategy)
		this.widthInPixels(this.defaults.widthInPixels);
		this.widthInPercent(this.defaults.widthInPercent);

		this.marginTop(this.defaults.marginTop);
		this.marginBottom(this.defaults.marginBottom);
		this.marginLeft(this.defaults.marginLeft);
		this.marginRight(this.defaults.marginRight);

		this.alignment(this.defaults.alignment);
	}
}

class AmeSeparatorSettingsScreen {
	customSettingsEnabled: KnockoutObservable<boolean>;
	previewEnabled: KnockoutObservable<boolean>;

	topLevelSeparators: AmeSeparatorTypeSettings;
	submenuSeparators: AmeSeparatorTypeSettings;
	useTopLevelSettingsForSubmenus: KnockoutObservable<boolean>;

	currentSavedSettings: AmePlainSeparatorSettings = null;

	currentTypeSettings: KnockoutComputed<AmeSeparatorTypeSettings>;

	activeTab: KnockoutObservable<'top' | 'submenu'>;
	/** Are the settings in the currently active tab enabled? */
	tabSettingsEnabled: KnockoutObservable<boolean>;

	previewCss: KnockoutObservable<string>;

	dialog: JQuery = null;
	isOpen: KnockoutObservable<boolean>;

	constructor() {
		this.customSettingsEnabled = ko.observable(false);
		this.previewEnabled = ko.observable(true);
		this.useTopLevelSettingsForSubmenus = ko.observable(false);

		this.activeTab = ko.observable('top');

		this.topLevelSeparators = new AmeSeparatorTypeSettings();

		this.submenuSeparators = new AmeSeparatorTypeSettings();
		//As an aesthetic choice, the default margins of submenu separators shall match
		//the default padding of submenu items.
		this.submenuSeparators.marginTop(5);
		this.submenuSeparators.marginBottom(5);
		this.submenuSeparators.marginLeft(12);
		this.submenuSeparators.marginRight(12);

		this.currentTypeSettings = ko.computed(() => {
			if (this.activeTab() === 'top') {
				return this.topLevelSeparators;
			} else {
				if (this.useTopLevelSettingsForSubmenus()) {
					return this.topLevelSeparators;
				} else {
					return this.submenuSeparators;
				}
			}
		});

		this.tabSettingsEnabled = ko.pureComputed(() => {
			return (this.activeTab() === 'top') || (!this.useTopLevelSettingsForSubmenus());
		});

		this.isOpen = ko.observable(false);
		this.previewCss = ko.pureComputed(() => {
			if (!this.previewEnabled() || !this.isOpen()) {
				return '';
			}

			let css = this.generatePreviewCss(
				this.topLevelSeparators,
				'#adminmenu li.wp-menu-separator .separator',
				'#adminmenu li.wp-menu-separator'
			);

			//Unlike top level separators, each submenu submenu separator is inside an <a> element that has some
			//default styles. Let's get rid of those to ensure that the separator has the correct size with respect to
			//its list item parent.
			css += '\n#adminmenu .wp-submenu a.wp-menu-separator {' +
				'padding: 0 !important;' +
				'margin: 0 !important;' +
				'}\n';

			css += '\n' + this.generatePreviewCss(
				this.useTopLevelSettingsForSubmenus() ? this.topLevelSeparators : this.submenuSeparators,
				'#adminmenu .wp-submenu .ws-submenu-separator',
				'#adminmenu .wp-submenu .ws-submenu-separator-wrap'
			);

			return css;
		});

		let previewStyleTag = jQuery('<style></style>').appendTo('head');
		this.previewCss.subscribe((css) => {
			previewStyleTag.text(css);
		});
	}

	// noinspection JSUnusedGlobalSymbols Is actually used in Knockout templates.
	selectTab(tabId: string) {
		if ((tabId === 'top') || (tabId === 'submenu')) {
			this.activeTab(tabId);
		}
		return false;
	}

	generatePreviewCss(settings: AmeSeparatorTypeSettings, nodeSelector: string, parentSelector: string): string {
		nodeSelector = wsAmeLodash.trimRight(nodeSelector);
		parentSelector = wsAmeLodash.trimRight(parentSelector);

		let shouldClearFloats = false;

		let parentLines = [
			'height: auto',
			'margin: 0',
			'padding: 0',
			'width: 100%'
		];
		let lines = [];

		let separatorColor = 'transparent';
		if (settings.colorType() !== 'transparent') {
			separatorColor = settings.customColor();
			if (separatorColor === '') {
				separatorColor = 'transparent';
			}
		}

		if (settings.borderStyle() === 'solid') {
			lines.push('border: none');
			lines.push('background-color: ' + separatorColor);
			lines.push('height: ' + settings.height() + 'px');
		} else {
			lines.push('border-top-style: ' + settings.borderStyle());

			lines.push('border-top-width: ' + settings.height() + 'px');
			lines.push('height: 0');

			lines.push('border-color: ' + separatorColor);
			lines.push('background: transparent');
		}

		if (settings.widthStrategy() === 'percentage') {
			lines.push('width: ' + settings.widthInPercent() + '%');
		} else if (settings.widthStrategy() === 'fixed') {
			lines.push('width: ' + settings.widthInPixels() + 'px');
		}

		let effectiveMargins = {
			top: settings.marginTop() + 'px',
			bottom: settings.marginBottom() + 'px',
			left: settings.marginLeft() + 'px',
			right: settings.marginRight() + 'px'
		};

		//Alignment has no meaning for separators that take the full width of the container. Also, applying float
		//would prevent the element from expanding and make it zero-width. So we apply alignment only to separators
		//that have an explicitly specified width.
		if (settings.widthStrategy() !== 'full') {
			if (settings.alignment() === 'center') {
				effectiveMargins.left = 'auto';
				effectiveMargins.right = 'auto';
			} else if ((settings.alignment() === 'left') || (settings.alignment() === 'right')) {
				lines.push('float: ' + settings.alignment());
				shouldClearFloats = true;
			}
		}

		lines.push('margin: ' + effectiveMargins.top + ' ' + effectiveMargins.right + ' '
			+ effectiveMargins.bottom + ' ' + effectiveMargins.left);

		let result = (
			nodeSelector + ' {\n' + lines.join(' !important;\n') + ' !important;\n}\n'
			+ parentSelector + ' {\n' + parentLines.join(' !important;\n') + ' !important;\n}'
		);
		if (shouldClearFloats) {
			result += parentSelector + '::after { content: ""; display: block; clear: both; height: 0; }';
		}
		return result;
	}

	setSettings(settings: AmePlainSeparatorSettings) {
		if (settings === null) {
			this.applyDefaultSettings();
			return;
		}

		this.currentSavedSettings = wsAmeLodash.clone(settings, true);

		this.topLevelSeparators.setAll(settings.topLevelSeparators);
		this.submenuSeparators.setAll(settings.submenuSeparators);
		this.useTopLevelSettingsForSubmenus(settings.useTopLevelSettingsForSubmenus);
		this.customSettingsEnabled(settings.customSettingsEnabled);
	}

	private applyDefaultSettings() {
		this.currentSavedSettings = null;

		this.customSettingsEnabled(false);
		this.previewEnabled(false);
		this.useTopLevelSettingsForSubmenus(true);

		this.topLevelSeparators.resetToDefault();
		this.submenuSeparators.resetToDefault();

		this.submenuSeparators.marginTop(5);
		this.submenuSeparators.marginBottom(5);
		this.submenuSeparators.marginLeft(12);
		this.submenuSeparators.marginRight(12);

		this.activeTab('top');
	}

	getConfirmedSettings(): AmePlainSeparatorSettings {
		return this.currentSavedSettings;
	}

	getDisplayedSettings(): AmePlainSeparatorSettings {
		return {
			topLevelSeparators: this.topLevelSeparators.getAll(),
			submenuSeparators: this.submenuSeparators.getAll(),
			useTopLevelSettingsForSubmenus: this.useTopLevelSettingsForSubmenus(),
			customSettingsEnabled: this.customSettingsEnabled()
		};
	}

	discardChanges() {
		this.setSettings(this.currentSavedSettings);
	}

	// noinspection JSUnusedGlobalSymbols
	onConfirm() {
		this.currentSavedSettings = this.getDisplayedSettings();
		if (this.dialog) {
			this.dialog.dialog('close');
		}
	}

	// noinspection JSUnusedGlobalSymbols
	onCancel() {
		this.discardChanges();
		if (this.dialog) {
			this.dialog.dialog('close');
		}
	}

	setDialog($dialog: JQuery) {
		this.dialog = $dialog;
		$dialog.on('dialogopen', () => {
			this.isOpen(true);
		});
		$dialog.on('dialogclose', () => {
			this.isOpen(false);
		});
	}
}

(function ($) {
	let lastLoadedConfig = null;
	let screen: AmeSeparatorSettingsScreen = null;

	$(document)
		.on('menuConfigurationLoaded.adminMenuEditor', function (event, menuConfiguration) {
			//Load separator settings from the menu configuration.
			if (typeof menuConfiguration['separators'] !== 'undefined') {
				lastLoadedConfig = menuConfiguration['separators'];
			} else {
				lastLoadedConfig = null;
			}
			if (screen) {
				screen.setSettings(lastLoadedConfig);
			}
		})
		.on('getMenuConfiguration.adminMenuEditor', function (event, menuConfiguration) {
			//Store separator settings in the menu configuration.
			const settings = (screen !== null) ? screen.getConfirmedSettings() : lastLoadedConfig;
			if (settings !== null) {
				menuConfiguration['separators'] = settings;
			} else {
				if (typeof menuConfiguration['separators'] !== 'undefined') {
					delete menuConfiguration['separators'];
				}
			}
		});

	jQuery(function ($) {
		const separatorDialog = $('#ws-ame-separator-style-settings');
		let isDialogInitialized = false;

		function initializeSeparatorDialog() {
			screen = new AmeSeparatorSettingsScreen();
			if (lastLoadedConfig !== null) {
				screen.setSettings(lastLoadedConfig);
			}

			separatorDialog.dialog({
				autoOpen: false,
				closeText: ' ',
				draggable: false,
				modal: true,
				minHeight: 400,
				minWidth: 520
			});
			isDialogInitialized = true;

			ko.applyBindings(screen, separatorDialog.get(0));
			screen.setDialog(separatorDialog);
		}

		$('#ws_edit_separator_styles').on('click', function () {
			if (!isDialogInitialized) {
				initializeSeparatorDialog();
			}
			screen.discardChanges();
			separatorDialog.dialog('open');

			//Reset the scroll position.
			separatorDialog.find('.ame-separator-settings-container').scrollTop(0);
		});
	});
})(jQuery);
