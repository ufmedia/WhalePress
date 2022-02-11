<p>
	Refreshing available widgets...
	<span class="spinner is-active" style="float: none; vertical-align: bottom;"></span>
</p>

<p>
	<?php
	$dashboardUrl = add_query_arg('ame-cache-buster', time(), admin_url('index.php'));
	?>
	You'll be redirected to widget settings when it's done. If that doesn't happen within a couple of minutes,
	please go to <a href="<?php echo esc_attr($dashboardUrl); ?>"> Dashboard -&gt; Home</a> and then return
	to this page.
</p>