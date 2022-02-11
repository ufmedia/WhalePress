/**
 * @property {string} wsAmeAddOnData.ajaxUrl
 */

jQuery(function ($) {
	$('.ame-activate-add-on').on('click', function () {
		var $button = $(this),
			$addOn = $button.closest('.ame-add-on-item'),
			$statusField = $addOn.find('.ame-add-on-status');

		$button.prop('disabled', true).text('Activating...');
		$.post(
			wsAmeAddOnData.ajaxUrl,
			{
				'action': 'ws_ame_activate_add_on',
				'_ajax_nonce': $button.data('nonce'),
				'slug': $addOn.data('slug')
			})
			.success(function (result) {
				$button.remove();
				if (result === 'OK') {
					$statusField.text('Active');
				} else {
					$statusField.text(result);
				}
			})
			.error(function (response) {
				$button.remove();
				$statusField.text('Error. ' + response.statusText + ': ' + response.responseText);
			});
		return false;
	});

	$('.ame-install-add-on').on('click', function () {
		return false;
	});
});
