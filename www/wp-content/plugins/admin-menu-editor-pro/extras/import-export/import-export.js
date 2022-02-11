jQuery(function($) {
	var $importForm = $('form.ame-unified-import-form').first(),
		$importFile = $importForm.find('#ame-import-file-selector'),
		$submitButton = $importForm.find(':submit');

	//Enable the "next" button when the user selects a file.
	$importFile.on('change', function () {
		$submitButton.prop('disabled', !$importFile.val());
	});

	if ( $importForm.is('#ame-import-step-2') ) {
		var $importableModules = $importForm.find('.ame-importable-module');
		//Only enable the submit button when at least one module is selected.
		$importableModules.change(function () {
			$submitButton.prop('disabled', $importableModules.filter(':checked').length === 0);
		});
	}
});