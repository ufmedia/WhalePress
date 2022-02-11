<?php
/**
 * Variables set by ameModule when it outputs a template.
 *
 * @var string $moduleTabUrl
 * @see ameModule::getTabUrl
 */
?>
<div id="ame-super-user-settings">
	<h3>
		Hidden Users
		<a class="page-title-action" href="#"
		   data-bind="click: $root.selectHiddenUsers.bind($root), text: addButtonText">Add</a>
	</h3>

	<table class="wp-list-table widefat fixed striped">
		<thead>
		<tr>
			<th scope="col">Username</th>
			<th scope="col">Name</th>
			<th scope="col">Role</th>
			<th class="ame-column-user-id num" scope="col">ID</th>
		</tr>
		</thead>

		<!-- ko if: (superUsers().length > 0) -->
		<tbody data-bind="foreach: superUsers">
		<tr>
			<td class="column-username">
				<span data-bind="html: avatarHTML"></span>
				<strong><a data-bind="text: userLogin, attr: {href: $root.getEditLink($data)}"></a></strong>

				<div class="row-actions">
					<span><a href="#" data-bind="click: $root.removeUser.bind($root, $data)">Remove</a></span>
				</div>
			</td>
			<td data-bind="text: displayName"></td>
			<td data-bind="text: $root.formatUserRoles($data)"></td>
			<td data-bind="text: userId" class="num"></td>
		</tr>
		</tbody>
		<!-- /ko -->

		<!-- ko if: (superUsers().length <= 0) -->
		<tbody>
		<tr>
			<td colspan="4">
				No users selected. Click "<span data-bind="text: addButtonText"></span>" to hide one or more users.
			</td>
		</tr>
		</tbody>
		<!-- /ko -->

		<tfoot>
		<tr>
			<th>Username</th>
			<th>Name</th>
			<th>Role</th>
			<th class="ame-column-user-id num">ID</th>
		</tr>
		</tfoot>
	</table>

	<form action="<?php echo esc_attr(add_query_arg('noheader', 1, $moduleTabUrl)); ?>" method="post">
		<input type="hidden" name="settings" value="" data-bind="value: settingsData">
		<input type="hidden" name="action" value="ame_save_super_users">
		<?php
		wp_nonce_field('ame_save_super_users');
		submit_button('Save Changes', 'primary', 'submit', true);
		?>
	</form>

	<div class="metabox-holder">
	<div class="postbox ws_ame_doc_box" data-bind="css: {closed: !isInfoBoxOpen()}">
		<button type="button" class="handlediv button-link" data-bind="click: toggleInfoBox.bind($root)">
			<span class="toggle-indicator"></span>
		</button>
		<h2 class="hndle" data-bind="click: toggleInfoBox.bind($root)">How It Works</h2>
		<div class="inside">
			<ul>
				<li>Hidden users don't show up
					on the <a href="<?php echo esc_attr(self_admin_url('users.php')); ?>">Users &rightarrow; All Users</a>
					page.
				</li>
				<li>They can't be edited or deleted by normal users.</li>
				<li>However, they still show up in other places like the "Author" column on the "Posts" page, and
					their posts and comments are not specially protected.
				</li>
				<li>Hidden users can see other hidden users.
					<ul>
						<li>So if you hide your own user account, you will still see it under "All Users"
							unless you switch to another user.</li>
					</ul>
				</li>
			</ul>

		</div>
	</div>
	</div>

</div>