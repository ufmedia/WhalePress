/* globals jQuery, wsAmeLodash, ameVisibleUsersScriptData */

window.AmeSelectUsersDialog = (function($, _) {
	'use strict';

	var maxUsersToShow = 30,
		maxLoadedUsers = 150,
		adminAjaxUrl,
		searchUsersNonce = '';

	var /** @var {IAmeUser[]} */
		selectedUsers = [],
		/** @var {IAmeUser[]} */
		loadedUsers = [],
		searchQuery = '',
		searchKeywords = [],
		bestMatch = null,
		currentUserLogin = '',
		alwaysIncludeCurrentUser = false,
		saveCallback = null,
		actorManager = null,

		$dialog,
		$selectedUsersTable,
		$availableUsersTable,
		$searchBox,
		$spinner;


	/**
	 * @param {IAmeUser} user
	 */
	function addSelectedUser(user) {
		//Don't add the same user twice.
		if (_.includes(selectedUsers, user)) {
			return;
		}

		//The list should stay sorted by username.
		var index = _.sortedIndex(selectedUsers, user, 'userLogin');
		selectedUsers.splice(index, 0, user);

		//Add a new row at the same index.
		var row = buildTableRow(user, 'deselect_user');
		if (index === 0) {
			$selectedUsersTable.prepend(row);
		} else {
			row.insertAfter($selectedUsersTable.find('tr').eq(index - 1));
		}

		searchUsers();
	}

	/**
	 * @param {IAmeUser} user
	 * @param {JQuery} tableRow
	 */
	function removeSelectedUser(user, tableRow) {
		//You can't remove the current user, ever.
		if (alwaysIncludeCurrentUser && (user.userLogin === currentUserLogin)) {
			return;
		}

		if (!tableRow) {
			tableRow = $selectedUsersTable.find('tr').filter(function() {
				return ($(this).data('user') === user);
			}).first();
		}
		tableRow.remove();
		selectedUsers = _.without(selectedUsers, user);

		updateSearchResults();
	}

	function searchUsers(newQuery) {
		if (typeof newQuery !== 'undefined') {
			searchQuery = newQuery;
			searchKeywords = _.uniq(_.words(searchQuery));
		}

		requestUsersFromServer();
		updateSearchResults();
	}

	var requestUsersFromServer = _.debounce(
		function() {
			$spinner.addClass('is-active');

			$.getJSON(
				adminAjaxUrl,
				{
					'action' : 'ws_ame_search_users',
					'_ajax_nonce' : searchUsersNonce,
					'query' : searchQuery,
					'limit' : maxLoadedUsers
				},
				function(response) {
					$spinner.removeClass('is-active');

					if (_.has(response, 'error')) {
						if (_.has(console, 'error')) {
							console.error(_.get(response, 'error'));
						}
						return;
					}

					if (_.has(response, 'users')) {
						//Add new results to loaded users.
						var userIndex = _.indexBy(loadedUsers, 'userLogin');
						_.forEach(response.users, function(userDetails) {
							if (!userIndex.hasOwnProperty(userDetails.user_login)) {
								loadedUsers.push(actorManager.createUserFromProperties(userDetails));
							}
						});
					}
					updateSearchResults();
				}
			);
		},
		1000,
		{
			maxWait: 5000
		}
	);

	function updateSearchResults() {
		loadedUsers = _(loadedUsers)
			.forEach(function(user) {
				//Update search score.
				user.searchScore = calculateSearchScore(user, searchQuery, searchKeywords);
			})
			.sortByOrder(['searchScore', 'userLogin'], ['desc', 'asc'])
			.take(maxLoadedUsers) //Conserve memory and keep searches fast.
			.value();

		var matchesToShow = _(loadedUsers)
			.filter(function(user) {
				return user.searchScore > 0;
			})
			.difference(selectedUsers)
			.take(maxUsersToShow)
			.value();

		//Keep the same best match if possible, or just pick the first one.
		if (!_.includes(matchesToShow, bestMatch)) {
			bestMatch = (matchesToShow.length > 0) ? matchesToShow[0] : null;
		}

		//Show the new matches in the table.
		$availableUsersTable.empty();
		_.forEach(matchesToShow, function(user) {
			$availableUsersTable.append(buildTableRow(user, 'select_available_user'));
		});

		scrollRowIntoView($availableUsersTable.find('.ws_user_best_match').first());
	}

	/**
	 *
	 * @param {IAmeUser} user
	 * @param {string} query
	 * @param {string[]} keywords
	 * @returns {number}
	 */
	function calculateSearchScore(user, query, keywords) {
		if (query === '') {
			return 1; //Include all users when there's no query.
		}

		var haystack = user.userLogin.toLowerCase() + '\n' + user.getDisplayName().toLowerCase();
		if (haystack.indexOf(query) >= 0) {
			return 2;
		} else if (_.all(keywords, function(keyword) { return (haystack.indexOf(keyword) >= 0);	})) {
			return 1;
		}
		return 0;
	}

	/**
	 *
	 * @param {IAmeUser} user
	 * @param {string} action
	 * @returns {*|void}
	 */
	function buildTableRow(user, action) {
		if (typeof action === 'undefined') {
			action = 'select_available_user';
		}

		return $('<tr></tr>')
			.data('user', user)
			.toggleClass('ws_user_best_match', user === bestMatch)
			.toggleClass(
				'ws_user_must_be_selected',
				alwaysIncludeCurrentUser && (user.userLogin === currentUserLogin)
			).append($('<td></td>', {
				'class': 'ws_user_action_column',
				'html': '<div class="dashicons dashicons-plus ws_user_action_button ws_' + action + '"></div>'
			})).append($('<td></td>', {
				'text': user.userLogin + ((user.userLogin === currentUserLogin) ? ' (current user)' : ''),
				'class': 'ws_user_username_column'
			})).append($('<td></td>', {
				'text': user.getDisplayName(),
				'class': 'ws_user_display_name_column'
			}));
	}

	function scrollRowIntoView(row) {
		if (row.length < 1) {
			return;
		}

		var rowTop = row.position().top || 0,
			scrollableContainer = $availableUsersTable.closest('.ws_user_list_wrapper'),
			containerScrollTop = scrollableContainer.scrollTop(),
			containerHeight = scrollableContainer.height(),
			rowHeight = row.height(),
			desiredVisibleHeight = Math.min(rowHeight, containerHeight);

		var scrollAmount = 0, visibleHeight = 0;
		if (rowTop > 0) {
			visibleHeight = containerHeight - rowTop;
			if (visibleHeight < desiredVisibleHeight) {
				scrollAmount = desiredVisibleHeight - visibleHeight;
			}
		} else {
			scrollAmount = rowTop;
		}

		if (Math.abs(scrollAmount) >= 1) {
			scrollableContainer.scrollTop(containerScrollTop + scrollAmount);
		}
	}


	$(function() {
		searchUsersNonce = _.get(ameVisibleUsersScriptData, 'searchUsersNonce', null);
		adminAjaxUrl = _.get(ameVisibleUsersScriptData, 'adminAjaxUrl', null);

		$dialog = $('#ws_visible_users_dialog');
		$selectedUsersTable = $('#ws_selected_users');
		$availableUsersTable = $('#ws_available_users');
		$spinner = $('#ws_loading_users_indicator');

		$dialog.dialog({
			autoOpen: false,
			closeText: ' ',
			modal: true,
			minHeight: 100,
			width: 726,
			draggable: false
		});

		$searchBox = $dialog.find('#ws_available_user_query');
		$searchBox.on('change keyup input paste click propertychange ', _.debounce(function() {
			//Normalize query: lowercase, condense whitespace, trim.
			var newQuery = $searchBox.val();

			function jsTrim(str){
				return str.replace(/^\s+|\s+$/g, "");
			}

			newQuery = jsTrim(newQuery.toLowerCase().replace(/\s{2,}/, ' '));

			if (newQuery !== searchQuery) {
				searchUsers(newQuery);
			}
		}, 200, {maxWait: 1000}));

		//Search box keyboard shortcuts.
		$searchBox.on('keydown', function(event) {
			var currentRow = $availableUsersTable.find('tr.ws_user_best_match').first(),
				nextRow = currentRow;
			if (currentRow.length === 0) {
				return;
			}

			switch(event.which) {
				//Up: Select the previous row.
				case 38:
					nextRow = currentRow.prev('tr');
					if (nextRow.length === 0) {
						nextRow = $availableUsersTable.find('tr').last();
					}
					break;

				//Down: Select the next row.
				case 40:
					nextRow = currentRow.next('tr');
					if (nextRow.length === 0) {
						nextRow = $availableUsersTable.find('tr').first();
					}
					break;

				//Enter: Add the current selection to the list of selected users.
				case 13:
					addSelectedUser(currentRow.data('user'));

					currentRow.remove();
					bestMatch = null;
					nextRow = null;

					$searchBox.val('');
					searchUsers('');
					break;
			}

			if (nextRow && nextRow.length > 0) {
				bestMatch = nextRow.data('user');
				$availableUsersTable.find('tr').removeClass('ws_user_best_match');
				nextRow.addClass('ws_user_best_match');
				scrollRowIntoView(nextRow);
			}
		});


		//Add a user.
		$availableUsersTable.on('click', 'tr', function() {
			var row = $(this).closest('tr'),
				user = row.data('user');
			row.remove();
			addSelectedUser(user);
			searchUsers();
		});

		//Remove a user.
		$selectedUsersTable.on('click', '.ws_user_action_button', function() {
			var row = $(this).closest('tr');
			removeSelectedUser(row.data('user'), row);
		});


		//The save button.
		$dialog.find('#ws_ame_save_visible_users').on('click', function() {
			if (saveCallback) {
				saveCallback(selectedUsers, _.pluck(selectedUsers, 'userLogin'));
			}
			$dialog.dialog('close');
		});

		//The cancel button.
		$dialog.find('.ws_close_dialog').on('click', function() {
			$dialog.dialog('close');
		});
	});

	return {
		/**
		 * @param {Object} options
		 * @param {String} options.currentUserLogin
		 * @param {Boolean} [options.alwaysIncludeCurrentUser]
		 * @param {Function} options.save
		 * @param {String[]} options.selectedUsers
		 * @param {Object.<String, IAmeUser>} options.users
		 * @param {AmeActorManagerInterface} options.actorManager
		 * @param {String} [options.dialogTitle]
		 */
		open: function(options) {
			currentUserLogin = options.currentUserLogin;
			alwaysIncludeCurrentUser = _.get(options, 'alwaysIncludeCurrentUser', false);
			saveCallback = options.save;
			actorManager = options.actorManager;

			var knownUsers = options.users,
				initialSelectedUsers = [].concat(options.selectedUsers); //Don't modify the input array.

			//Always include the current user.
			if (!_.includes(initialSelectedUsers, currentUserLogin) && alwaysIncludeCurrentUser) {
				initialSelectedUsers.unshift(currentUserLogin);
			}

			selectedUsers = _.map(initialSelectedUsers, function(login) {
				return knownUsers[login];
			});

			//Use the user objects provided by the plugin whenever possible.
			//We don't want to have two different instances for the same user.
			loadedUsers = _(loadedUsers)
				.map(function(user) {
					if (knownUsers.hasOwnProperty(user.userLogin)) {
						return knownUsers[user.userLogin];
					} else {
						return user;
					}
				})
				.union(_.values(knownUsers))
				.value();

			//Populate the "selected users" table.
			$selectedUsersTable.empty();
			_.forEach(selectedUsers, function(user) {
				$selectedUsersTable.append(buildTableRow(user, 'deselect_user'));
			});

			bestMatch = null;
			$searchBox.val('');
			searchUsers('');

			$dialog.dialog('option', 'title', _.get(options, 'dialogTitle', 'Select Users'));
			$dialog.dialog('open');
			$searchBox.trigger('focus');
		}
	};

})(jQuery, wsAmeLodash);

window.AmeVisibleUserDialog = (function($, _) {
	'use strict';

	return {
		/**
		 * @param {Object} options
		 * @param {String} options.currentUserLogin
		 * @param {Function} options.save
		 * @param {String[]} options.visibleUsers
		 * @param {Object.<String, IAmeUser>} options.users
		 * @param {AmeActorManagerInterface} options.actorManager
		 */
		open: function(options) {
			options = _.assign(
				{
					selectedUsers: options.visibleUsers,
					dialogTitle: 'Select Visible Users',
					alwaysIncludeCurrentUser: true
				},
				options
			);

			window.AmeSelectUsersDialog.open(options);
		}
	};

})(jQuery, wsAmeLodash);