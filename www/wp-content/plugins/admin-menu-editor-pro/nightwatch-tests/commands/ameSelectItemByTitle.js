module.exports = class AmeSelectItemByTitleCommand {
	/**
	 * Select a menu item in the menu editor.
	 *
	 * If there are multiple items with the same title, this command will only select the first one.
	 *
	 * @param {string[]} titles One or more titles that specify a hierarchical path. Example: ['Posts', 'Add New'].
	 * @param {boolean} [expand]
	 * @param {Function} [callback]
	 * @return {Promise<unknown>|void}
	 */
	command(titles, expand, callback) {
		const browser = this.api;

		if (typeof expand === 'undefined') {
			expand = false;
		}

		if ((typeof titles.length === 'undefined') || (titles.length < 1)) {
			return; //No menu item(s) specified.
		}

		return new Promise((resolve, reject) => {
			function selectRecursively(titles, level, expand) {
				const thisTitle = titles.shift();

				browser.execute(
					function (level, title, expand) {
						const $column = jQuery('#ws_menu_editor .ame-editor-column-' + level);
						if ($column.length < 1) {
							return false;
						}

						const usesSubmenuContainers = ($column.children('.ws_box').children('.ws_submenu').length > 0);
						let $list;
						if (usesSubmenuContainers) {
							$list = $column.find('.ws_submenu:visible').first();
						} else {
							$list = $column.children('.ws_box').first();
						}

						const $item = $list
							.find('.ws_container .ws_item_title:contains("' + title + '")')
							.first()
							.closest('.ws_container')

						if ($item.length < 1) {
							return false;
						}

						$item.click();

						const $expandLink = $item.find('.ws_edit_link');
						if (expand && !$expandLink.hasClass('ws_edit_link_expanded')) {
							$expandLink.click();
						}

						return true;
					},
					[level, thisTitle, expand && (titles.length < 1) /* Only expand the deepest item. */],
					function (result) {
						if (result && result.value === true) {
							if (titles.length > 0) {
								selectRecursively(titles, level + 1, expand);
							} else {
								resolve({value: null});
							}
						} else {
							reject('Cannot select item with title "' + thisTitle + '"');
						}
					}
				);
			}

			selectRecursively(titles, 1, expand);
		});
	}
}