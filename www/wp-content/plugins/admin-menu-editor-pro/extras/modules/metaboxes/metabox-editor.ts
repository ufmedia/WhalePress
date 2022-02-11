/// <reference path="../../../js/lodash-3.10.d.ts" />
/// <reference path="../../../js/knockout.d.ts" />
/// <reference path="../../../modules/actor-selector/actor-selector.ts" />
/// <reference path="../../../js/common.d.ts" />

declare const wsAmeMetaBoxEditorData;

interface MetaBoxEditorSettings {
	format: {
		name: string,
		version: string
	},
	screens: {[id: string] : ScreenSettingsData};
	isInitialRefreshDone: boolean;
}

interface ScreenSettingsData {
	'metaBoxes:': MetaBoxPropertyMap;
	'postTypeFeatures:': any;
}

class AmeMetaBoxEditor {
	private static _ = wsAmeLodash;

	screens: Array<AmeMetaBoxCollection>;

	actorSelector: AmeActorSelector;
	selectedActor: KnockoutComputed<IAmeActor|null>;

	settingsData: KnockoutObservable<string>;
	canAnyBoxesBeDeleted: boolean = false;

	isSlugWarningEnabled: KnockoutObservable<boolean>;

	private readonly forceRefreshUrl: string;

	constructor(settings: MetaBoxEditorSettings, forceRefreshUrl: string) {
		this.actorSelector = new AmeActorSelector(AmeActors, true);

		//Wrap the selected actor in a computed observable so that it can be used with Knockout.
		let _selectedActor = ko.observable(
			this.actorSelector.selectedActor
				? AmeActors.getActor(this.actorSelector.selectedActor)
				: null
		);
		this.selectedActor = ko.computed<AmeBaseActor|null>({
			read: function () {
				return _selectedActor();
			},
			write: (newActor: AmeBaseActor) => {
				this.actorSelector.setSelectedActor(newActor ? newActor.id : null);
			}
		});
		this.actorSelector.onChange((newSelectedActorId: string|null) => {
			if (newSelectedActorId === null) {
				_selectedActor(null);
			} else {
				_selectedActor(AmeActors.getActor(newSelectedActorId));
			}
		});

		this.screens = AmeMetaBoxEditor._.map(settings.screens, (screenData, id) => {
			let metaBoxes = screenData['metaBoxes:'];
			if(AmeMetaBoxEditor._.isEmpty(metaBoxes)) {
				metaBoxes = {};
			}

			if (screenData['postTypeFeatures:'] && !AmeMetaBoxEditor._.isEmpty(screenData['postTypeFeatures:'])) {
				const features = screenData['postTypeFeatures:'];
				for(let featureName in features) {
					if (features.hasOwnProperty(featureName)) {
						metaBoxes['cpt-feature:' + featureName] = features[featureName];
					}
				}
			}

			return new AmeMetaBoxCollection(id, metaBoxes, this);
		});
		this.screens.sort(function(a, b) {
			return a.formattedTitle.localeCompare(b.formattedTitle);
		});

		this.canAnyBoxesBeDeleted = AmeMetaBoxEditor._.some(this.screens, 'canAnyBeDeleted');

		this.settingsData = ko.observable('');
		this.forceRefreshUrl = forceRefreshUrl;
		this.isSlugWarningEnabled = ko.observable(true);
	}

	//noinspection JSUnusedGlobalSymbols It's actually used in the KO template, but PhpStorm doesn't realise that.
	saveChanges() {
		let settings = this.getCurrentSettings();

		//Set the hidden form fields.
		this.settingsData(JSON.stringify(settings));

		//Submit the form.
		return true;
	}

	protected getCurrentSettings(): MetaBoxEditorSettings {
		const collectionFormatName = 'Admin Menu Editor meta boxes',
			collectionFormatVersion = '1.0';

		let settings: MetaBoxEditorSettings = {
			format: {
				name: collectionFormatName,
				version: collectionFormatVersion
			},
			screens: {},
			isInitialRefreshDone: true
		};

		const _ = AmeMetaBoxEditor._;
		_.forEach(this.screens, function (collection) {
			let thisScreenData = {
				'metaBoxes:' : {},
				'postTypeFeatures:' : {}
			};
			_.forEach(collection.boxes(), function(metaBox) {
				let key = metaBox.parentCollectionKey ? metaBox.parentCollectionKey : 'metaBoxes:';
				thisScreenData[key][metaBox.id] = metaBox.toPropertyMap();
			});
			settings.screens[collection.screenId] = thisScreenData;
		});

		return settings;
	}

	//noinspection JSUnusedGlobalSymbols It's used in the KO template.
	promptForRefresh() {
		if (confirm('Refresh the list of available meta boxes?\n\nWarning: Unsaved changes will be lost.')) {
			window.location.href = this.forceRefreshUrl;
		}
	}
}

class AmeMetaBox {
	private static _ = wsAmeLodash;
	protected static counter = 0;
	uniqueHtmlId: string;

	id: string;
	title: string;
	context: string;
	safeTitle: KnockoutComputed<string>;
	parentCollectionKey?: string;

	isAvailable: KnockoutComputed<boolean>;
	grantAccess: AmeActorAccessDictionary;

	isVisibleByDefault: KnockoutComputed<boolean>;
	defaultVisibility: AmeActorAccessDictionary;
	isHiddenByDefault: boolean = false;
	canChangeDefaultVisibility: KnockoutComputed<boolean>;

	canBeDeleted: boolean = false;
	isVirtual: boolean = false;
	tooltipText: string = null;

	private readonly initialProperties: MetaBoxPropertyMap;
	protected metaBoxEditor: AmeMetaBoxEditor;

	constructor(settings: MetaBoxPropertyMap, metaBoxEditor: AmeMetaBoxEditor) {
		AmeMetaBox.counter++;
		this.uniqueHtmlId = 'ame-mb-item-' + AmeMetaBox.counter;

		const _ = AmeMetaBox._;
		this.metaBoxEditor = metaBoxEditor;
		this.initialProperties = settings;

		if (settings['parentCollectionKey']) {
			this.parentCollectionKey = settings['parentCollectionKey'];
		}

		this.id = settings['id'];
		this.title = _.get(settings, 'title', '[Untitled widget]');
		this.context = _.get(settings, 'context', 'normal');
		this.isHiddenByDefault = _.get(settings, 'isHiddenByDefault', false);

		this.grantAccess = new AmeActorAccessDictionary(_.get(settings, 'grantAccess', {}));
		this.defaultVisibility = new AmeActorAccessDictionary(_.get(settings, 'defaultVisibility', {}));

		this.canBeDeleted = !_.get(settings, 'isPresent', true);

		this.isVirtual = _.get(settings, 'isVirtual', false);
		if (this.isVirtual) {
			this.tooltipText = 'Technically, this is not a meta box, but it\'s included here for convenience.';
		}

		this.isAvailable = ko.computed({
			read: () => {
				const actor = metaBoxEditor.selectedActor();
				if (actor !== null) {
					return AmeMetaBox.actorHasAccess(actor, this.grantAccess, true, true);
				} else {
					//Check if any actors have this widget enabled.
					//We only care about visible actors. There might be some users that are loaded but not visible.
					const actors = metaBoxEditor.actorSelector.getVisibleActors();
					return _.some(actors, (anActor) => {
						return AmeMetaBox.actorHasAccess(anActor, this.grantAccess, true, true);
					});
				}
			},
			write: (checked: boolean) => {
				if ((this.id === 'slugdiv') && !checked && this.metaBoxEditor.isSlugWarningEnabled()) {
					const warningMessage =
						'Hiding the "Slug" metabox can prevent the user from changing the post slug.\n'
						+ 'This is caused by a known bug in WordPress core.\n'
						+ 'Do you want to hide this metabox anyway?';
					if (confirm(warningMessage)) {
						//Suppress the warning.
						this.metaBoxEditor.isSlugWarningEnabled(false);
					} else {
						this.isAvailable.notifySubscribers();
						return;
					}
				}

				const actor = metaBoxEditor.selectedActor();
				if (actor !== null) {
					this.grantAccess.set(actor.getId(), checked);
				} else {
					//Enable/disable all.
					_.forEach(
						metaBoxEditor.actorSelector.getVisibleActors(),
						(anActor) => { this.grantAccess.set(anActor.getId(), checked); }
					);
				}
			}
		});

		this.isVisibleByDefault = ko.computed({
			read: () => {
				const actor = metaBoxEditor.selectedActor();
				if (actor !== null) {
					return AmeMetaBox.actorHasAccess(actor, this.defaultVisibility, !this.isHiddenByDefault, null);
				} else {
					const actors = metaBoxEditor.actorSelector.getVisibleActors();
					return _.some(actors, (anActor) => {
						return AmeMetaBox.actorHasAccess(anActor, this.defaultVisibility, !this.isHiddenByDefault, null);
					});
				}
			},
			write: (checked) => {
				const actor = metaBoxEditor.selectedActor();
				if (actor !== null) {
					this.defaultVisibility.set(actor.getId(), checked);
				} else {
					//Enable/disable all.
					_.forEach(
						metaBoxEditor.actorSelector.getVisibleActors(),
						(anActor) => { this.defaultVisibility.set(anActor.getId(), checked); }
					);
				}
			}
		});

		this.canChangeDefaultVisibility = ko.computed(() => {
			return this.isAvailable() && !this.isVirtual;
		});

		this.safeTitle = ko.computed(() => {
			return AmeMetaBox.stripAllTags(this.title);
		});
	}

	private static actorHasAccess(
		actor: IAmeActor,
		grants: AmeActorAccessDictionary,
		roleDefault: boolean = true,
		superAdminDefault: boolean | null = true
	) {
		//Is there a setting for this actor specifically?
		let hasAccess = grants.get(actor.getId(), null);
		if (hasAccess !== null) {
			return hasAccess;
		}

		if (actor instanceof AmeUser) {
			//The Super Admin has access to everything by default, and it takes priority over roles.
			if (actor.isSuperAdmin) {
				const adminHasAccess = grants.get('special:super_admin', null);
				if (adminHasAccess !== null) {
					return adminHasAccess;
				} else if (superAdminDefault !== null) {
					return superAdminDefault;
				}
			}

			//Allow access if at least one role has access.
			let result = false;
			for (let index = 0; index < actor.roles.length; index++) {
				let roleActor = 'role:' + actor.roles[index],
					roleHasAccess = grants.get(roleActor, roleDefault);
				result = result || roleHasAccess;
			}
			return result;
		}

		return roleDefault;
	}

	toPropertyMap() {
		let properties = {
			'id': this.id,
			'title': this.title,
			'context': this.context,
			'grantAccess': this.grantAccess.getAll(),

			'defaultVisibility': this.defaultVisibility.getAll(),
			'isHiddenByDefault': this.isHiddenByDefault
		};

		//Preserve unused properties on round-trip.
		properties = AmeMetaBox._.merge({}, this.initialProperties, properties);

		return properties;
	}

	private static stripAllTags(input: string) {
		//Based on: http://phpjs.org/functions/strip_tags/
		const tags = /<\/?([a-z][a-z0-9]*)\b[^>]*>/gi,
			commentsAndPhpTags = /<!--[\s\S]*?-->|<\?(?:php)?[\s\S]*?\?>/gi;
		return input.replace(commentsAndPhpTags, '').replace(tags, '');
	}
}

interface MetaBoxPropertyMap {
	[name: string] : any;
}

class AmeActorAccessDictionary {
	items: { [actorId: string] : KnockoutObservable<boolean>; } = {};
	private readonly numberOfObservables: KnockoutObservable<number>;

	constructor(initialData?: AmeDictionary<boolean>) {
		this.numberOfObservables = ko.observable(0);
		if (initialData) {
			this.setAll(initialData);
		}
	}

	get(actor: string, defaultValue = null): boolean {
		if (this.items.hasOwnProperty(actor)) {
			return this.items[actor]();
		}
		this.numberOfObservables(); //Establish a dependency.
		return defaultValue;
	}

	set(actor: string, value: boolean) {
		if (!this.items.hasOwnProperty(actor)) {
			this.items[actor] = ko.observable(value);
			this.numberOfObservables(this.numberOfObservables() + 1);
		} else {
			this.items[actor](value);
		}
	}

	getAll(): AmeDictionary<boolean> {
		let result: AmeDictionary<boolean> = {};
		for (let actorId in this.items) {
			if (this.items.hasOwnProperty(actorId)) {
				result[actorId] = this.items[actorId]();
			}
		}
		return result;
	}

	setAll(values: AmeDictionary<boolean>) {
		for (let actorId in values) {
			if (values.hasOwnProperty(actorId)) {
				this.set(actorId, values[actorId]);
			}
		}
	}
}

class AmeMetaBoxCollection {
	private static _ = wsAmeLodash;

	screenId: string;
	formattedTitle: string;
	boxes: KnockoutObservableArray<AmeMetaBox>;

	canAnyBeDeleted: boolean = false;

	constructor(screenId: string, metaBoxes: {[id: string]: MetaBoxPropertyMap}, metaBoxEditor: AmeMetaBoxEditor) {
		this.screenId = screenId;
		this.formattedTitle = screenId.charAt(0).toUpperCase() + screenId.slice(1);

		this.boxes = ko.observableArray(AmeMetaBoxCollection._.map(metaBoxes, function(properties) {
			return new AmeMetaBox(properties, metaBoxEditor);
		}));

		this.boxes.sort(function(a, b) {
			return a.id.localeCompare(b.id);
		});

		this.canAnyBeDeleted = AmeMetaBoxCollection._.some(this.boxes(), 'canBeDeleted');
	}

	//noinspection JSUnusedGlobalSymbols Use by KO.
	deleteBox(item) {
		this.boxes.remove(item);
	}
}


jQuery(function() {
	let metaBoxEditor = new AmeMetaBoxEditor(wsAmeMetaBoxEditorData.settings, wsAmeMetaBoxEditorData.refreshUrl);
	ko.applyBindings(metaBoxEditor, document.getElementById('ame-meta-box-editor'));

	//Make the column widths the same in all tables.
	const $ = jQuery;
	let tables = $('.ame-meta-box-list'),
		columnCount = tables.find('thead').first().find('th').length,
		maxWidths = wsAmeLodash.fill(Array(columnCount), 0);

	tables.find('tr').each(function() {
		$(this).find('td,th').each(function(index) {
			const width = $(this).width();
			if (maxWidths[index]) {
				maxWidths[index] = Math.max(width, maxWidths[index]);
			} else {
				maxWidths[index] = width;
			}
		})
	});

	tables.each(function() {
		$(this).find('thead th').each(function(index) {
			$(this).width(maxWidths[index]);
		});
	});

	//Set up tooltips.
	if ($['qtip']) {
		$('#ame-meta-box-editor .ws_tooltip_trigger').qtip({
			style: {
				classes: 'qtip qtip-rounded ws_tooltip_node'
			}
		});
	}
});