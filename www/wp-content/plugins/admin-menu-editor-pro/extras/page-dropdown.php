<div style="visibility: hidden;">

<div id="ws_embedded_page_selector">
	<ul class="ws_page_selector_tab_nav">
		<li class="ws_active_tab"><a href="#ws_select_page_tab">Pages</a></li>
		<li><a href="#ws_custom_embedded_page_tab">Custom</a></li>
	</ul>

	<div id="ws_select_page_tab" class="ws_page_selector_tab">
		<label for="ws_current_site_pages" class="hidden">
			<span>Select page</span>
		</label>
		<select id="ws_current_site_pages" size="10">
			<option>Loading pages...</option>
		</select>
	</div>
	<div id="ws_custom_embedded_page_tab" class="ws_page_selector_tab">
		<form>
			<p>
				<label for="ws_embedded_page_id">Post ID</label><br>
				<input type="number" value="0" id="ws_embedded_page_id" min="0">
			</p>

			<p>
			<label for="ws_embedded_page_blog_id">Blog ID</label><br>
			<input type="number" value="<?php echo get_current_blog_id(); ?>" id="ws_embedded_page_blog_id" min="0" <?php
				if ( !is_multisite() || !is_super_admin() ) {
					echo ' readonly="readonly"';
				}
			?>>
			</p>

			<div>
				<?php
				submit_button('Apply', 'primary', 'ws_set_custom_embedded_page', false);
				?>
				<div class="clear"></div>
			</div>
		</form>
	</div>
</div>

</div>