/// <reference path="../../../js/knockout.d.ts" />
/// <reference path="../../../js/jquery.d.ts" />
/// <reference path="../../../js/jquery.biscuit.d.ts" />
/// <reference path="../../../js/lodash-3.10.d.ts" />
/// <reference path="../../../modules/actor-selector/actor-selector.ts" />

declare var wsAmeSuperUserSettings: Object;
declare var AmeSelectUsersDialog: any;

class AmeSuperUsers {
	private static _ = wsAmeLodash;
	public superUsers: KnockoutObservableArray<AmeUser>;
	public settingsData: KnockoutComputed<string>;

	private userEditUrl: string;
	private currentUserLogin: string;

	public addButtonText: string = 'Add User';
	public isInfoBoxOpen: KnockoutComputed<boolean>;

	constructor(settings) {
		this.userEditUrl = settings.userEditUrl;
		this.currentUserLogin = settings.currentUserLogin;

		this.superUsers = ko.observableArray([]);
		AmeSuperUsers._.forEach(settings.superUsers, (userDetails) => {
			var user = AmeUser.createFromProperties(userDetails);
			if (!AmeActors.getUser(user.userLogin)) {
				AmeActors.addUsers([user]);
			}
			this.superUsers.push(user);
		});
		this.superUsers.sort(AmeSuperUsers.compareLogins);

		this.settingsData = ko.computed<string>((): string => {
			return AmeSuperUsers._.map(this.superUsers(), 'userId').join(',');
		});

		//Store the state of the info box in a cookie.
		let	initialState = jQuery.cookie('ame_su_info_box_open');
		let _isBoxOpen = ko.observable<boolean>((typeof initialState === 'undefined') ? true : (initialState === '1'));

		this.isInfoBoxOpen = ko.computed<boolean>({
			read: (): boolean => {
				return _isBoxOpen();
			},
			write: (value: boolean) => {
				jQuery.cookie('ame_su_info_box_open', value ? '1' : '0', {expires: 90});
				_isBoxOpen(value);
			}
		});
	}

	public removeUser(user: AmeUser) {
		this.superUsers.remove(user);
	}

	public getEditLink(user: AmeUser) {
		return this.userEditUrl + '?user_id=' + user.userId;
	}

	public selectHiddenUsers() {
		AmeSelectUsersDialog.open({
			selectedUsers: AmeSuperUsers._.map(this.superUsers(), 'userLogin'),
			users: AmeSuperUsers._.indexBy(this.superUsers(), 'userLogin'),
			actorManager: AmeActors,

			currentUserLogin: this.currentUserLogin,
			alwaysIncludeCurrentUser: false,

			save: (selectedUsers: AmeUser[]) => {
				selectedUsers.sort(AmeSuperUsers.compareLogins);
				this.superUsers(selectedUsers);
			}
		});
	}

	private static compareLogins(a: AmeUser, b: AmeUser): number {
		if (a.userLogin > b.userLogin) {
			return 1;
		} else if (a. userLogin < b.userLogin) {
			return -1;
		}
		return 0;
	}

	public formatUserRoles(user: AmeUser): string {
		let displayNames = AmeSuperUsers._.map(user.roles, (roleId) => {
			var actor = AmeActors.getActor('role:' + roleId);
			if (actor) {
				return actor.displayName;
			} else {
				return '[Unknown role]';
			}
		});
		return displayNames.join(', ');
	}

	public toggleInfoBox() {
		this.isInfoBoxOpen(!this.isInfoBoxOpen());
	}
}

jQuery(function() {
	var superUserVM = new AmeSuperUsers(wsAmeSuperUserSettings);
	ko.applyBindings(superUserVM, document.getElementById('ame-super-user-settings'));
});
