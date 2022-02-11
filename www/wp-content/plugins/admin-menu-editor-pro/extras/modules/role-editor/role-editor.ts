/// <reference path="../../../js/knockout.d.ts" />
/// <reference path="../../../js/lodash-3.10.d.ts" />
/// <reference path="../../../js/common.d.ts" />
/// <reference path="../../../js/actor-manager.ts" />
/// <reference path="../../../js/jquery.d.ts" />
/// <reference path="../../../js/jqueryui.d.ts" />
/// <reference path="../../../modules/actor-selector/actor-selector.ts" />
/// <reference path="../../ko-extensions.ts" />

class RexPermission {
	public readonly capability: RexCapability;

	labelHtml: KnockoutComputed<string>;
	protected readableAction: string = null;

	mainDescription: string = '';

	isRedundant: boolean = false;

	readonly isVisible: KnockoutComputed<boolean>;

	private editor: RexRoleEditor;

	constructor(editor: RexRoleEditor, capability: RexCapability) {
		this.editor = editor;
		this.capability = capability;

		const self = this;

		this.labelHtml = ko.pureComputed({
			read: self.getLabelHtml,
			deferEvaluation: true,
			owner: this
		});
		//Prevent freezing when entering a search query. Highlighting keywords in hundreds of capabilities can be slow.
		this.labelHtml.extend({rateLimit: {timeout: 50, method: "notifyWhenChangesStop"}});

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

	protected getLabelHtml(): string {
		let text;

		if ((this.readableAction !== null) && this.editor.readableNamesEnabled()) {
			text = this.readableAction;
		} else {
			text = this.capability.displayName();
		}

		let html = wsAmeLodash.escape(text);
		if (this.isVisible()) {
			html = this.editor.highlightSearchKeywords(html);
		}

		//Let the browser break words on underscores.
		html = html.replace(/_/g, '_<wbr>');

		return html;
	}
}

interface RexComponentData {
	name: string;
	type?: string;
	capabilityDocumentationUrl?: string;
}

/**
 * A basic representation of any component or extension that can add new capabilities.
 * This includes plugins, themes, and the WordPress core.
 */
class RexWordPressComponent {
	readonly name: string;
	readonly id: string;
	capabilityDocumentationUrl?: string;

	constructor(id: string, name: string) {
		this.id = id;
		this.name = name;
	}

	static fromJs(id: string, details: RexComponentData): RexWordPressComponent {
		const instance = new RexWordPressComponent(id, details.name ? details.name : id);
		if (details.capabilityDocumentationUrl) {
			instance.capabilityDocumentationUrl = details.capabilityDocumentationUrl;
		}
		return instance;
	}
}

class RexObservableCapabilityMap {
	private readonly initialCapabilities: CapabilityMap;
	private capabilities: { [capabilityName: string]: KnockoutObservable<boolean | null> } = {};

	constructor(initialCapabilities: CapabilityMap) {
		if (initialCapabilities) {
			this.initialCapabilities = wsAmeLodash.clone(initialCapabilities);
		} else {
			this.initialCapabilities = {};
		}
	}

	getCapabilityState(capabilityName: string): boolean {
		const observable = this.getObservable(capabilityName);
		return observable();
	}

	setCapabilityState(capabilityName: string, state: boolean | null) {
		const observable = this.getObservable(capabilityName);
		observable(state);
	}

	getAllCapabilities(): CapabilityMap {
		const _ = wsAmeLodash;

		let result = this.initialCapabilities ? _.clone(this.initialCapabilities) : {};
		_.forEach(this.capabilities, function (observable, name) {
			const isGranted = observable();
			if (isGranted === null) {
				delete result[name];
			} else {
				result[name] = isGranted;
			}
		});
		return result;
	}

	private getObservable(capabilityName: string): KnockoutObservable<boolean | null> {
		if (!this.capabilities.hasOwnProperty(capabilityName)) {
			let initialValue = null;
			if (this.initialCapabilities.hasOwnProperty(capabilityName)) {
				initialValue = this.initialCapabilities[capabilityName];
			}
			this.capabilities[capabilityName] = ko.observable(initialValue);
		}
		return this.capabilities[capabilityName];
	}
}

abstract class RexBaseActor implements IAmeActor {
	/**
	 * Actor ID. Usually in the form of "prefix:name".
	 */
	id: KnockoutObservable<string>;

	/**
	 * Internal role name or user login.
	 */
	name: KnockoutObservable<string>;

	/**
	 * Formatted, human-readable name.
	 */
	displayName: KnockoutObservable<string>;

	canHaveRoles: boolean = false;

	private capabilities: RexObservableCapabilityMap;

	protected constructor(id: string, name: string, displayName: string, capabilities?: CapabilityMap) {
		this.id = ko.observable(id);
		this.name = ko.observable(name);
		this.displayName = ko.observable(displayName);
		this.capabilities = new RexObservableCapabilityMap(capabilities || {});
	}

	hasCap(capability: string): boolean {
		return (this.capabilities.getCapabilityState(capability) === true);
	}

	getCapabilityState(capability: string) {
		return this.getOwnCapabilityState(capability);
	}

	getOwnCapabilityState(capability: string): boolean | null {
		return this.capabilities.getCapabilityState(capability);
	}

	setCap(capability: string, enabled: boolean) {
		this.capabilities.setCapabilityState(capability, enabled);
	}

	deleteCap(capability: string) {
		this.capabilities.setCapabilityState(capability, null);
	}

	getDisplayName(): string {
		return this.displayName();
	}

	getId(): string {
		return this.id();
	}

	/**
	 * Get capabilities that are explicitly assigned/denied to this actor.
	 * Does not include capabilities that a user inherits from their role(s).
	 */
	getOwnCapabilities(): CapabilityMap {
		return this.capabilities.getAllCapabilities();
	}
}

class RexRole extends RexBaseActor {
	static readonly builtInRoleNames = ['administrator', 'editor', 'author', 'subscriber', 'contributor'];

	hasUsers: boolean = false;

	public constructor(name: string, displayName: string, capabilities?: CapabilityMap) {
		super('role:' + name, name, displayName, capabilities);
	}

	public static fromRoleData(data: RexRoleData) {
		const role = new RexRole(data.name, data.displayName, data.capabilities);
		role.hasUsers = data.hasUsers;
		return role;
	}

	/**
	 * Is this one of the default roles that are part of WordPress core?
	 *
	 * Note: I'm calling this property "built-in" instead of "default" to distinguish it
	 * from the default role for new users.
	 */
	isBuiltIn() {
		return RexRole.builtInRoleNames.indexOf(this.name()) >= 0;
	}

	toJs(): RexStorableRoleData {
		return {
			name: this.name(),
			displayName: this.displayName(),
			capabilities: this.getOwnCapabilities()
		};
	}
}

class RexSuperAdmin extends RexBaseActor {
	private static instance: RexSuperAdmin = null;

	protected constructor() {
		super('special:super_admin', 'Super Admin', 'Super Admin');
	}

	static getInstance(): RexSuperAdmin {
		if (RexSuperAdmin.instance === null) {
			RexSuperAdmin.instance = new RexSuperAdmin();
		}
		return RexSuperAdmin.instance;
	}
}

class RexUser extends RexBaseActor implements IAmeUser {
	roles: KnockoutObservableArray<RexRole>;
	isSuperAdmin: boolean = false;
	userLogin: string;
	userId: number;

	constructor(login: string, displayName: string, capabilities?: CapabilityMap, userId?: number) {
		super('user:' + login, login, displayName, capabilities);
		this.userLogin = login;
		this.canHaveRoles = true;
		this.roles = ko.observableArray([]);
		this.userId = userId;
	}

	hasCap(capability: string, outGrantedBy?: RexBaseActor[]): boolean {
		return (this.getCapabilityState(capability, outGrantedBy) === true);
	}

	getCapabilityState(capability: string, outGrantedBy?: RexBaseActor[]): boolean {
		if (capability === 'do_not_allow') {
			return false;
		}

		if (this.isSuperAdmin) {
			if (outGrantedBy) {
				outGrantedBy.push(RexSuperAdmin.getInstance());
			}
			return (capability !== 'do_not_allow');
		}

		let result = super.getCapabilityState(capability);
		if (result !== null) {
			if (outGrantedBy) {
				outGrantedBy.push(this);
			}
			return result;
		}

		wsAmeLodash.each(this.roles(), (role) => {
			const roleHasCap = role.getCapabilityState(capability);
			if (roleHasCap !== null) {
				if (outGrantedBy) {
					outGrantedBy.push(role);
				}
				result = roleHasCap;
			}
		});

		return result;
	}

	// noinspection JSUnusedGlobalSymbols Used in KO templates.
	getInheritanceDetails(capability: RexCapability): any[] {
		const _ = wsAmeLodash;
		let results = [];
		//Note: Alternative terms include "Assigned", "Granted", "Yes"/"No".

		if (this.isSuperAdmin) {
			const superAdmin = RexSuperAdmin.getInstance();
			let description = 'Allow everything';
			if (capability.name === 'do_not_allow') {
				description = 'Deny';
			}
			results.push({
				actor: superAdmin,
				name: superAdmin.displayName(),
				description: description
			});
		}

		_.each(this.roles(), (role) => {
			const roleHasCap = role.getCapabilityState(capability.name);
			let description;
			if (roleHasCap) {
				description = 'Allow';
			} else if (roleHasCap === null) {
				description = '—';
			} else {
				description = 'Deny';
			}
			results.push({
				actor: role,
				name: role.displayName(),
				description: description,
			});
		});

		let hasOwnCap = super.getCapabilityState(capability.name);
		let description;
		if (hasOwnCap) {
			description = 'Allow';
		} else if (hasOwnCap === null) {
			description = '—';
		} else {
			description = 'Deny';
		}
		results.push({
			actor: this,
			name: 'User-specific setting',
			description: description,
		});

		let relevantActors = [];
		this.getCapabilityState(capability.name, relevantActors);
		const decidingActor = _.last(relevantActors);
		_.each(results, function (item) {
			item.isDecisive = (item.actor === decidingActor);
		});

		return results;
	}

	static fromAmeUser(data: AmeUser, editor: RexRoleEditor) {
		const user = new RexUser(data.userLogin, data.displayName, data.capabilities, data.userId);
		wsAmeLodash.forEach(data.roles, function (roleId) {
			const role = editor.getRole(roleId);
			if (role) {
				user.roles.push(role);
			}
		});
		return user;
	}

	static fromAmeUserProperties(properties: AmeUserPropertyMap, editor: RexRoleEditor) {
		const user = new RexUser(properties.user_login, properties.display_name, properties.capabilities);
		if (properties.id) {
			user.userId = properties.id;
		}
		wsAmeLodash.forEach(properties.roles, function (roleId) {
			const role = editor.getRole(roleId);
			if (role) {
				user.roles.push(role);
			}
		});
		return user;
	}

	toJs(): RexStorableUserData {
		const _ = wsAmeLodash;
		let roles = _.invoke(this.roles(), 'name');
		return {
			userId: this.userId,
			userLogin: this.userLogin,
			displayName: this.displayName(),
			capabilities: this.getOwnCapabilities(),
			roles: roles
		};
	}
}

interface RexStorableRoleData {
	name: string;
	displayName: string;
	capabilities: CapabilityMap;
}

interface RexRoleData extends RexStorableRoleData {
	hasUsers: boolean;
}

interface RexStorableUserData {
	userId?: number;
	userLogin: string;
	displayName: string;
	roles: string[];
	capabilities: CapabilityMap;
}

interface RexUserData extends RexStorableUserData {
	isSuperAdmin: boolean;
}

type RexCategoryComparisonCallback = (a: RexCategory, b: RexCategory) => number;

class RexCategory {
	slug: string = null;

	name: string;
	permissions: KnockoutObservableArray<RexPermission>;
	origin: RexWordPressComponent = null;
	subtitle: string = null;
	htmlId: string = null;

	parent: RexCategory = null;
	subheading: KnockoutObservable<string>;
	subcategories: RexCategory[] = [];

	sortedSubcategories: KnockoutComputed<RexCategory[]>;
	static readonly defaultSubcategoryComparison: RexCategoryComparisonCallback = function (a, b) {
		return a.name.toLowerCase().localeCompare(b.name.toLowerCase());
	};

	navSubcategories: KnockoutComputed<RexCategory[]>;
	protected subcategoryModificationFlag: KnockoutObservable<number>;

	protected editor: RexRoleEditor;

	areAllPermissionsEnabled: KnockoutComputed<boolean>;
	areAnyPermissionsEditable: KnockoutComputed<boolean>;

	/**
	 * Number of unique capabilities in this category and all of its subcategories.
	 */
	totalCapabilityCount: KnockoutComputed<number>;
	/**
	 * Number of capabilities that are granted to the currently selected actor.
	 */
	enabledCapabilityCount: KnockoutComputed<number>;

	isVisible: KnockoutComputed<boolean>;
	isSelected: KnockoutObservable<boolean>;
	desiredColumnCount: KnockoutComputed<string>;

	isNavExpanded: KnockoutObservable<boolean>;
	isNavVisible: KnockoutComputed<boolean>;

	cssClasses: KnockoutComputed<string>;
	navCssClasses: KnockoutComputed<string>;
	readonly nestingDepth: KnockoutComputed<number>;
	contentTemplate: KnockoutObservable<string>;

	isCapCountVisible: KnockoutComputed<boolean>;
	isEnabledCapCountVisible: KnockoutComputed<boolean>;

	protected duplicates: RexCategory[] = [];

	constructor(name: string, editor: RexRoleEditor, slug: string = null, capabilities: string[] = []) {
		const _ = wsAmeLodash;
		const self = this;
		this.editor = editor;

		this.name = name;
		this.slug = slug;
		if ((this.slug !== null) && (this.slug !== '')) {
			editor.categoriesBySlug[this.slug] = this;
		}

		let initialPermissions = _.map(capabilities, (capabilityName) => {
			return new RexPermission(editor, editor.getCapability(capabilityName));
		});
		this.permissions = ko.observableArray(initialPermissions);
		this.sortPermissions();
		this.contentTemplate = ko.observable('rex-default-category-content-template');

		this.isSelected = ko.observable(false);

		this.enabledCapabilityCount = ko.pureComputed({
			read: function () {
				return self.countUniqueCapabilities({}, function (capability: RexCapability) {
					return capability.isEnabledForSelectedActor();
				});
			},
			deferEvaluation: true,
			owner: this
		});
		this.enabledCapabilityCount.extend({rateLimit: {timeout: 5, method: "notifyWhenChangesStop"}});

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

				const totalCaps = self.totalCapabilityCount(),
					enabledCaps = self.enabledCapabilityCount();
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
				const items = self.permissions();
				const len = items.length;

				for (let i = 0; i < len; i++) {
					if (!items[i].capability.isEnabledForSelectedActor() && items[i].capability.isEditable()) {
						return false;
					}
				}

				for (let i = 0; i < self.subcategories.length; i++) {
					if (!self.subcategories[i].areAllPermissionsEnabled()) {
						return false;
					}
				}

				return true;
			},
			write: function (enabled) {
				const items = self.permissions();
				for (let i = 0; i < items.length; i++) {
					let item = items[i];
					if (item.capability.isEditable()) {
						item.capability.isEnabledForSelectedActor(enabled);
					}
				}

				for (let i = 0; i < self.subcategories.length; i++) {
					self.subcategories[i].areAllPermissionsEnabled(enabled);
				}
			},
			deferEvaluation: true,
			owner: this
		});
		this.areAllPermissionsEnabled.extend({rateLimit: {timeout: 5, method: 'notifyWhenChangesStop'}});

		this.areAnyPermissionsEditable = ko.pureComputed({
			read: () => {
				const items = self.permissions();
				const len = items.length;

				for (let i = 0; i < len; i++) {
					if (items[i].capability.isEditable()) {
						return true;
					}
				}

				for (let i = 0; i < self.subcategories.length; i++) {
					if (!self.subcategories[i].areAnyPermissionsEditable()) {
						return true;
					}
				}

				return false;
			},
			deferEvaluation: true,
			owner: this
		});
		this.areAnyPermissionsEditable.extend({rateLimit: {timeout: 5, method: 'notifyWhenChangesStop'}});

		this.isVisible = ko.computed({
			read: function () {
				let visible = false;

				let hasVisibleSubcategories = false;
				_.forEach(self.subcategories, function (category) {
					if (category.isVisible()) {
						hasVisibleSubcategories = true;
						return false;
					}
				});

				//Hide it if not inside the selected category.
				let isInSelectedCategory = false,
					temp: RexCategory = self;
				while (temp !== null) {
					if (temp.isSelected()) {
						isInSelectedCategory = true;
						break;
					}
					temp = temp.parent;
				}

				//In single-category view, the category also counts as "selected"
				//if one of its duplicates is selected.
				if (
					!isInSelectedCategory
					&& (self.duplicates.length > 0)
					&& (editor.categoryViewMode() === RexRoleEditor.singleCategoryView)
				) {
					for (let i = 0; i < self.duplicates.length; i++) {
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
				let visiblePermissions = 0;
				_.forEach(self.permissions(), function (permission) {
					if (permission.isVisible()) {
						visiblePermissions++;
					}
				});

				let minItemsPerColumn = 12;
				if (editor.categoryWidthMode() === 'full') {
					minItemsPerColumn = 3;
				}

				let desiredColumns = Math.max(Math.ceil(visiblePermissions / minItemsPerColumn), 1);
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

		this.isNavExpanded = ko.observable(
			(this.slug !== null) ? !editor.userPreferences.collapsedCategories.peek(this.slug) : true
		);

		if (this.slug) {
			this.isNavExpanded.subscribe((newValue: boolean) => {
				editor.userPreferences.collapsedCategories.toggle(this.slug, !newValue);
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
				let classes = [];
				if (self.subcategories.length > 0) {
					classes.push('rex-has-subcategories');
				}
				if (self.parent) {
					if (self.parent === editor.rootCategory) {
						classes.push('rex-top-category');
					} else {
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
				let classes = [];
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
			read: () => {
				//Refresh the sorted list when categories are added or removed.
				this.subcategoryModificationFlag();
				return this.getSortedSubcategories();
			},
			deferEvaluation: true
		});

		this.navSubcategories = ko.pureComputed({
			read: () => {
				this.subcategoryModificationFlag();
				return this.subcategories;
			},
			deferEvaluation: true
		});

		this.subheading = ko.pureComputed({
			read: () => {
				return this.getSubheadingItems().join(', ');
			},
			deferEvaluation: true
		});
	}

	addSubcategory(category: RexCategory, afterName?: string) {
		category.parent = this;
		if (afterName) {
			const index = wsAmeLodash.findIndex(this.subcategories, {'name': afterName});
			if (index > -1) {
				this.subcategories.splice(index + 1, 0, category);
				this.subcategoryModificationFlag(this.subcategories.length);
				return;
			}
		}
		this.subcategories.push(category);
		this.subcategoryModificationFlag(this.subcategories.length);
	}

	// noinspection JSUnusedGlobalSymbols Used in KO templates.
	toggleSubcategories() {
		this.isNavExpanded(!this.isNavExpanded());
	}

	protected getSortedSubcategories(): RexCategory[] {
		//In most cases, the subcategory list is already sorted either alphabetically or in a predefined order
		//chosen for specific category. Subcategories can override this method to change the sort order.
		return this.subcategories;
	}

	/**
	 * Sort the permissions in this category. Doesn't affect subcategories.
	 * The default sort is alphabetical, but subclasses can override this method to specify a custom order.
	 */
	sortPermissions() {
		this.permissions.sort(function (a, b) {
			return a.capability.name.toLowerCase().localeCompare(b.capability.name.toLowerCase());
		});
	}

	countUniqueCapabilities(accumulator: AmeDictionary<boolean> = {}, predicate: Function = null): number {
		let total = 0;
		const permissions = this.permissions();

		for (let i = 0; i < permissions.length; i++) {
			const capability = permissions[i].capability;
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

		for (let i = 0; i < this.subcategories.length; i++) {
			total = total + this.subcategories[i].countUniqueCapabilities(accumulator, predicate);
		}

		return total;
	}

	protected findCategoryBySlug(slug: string): RexCategory {
		if (this.editor.categoriesBySlug.hasOwnProperty(slug)) {
			return this.editor.categoriesBySlug[slug];
		}
		return null;
	}

	static fromJs(details: RexCategoryData, editor: RexRoleEditor): RexCategory {
		let category;
		if (details.variant && details.variant === 'post_type') {
			category = new RexPostTypeCategory(details.name, editor, details.contentTypeId, details.slug, details.permissions);
		} else if (details.variant && details.variant === 'taxonomy') {
			category = new RexTaxonomyCategory(details.name, editor, details.contentTypeId, details.slug, details.permissions);
		} else {
			category = new RexCategory(details.name, editor, details.slug, details.capabilities);
		}

		if (details.componentId) {
			category.origin = editor.getComponent(details.componentId);
		}

		if (details.subcategories) {
			wsAmeLodash.forEach(details.subcategories, (childDetails) => {
				const subcategory = RexCategory.fromJs(childDetails, editor);
				category.addSubcategory(subcategory);
			});
		}

		return category;
	}

	usesBaseCapabilities(): boolean {
		return false;
	}

	getDeDuplicationKey(): string {
		let key = this.slug ?? this.name;
		if (this.parent) {
			key = this.parent.getDeDuplicationKey() + '>' + key;
		}
		return key;
	}

	addDuplicate(category: RexCategory) {
		if (this.duplicates.indexOf(category) === -1) {
			this.duplicates.push(category);
		}
	}

	protected getSubheadingItems(): string[] {
		let items = [];
		if (this.parent !== null) {
			items.push(this.parent.name);
		}
		if (this.duplicates.length > 0) {
			for (let i = 0; i < this.duplicates.length; i++) {
				let category = this.duplicates[i];
				if (category.parent) {
					items.push(category.parent.name);
				}
			}
		}
		return items;
	}

	getAbsoluteName() {
		let components = [this.name];
		let parent = this.parent;
		while (parent !== null) {
			components.unshift(parent.name);
			parent = parent.parent;
		}
		return components.join(' > ');
	}
}

interface RexContentTypePermission extends RexPermission {
	readonly action: string;
}

abstract class RexContentTypeCategory extends RexCategory {
	public actions: { [action: string]: RexContentTypePermission } = {};
	protected baseCategorySlug: string = null;
	isBaseCapNoticeVisible: KnockoutComputed<boolean>;

	protected constructor(name: string, editor: RexRoleEditor, slug: string = null) {
		super(name, editor, slug);

		this.isBaseCapNoticeVisible = ko.pureComputed({
			read: () => {
				if (editor.showBaseCapsEnabled()) {
					return false;
				}
				return this.usesBaseCapabilities();
			},
			deferEvaluation: true
		});
	}

	/**
	 * Check if the post type or taxonomy represented by this category uses the same capabilities
	 * as the built-in "post" type or the "category" taxonomy.
	 */
	usesBaseCapabilities(): boolean {
		const baseCategory = this.getBaseCategory();
		if (baseCategory === null || this === baseCategory) {
			return false;
		}

		let allCapsMatch = true;
		wsAmeLodash.forEach(this.actions, function (item) {
			let isMatch = item.action
				&& baseCategory.actions.hasOwnProperty(item.action)
				&& (item.capability === baseCategory.actions[item.action].capability);

			if (!isMatch) {
				allCapsMatch = false;
				return false;
			}
		});
		return allCapsMatch;
	}

	protected getBaseCategory(): RexContentTypeCategory {
		if (this.baseCategorySlug !== null) {
			let result = this.findCategoryBySlug(this.baseCategorySlug);
			if (result instanceof RexContentTypeCategory) {
				return result;
			}
		}
		return null;
	}
}

class RexPostTypePermission extends RexPermission implements RexContentTypePermission {
	public readonly action: string;

	public static readonly actionDescriptions: { [cptAction: string]: string } = {
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

	constructor(editor: RexRoleEditor, capability: RexCapability, action: string, pluralNoun: string = '') {
		super(editor, capability);

		this.action = action;
		this.readableAction = wsAmeLodash.capitalize(this.action.replace('_posts', '').replace('_', ' '));

		if (RexPostTypePermission.actionDescriptions.hasOwnProperty(action) && pluralNoun) {
			this.mainDescription = RexPostTypePermission.actionDescriptions[action].replace('%s', pluralNoun);
		}
	}
}

class RexPostTypeCategory extends RexContentTypeCategory {
	readonly pluralLabel: string = '';

	public actions: { [action: string]: RexPostTypePermission } = {};
	public readonly postType: string;
	public readonly isDefault: boolean;

	private static readonly desiredActionOrder: { [cptAction: string]: number } = {
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

	constructor(
		name: string,
		editor: RexRoleEditor,
		postTypeId: string,
		slug: string = null,
		permissions: { [action: string]: string },
		isDefault: boolean = false
	) {
		super(name, editor, slug);
		const _ = wsAmeLodash;

		this.baseCategorySlug = 'postTypes/post';
		this.postType = postTypeId;
		this.isDefault = isDefault;
		this.subtitle = this.postType;
		if (editor.postTypes[postTypeId].pluralLabel) {
			this.pluralLabel = editor.postTypes[postTypeId].pluralLabel;
		} else {
			this.pluralLabel = name.toLowerCase();
		}

		this.permissions = ko.observableArray(_.map(permissions, (capability, action) => {
			const permission = new RexPostTypePermission(editor, editor.getCapability(capability), action, this.pluralLabel);

			//The "read" capability is already shown in the core category and every role has it by default.
			if (capability === 'read') {
				permission.isRedundant = true;
			}

			this.actions[action] = permission;
			return permission;
		}));

		this.sortPermissions();

		//The "create" capability is often the same as the "edit" capability.
		const editPerm = _.get(this.actions, 'edit_posts', null),
			createPerm = _.get(this.actions, 'create_posts', null);
		if (editPerm && createPerm && (createPerm.capability.name === editPerm.capability.name)) {
			createPerm.isRedundant = true;
		}
	}


	getDeDuplicationKey(): string {
		return 'postType:' + this.postType;
	}

	sortPermissions() {
		this.permissions.sort(function (a: RexPostTypePermission, b: RexPostTypePermission) {
			const priorityA = RexPostTypeCategory.desiredActionOrder.hasOwnProperty(a.action) ? RexPostTypeCategory.desiredActionOrder[a.action] : 1000;
			const priorityB = RexPostTypeCategory.desiredActionOrder.hasOwnProperty(b.action) ? RexPostTypeCategory.desiredActionOrder[b.action] : 1000;

			let delta = priorityA - priorityB;
			if (delta !== 0) {
				return delta;
			}

			return a.capability.name.localeCompare(b.capability.name);
		});
	}

	protected getSubheadingItems(): string[] {
		let items = super.getSubheadingItems();
		items.push(this.postType);
		return items;
	}
}

class RexTaxonomyPermission extends RexPermission implements RexContentTypePermission {
	public readonly action: string;

	public static readonly actionDescriptions: { [cptAction: string]: string } = {
		'manage_terms': 'Manage %s',
		'edit_terms': 'Edit %s',
		'delete_terms': 'Delete %s',
		'assign_terms': 'Assign %s',
	};

	constructor(editor: RexRoleEditor, capability: RexCapability, action: string, pluralNoun: string = '') {
		super(editor, capability);

		this.action = action;
		this.readableAction = wsAmeLodash.capitalize(this.action.replace('_terms', '').replace('_', ' '));

		if (RexTaxonomyPermission.actionDescriptions.hasOwnProperty(action) && pluralNoun) {
			this.mainDescription = RexTaxonomyPermission.actionDescriptions[action].replace('%s', pluralNoun);
		}
	}
}

class RexTaxonomyCategory extends RexContentTypeCategory {
	public actions: { [action: string]: RexTaxonomyPermission } = {};
	private readonly taxonomy: string;

	private static readonly desiredActionOrder: { [cptAction: string]: number } = {
		'manage_terms': 1,
		'edit_terms': 2,
		'delete_terms': 3,
		'assign_terms': 4,
	};

	constructor(
		name: string,
		editor: RexRoleEditor,
		taxonomyId: string,
		slug: string = null,
		permissions: { [action: string]: string }
	) {
		super(name, editor, slug);
		const _ = wsAmeLodash;

		this.baseCategorySlug = 'taxonomies/category';
		this.taxonomy = taxonomyId;
		this.subtitle = taxonomyId;

		const noun = name.toLowerCase();
		this.permissions = ko.observableArray(_.map(permissions, (capability, action) => {
			const permission = new RexTaxonomyPermission(editor, editor.getCapability(capability), action, noun);
			this.actions[action] = permission;
			return permission;
		}));

		this.sortPermissions();

		//Permissions that use the same capability as the "manage_terms" permission are redundant.
		if (this.actions.manage_terms) {
			const manageCap = this.actions.manage_terms.capability.name;
			for (let action in this.actions) {
				if (!this.actions.hasOwnProperty(action)) {
					continue;
				}
				if ((action !== 'manage_terms') && (this.actions[action].capability.name === manageCap)) {
					this.actions[action].isRedundant = true;
				}
			}
		}
	}

	getDeDuplicationKey(): string {
		return 'taxonomy:' + this.taxonomy;
	}

	sortPermissions(): void {
		this.permissions.sort(function (a: RexTaxonomyPermission, b: RexTaxonomyPermission) {
			const priorityA = RexTaxonomyCategory.desiredActionOrder.hasOwnProperty(a.action) ? RexTaxonomyCategory.desiredActionOrder[a.action] : 1000;
			const priorityB = RexTaxonomyCategory.desiredActionOrder.hasOwnProperty(b.action) ? RexTaxonomyCategory.desiredActionOrder[b.action] : 1000;

			let delta = priorityA - priorityB;
			if (delta !== 0) {
				return delta;
			}

			return a.capability.name.localeCompare(b.capability.name);
		});
	}

	protected getSubheadingItems(): string[] {
		let items = super.getSubheadingItems();
		items.push(this.taxonomy);
		return items;
	}
}

interface RexPermissionTableColumn {
	title: string;
	actions: string[];
}

class RexTableViewCategory extends RexCategory {
	tableColumns: KnockoutComputed<RexPermissionTableColumn[]>;
	subcategoryComparisonCallback: RexCategoryComparisonCallback = null;

	constructor(name: string, editor: RexRoleEditor, slug: string = null) {
		super(name, editor, slug);

		this.contentTemplate = ko.pureComputed(function () {
			if (editor.categoryViewMode() === RexRoleEditor.hierarchyView) {
				return 'rex-permission-table-template';
			}
			return 'rex-default-category-content-template';
		});

		this.subcategoryComparisonCallback = RexCategory.defaultSubcategoryComparison;
	}

	protected getSortedSubcategories(): RexCategory[] {
		if (this.editor.showBaseCapsEnabled()) {
			return super.getSortedSubcategories();
		}

		let cats = wsAmeLodash.clone(this.subcategories);
		return cats.sort((a, b) => {
			//Special case: Put categories that use base capabilities at the end.
			const aEqualsBase = a.usesBaseCapabilities();
			const bEqualsBase = b.usesBaseCapabilities();
			if (aEqualsBase && !bEqualsBase) {
				return 1;
			} else if (!aEqualsBase && bEqualsBase) {
				return -1;
			}

			//Otherwise just sort in the default order.
			return this.subcategoryComparisonCallback(a, b);
		});
	}

	/**
	 * Sort the underlying category array.
	 */
	public sortSubcategories() {
		this.subcategories.sort(this.subcategoryComparisonCallback);
	}
}

class RexTaxonomyContainerCategory extends RexTableViewCategory {
	constructor(name: string, editor: RexRoleEditor, slug: string = null) {
		super(name, editor, slug);

		this.htmlId = 'rex-taxonomy-summary-category';

		this.tableColumns = ko.pureComputed({
			read: () => {
				const _ = wsAmeLodash;
				const defaultTaxonomyActions = ['manage_terms', 'assign_terms', 'edit_terms', 'delete_terms'];

				let columns = [
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
				let misColumnExists = false, miscColumn: RexPermissionTableColumn = null;

				for (let i = 0; i < this.subcategories.length; i++) {
					const category = this.subcategories[i];
					if (!(category instanceof RexTaxonomyCategory)) {
						continue;
					}

					//Display any unrecognized actions in a "Misc" column.
					const customActions = _.omit(category.actions, defaultTaxonomyActions);
					if (!_.isEmpty(customActions)) {
						if (!misColumnExists) {
							miscColumn = {title: 'Misc', actions: []};
							columns.push(miscColumn);
						}
						miscColumn.actions = _.union(miscColumn.actions, _.keys(customActions));
					}
				}

				return columns;
			},
			deferEvaluation: true,
		});
	}
}

class RexPostTypeContainerCategory extends RexTableViewCategory {
	constructor(name: string, editor: RexRoleEditor, slug: string = null) {
		super(name, editor, slug);

		/* Note: This seems like poor design because the superclass overrides subclass
		 * behaviour (subcategory comparison) in some situations. Unfortunately, I haven't
		 * come up with anything better so far. Might be something to revisit later.
		 */

		this.subcategoryComparisonCallback = function (a: RexPostTypeCategory, b: RexPostTypeCategory) {
			//Special case: Put "Posts" at the top.
			if (a.postType === 'post') {
				return -1;
			} else if (b.postType === 'post') {
				return 1;
			}

			//Put other built-in post types above custom post types.
			if (a.isDefault && !b.isDefault) {
				return -1;
			} else if (b.isDefault && !a.isDefault) {
				return 1;
			}

			let labelA = a.name.toLowerCase(), labelB = b.name.toLowerCase();
			return labelA.localeCompare(labelB);
		};

		this.tableColumns = ko.pureComputed({
			read: () => {
				const _ = wsAmeLodash;
				const defaultPostTypeActions = _.keys(RexPostTypePermission.actionDescriptions);

				let columns = [
					{
						title: 'Own items',
						actions: ['create_posts', 'edit_posts', 'delete_posts', 'publish_posts', 'edit_published_posts', 'delete_published_posts']
					},
					{
						title: 'Other\'s items',
						actions: ['edit_others_posts', 'delete_others_posts', 'edit_private_posts', 'delete_private_posts', 'read_private_posts']
					}
				];
				let metaColumn = {
					title: 'Meta',
					actions: ['edit_post', 'delete_post', 'read_post']
				};
				columns.push(metaColumn);

				for (let i = 0; i < this.subcategories.length; i++) {
					const category = this.subcategories[i];
					if (!(category instanceof RexPostTypeCategory)) {
						continue;
					}

					//Display any unrecognized actions in a "Misc" column.
					const customActions = _.omit(category.actions, defaultPostTypeActions);
					if (!_.isEmpty(customActions)) {
						metaColumn.actions = _.union(metaColumn.actions, _.keys(customActions));
					}
				}

				return columns;
			},
			deferEvaluation: true,
		});
	}
}


interface RexCapabilityData {
	componentId?: string;
	menuItems: string[];
	usedByComponents: string[];

	documentationUrl?: string;
	permissions?: string[];
	readableName?: string;
}

class RexCapability {
	readonly name: string;

	private readableName: string;
	readonly displayName: KnockoutComputed<string>;

	private readonly editor: RexRoleEditor;

	readonly isEnabledForSelectedActor: KnockoutComputed<boolean>;
	isEditable: KnockoutComputed<boolean>;

	readonly responsibleActors: KnockoutComputed<RexBaseActor[]>;
	readonly isInherited: KnockoutComputed<boolean>;
	readonly isPersonalOverride: KnockoutComputed<boolean>;
	readonly isExplicitlyDenied: KnockoutComputed<boolean>;

	originComponent: RexWordPressComponent = null;
	usedByComponents: RexWordPressComponent[] = [];

	menuItems: string[] = [];
	usedByPostTypeActions: { [postType: string]: { [action: string]: boolean } } = {};
	usedByTaxonomyActions: { [taxonomy: string]: { [action: string]: boolean } } = {};
	predefinedPermissions: string[] = [];

	grantedPermissions: KnockoutComputed<string[]>;
	protected documentationUrl: string = null;
	notes: string = null;

	readonly isDeleted: KnockoutObservable<boolean>;

	constructor(name: string, editor: RexRoleEditor) {
		this.name = String(name);
		this.editor = editor;

		const self = this;

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
				let actor = editor.selectedActor(), list = [];
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
				const actor = editor.selectedActor();
				if (!actor.canHaveRoles) {
					return false;
				}

				const responsibleActors = self.responsibleActors();
				return responsibleActors
					&& (responsibleActors.length > 0)
					&& (wsAmeLodash.indexOf(responsibleActors, actor) < (responsibleActors.length - 1))
			},
			owner: this,
			deferEvaluation: true
		});

		this.isPersonalOverride = ko.pureComputed({
			read: function () {
				//This flag applies only to actors that can inherit permissions.
				const actor = editor.selectedActor();
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
			write: function (newState: boolean) {
				const actor = editor.selectedActor();
				if (editor.isShiftKeyDown()) {
					//Hold the shift key while clicking to cycle the capability between 3 states:
					//Granted -> Denied -> Not granted.
					const oldState = actor.getOwnCapabilityState(self.name);
					if (newState) {
						if (oldState === false) {
							actor.deleteCap(self.name); //Denied -> Not granted.
						} else if (oldState === null) {
							actor.setCap(self.name, true); //Not granted -> Granted.
						}
					} else {
						if (oldState === true) {
							actor.setCap(self.name, false); //Granted -> Denied.
						} else if (oldState === null) {
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
				} else {
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
				const actor = editor.selectedActor();
				if (actor) {
					return (actor.getCapabilityState(self.name) === false);
				}
				return false;
			},
			deferEvaluation: true
		});

		this.grantedPermissions = ko.computed({
			read: () => {
				const _ = wsAmeLodash;
				let results = [];

				if (this.predefinedPermissions.length > 0) {
					results = this.predefinedPermissions.slice();
				}

				function localeAwareCompare(a: string, b: string) {
					return a.localeCompare(b);
				}

				function actionsToPermissions(
					actionGroups: AmeDictionary<string[]>,
					labelMap: AmeDictionary<RexBaseContentData>,
					descriptions: AmeDictionary<string>
				): string[] {
					return _.map(actionGroups, (ids, action) => {
						let labels = _.map(ids, (id) => labelMap[id].pluralLabel)
							.sort(localeAwareCompare);
						let template = descriptions[action];
						if (!template) {
							template = action + ': %s';
						}
						return template.replace('%s', RexCapability.formatNounList(labels));
					}).sort(localeAwareCompare);
				}

				//Post permissions.
				let postActionGroups = _.transform(
					this.usedByPostTypeActions,
					function (accumulator: { [action: string]: string[] }, actions, postType) {
						let actionKeys = _.keys(actions);

						//Combine "edit" and "create" permissions because they usually use the same capability.
						const editEqualsCreate = actions.hasOwnProperty('edit_posts') && actions.hasOwnProperty('create_posts');
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
					}, {}
				);

				let postPermissions = actionsToPermissions(
					postActionGroups,
					this.editor.postTypes,
					RexPostTypePermission.actionDescriptions
				);
				Array.prototype.push.apply(results, postPermissions);

				//Taxonomy permissions.
				let taxonomyActionGroups = _.transform(
					this.usedByTaxonomyActions,
					function (accumulator: { [action: string]: string[] }, actions, taxonomy) {
						let actionKeys = _.keys(actions);

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
					}, {}
				);

				let taxonomyPermissions = actionsToPermissions(
					taxonomyActionGroups,
					this.editor.taxonomies,
					RexTaxonomyPermission.actionDescriptions
				);
				Array.prototype.push.apply(results, taxonomyPermissions);

				Array.prototype.push.apply(results, this.menuItems);
				return results;
			},
			deferEvaluation: true,
			owner: this,
		})
	}

	// noinspection JSUnusedGlobalSymbols Used in KO templates.
	getDocumentationUrl(): string | null {
		if (this.documentationUrl) {
			return this.documentationUrl;
		}
		if (this.originComponent && this.originComponent.capabilityDocumentationUrl) {
			this.documentationUrl = this.originComponent.capabilityDocumentationUrl;
			return this.documentationUrl;
		}
		return null;
	}

	static fromJs(name: string, data: RexCapabilityData, editor: RexRoleEditor): RexCapability {
		const capability = new RexCapability(name, editor);
		capability.menuItems = data.menuItems.sort(function (a, b) {
			return a.localeCompare(b);
		});

		if (data.componentId) {
			capability.originComponent = editor.getComponent(data.componentId);
		}
		if (data.usedByComponents) {
			for (let id in data.usedByComponents) {
				const component = editor.getComponent(id);
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
	}

	static formatNounList(items: string[]): string {
		if (items.length <= 2) {
			return items.join(' and ');
		}
		return items.slice(0, -1).join(', ') + ', and ' + items[items.length - 1];
	}
}

class RexDoNotAllowCapability extends RexCapability {
	constructor(editor: RexRoleEditor) {
		super('do_not_allow', editor);
		this.notes = '"do_not_allow" is a special capability. '
			+ 'WordPress uses it internally to indicate that access is denied. '
			+ 'Normally, it should not be assigned to any roles or users.';

		//Normally, it's impossible to grant this capability to anyone. Doing so would break things.
		//However, if it's already granted, you can remove it.
		this.isEditable = ko.computed(() => {
			return this.isEnabledForSelectedActor();
		});
	}
}

class RexExistCapability extends RexCapability {
	constructor(editor: RexRoleEditor) {
		super('exist', editor);
		this.notes = '"exist" is a special capability. '
			+ 'WordPress uses it internally to indicate that a role or user exists. '
			+ 'Normally, everyone has this capability by default, and it is not necessary '
			+ '(or possible) to assign it directly.';

		//Everyone must have this capability. However, if it has somehow become disabled,
		//we'll let the user enable it.
		this.isEditable = ko.computed(() => {
			return !this.isEnabledForSelectedActor();
		});
	}
}

class RexInvalidCapability extends RexCapability {
	constructor(fakeName: string, value: any, editor: RexRoleEditor) {
		super(fakeName, editor);
		const startsWithVowel = /^[aeiou]/i;
		let theType = (typeof value);
		const nounPhrase = (startsWithVowel.test(theType) ? 'an' : 'a') + ' ' + theType;

		this.notes = 'This is not a valid capability. A capability name must be a string (i.e. text),'
			+ ' but this is ' + nounPhrase + '. It was probably created by a bug in another plugin or theme.';

		this.isEditable = ko.computed(() => {
			return false;
		});
	}
}

class RexUserPreferences {
	private readonly preferenceObservables: AmeDictionary<KnockoutObservable<any>>;
	private readonly preferenceCount: KnockoutObservable<number>;

	private readonly plainPreferences: KnockoutComputed<any>;

	collapsedCategories: RexCollapsedCategorySet;

	constructor(initialPreferences?: AmeDictionary<any>, ajaxUrl?: string, updateNonce?: string) {
		const _ = wsAmeLodash;

		initialPreferences = initialPreferences || {};
		if (_.isArray(initialPreferences)) {
			initialPreferences = {};
		}

		this.preferenceObservables = _.mapValues(initialPreferences, ko.observable, ko);
		this.preferenceCount = ko.observable(_.size(this.preferenceObservables));

		this.collapsedCategories = new RexCollapsedCategorySet(_.get(initialPreferences, 'collapsedCategories', []));

		this.plainPreferences = ko.computed(() => {
			//By creating a dependency on the number of preferences, we ensure that the observable will be re-evaluated
			//whenever a preference is added or removed.
			this.preferenceCount();

			//This converts preferences to a plain JS object and establishes dependencies on all individual observables.
			let result = _.mapValues(this.preferenceObservables, function (observable) {
				return observable();
			});

			result.collapsedCategories = this.collapsedCategories.toJs();

			return result;
		});

		//Avoid excessive AJAX requests.
		this.plainPreferences.extend({rateLimit: {timeout: 5000, method: "notifyWhenChangesStop"}});

		//Save preferences when they change.
		if (ajaxUrl && updateNonce) {
			this.plainPreferences.subscribe((preferences) => {
				//console.info('Saving user preferences', preferences);
				jQuery.post(
					ajaxUrl,
					{
						action: 'ws_ame_rex_update_user_preferences',
						_ajax_nonce: updateNonce,
						preferences: ko.toJSON(preferences)
					}
				)
			});
		}
	}

	getObservable<T>(name: string, defaultValue: T = null): KnockoutObservable<T> {
		if (this.preferenceObservables.hasOwnProperty(name)) {
			return this.preferenceObservables[name];
		}

		const newPreference = ko.observable(defaultValue || null);
		this.preferenceObservables[name] = newPreference;
		this.preferenceCount(this.preferenceCount() + 1);

		return newPreference;
	}
}

/**
 * An observable collection of unique strings. In this case, they're category slugs.
 */
class RexCollapsedCategorySet {
	readonly items: KnockoutObservableArray<string>;
	private isItemInSet: AmeDictionary<KnockoutObservable<boolean>> = {};

	constructor(items: string[] = []) {
		items = wsAmeLodash.uniq(items);
		for (let i = 0; i < items.length; i++) {
			this.isItemInSet[items[i]] = ko.observable(true);
		}
		this.items = ko.observableArray(items);
	}

	private getItemObservable(item: string) {
		if (!this.isItemInSet.hasOwnProperty(item)) {
			this.isItemInSet[item] = ko.observable(false);
		}
		return this.isItemInSet[item];
	}

	add(item: string) {
		if (!this.contains(item)) {
			this.getItemObservable(item)(true);
			this.items.push(item);
		}
	}

	remove(item: string) {
		if (this.contains(item)) {
			this.isItemInSet[item](false);
			this.items.remove(item);
		}
	}

	toggle(item: string, addToSet: boolean) {
		if (addToSet) {
			this.add(item);
		} else {
			this.remove(item);
		}
	}

	contains(item: string): boolean {
		return this.getItemObservable(item)();
	}

	peek(item: string): boolean {
		if (!this.isItemInSet.hasOwnProperty(item)) {
			return false;
		}
		return this.isItemInSet[item].peek();
	}

	toJs() {
		return this.items();
	}
}

interface RexCategoryData {
	name: string;
	componentId?: string;
	slug?: string;

	capabilities?: string[];
	permissions?: { [action: string]: string };
	subcategories?: RexCategoryData[];

	variant?: string;
	contentTypeId?: string; //Post type or taxonomy name (internal ID, not display name).
}

interface RexBaseContentData {
	name: string;
	label: string;
	pluralLabel: string;
	permissions: { [action: string]: string };
	componentId?: string;
}

interface RexPostTypeData extends RexBaseContentData {
	isDefault: boolean;
}

interface RexTaxonomyData extends RexBaseContentData {
}

type RexEditableRoleStrategy = 'auto' | 'none' | 'user-defined-list';

interface RexEditableRoleSettings {
	strategy: RexEditableRoleStrategy;
	userDefinedList: null | { [roleId: string]: true; };
}

interface RexActorEditableRoles {
	[actorId: string]: RexEditableRoleSettings;
}

interface RexAppData {
	knownComponents: { [id: string]: RexComponentData };

	capabilities: { [capabilityName: string]: RexCapabilityData };
	deprecatedCapabilities: CapabilityMap;
	roles: RexRoleData[];
	users: RexUserData[];
	defaultRoleName: string;
	trashedRoles: RexRoleData[];

	coreCategory: RexCategoryData;
	customCategories: RexCategoryData[];
	uncategorizedCapabilities: string[];
	userDefinedCapabilities: CapabilityMap;

	postTypes: { [postType: string]: RexPostTypeData };
	taxonomies: { [taxonomy: string]: RexTaxonomyData };

	metaCapMap: AmeDictionary<string>;

	editableRoles: RexActorEditableRoles;

	selectedActor: string | null;
	userPreferences: AmeDictionary<any>;
	adminAjaxUrl: string;
	updatePreferencesNonce: string;
}

interface RexCategoryViewOption {
	id: string;
	label: string;
}

class RexBaseDialog implements AmeKnockoutDialog {
	isOpen: KnockoutObservable<boolean> = ko.observable(false);
	isRendered: KnockoutObservable<boolean> = ko.observable(false);
	jQueryWidget: JQuery;
	title: KnockoutObservable<string> = null;
	options: AmeDictionary<any> = {
		buttons: []
	};

	constructor() {
		this.isOpen.subscribe((isOpenNow) => {
			if (isOpenNow && !this.isRendered()) {
				this.isRendered(true);
			}
		});
	}

	setupValidationTooltip(inputSelector: string, message: KnockoutObservable<string>) {
		//Display validation messages next to the input field.
		const element = this.jQueryWidget.find(inputSelector).qtip({
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

		message.subscribe((newMessage) => {
			if (newMessage == '') {
				element.qtip('option', 'content.text', 'OK');
				element.qtip('option', 'show.event', '');
				element.qtip('hide');
			} else {
				element.qtip('option', 'content.text', newMessage);
				element.qtip('option', 'show.event', 'focus');
				element.qtip('show');
			}
		});

		//Hide the tooltip when the dialog is closed and prevent it from automatically re-appearing.
		this.isOpen.subscribe((isDialogOpen) => {
			if (!isDialogOpen) {
				element.qtip('option', 'show.event', '');
				element.qtip('hide');
			}
		});
	};
}

interface RexDeletableCapItem {
	capability: RexCapability;
	isSelected: KnockoutObservable<boolean>;
}

class RexDeleteCapDialog extends RexBaseDialog {
	options = {
		buttons: [],
		minWidth: 380
	};

	deletableItems: KnockoutComputed<RexDeletableCapItem[]>;
	selectedItemCount: KnockoutComputed<number>;
	isDeleteButtonEnabled: KnockoutComputed<boolean>;

	private wasEverOpen: KnockoutObservable<boolean> = ko.observable(false);

	constructor(editor: RexRoleEditor) {
		super();
		const _ = wsAmeLodash;

		this.options.buttons.push({
			text: 'Delete Capability',
			'class': 'button button-primary rex-delete-selected-caps',
			click: () => {
				let selectedCapabilities = _.chain(this.deletableItems())
					.filter(function (item) {
						return item.isSelected();
					})
					.pluck<RexCapability>('capability')
					.value();

				//Note: We could remove confirmation if we get an "Undo" feature.
				const noun = (selectedCapabilities.length === 1) ? 'capability' : 'capabilities';
				const warning = 'Caution: Deleting capabilities could break plugins that use those capabilities. '
					+ 'Delete ' + selectedCapabilities.length + ' ' + noun + '?';
				if (!confirm(warning)) {
					return;
				}

				this.isOpen(false);

				editor.deleteCapabilities(selectedCapabilities);

				alert(selectedCapabilities.length + ' capabilities deleted');
			},
			disabled: true
		});

		this.isOpen.subscribe((open) => {
			if (open && !this.wasEverOpen()) {
				this.wasEverOpen(true);
			}
		});

		this.deletableItems = ko.pureComputed({
			read: () => {
				const wpCore = editor.getComponent(':wordpress:');
				return _.chain(editor.capabilities)
					.filter(function (capability) {
						if (capability.originComponent === wpCore) {
							return false;
						}
						return !capability.isDeleted();
					})
					//Pre-populate part of the list when the dialog is closed to ensure it has a non-zero height.
					.take(this.wasEverOpen() ? 1000000 : 30)
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

		this.selectedItemCount = ko.pureComputed({
			read: () => _.filter(this.deletableItems(), function (item) {
				return item.isSelected();
			}).length,
			deferEvaluation: true
		});

		const deleteButtonText = ko.pureComputed({
			read: () => {
				const count = this.selectedItemCount();
				if (count <= 0) {
					return 'Delete Capability';
				} else {
					if (count === 1) {
						return 'Delete 1 Capability';
					} else {
						return ('Delete ' + count + ' Capabilities');
					}
				}
			},
			deferEvaluation: true
		});

		deleteButtonText.subscribe((newText) => {
			this.jQueryWidget
				.closest('.ui-dialog')
				.find('.ui-dialog-buttonset .button-primary .ui-button-text')
				.text(newText);
		});

		this.isDeleteButtonEnabled = ko.pureComputed({
			read: () => {
				return this.selectedItemCount() > 0;
			},
			deferEvaluation: true
		})
	}

	onOpen() {
		//Deselect all items when the dialog is opened.
		const items = this.deletableItems();
		for (let i = 0; i < items.length; i++) {
			if (items[i].isSelected()) {
				items[i].isSelected(false);
			}
		}
	}
}

class RexAddCapabilityDialog extends RexBaseDialog {
	public static readonly states = {
		valid: 'valid',
		empty: 'empty',
		notice: 'notice',
		error: 'error'
	};

	autoCancelButton: boolean = true;
	options: AmeDictionary<any> = {
		minWidth: 380
	};

	capabilityName: KnockoutComputed<string>;
	validationState: KnockoutObservable<string> = ko.observable(RexAddCapabilityDialog.states.empty);
	validationMessage: KnockoutObservable<string> = ko.observable('');
	isAddButtonEnabled: KnockoutComputed<boolean>;

	private readonly editor: RexRoleEditor;

	constructor(editor: RexRoleEditor) {
		super();
		const _ = wsAmeLodash;
		this.editor = editor;

		const excludedCaps = ['do_not_allow', 'exist', 'customize'];

		let newCapabilityName = ko.observable('');
		this.capabilityName = ko.computed({
			read: function () {
				return newCapabilityName();
			},
			write: (value) => {
				value = _.trimRight(value);

				//Validate and sanitize the capability name.
				let state = this.validationState,
					message = this.validationMessage;

				//WP API allows completely arbitrary capability names, but this plugin forbids some characters
				//for sanity's sake and to avoid XSS.
				const invalidCharacters = /[><&\r\n\t]/g;
				//While all other characters are allowed, it's recommended to stick to alphanumerics,
				//underscores and dashes. Spaces are also OK because some other plugins use them.
				const suspiciousCharacters = /[^a-z0-9_ -]/ig;
				//PHP doesn't allow numeric string keys, and there's no conceivable reason to start the name with a space.
				const invalidFirstCharacter = /^[\s0-9]/i;

				let foundInvalid = value.match(invalidCharacters);
				let foundSuspicious = value.match(suspiciousCharacters);

				if (foundInvalid !== null) {
					state(RexAddCapabilityDialog.states.error);
					message('Sorry, <code>' + _.escape(_.last(foundInvalid)) + '</code> is not allowed here.');

				} else if (value.match(invalidFirstCharacter) !== null) {
					state(RexAddCapabilityDialog.states.error);
					message('Capability name should start with a letter or an underscore.');

				} else if (editor.capabilityExists(value)) {
					//Duplicates are not allowed.
					state(RexAddCapabilityDialog.states.error);
					message('That capability already exists.');

				} else if (editor.getRole(value) !== null) {
					state(RexAddCapabilityDialog.states.error);
					message('Capability name can\'t be the same as the name of a role.');

				} else if (excludedCaps.indexOf(value) >= 0) {
					state(RexAddCapabilityDialog.states.error);
					message('That is a meta capability or a reserved capability name.');

				} else if (foundSuspicious !== null) {
					state(RexAddCapabilityDialog.states.notice);
					message('For best compatibility, we recommend using only English letters, numbers, and underscores.');

				} else if (value === '') {
					//Empty input, nothing to validate.
					state(RexAddCapabilityDialog.states.empty);
					message('');

				} else {
					state(RexAddCapabilityDialog.states.valid);
					message('');
				}

				newCapabilityName(value);
			}
		});

		const acceptableStates = [RexAddCapabilityDialog.states.valid, RexAddCapabilityDialog.states.notice];
		this.isAddButtonEnabled = ko.pureComputed(() => {
			return (acceptableStates.indexOf(this.validationState()) >= 0);
		});

		this.options.buttons = [{
			text: 'Add Capability',
			'class': 'button button-primary',
			click: () => {
				this.onConfirm();
			},
			disabled: true
		}];
	}

	onOpen(event, ui) {
		//Clear the input when the dialog is opened.
		this.capabilityName('');
	}

	onConfirm() {
		if (!this.isAddButtonEnabled()) {
			return;
		}
		const category = this.editor.addCapability(this.capabilityName().trim());
		this.isOpen(false);

		//Note: Maybe the user doesn't need this alert? Hmm.
		if (!category || (this.editor.categoryViewMode() === RexRoleEditor.listView)) {
			alert('Capability added');
		} else {
			alert('Capability added to the "' + category.getAbsoluteName() + '" category.');
		}
	}
}

class RexAddRoleDialog extends RexBaseDialog {
	roleName: KnockoutObservable<string> = ko.observable('');
	roleDisplayName: KnockoutObservable<string> = ko.observable('');
	roleToCopyFrom: KnockoutObservable<RexRole> = ko.observable(null);

	isAddButtonEnabled: KnockoutComputed<boolean>;

	isNameValid: KnockoutComputed<boolean>;
	nameValidationMessage: KnockoutObservable<string> = ko.observable('');
	isDisplayNameValid: KnockoutComputed<boolean>;
	displayNameValidationMessage: KnockoutObservable<string> = ko.observable('');

	private readonly editor: RexRoleEditor;
	private areTooltipsInitialised: boolean = false;

	private static readonly invalidDisplayNameRegex = /[><&\r\n\t]/;

	constructor(editor: RexRoleEditor) {
		super();
		const _ = wsAmeLodash;
		this.editor = editor;

		this.options.minWidth = 380;
		this.options.buttons.push({
			text: 'Add Role',
			'class': 'button button-primary',
			click: this.onConfirm.bind(this),
			disabled: true
		});

		this.roleDisplayName.extend({rateLimit: 10});
		this.roleName.extend({rateLimit: 10});

		//Role names are restricted - you can only use lowercase Latin letters, numbers and underscores.
		const roleNameCharacterGroup = 'a-z0-9_';
		const invalidCharacterRegex = new RegExp('[^' + roleNameCharacterGroup + ']', 'g');
		const numbersOnlyRegex = /^[0-9]+$/;

		this.isNameValid = ko.computed(() => {
			let name = this.roleName().trim();
			let message = this.nameValidationMessage;

			//Name must not be empty.
			if (name === '') {
				message('');
				return false;
			}

			//Name can only contain certain characters.
			const invalidChars = name.match(invalidCharacterRegex);
			if (invalidChars !== null) {
				let lastInvalidChar = _.last(invalidChars);
				if (lastInvalidChar === ' ') {
					lastInvalidChar = 'space';
				}
				message(
					'Sorry, <code>' + _.escape(lastInvalidChar) + '</code> is not allowed here.<br>'
					+ 'Please enter only lowercase English letters, numbers, and underscores.'
				);
				return false;
			}

			//Numeric names could cause problems with how PHP handles associative arrays.
			if (numbersOnlyRegex.test(name)) {
				message('Numeric names are not allowed. Please add at least one letter or underscore.');
				return false;
			}

			//Name must not be a duplicate.
			let existingRole = editor.getRole(name);
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

		this.isDisplayNameValid = ko.computed(() => {
			let name = this.roleDisplayName();
			let message = this.displayNameValidationMessage;
			return RexAddRoleDialog.validateDisplayName(name, message);
		});

		//Automatically generate a role name from the display name. Basically, turn it into a slug.
		let lastAutoRoleName = null;
		this.roleDisplayName.subscribe((displayName) => {
			let slug = _.snakeCase(displayName);

			//Use the auto-generated role name only if the user hasn't entered their own.
			let currentValue = this.roleName();
			if ((currentValue === '') || (currentValue === lastAutoRoleName)) {
				this.roleName(slug);
			}
			lastAutoRoleName = slug;
		});

		this.isAddButtonEnabled = ko.pureComputed({
			read: () => {
				return (this.roleName() !== '') && (this.roleDisplayName() !== '')
					&& this.isNameValid() && this.isDisplayNameValid();
			},
			deferEvaluation: true
		});
	}

	static validateDisplayName(name: string, validationMessage: KnockoutObservable<string>): boolean {
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
	}

	onOpen(event, ui) {
		//Clear dialog fields when it's opened.
		this.roleName('');
		this.roleDisplayName('');
		this.roleToCopyFrom(null);

		if (!this.areTooltipsInitialised) {
			this.setupValidationTooltip('#rex-new-role-display-name', this.displayNameValidationMessage);
			this.setupValidationTooltip('#rex-new-role-name', this.nameValidationMessage);
			this.areTooltipsInitialised = true;
		}
	}

	onConfirm() {
		if (!this.isAddButtonEnabled()) {
			return;
		}

		this.isOpen(false);

		let caps = {};
		if (this.roleToCopyFrom()) {
			caps = this.roleToCopyFrom().getOwnCapabilities();
		}

		this.editor.addRole(this.roleName(), this.roleDisplayName(), caps);
	}
}

class RexDeleteRoleDialog extends RexBaseDialog {
	isDeleteButtonEnabled: KnockoutComputed<boolean>;

	private editor: RexRoleEditor;
	private isRoleSelected: AmeDictionary<KnockoutObservable<boolean>> = {};

	constructor(editor: RexRoleEditor) {
		super();
		this.editor = editor;

		this.options.minWidth = 420;
		this.options.buttons.push({
			text: 'Delete Role',
			'class': 'button button-primary',
			click: this.onConfirm.bind(this),
			disabled: true
		});

		this.isDeleteButtonEnabled = ko.pureComputed({
			read: () => {
				return this.getSelectedRoles().length > 0;
			},
			deferEvaluation: true
		});
	}

	onConfirm() {
		const _ = wsAmeLodash;
		let rolesToDelete = this.getSelectedRoles();

		//Warn about the dangers of deleting built-in roles.
		let selectedBuiltInRoles = _.filter(rolesToDelete, _.method('isBuiltIn'));
		if (selectedBuiltInRoles.length > 0) {
			const warning = 'Caution: Deleting default roles like ' + _.first(selectedBuiltInRoles).displayName()
				+ ' can prevent you from using certain plugins. This is because some plugins look for specific'
				+ ' role names to determine if a user is allowed to access the plugin.'
				+ '\nDelete ' + selectedBuiltInRoles.length + ' default role(s)?';
			if (!confirm(warning)) {
				return;
			}
		}
		this.editor.deleteRoles(rolesToDelete);
		this.isOpen(false);
	}

	onOpen(event, ui) {
		//Deselect all previously selected roles.
		wsAmeLodash.forEach(this.isRoleSelected, function (isSelected) {
			isSelected(false);
		});
	}

	getSelectionState(roleName: string): KnockoutObservable<boolean> {
		if (!this.isRoleSelected.hasOwnProperty(roleName)) {
			this.isRoleSelected[roleName] = ko.observable(false);
		}
		return this.isRoleSelected[roleName];
	}

	private getSelectedRoles(): RexRole[] {
		const _ = wsAmeLodash;
		let rolesToDelete = [];
		_.forEach(this.editor.roles(), (role) => {
			if (this.getSelectionState(role.name())()) {
				rolesToDelete.push(role);
			}
		});
		return rolesToDelete;
	}
}

class RexRenameRoleDialog extends RexBaseDialog {
	private editor: RexRoleEditor;
	isConfirmButtonEnabled: KnockoutComputed<boolean>;
	selectedRole: KnockoutObservable<RexRole> = ko.observable(null);

	newDisplayName: KnockoutObservable<string> = ko.observable('');
	displayNameValidationMessage: KnockoutObservable<string> = ko.observable('');
	isTooltipInitialised: boolean = false;

	constructor(editor: RexRoleEditor) {
		super();
		this.editor = editor;

		this.options.minWidth = 380;
		this.options.buttons.push({
			text: 'Rename Role',
			'class': 'button button-primary',
			click: this.onConfirm.bind(this),
			disabled: true
		});

		this.selectedRole.subscribe((role) => {
			if (role) {
				this.newDisplayName(role.displayName());
			}
		});

		this.isConfirmButtonEnabled = ko.computed({
			read: () => {
				return RexAddRoleDialog.validateDisplayName(this.newDisplayName(), this.displayNameValidationMessage);
			},
			deferEvaluation: true
		});
	}

	onOpen(event, ui) {
		const _ = wsAmeLodash;

		if (!this.isTooltipInitialised) {
			this.setupValidationTooltip('#rex-edited-role-display-name', this.displayNameValidationMessage);
			this.isTooltipInitialised = true;
		}

		//Select either the currently selected role or the first available role.
		const selectedActor = this.editor.selectedActor();
		if (selectedActor && (selectedActor instanceof RexRole)) {
			this.selectedRole(selectedActor);
		} else {
			this.selectedRole(_.first(this.editor.roles()));
		}
	}

	onConfirm() {
		if (!this.isConfirmButtonEnabled()) {
			return;
		}
		if (this.selectedRole()) {
			const name = this.newDisplayName().trim();
			this.selectedRole().displayName(name);
			this.editor.actorSelector.repopulate();
		}
		this.isOpen(false);
	}
}

class RexEagerObservableStringSet {
	private items: Record<string, KnockoutObservable<boolean>> = {};

	public contains(item: string): boolean {
		if (!this.items.hasOwnProperty(item)) {
			this.items[item] = ko.observable(false);
			return false;
		}
		return this.items[item]();
	}

	public add(item: string) {
		if (!this.items.hasOwnProperty(item)) {
			this.items[item] = ko.observable(true);
		} else {
			this.items[item](true);
		}
	}

	public remove(item: string) {
		if (this.items.hasOwnProperty(item)) {
			this.items[item](false);
		}
	}

	public clear() {
		const _ = wsAmeLodash;
		_.forEach(this.items, (isInSet) => {
			isInSet(false);
		});
	}

	public getPresenceObservable(item: string): KnockoutObservable<boolean> {
		if (!this.items.hasOwnProperty(item)) {
			this.items[item] = ko.observable(false);
		}
		return this.items[item];
	}

	public getAsObject<T>(fillValue: T | boolean = true): Record<string, T> {
		const _ = wsAmeLodash;
		let output = {};
		_.forEach(this.items, (isInSet, item) => {
			if (isInSet()) {
				output[item] = fillValue;
			}
		});
		return output;
	}
}

class RexObservableEditableRoleSettings {
	strategy: KnockoutObservable<RexEditableRoleStrategy>;
	userDefinedList: RexEagerObservableStringSet;

	constructor() {
		this.strategy = ko.observable('auto');
		this.userDefinedList = new RexEagerObservableStringSet();
	}

	toPlainObject(): RexEditableRoleSettings {
		let roleList = this.userDefinedList.getAsObject<true>(true);
		if (wsAmeLodash.isEmpty(roleList)) {
			roleList = null;
		}
		return {
			strategy: this.strategy(),
			userDefinedList: roleList
		};
	}
}

class RexUserRoleModule {
	primaryRole: KnockoutObservable<RexRole | null>;
	private roleObservables: {
		[roleId: string]: {
			role: RexRole;
			selectedActorHasRole: KnockoutComputed<boolean>;
		}
	} = {};

	private readonly selectedActor: KnockoutObservable<RexBaseActor>;
	public readonly sortedRoles: KnockoutObservable<RexRole[]>;

	public readonly isVisible: KnockoutObservable<boolean>;

	constructor(selectedActor: KnockoutObservable<RexBaseActor>, roles: KnockoutObservableArray<RexRole>) {
		this.selectedActor = selectedActor;
		this.sortedRoles = ko.computed(() => {
			return roles();
		});
		this.primaryRole = ko.computed({
			read: () => {
				const actor = selectedActor();
				if ((actor === null) || !actor.canHaveRoles) {
					return null;
				}
				if (actor instanceof RexUser) {
					const roles = actor.roles();
					if (roles.length < 1) {
						return null;
					}
					return roles[0];
				}
				return null;
			},
			write: (newRole: RexRole | null) => {
				const actor = selectedActor();
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

				if (!this.canAssignRoleToActor(newRole)) {
					return;
				}

				//Remove the previous primary role.
				const oldPrimaryRole = (actor.roles().length > 0) ? actor.roles()[0] : null;
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

		this.isVisible = ko.pureComputed(() => {
			const actor = this.selectedActor();
			return (actor !== null) && actor.canHaveRoles;
		});
	}

	// noinspection JSUnusedGlobalSymbols Used in Knockout templates.
	actorHasRole(role: RexRole): KnockoutObservable<boolean> {
		const roleActorId = role.getId();
		if (this.roleObservables.hasOwnProperty(roleActorId) && (this.roleObservables[roleActorId].role === role)) {
			return this.roleObservables[roleActorId].selectedActorHasRole;
		}

		let selectedActorHasRole = ko.computed<boolean>({
			read: () => {
				const actor = this.selectedActor();
				if ((actor === null) || !actor.canHaveRoles) {
					return false;
				}
				if (actor instanceof RexUser) {
					return (actor.roles.indexOf(role) !== -1);
				}
				return false;
			},
			write: (shouldHaveRole) => {
				const actor = this.selectedActor();
				if ((actor === null) || !actor.canHaveRoles || !(actor instanceof RexUser)) {
					return;
				}
				if (!this.canAssignRoleToActor(role)) {
					return;
				}

				const alreadyHasRole = (actor.roles.indexOf(role) !== -1);
				if (shouldHaveRole !== alreadyHasRole) {
					if (shouldHaveRole) {
						actor.roles.push(role);
					} else {
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
	}

	canAssignRoleToActor(role: RexRole): boolean {
		//This is a stub. The role editor currently doesn't check editable role settings at edit time.
		const actor = this.selectedActor();
		if ((actor === null) || !actor.canHaveRoles) {
			return false;
		}
		return (role instanceof RexRole);
	}
}

class RexEditableRolesDialog extends RexBaseDialog {
	private editor: RexRoleEditor;
	private readonly visibleActors: KnockoutObservableArray<IAmeActor>;
	selectedActor: KnockoutObservable<RexBaseActor> = ko.observable(null);

	private actorSettings: { [actorId: string]: RexObservableEditableRoleSettings; } = {};
	private selectedActorSettings: KnockoutObservable<RexObservableEditableRoleSettings>;

	editableRoleStrategy: KnockoutComputed<string>;
	isAutoStrategyAllowed: KnockoutComputed<boolean>;
	isListStrategyAllowed: KnockoutComputed<boolean>;

	constructor(editor: RexRoleEditor) {
		super();
		this.editor = editor;
		this.visibleActors = ko.observableArray([]);

		this.options.minWidth = 600;
		this.options.buttons.push({
			text: 'Save Changes',
			'class': 'button button-primary',
			click: this.onConfirm.bind(this),
			disabled: false
		});

		//Super Admin is always set to "leave unchanged" because
		//they can edit all roles.
		const superAdmin = editor.getSuperAdmin();
		const superAdminSettings = new RexObservableEditableRoleSettings();
		superAdminSettings.strategy('none');

		const dummySettings = new RexObservableEditableRoleSettings();
		this.selectedActorSettings = ko.computed(() => {
			if (this.selectedActor() === null) {
				return dummySettings;
			}
			if (this.selectedActor() === superAdmin) {
				return superAdminSettings;
			}
			const actorId = this.selectedActor().getId();
			if (!this.actorSettings.hasOwnProperty(actorId)) {
				//This should never happen; the dictionary should be initialised when opening the dialog.
				this.actorSettings[actorId] = new RexObservableEditableRoleSettings();
			}
			return this.actorSettings[actorId];
		});

		this.editableRoleStrategy = ko.computed({
			read: () => {
				return this.selectedActorSettings().strategy();
			},
			write: (newValue: string) => {
				this.selectedActorSettings().strategy(newValue as RexEditableRoleStrategy);
			}
		});

		this.isAutoStrategyAllowed = ko.computed(() => {
			const actor = this.selectedActor();
			if (actor == null) {
				return true;
			}
			return !(
				(actor === superAdmin)
				|| ((actor instanceof RexUser) && actor.isSuperAdmin)
			);
		});
		this.isListStrategyAllowed = this.isAutoStrategyAllowed;
	}

	onOpen(event, ui) {
		const _ = wsAmeLodash;

		//Copy editable role settings into observables.
		_.forEach(this.editor.actorEditableRoles, (settings: RexEditableRoleSettings, actorId: string) => {
			if (!this.actorSettings.hasOwnProperty(actorId)) {
				this.actorSettings[actorId] = new RexObservableEditableRoleSettings();
			}
			const observableSettings = this.actorSettings[actorId];
			observableSettings.strategy(settings.strategy);
			observableSettings.userDefinedList.clear();
			if (settings.userDefinedList !== null) {
				_.forEach(settings.userDefinedList, (ignored, roleId: string) => {
					observableSettings.userDefinedList.add(roleId);
				});
			}
		});

		this.visibleActors(this.editor.actorSelector.getVisibleActors());

		//Select either the currently selected actor or the first role.
		const selectedActor = this.editor.selectedActor();
		if (selectedActor) {
			this.selectedActor(selectedActor);
		} else {
			this.selectedActor(_.first(this.editor.roles()));
		}
	}

	onConfirm() {
		//Save editable roles
		const _ = wsAmeLodash;
		let settings = this.editor.actorEditableRoles;
		_.forEach(this.actorSettings, (observableSettings, actorId) => {
			if (observableSettings.strategy() === 'auto') {
				//"auto" is the default so we don't need to store anything.
				delete settings[actorId];
			} else {
				settings[actorId] = observableSettings.toPlainObject();
			}
		});

		this.isOpen(false);
	}

	isRoleSetToEditable(role: RexBaseActor) {
		return this.selectedActorSettings().userDefinedList.getPresenceObservable(role.name());
	}

	isRoleEnabled(role: RexBaseActor) {
		return this.editableRoleStrategy() === 'user-defined-list';
	}

	selectItem(actor: RexBaseActor) {
		this.selectedActor(actor);
	}

	getItemText(actor: RexBaseActor): string {
		return this.editor.actorSelector.getNiceName(actor);
	}
}

class RexRoleEditor implements AmeActorManagerInterface {
	public static readonly hierarchyView = {
		label: 'Hierarchy view',
		id: 'hierarchy',
		templateName: 'rex-hierarchy-view-template'
	};
	public static readonly singleCategoryView = {
		label: 'Category view',
		id: 'category',
		templateName: 'rex-single-category-view-template'
	};
	public static readonly listView = {label: 'List view', id: 'list', templateName: 'rex-list-view-template'};
	// noinspection JSUnusedGlobalSymbols
	readonly categoryViewOptions: RexCategoryViewOption[] = [
		RexRoleEditor.hierarchyView,
		RexRoleEditor.singleCategoryView,
		RexRoleEditor.listView
	];

	readonly selectedActor: KnockoutComputed<RexBaseActor>;
	readonly readableNamesEnabled: KnockoutObservable<boolean>;

	roles: KnockoutObservableArray<RexRole>;
	users: KnockoutObservableArray<RexUser>;
	capabilities: { [capability: string]: RexCapability };

	postTypes: { [name: string]: RexPostTypeData };
	taxonomies: { [name: string]: RexTaxonomyData };

	private deprecatedCapabilities: CapabilityMap = {};
	private readonly metaCapabilityMap: AmeDictionary<string>;

	private readonly userDefinedCapabilities: CapabilityMap = {};

	private readonly components: { [id: string]: RexWordPressComponent };
	readonly coreComponent: RexWordPressComponent;

	rootCategory: RexCategory;
	selectedCategory: KnockoutComputed<RexCategory>;
	categoriesBySlug: AmeDictionary<RexCategory> = {};
	categoryViewMode: KnockoutObservable<RexCategoryViewOption>;
	capabilityViewClasses: KnockoutObservable<string>;
	readonly leafCategories: KnockoutComputed<RexCategory[]>;
	allCapabilitiesAsPermissions: KnockoutComputed<RexPermission[]>;
	/**
	 * Index of capabilities that are in the selected category or its subcategories.
	 */
	private readonly capsInSelectedCategory: KnockoutComputed<AmeDictionary<boolean>>;

	private readonly defaultNewUserRoleName: string;
	defaultRoles: KnockoutComputed<RexRole[]>;
	customRoles: KnockoutComputed<RexRole[]>;
	trashedRoles: KnockoutObservableArray<RexRole>;

	actorSelector: AmeActorSelector;
	private actorLookup: AmeDictionary<RexBaseActor> = {};
	private readonly dummyActor: RexRole;
	permissionTipSubject: KnockoutObservable<RexPermission>;

	searchQuery: KnockoutObservable<string>;
	searchKeywords: KnockoutComputed<string[]>;

	public readonly userPreferences: RexUserPreferences;

	public actorEditableRoles: RexActorEditableRoles;

	public readonly isLoaded: KnockoutObservable<boolean>;
	public readonly areBindingsApplied: KnockoutObservable<boolean>;

	/**
	 * Show deprecated capabilities.
	 */
	showDeprecatedEnabled: KnockoutObservable<boolean>;
	/**
	 * Show CPT or taxonomy permissions that use the same capability as another permission on that CPT/taxonomy.
	 */
	showRedundantEnabled: KnockoutObservable<boolean>;
	/**
	 * Show CPT or taxonomy capabilities that match the built-in "Posts" post type or the "Categories" taxonomy.
	 */
	showBaseCapsEnabled: KnockoutObservable<boolean>;

	/**
	 * Show only checked (granted) capabilities.
	 */
	showOnlyCheckedEnabled: KnockoutObservable<boolean>;

	showNumberOfCapsEnabled: KnockoutObservable<boolean>;
	showTotalCapCountEnabled: KnockoutObservable<boolean>;
	showGrantedCapCountEnabled: KnockoutObservable<boolean>;
	showZerosEnabled: KnockoutObservable<boolean>;

	categoryWidthMode: KnockoutObservable<string>;

	inheritanceOverrideEnabled: KnockoutObservable<boolean>;

	deleteCapabilityDialog: AmeKnockoutDialog;
	addCapabilityDialog: RexAddCapabilityDialog;
	addRoleDialog: AmeKnockoutDialog;
	deleteRoleDialog: AmeKnockoutDialog;
	renameRoleDialog: AmeKnockoutDialog;
	editableRolesDialog: AmeKnockoutDialog;

	userRoleModule: RexUserRoleModule;

	settingsFieldData: KnockoutObservable<string>;
	isSaving: KnockoutObservable<boolean>;
	isGlobalSettingsUpdate: KnockoutObservable<boolean>;

	public readonly isShiftKeyDown: KnockoutObservable<boolean>;

	constructor(data: RexAppData) {
		const self = this;
		const _ = wsAmeLodash;

		this.areBindingsApplied = ko.observable(false);
		this.isLoaded = ko.computed(() => {
			return this.areBindingsApplied();
		});

		this.userPreferences = new RexUserPreferences(data.userPreferences, data.adminAjaxUrl, data.updatePreferencesNonce);

		const preferences = this.userPreferences;
		this.showDeprecatedEnabled = preferences.getObservable('showDeprecatedEnabled', true);
		this.showRedundantEnabled = preferences.getObservable('showRedundantEnabled', false);
		this.showBaseCapsEnabled = ko.computed<boolean>(this.showRedundantEnabled);
		this.showOnlyCheckedEnabled = preferences.getObservable('showOnlyCheckedEnabled', false);
		this.categoryWidthMode = preferences.getObservable<string>('categoryWidthMode', 'adaptive');

		this.readableNamesEnabled = preferences.getObservable<boolean>('readableNamesEnabled', true);

		this.showNumberOfCapsEnabled = preferences.getObservable('showNumberOfCapsEnabled', true);
		this.showGrantedCapCountEnabled = preferences.getObservable('showGrantedCapCountEnabled', true);
		this.showTotalCapCountEnabled = preferences.getObservable('showTotalCapCountEnabled', true);
		this.showZerosEnabled = preferences.getObservable('showZerosEnabled', false);
		this.inheritanceOverrideEnabled = preferences.getObservable('inheritanceOverrideEnabled', false);

		//Remember and restore the selected view mode.
		let viewModeId = preferences.getObservable('categoryVewMode', 'hierarchy');
		let initialViewMode = _.find(this.categoryViewOptions, 'id', viewModeId());
		if (!initialViewMode) {
			initialViewMode = RexRoleEditor.hierarchyView;
		}
		this.categoryViewMode = ko.observable(initialViewMode);
		this.categoryViewMode.subscribe(function (newMode) {
			viewModeId(newMode.id);
		});

		this.isShiftKeyDown = ko.observable(false);

		this.capabilityViewClasses = ko.pureComputed({
			read: () => {
				const viewMode = this.categoryViewMode();
				let classes = ['rex-category-view-mode-' + viewMode.id];
				if (viewMode === RexRoleEditor.singleCategoryView) {
					classes.push('rex-show-category-subheadings');
				}
				if (this.readableNamesEnabled()) {
					classes.push('rex-readable-names-enabled');
				}
				if (this.categoryWidthMode() === 'full') {
					classes.push('rex-full-width-categories');
				}
				return classes.join(' ');
			},
			deferEvaluation: true
		});

		this.searchQuery = ko.observable('').extend({rateLimit: {timeout: 100, method: "notifyWhenChangesStop"}});
		this.searchKeywords = ko.computed(function () {
			let query = self.searchQuery().trim();
			if (query === '') {
				return [];
			}

			return wsAmeLodash(query.split(' '))
				.map((keyword) => {
					return keyword.trim()
				})
				.filter((keyword) => {
					return (keyword !== '');
				})
				.value();
		});

		this.components = _.mapValues(data.knownComponents, (details, id) => {
			return RexWordPressComponent.fromJs(id, details);
		});
		this.coreComponent = new RexWordPressComponent(':wordpress:', 'WordPress core');
		this.components[':wordpress:'] = this.coreComponent;

		//Populate roles and users.
		const tempRoleList = [];
		_.forEach(data.roles, (roleData) => {
			const role = new RexRole(roleData.name, roleData.displayName, roleData.capabilities);
			role.hasUsers = roleData.hasUsers;
			tempRoleList.push(role);
			this.actorLookup[role.id()] = role;
		});
		this.roles = ko.observableArray(tempRoleList);

		const tempUserList = [];
		_.forEach(AmeActors.getUsers(), (data) => {
			const user = RexUser.fromAmeUser(data, self);
			tempUserList.push(user);
			this.actorLookup[user.id()] = user;
		});
		this.users = ko.observableArray(tempUserList);

		this.dummyActor = new RexRole('rex-invalid-role', 'Invalid Role');
		this.defaultNewUserRoleName = data.defaultRoleName;
		this.trashedRoles = ko.observableArray(_.map(data.trashedRoles, function (roleData) {
			return RexRole.fromRoleData(roleData);
		}));

		this.actorSelector = new AmeActorSelector(this, true, false);
		//Wrap the selected actor in a computed observable so that it can be used with Knockout.
		let _selectedActor = ko.observable(this.getActor(this.actorSelector.selectedActor));
		this.selectedActor = ko.computed({
			read: function () {
				return _selectedActor();
			},
			write: (newActor: RexBaseActor) => {
				this.actorSelector.setSelectedActor(newActor.id());
			}
		});
		this.actorSelector.onChange((newSelectedActor: string) => {
			_selectedActor(this.getActor(newSelectedActor));
		});

		//Refresh the actor selector when roles are added or removed.
		this.roles.subscribe(() => {
			this.actorSelector.repopulate();
		});

		//Re-select the previously selected actor if possible.
		let initialActor: RexBaseActor = null;
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

		this.capabilities = _.mapValues(data.capabilities, (metadata: RexCapabilityData, name: string) => {
			return RexCapability.fromJs(name, metadata, self);
		});

		//Add the special "do_not_allow" capability. Normally, it's impossible to assign it to anyone,
		//but it can still be used in post type permissions and other places.
		const doNotAllow = new RexDoNotAllowCapability(this);
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

		const coreCategory = RexCategory.fromJs(data.coreCategory, this);
		this.rootCategory.addSubcategory(coreCategory);

		const postTypeCategory = new RexPostTypeContainerCategory('Post Types', this, 'postTypes');
		this.postTypes = _.indexBy(data.postTypes, 'name');
		_.forEach(this.postTypes, (details: RexPostTypeData, id) => {
			const category = new RexPostTypeCategory(details.label, self, id, 'postTypes/' + id, details.permissions, details.isDefault);
			if (details.componentId) {
				category.origin = this.getComponent(details.componentId);
			}
			postTypeCategory.addSubcategory(category);

			//Record the post type actions associated with each capability.
			for (let action in details.permissions) {
				const capability = self.getCapability(details.permissions[action]);
				_.set(capability.usedByPostTypeActions, [details.name, action], true);
			}
		});
		//Sort the actual subcategory array.
		postTypeCategory.sortSubcategories();
		this.rootCategory.addSubcategory(postTypeCategory);

		//Taxonomies.
		this.taxonomies = data.taxonomies;
		const taxonomyCategory = new RexTaxonomyContainerCategory('Taxonomies', this, 'taxonomies');
		_.forEach(data.taxonomies, (details, id) => {
			const category = new RexTaxonomyCategory(details.label, self, id, 'taxonomies/' + id, details.permissions);
			taxonomyCategory.addSubcategory(category);

			//Record taxonomy type actions associated with each capability.
			for (let action in details.permissions) {
				const capability = self.getCapability(details.permissions[action]);
				_.set(capability.usedByTaxonomyActions, [details.name, action], true);
			}
		});
		taxonomyCategory.subcategories.sort((a, b) => {
			return a.name.toLowerCase().localeCompare(b.name.toLowerCase());
		});

		this.rootCategory.addSubcategory(taxonomyCategory);

		const customParentCategory = new RexCategory('Plugins', this, 'custom');

		function initCustomCategory(details: RexCategoryData, parent: RexCategory) {
			let category = RexCategory.fromJs(details, self);

			//Sort subcategories by title.
			category.subcategories.sort((a, b) => {
				//Keep the "General" category at the top if there is one.
				if (a.name === b.name) {
					return 0
				} else if (a.name === 'General') {
					return -1;
				} else if (b.name === 'General') {
					return 1;
				}
				return a.name.localeCompare(b.name);
			});

			parent.addSubcategory(category);
		}

		_.forEach(data.customCategories, (details) => {
			initCustomCategory(details, customParentCategory);
		});
		customParentCategory.subcategories.sort((a, b) => {
			return a.name.toLowerCase().localeCompare(b.name.toLowerCase());
		});
		this.rootCategory.addSubcategory(customParentCategory);

		//Make a category for uncategorized capabilities. This one is always at the bottom.
		const uncategorizedCategory = new RexCategory(
			'Uncategorized',
			self,
			'custom/uncategorized',
			data.uncategorizedCapabilities
		);
		customParentCategory.addSubcategory(uncategorizedCategory);

		let _selectedCategory: KnockoutObservable<RexCategory> = ko.observable(null);
		this.selectedCategory = ko.computed({
			read: function () {
				return _selectedCategory();
			},
			write: function (newSelection: RexCategory) {
				const oldSelection = _selectedCategory();
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
			read: () => {
				//Create a permission for each unique, non-deleted capability.
				//Exclude special caps like do_not_allow and exist because they can't be enabled.
				const excludedCaps = ['do_not_allow', 'exist'];
				return _.chain(this.capabilities)
					.map(function (capability) {
						if (excludedCaps.indexOf(capability.name) >= 0) {
							return null;
						}
						return new RexPermission(self, capability);
					})
					.filter(function (value) {
						return value !== null
					})
					.value();
			},
			deferEvaluation: true
		});

		this.capsInSelectedCategory = ko.pureComputed({
			read: () => {
				const category = this.selectedCategory();
				if (!category) {
					return {};
				}

				let caps = {};
				category.countUniqueCapabilities(caps);
				return caps;
			},
			deferEvaluation: true
		});

		this.leafCategories = ko.computed({
			read: () => {
				//So what we want here is a depth-first traversal of the category tree.
				let results: RexCategory[] = [];
				let addedUniqueCategories: AmeDictionary<RexCategory> = {};

				function traverse(category: RexCategory) {
					if (category.subcategories.length < 1) {
						//Eliminate duplicates, like CPTs that show up in the post type category and a plugin category.
						let key = category.getDeDuplicationKey();
						if (!addedUniqueCategories.hasOwnProperty(key)) {
							results.push(category);
							addedUniqueCategories[key] = category;
						} else {
							addedUniqueCategories[key].addDuplicate(category);
						}
						return;
					}

					for (let i = 0; i < category.subcategories.length; i++) {
						traverse(category.subcategories[i]);
					}
				}

				traverse(this.rootCategory);

				results.sort(function (a, b) {
					return a.name.toLowerCase().localeCompare(b.name.toLowerCase());
				});

				return results;
			},
			deferEvaluation: true
		});

		const compareRoleDisplayNames = function (a: RexRole, b: RexRole): number {
			return a.displayName().toLowerCase().localeCompare(b.displayName().toLowerCase());
		};
		this.defaultRoles = ko.pureComputed({
			read: function () {
				return _.filter(self.roles(), function (role: RexRole) {
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

	capabilityMatchesFilters(capability: RexCapability): boolean {
		if (!this.showDeprecatedEnabled() && this.isDeprecated(capability.name)) {
			return false;
		}

		if (this.showOnlyCheckedEnabled() && !capability.isEnabledForSelectedActor()) {
			return false;
		}

		const keywords = this.searchKeywords(),
			capabilityName = capability.name;
		if (keywords.length > 0) {
			const haystack = capabilityName.toLowerCase();
			const matchesKeywords = wsAmeLodash.all(
				keywords,
				function (keyword) {
					return haystack.indexOf(keyword) >= 0;
				}
			);

			if (!matchesKeywords) {
				return false;
			}
		}

		return true;
	}

	isDeprecated(capability: string): boolean {
		return this.deprecatedCapabilities.hasOwnProperty(capability);
	}

	getComponent(componentId: string): RexWordPressComponent | null {
		if (this.components.hasOwnProperty(componentId)) {
			return this.components[componentId];
		}
		return null;
	}

	/**
	 * Get or create a capability instance.
	 */
	getCapability(capabilityName: string, recursionDepth: number = 0): RexCapability {
		//Un-map meta capabilities where possible.
		if (this.metaCapabilityMap.hasOwnProperty(capabilityName) && (recursionDepth < 10)) {
			return this.getCapability(this.metaCapabilityMap[capabilityName], recursionDepth + 1);
		}

		if (!this.capabilities.hasOwnProperty(capabilityName)) {
			const _ = wsAmeLodash;
			if (!_.isString(capabilityName) && !_.isFinite(capabilityName)) {
				return this.getInvalidCapability(capabilityName);
			}

			if (console && console.info) {
				console.info('Capability not found: "' + capabilityName + '". It will be created.');
			}
			capabilityName = String(capabilityName);
			this.capabilities[capabilityName] = new RexCapability(capabilityName, this);
		}
		return this.capabilities[capabilityName];
	}

	private getInvalidCapability(invalidName: any): RexCapability {
		const capabilityName = '[Invalid capability: ' + String(invalidName) + ']';
		if (!this.capabilities.hasOwnProperty(capabilityName)) {
			if (console && console.error) {
				console.error('Invalid capability detected - expected a string but got this: ', invalidName);
			}
			this.capabilities[capabilityName] = new RexInvalidCapability(capabilityName, invalidName, this);
		}
		return this.capabilities[capabilityName];
	}

	getActor(actorId: string): RexBaseActor {
		if (this.actorLookup.hasOwnProperty(actorId)) {
			return this.actorLookup[actorId];
		}
		return this.dummyActor;
	}

	getRole(name: string): RexRole {
		const actorId = 'role:' + name;
		if (this.actorLookup.hasOwnProperty(actorId)) {
			const role = this.actorLookup[actorId];
			if (role instanceof RexRole) {
				return role;
			}
		}
		return null;
	}

	// noinspection JSUnusedGlobalSymbols Testing method used in KO templates.
	setSubjectPermission(permission: RexPermission) {
		this.permissionTipSubject(permission);
	}

	/**
	 * Search a string for the current search keywords and add the "rex-search-highlight" CSS class to each match.
	 *
	 * @param inputString
	 */
	highlightSearchKeywords(inputString: string): string {
		const _ = wsAmeLodash;
		const keywordList = this.searchKeywords();
		if (keywordList.length === 0) {
			return inputString;
		}

		let keywordGroup = _.map(keywordList, _.escapeRegExp).join('|');
		let regex = new RegExp('((?:' + keywordGroup + ')(?:\\s*))+', 'gi');

		return inputString.replace(
			regex,
			function (foundKeywords) {
				//Don't highlight the trailing space after the keyword(s).
				let trailingSpace = '';
				let parts = foundKeywords.match(/^(.+?)(\s+)$/);
				if (parts) {
					foundKeywords = parts[1];
					trailingSpace = parts[2];
				}

				return '<mark class="rex-search-highlight">' + foundKeywords + '</mark>' + trailingSpace;
			}
		);
	}

	actorExists(actorId: string): boolean {
		return this.actorLookup.hasOwnProperty(actorId);
	}

	addUsers(newUsers: IAmeUser[]) {
		wsAmeLodash.forEach(newUsers, (user) => {
			if (!(user instanceof RexUser)) {
				if (console.error) {
					console.error('Cannot add a user. Expected an instance of RexUser, got this:', user);
				}
				return;
			}
			if (!this.actorLookup.hasOwnProperty(user.getId())) {
				this.users.push(user);
				this.actorLookup[user.getId()] = user;
			}
		});
	}

	createUserFromProperties(properties: AmeUserPropertyMap): RexUser {
		return RexUser.fromAmeUserProperties(properties, this);
	}

	getRoles(): AmeDictionary<RexRole> {
		return wsAmeLodash.indexBy(this.roles(), function (role) {
			return role.name();
		});
	}

	getSuperAdmin(): RexSuperAdmin {
		return RexSuperAdmin.getInstance();
	}

	getUser(login: string): RexUser {
		const actorId = 'user:' + login;
		if (this.actorLookup.hasOwnProperty(actorId)) {
			const user = this.actorLookup[actorId];
			if (user instanceof RexUser) {
				return user;
			}
		}
		return null;
	}

	getUsers(): AmeDictionary<RexUser> {
		return wsAmeLodash.indexBy(this.users(), 'userLogin');
	}

	isInSelectedCategory(capabilityName: string): boolean {
		let caps = this.capsInSelectedCategory();
		return caps.hasOwnProperty(capabilityName);
	}

	addCapability(capabilityName: string): RexCategory {
		let capability: RexCapability;
		if (this.capabilities.hasOwnProperty(capabilityName)) {
			capability = this.capabilities[capabilityName];
			if (!capability.isDeleted()) {
				throw 'Cannot add capability "' + capabilityName + '" because it already exists.';
			}
			capability.isDeleted(false);

			this.userDefinedCapabilities[capabilityName] = true;
			return null;
		} else {
			capability = new RexCapability(capabilityName, this);
			capability.notes = 'This capability has not been saved yet. Click the "Save Changes" button to save it.';
			this.capabilities[capabilityName] = capability;

			//Add the new capability to the "Other" or "Uncategorized" category.
			const category = this.categoriesBySlug['custom/uncategorized'];
			const permission = new RexPermission(this, capability);
			category.permissions.push(permission);
			category.sortPermissions();

			this.userDefinedCapabilities[capabilityName] = true;
			return category;
		}
	}

	deleteCapabilities(selectedCapabilities: RexCapability[]) {
		const self = this, _ = wsAmeLodash;
		const targetActors = _.union<RexBaseActor>(this.roles(), this.users());

		_.forEach(selectedCapabilities, function (capability) {
			//Remove it from all roles and visible users.
			_.forEach(targetActors, function (actor) {
				actor.deleteCap(capability.name);
			});
			capability.isDeleted(true);

			delete self.userDefinedCapabilities[capability.name];
		});
	}

	capabilityExists(capabilityName: string): boolean {
		return this.capabilities.hasOwnProperty(capabilityName) && !this.capabilities[capabilityName].isDeleted();
	}

	addRole(name: string, displayName: string, capabilities: CapabilityMap = {}): RexRole {
		let role = new RexRole(name, displayName, capabilities);
		this.actorLookup[role.id()] = role;
		this.roles.push(role);

		//Select the new role.
		this.selectedActor(role);

		return role;
	}

	deleteRoles(roles: RexRole[]) {
		const _ = wsAmeLodash;
		_.forEach(roles, (role) => {
			if (!this.canDeleteRole(role)) {
				throw 'Cannot delete role "' + role.name() + '"';
			}
		});

		this.roles.removeAll(roles);
		this.trashedRoles.push.apply(this.trashedRoles, roles);
		//TODO: Later, add an option to restore deleted roles.
	}

	canDeleteRole(role: RexRole): boolean {
		//Was the role already assigned to any users when the editor was opened?
		if (role.hasUsers) {
			return false;
		}
		//We also need to take into account any unsaved user role changes.
		//Is the role assigned to any of the users currently loaded in the editor?
		const _ = wsAmeLodash;
		if (_.some(this.users(), function (user) {
			return (user.roles.indexOf(role) !== -1);
		})) {
			return false;
		}
		return !this.isDefaultRoleForNewUsers(role);
	}

	isDefaultRoleForNewUsers(role: RexRole): boolean {
		return (role.name() === this.defaultNewUserRoleName);
	}

	// noinspection JSUnusedGlobalSymbols Used in KO templates.
	saveChanges() {
		this.isSaving(true);
		const _ = wsAmeLodash;

		let data = {
			'roles': _.invoke(this.roles(), 'toJs'),
			'users': _.invoke(this.users(), 'toJs'),
			'trashedRoles': _.invoke(this.trashedRoles(), 'toJs'),
			'userDefinedCaps': _.keys(this.userDefinedCapabilities),
			'editableRoles': this.actorEditableRoles
		};

		this.settingsFieldData(ko.toJSON(data));
		jQuery('#rex-save-settings-form').submit();
	}

	updateAllSites() {
		if (!confirm('Apply these role settings to ALL sites? Any changes that you\'ve made to individual sites will be lost.')) {
			return false;
		}
		this.isGlobalSettingsUpdate(true);
		this.saveChanges();
	}
}

declare var wsRexRoleEditorData: RexAppData;

(function () {
	jQuery(function ($) {
		const rootElement = jQuery('#ame-role-editor-root');

		//Initialize the application.
		const app = new RexRoleEditor(wsRexRoleEditorData);
		//The input data can be quite large, so let's give the browser a chance to free up that memory.
		wsRexRoleEditorData = null;

		window['ameRoleEditor'] = app;

		//console.time('Apply Knockout bindings');
		//ko.options.deferUpdates = true;
		ko.applyBindings(app, rootElement.get(0));
		app.areBindingsApplied(true);
		//console.timeEnd('Apply Knockout bindings');

		//Track the state of the Shift key.
		let isShiftKeyDown = false;

		function handleKeyboardEvent(event) {
			const newState = !!(event.shiftKey);
			if (newState !== isShiftKeyDown) {
				isShiftKeyDown = newState;
				app.isShiftKeyDown(isShiftKeyDown);
			}
		}

		$(document).on(
			'keydown.adminMenuEditorRex keyup.adminMenuEditorRex mousedown.adminMenuEditorRex',
			handleKeyboardEvent
		);

		//Initialize permission tooltips.
		let visiblePermissionTooltips = [];

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
						for (let i = visiblePermissionTooltips.length - 1; i >= 0; i--) {
							visiblePermissionTooltips[i].hide();
						}

						let permission = ko.dataFor(api.target.get(0));
						if (permission && (permission instanceof RexPermission)) {
							app.permissionTipSubject(permission);
						}

						//Move the content container to the current tooltip.
						const tipContent = $('#rex-permission-tip');
						if (!$.contains(api.elements.content.get(0), tipContent.get(0))) {
							api.elements.content.empty().append(tipContent);
						}

						visiblePermissionTooltips.push(api);
					},
					hide: function (event, api) {
						const index = visiblePermissionTooltips.indexOf(api);
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
			const $trigger = $(this);
			const $dropdown = $('#' + $trigger.data('target-dropdown-id'));

			event.stopPropagation();
			event.preventDefault();

			function hideThisDropdown(event) {
				//Only do it if the user clicked something outside the dropdown.
				const $clickedDropdown = $(event.target).closest($dropdown.get(0));
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
