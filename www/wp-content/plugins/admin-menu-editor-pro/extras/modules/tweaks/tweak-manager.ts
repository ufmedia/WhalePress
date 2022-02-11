/// <reference path="../../../js/knockout.d.ts" />
/// <reference path="../../../js/jquery.d.ts" />
/// <reference path="../../../js/lodash-3.10.d.ts" />
/// <reference path="../../../modules/actor-selector/actor-selector.ts" />
/// <reference path="../../../js/jquery.biscuit.d.ts" />
/// <reference path="../../ko-extensions.ts" />

declare let ameTweakManager: AmeTweakManagerModule;
declare const wsTweakManagerData: AmeTweakManagerScriptData;

declare const wp: {
	codeEditor: {
		initialize: (textarea: string, options: object) => any;
	};
};

interface AmeTweakManagerScriptData {
	selectedActor: string;
	isProVersion: boolean;
	tweaks: AmeTweakProperties[];
	sections: AmeSectionProperties[];
	lastUserTweakSuffix: number;
	defaultCodeEditorSettings: Record<string, any>;
}

interface AmeNamedNodeProperties {
	id: string;
	label: string;
}

abstract class AmeNamedNode {
	id: string;
	label: string | KnockoutObservable<string>;
	htmlId: string = '';

	protected constructor(properties: AmeNamedNodeProperties) {
		this.id = properties.id;
		this.label = properties.label;
	}
}

interface AmeSettingsGroupProperties extends AmeNamedNodeProperties {
	children: ConfigurationNodeProperties[];
	propertyPath?: string | null;
}

function isAmeSettingsGroupProperties(thing: AmeNamedNodeProperties): thing is AmeSettingsGroupProperties {
	const group = thing as AmeSettingsGroupProperties;
	return (typeof group.children !== 'undefined');
}

interface AmeSettingProperties extends AmeNamedNodeProperties {
	dataType: string;
	inputType: string | null;
	defaultValue?: any;
}

function isAmeSettingProperties(thing: AmeNamedNodeProperties): thing is AmeSettingProperties {
	return (typeof (thing as AmeSettingProperties).dataType === 'string');
}

abstract class AmeSetting extends AmeNamedNode {
	protected static idCounter = 0;

	// noinspection JSUnusedGlobalSymbols Used in Knockout templates.
	templateName: string;
	inputValue: KnockoutObservable<any>;
	readonly uniqueInputId: string;

	protected constructor(properties: AmeSettingProperties, store: AmeSettingStore, path: string[] = []) {
		super(properties);
		let defaultValue = null;
		if (typeof properties.defaultValue !== 'undefined') {
			defaultValue = properties.defaultValue;
		}
		this.inputValue = store.getObservableProperty(properties.id, defaultValue, path);

		AmeSetting.idCounter++;
		this.uniqueInputId = 'ws-ame-gen-setting-' + AmeSetting.idCounter;
	}
}

interface AmeStringSettingProperties extends AmeSettingProperties {
	syntaxHighlighting?: string;
}

class AmeStringSetting extends AmeSetting {
	syntaxHighlightingOptions: object = null;

	constructor(
		properties: AmeStringSettingProperties,
		module: AmeTweakManagerModule,
		store: AmeSettingStore,
		path: string[] = []
	) {
		super(properties, store, path);
		this.templateName = 'ame-tweak-textarea-input-template';

		if (properties.syntaxHighlighting && module) {
			this.syntaxHighlightingOptions = module.getCodeMirrorOptions(properties.syntaxHighlighting);
		}
	}
}

class AmeColorSetting extends AmeSetting {
	constructor(
		properties: AmeStringSettingProperties,
		store: AmeSettingStore,
		path: string[] = []
	) {
		super(properties, store, path);
		this.templateName = 'ame-tweak-color-input-template';
	}
}

class AmeBooleanSetting extends AmeSetting {
	public templateName: string = 'ame-tweak-boolean-input-template';

	constructor(
		properties: AmeStringSettingProperties,
		store: AmeSettingStore,
		path: string[] = []
	) {
		super(properties, store, path);

		//Ensure that the value is always a boolean.
		let _internalValue = this.inputValue;
		if (typeof _internalValue() !== 'boolean') {
			_internalValue(!!_internalValue());
		}

		this.inputValue = ko.computed<boolean>({
			read: function () {
				return _internalValue();
			},
			write: function (newValue) {
				if (typeof newValue !== 'boolean') {
					newValue = !!newValue;
				}
				_internalValue(newValue);
			},
			owner: this
		});
	}
}

interface AmeActorFeatureProperties extends AmeSettingsGroupProperties {
	hasAccessMap: true;
	defaultAccessMap?: AmeDictionary<boolean>;
	enabledForActor?: AmeDictionary<boolean>;
}

function isAmeActorFeatureProperties(thing: AmeNamedNodeProperties): thing is AmeActorFeatureProperties {
	return (typeof (thing as AmeActorFeatureProperties).hasAccessMap === 'boolean');
}

type ConfigurationNodeProperties = AmeActorFeatureProperties | AmeSettingProperties | AmeSettingsGroupProperties;

class AmeSettingStore {
	private observableProperties: Record<string, KnockoutObservable<any>> = {};
	private accessMaps: Record<string, AmeObservableActorSettings> = {};
	private readonly initialProperties: Record<string, any>;

	constructor(initialProperties: Record<string, any> = {}) {
		this.initialProperties = initialProperties;
	}

	getObservableProperty<T>(name: string, defaultValue: T, path: string | string[] = []): KnockoutObservable<T> {
		path = this.getFullPath(name, path);

		if (this.observableProperties.hasOwnProperty(path)) {
			return this.observableProperties[path];
		}

		const _ = AmeTweakManagerModule._;
		const value = _.get(this.initialProperties, path, defaultValue);
		const observable = ko.observable(value);
		this.observableProperties[path] = observable;
		return observable;
	}

	protected getFullPath(name: string, path: string | string[]): string {
		if (typeof path !== 'string') {
			path = path.join('.');
		}
		if (path === '') {
			path = name;
		} else {
			path = path + '.' + name;
		}
		return path;
	}

	propertiesToJs(): Record<string, any> {
		const _ = AmeTweakManagerModule._;
		let newProps = {};
		_.forOwn(this.observableProperties, function (observable, path) {
			_.set(newProps, path, observable());
		});

		_.forOwn(this.accessMaps, function (map, path: string) {
			//Since all tweaks are disabled by default, having a tweak disabled for a role is the same
			//as not having a setting, so we can save some space by removing it. This does not always
			//apply to users/Super Admins because they can have precedence over roles.
			let temp = map.getAll();
			let enabled: AmeDictionary<boolean> = {};
			let areAllFalse = true;
			for (let actorId in temp) {
				if (!temp.hasOwnProperty(actorId)) {
					continue;
				}

				areAllFalse = areAllFalse && (!temp[actorId]);
				if (!temp[actorId]) {
					const actor = AmeActors.getActor(actorId);
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
	}

	getAccessMap(
		name: string,
		path: string | string[] = [],
		defaultAccessMap: AmeDictionary<boolean> | null = null
	): AmeObservableActorSettings {
		path = this.getFullPath(name, path);
		const _ = AmeTweakManagerModule._;
		const value = _.get(this.initialProperties, path, defaultAccessMap);

		if (!this.accessMaps.hasOwnProperty(path)) {
			this.accessMaps[path] = new AmeObservableActorSettings(value);

		}
		return this.accessMaps[path];
	}
}

function isSettingStore(thing: object): thing is AmeSettingStore {
	const maybe = thing as AmeSettingStore;
	return (typeof maybe.getObservableProperty !== 'undefined') && (typeof maybe.propertiesToJs !== 'undefined');
}

class AmeCompositeNode extends AmeNamedNode {
	children: KnockoutObservableArray<AmeNamedNode> = null;
	propertyPath: string[];
	actorAccess: AmeActorAccess;
	properties: AmeSettingStore;

	constructor(
		properties: ConfigurationNodeProperties,
		module: AmeTweakManagerModule,
		store: AmeSettingStore | 'self' = null,
		path: string[] = []
	) {
		super(properties);
		this.id = properties.id;
		this.label = properties.label;

		if (store === 'self') {
			if (!this.properties) {
				this.properties = new AmeSettingStore(properties);
			}
			store = this.properties;
		}

		if (isAmeSettingsGroupProperties(properties)) {
			if ((typeof properties.propertyPath === 'string') && (properties.propertyPath !== '')) {
				this.propertyPath = properties.propertyPath.split('.');
			} else {
				this.propertyPath = [];
			}
			if (path.length > 0) {
				this.propertyPath = path.concat(this.propertyPath);
			}

			let children = [];
			if (properties.children && (properties.children.length > 0)) {
				for (let i = 0; i < properties.children.length; i++) {
					const props = properties.children[i];
					let child;
					if (isAmeSettingProperties(props)) {
						child = AmeCompositeNode.createSetting(props, module, store, this.propertyPath);
					} else {
						child = new AmeCompositeNode(props, module, store, this.propertyPath);
					}
					if (child) {
						children.push(child);
					}
				}
			}

			this.children = ko.observableArray(children);
		}

		if (isAmeActorFeatureProperties(properties)) {
			let name = (store === this.properties) ? 'enabledForActor' : this.id;
			const defaultAccess = (typeof properties.defaultAccessMap !== 'undefined') ? properties.defaultAccessMap : null;
			this.actorAccess = new AmeActorAccess(
				store.getAccessMap(name, path, defaultAccess),
				module,
				this.children
			);
		}
	}

	static createSetting(
		properties: AmeSettingProperties,
		module: AmeTweakManagerModule,
		store: AmeSettingStore,
		path: string[] = []
	): AmeSetting {
		const inputType = properties.inputType ? properties.inputType : properties.dataType;

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
	}
}

class AmeActorAccess {
	isChecked: KnockoutComputed<boolean>;
	protected enabledForActor: AmeObservableActorSettings;
	protected module: AmeTweakManagerModule;
	isIndeterminate: KnockoutComputed<boolean>;

	constructor(
		actorSettings: AmeObservableActorSettings,
		module: AmeTweakManagerModule,
		children: AmeCompositeNode['children'] = null
	) {
		this.module = module;
		this.enabledForActor = actorSettings;

		let _isIndeterminate = ko.observable<boolean>(false);
		this.isIndeterminate = ko.computed<boolean>(() => {
			if (module.selectedActor() !== null) {
				return false;
			}
			return _isIndeterminate();
		});

		this.isChecked = ko.computed<boolean>({
			read: () => {
				const selectedActor = this.module.selectedActor();

				if (selectedActor === null) {
					//All: Checked only if it's checked for all actors.
					const allActors = this.module.actorSelector.getVisibleActors();
					let isEnabledForAll = true, isEnabledForAny = false;
					for (let index = 0; index < allActors.length; index++) {
						if (this.enabledForActor.get(allActors[index].getId(), false)) {
							isEnabledForAny = true;
						} else {
							isEnabledForAll = false;
						}
					}

					_isIndeterminate(isEnabledForAny && !isEnabledForAll);

					return isEnabledForAll;
				}

				//Is there an explicit setting for this actor?
				let ownSetting = this.enabledForActor.get(selectedActor.getId(), null);
				if (ownSetting !== null) {
					return ownSetting;
				}

				if (selectedActor instanceof AmeUser) {
					//The "Super Admin" setting takes precedence over regular roles.
					if (selectedActor.isSuperAdmin) {
						let superAdminSetting = this.enabledForActor.get(AmeSuperAdmin.permanentActorId, null);
						if (superAdminSetting !== null) {
							return superAdminSetting;
						}
					}

					//Is it enabled for any of the user's roles?
					for (let i = 0; i < selectedActor.roles.length; i++) {
						let groupSetting = this.enabledForActor.get('role:' + selectedActor.roles[i], null);
						if (groupSetting === true) {
							return true;
						}
					}
				}

				//All tweaks are unchecked by default.
				return false;
			},
			write: (checked: boolean) => {
				const selectedActor = this.module.selectedActor();
				if (selectedActor === null) {
					//Enable/disable this tweak for all actors.
					if (checked === false) {
						//Since false is the default, this is the same as removing/resetting all values.
						this.enabledForActor.resetAll();
					} else {
						const allActors = this.module.actorSelector.getVisibleActors();
						for (let i = 0; i < allActors.length; i++) {
							this.enabledForActor.set(allActors[i].getId(), checked);
						}
					}
				} else {
					this.enabledForActor.set(selectedActor.getId(), checked);
				}

				//Apply the same setting to all children.
				if (children) {
					const childrenArray = children();
					for (let i = 0; i < childrenArray.length; i++) {
						const child = childrenArray[i];
						if ((child instanceof AmeCompositeNode) && child.actorAccess) {
							child.actorAccess.isChecked(checked);
						}
					}
				}
			}
		});
	}
}

interface AmeSavedTweakProperties {
	id: string;
	enabledForActor?: AmeDictionary<boolean>;
}

interface AmeTweakProperties extends AmeSavedTweakProperties, AmeActorFeatureProperties {
	description?: string;
	parentId?: string;
	sectionId?: string;

	isUserDefined?: boolean;
	typeId?: string;

	//User-defined tweaks can have additional arbitrary properties.
	[key: string]: any;
}

class AmeTweakItem extends AmeCompositeNode {
	label: KnockoutObservable<string>;

	public readonly isUserDefined: boolean;
	private readonly initialProperties: AmeSavedTweakProperties = null;

	private section: AmeTweakSection = null;
	private parent: AmeTweakItem = null;

	constructor(properties: AmeTweakProperties, module: AmeTweakManagerModule) {
		super(properties, module, 'self');

		this.isUserDefined = properties.isUserDefined ? properties.isUserDefined : false;
		if (this.isUserDefined) {
			this.initialProperties = properties;
		}

		if (this.isUserDefined) {
			this.label = ko.observable(properties.label);
		} else {
			this.label = ko.pureComputed(function () {
				return properties.label;
			});
		}

		this.htmlId = 'ame-tweak-' + AmeTweakManagerModule.slugify(this.id);
	}

	toJs(): AmeSavedTweakProperties {
		let result: AmeSavedTweakProperties = {
			id: this.id
		};

		const _ = AmeTweakManagerModule._;
		if (this.properties) {
			result = _.defaults(result, this.properties.propertiesToJs());
		}

		if (!this.isUserDefined) {
			return result;
		} else {
			let props: AmeTweakProperties = result as AmeTweakProperties;
			props.isUserDefined = this.isUserDefined;
			props.label = this.label();
			props.sectionId = this.section ? this.section.id : null;
			props.parentId = this.parent ? this.parent.id : null;

			props = _.defaults(
				props,
				_.omit(this.initialProperties, 'userInputValue', 'enabledForActor')
			);
			return props;
		}
	}

	setSection(section: AmeTweakSection) {
		this.section = section;
		return this;
	}

	setParent(tweak: AmeTweakItem) {
		this.parent = tweak;
		return this;
	}

	getSection(): AmeTweakSection {
		return this.section;
	}

	getParent(): AmeTweakItem {
		return this.parent;
	}

	addChild(tweak: AmeTweakItem) {
		this.children.push(tweak);
		tweak.setParent(this);
		return this;
	}

	removeChild(tweak: AmeTweakItem) {
		this.children.remove(tweak);
	}

	getEditableProperty(key: string): KnockoutObservable<any> {
		if (this.properties) {
			return this.properties.getObservableProperty(key, '');
		}
	}

	getTypeId(): string | null {
		if (!this.isUserDefined || !this.initialProperties) {
			return null;
		}
		if ((this.initialProperties as AmeTweakProperties).typeId) {
			return (this.initialProperties as AmeTweakProperties).typeId;
		}
		return null;
	}
}

interface AmeSectionProperties {
	id: string;
	label: string;
	priority: number | null;
}

class AmeTweakSection {
	id: string;
	label: string;
	tweaks: KnockoutObservableArray<AmeTweakItem>;
	isOpen: KnockoutObservable<boolean>;

	footerTemplateName: string = null;

	constructor(properties: AmeSectionProperties) {
		this.id = properties.id;
		this.label = properties.label;
		this.isOpen = ko.observable<boolean>(true);
		this.tweaks = ko.observableArray([]);
	}

	addTweak(tweak: AmeTweakItem) {
		this.tweaks.push(tweak);
		tweak.setSection(this);
	}

	removeTweak(tweak: AmeTweakItem) {
		this.tweaks.remove(tweak);
	}

	hasContent() {
		return this.tweaks().length > 0;
	}

	toggle() {
		this.isOpen(!this.isOpen());
	}
}

class AmeTweakManagerModule {
	static _ = wsAmeLodash;
	static readonly openSectionCookieName = 'ame_tmce_open_sections';

	readonly actorSelector: AmeActorSelector;
	selectedActorId: KnockoutComputed<string>;
	selectedActor: KnockoutComputed<IAmeActor>;

	private tweaksById: { [id: string]: AmeTweakItem } = {};
	private sectionsById: AmeDictionary<AmeTweakSection> = {};
	sections: AmeTweakSection[] = [];

	settingsData: KnockoutObservable<string>;
	isSaving: KnockoutObservable<boolean>;

	private readonly openSectionIds: KnockoutComputed<string[]>;

	readonly adminCssEditorDialog: AmeEditAdminCssDialog;
	private lastUserTweakSuffix: number = 0;

	public readonly cssHighlightingOptions: Record<string, any>;

	constructor(scriptData: AmeTweakManagerScriptData) {
		const _ = AmeTweakManagerModule._;

		this.actorSelector = new AmeActorSelector(AmeActors, scriptData.isProVersion);
		this.selectedActorId = this.actorSelector.createKnockoutObservable(ko);
		this.selectedActor = ko.computed<IAmeActor>(() => {
			const id = this.selectedActorId();
			if (id === null) {
				return null;
			}
			return AmeActors.getActor(id);
		});

		//Reselect the previously selected actor.
		this.selectedActorId(scriptData.selectedActor);

		//Set syntax highlighting options.
		this.cssHighlightingOptions = _.merge(
			{},
			scriptData.defaultCodeEditorSettings,
			{
				'codemirror': {
					'mode': 'css',
					'lint': true,
					'autoCloseBrackets': true,
					'matchBrackets': true
				}
			}
		);

		//Sort sections by priority, then by label.
		let sectionData = _.sortByAll(scriptData.sections, ['priority', 'label']);
		//Register sections.
		_.forEach(sectionData, (properties) => {
			let section = new AmeTweakSection(properties);
			this.sectionsById[section.id] = section;
			this.sections.push(section);
		});
		const firstSection = this.sections[0];

		_.forEach(scriptData.tweaks, (properties) => {
			const tweak = new AmeTweakItem(properties, this);
			this.tweaksById[tweak.id] = tweak;

			if (properties.parentId && this.tweaksById.hasOwnProperty(properties.parentId)) {
				this.tweaksById[properties.parentId].addChild(tweak);
			} else {
				let ownerSection = firstSection;
				if (properties.sectionId && this.sectionsById.hasOwnProperty(properties.sectionId)) {
					ownerSection = this.sectionsById[properties.sectionId];
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
		this.openSectionIds = ko.computed<string[]>({
			read: () => {
				let result = [];
				_.forEach(this.sections, section => {
					if (section.isOpen()) {
						result.push(section.id);
					}
				});
				return result;
			},
			write: (sectionIds: string[]) => {
				const openSections = _.indexBy(sectionIds);
				_.forEach(this.sections, section => {
					section.isOpen(openSections.hasOwnProperty(section.id));
				});
			}
		});
		this.openSectionIds.extend({rateLimit: {timeout: 1000, method: 'notifyWhenChangesStop'}});

		let initialState: string[] = null;
		let cookieValue = jQuery.cookie(AmeTweakManagerModule.openSectionCookieName);
		if ((typeof cookieValue === 'string') && JSON && JSON.parse) {
			let storedState = JSON.parse(cookieValue);
			if (_.isArray<string>(storedState)) {
				initialState = _.intersection(_.keys(this.sectionsById), storedState);
			}
		}

		if (initialState !== null) {
			this.openSectionIds(initialState);
		} else {
			this.openSectionIds([_.first(this.sections).id]);
		}

		this.openSectionIds.subscribe((sectionIds) => {
			jQuery.cookie(AmeTweakManagerModule.openSectionCookieName, ko.toJSON(sectionIds), {expires: 90});
		});

		if (scriptData.lastUserTweakSuffix) {
			this.lastUserTweakSuffix = scriptData.lastUserTweakSuffix;
		}

		this.adminCssEditorDialog = new AmeEditAdminCssDialog(this);

		this.settingsData = ko.observable<string>('');
		this.isSaving = ko.observable<boolean>(false);
	}

	saveChanges() {
		this.isSaving(true);
		const _ = wsAmeLodash;

		let data = {
			'tweaks': _.indexBy(_.invoke(this.tweaksById, 'toJs'), 'id'),
			'lastUserTweakSuffix': this.lastUserTweakSuffix
		};
		this.settingsData(ko.toJSON(data));
		return true;
	}

	addAdminCssTweak(label: string, css: string) {
		this.lastUserTweakSuffix++;

		let slug = AmeTweakManagerModule.slugify(label);
		if (slug !== '') {
			slug = '-' + slug;
		}

		let props: AmeTweakProperties = {
			label: label,
			id: 'utw-' + this.lastUserTweakSuffix + slug,
			isUserDefined: true,
			sectionId: 'admin-css',
			typeId: 'admin-css',
			children: [],
			hasAccessMap: true
		};
		props['css'] = css;

		const cssInput: AmeStringSettingProperties = {
			id: 'css',
			label: '',
			dataType: 'string',
			inputType: 'textarea',
			syntaxHighlighting: 'css'
		};
		props.children.push(cssInput);

		const newTweak = new AmeTweakItem(props, this);
		this.tweaksById[newTweak.id] = newTweak;
		this.sectionsById['admin-css'].addTweak(newTweak)
	}

	static slugify(input: string): string {
		const _ = AmeTweakManagerModule._;
		let output = _.deburr(input);
		output = output.replace(/[^a-zA-Z0-9 \-]/, '');
		return _.kebabCase(output);
	}

	launchTweakEditor(tweak: AmeTweakItem) {
		// noinspection JSRedundantSwitchStatement
		switch (tweak.getTypeId()) {
			case 'admin-css':
				this.adminCssEditorDialog.selectedTweak = tweak;
				this.adminCssEditorDialog.open();
				break;
			default:
				alert('Error: Editor not implemented! This is probably a bug.');
		}
	}

	confirmDeleteTweak(tweak: AmeTweakItem) {
		if (!tweak.isUserDefined || !confirm('Delete this tweak?')) {
			return;
		}
		this.deleteTweak(tweak);
	}

	protected deleteTweak(tweak: AmeTweakItem) {
		const section = tweak.getSection();
		if (section) {
			section.removeTweak(tweak);
		}
		const parent = tweak.getParent();
		if (parent) {
			parent.removeChild(tweak);
		}
		delete this.tweaksById[tweak.id];
	}

	getCodeMirrorOptions(mode: string) {
		if (mode === 'css') {
			return this.cssHighlightingOptions;
		}
		return null;
	}
}

class AmeEditAdminCssDialog implements AmeKnockoutDialog {
	jQueryWidget: JQuery;
	isOpen: KnockoutObservable<boolean>;
	autoCancelButton: boolean = false;

	options: AmeDictionary<any> = {
		minWidth: 400
	};

	isAddButtonEnabled: KnockoutComputed<boolean>;
	tweakLabel: KnockoutObservable<string>;
	cssCode: KnockoutObservable<string>;
	confirmButtonText: KnockoutObservable<string>;
	title: KnockoutObservable<string>;

	selectedTweak: AmeTweakItem = null;

	private manager: AmeTweakManagerModule;

	constructor(manager: AmeTweakManagerModule) {
		const _ = AmeTweakManagerModule._;
		this.manager = manager;

		this.tweakLabel = ko.observable('');
		this.cssCode = ko.observable('');
		this.confirmButtonText = ko.observable('Add Snippet');
		this.title = ko.observable(null);

		this.isAddButtonEnabled = ko.computed(() => {
			return !((_.trim(this.tweakLabel()) === '') || (_.trim(this.cssCode()) === ''));
		});
		this.isOpen = ko.observable(false);
	}

	onOpen(event, ui) {
		if (this.selectedTweak) {
			this.tweakLabel(this.selectedTweak.label());
			this.title('Edit admin CSS snippet');
			this.confirmButtonText('Save Changes');

			const cssProperty = this.selectedTweak.getEditableProperty('css');
			this.cssCode(cssProperty ? cssProperty() : '');
		} else {
			this.tweakLabel('');
			this.cssCode('');
			this.title('Add admin CSS snippet');
			this.confirmButtonText('Add Snippet');
		}
	}

	onConfirm() {
		if (this.selectedTweak) {
			//Update the existing tweak.
			this.selectedTweak.label(this.tweakLabel());
			this.selectedTweak.getEditableProperty('css')(this.cssCode());
		} else {
			//Create a new tweak.
			this.manager.addAdminCssTweak(
				this.tweakLabel(),
				this.cssCode()
			);
		}
		this.close();
	}

	onClose() {
		this.selectedTweak = null;
	}

	close() {
		this.isOpen(false);
	}

	open() {
		this.isOpen(true);
	}
}

ko.bindingHandlers.ameCodeMirror = {
	init: function (element, valueAccessor, allBindings) {
		if (!wp.hasOwnProperty('codeEditor') || !wp.codeEditor.initialize) {
			return;
		}
		let parameters = ko.unwrap(valueAccessor());
		if (!parameters) {
			return;
		}

		let options;
		let refreshTrigger: KnockoutObservable<any>;
		if (parameters.options) {
			options = parameters.options;
			if (parameters.refreshTrigger) {
				refreshTrigger = parameters.refreshTrigger;
			}
		} else {
			options = parameters;
		}

		let result = wp.codeEditor.initialize(element, options);
		const cm = result.codemirror;

		//Synchronise the editor contents with the observable passed to the "value" binding.
		let valueObservable: KnockoutObservable<any> = allBindings.get('value');
		if (!ko.isObservable(valueObservable)) {
			valueObservable = null;
		}

		let subscription = null;
		let changeHandler = null;
		if (valueObservable !== null) {
			//Update the observable when the contents of the editor change.
			let ignoreNextUpdate = false;
			changeHandler = function () {
				//This will trigger our observable subscription (see below).
				//We need to ignore that trigger to avoid recursive or duplicated updates.
				ignoreNextUpdate = true;
				valueObservable(cm.doc.getValue());
			};
			cm.on('changes', changeHandler);

			//Update the editor when the observable changes.
			subscription = valueObservable.subscribe(function (newValue) {
				if (ignoreNextUpdate) {
					ignoreNextUpdate = false;
					return;
				}
				cm.doc.setValue(newValue);
				ignoreNextUpdate = false;
			});
		}

		//Refresh the size of the editor element when an observable changes value.
		let refreshSubscription: KnockoutSubscription = null;
		if (refreshTrigger) {
			refreshSubscription = refreshTrigger.subscribe(function () {
				cm.refresh();
			});
		}

		//If the editor starts out hidden - for example, because it's inside a collapsed section - it will
		//render incorrectly. To fix that, let's refresh it the first time it becomes visible.
		if (!jQuery(element).is(':visible') && (typeof IntersectionObserver !== 'undefined')) {
			const observer = new IntersectionObserver(
				function (entries) {
					for (let i = 0; i < entries.length; i++) {
						if (entries[i].isIntersecting) {
							//The editor is at least partially visible now.
							observer.disconnect();
							cm.refresh();
							break;
						}
					}
				},
				{
					//Use the browser viewport.
					root: null,
					//The threshold is somewhat arbitrary. Any value will work, but a lower setting means
					//that the user is less likely to see an incorrectly rendered editor.
					threshold: 0.05
				}
			);
			observer.observe(cm.getWrapperElement());
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