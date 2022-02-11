jQuery(document).ready(function ($) {
    $('.js-form-submit').click(function () {
        event.preventDefault();
        var pass = true;
        var formId = $(this).closest('form').attr('id');
        $('form#' + formId + ' .form-group.shake').removeClass('shake active');
        var h = $('form#' + formId).closest('.form-container').height();
        $('form#' + formId).closest('.form-container').height(h);
        $('form#' + formId).closest('.form-container').addClass(formId);
        $('form#' + formId + ' :input').each(function () {
            if ($(this).is(':checkbox')) {
                if ($(this).prop('required') && !$(this).prop('checked')) {
                    $(this).addClass('shake active');
                    $(this).closest('label').addClass('text-danger shake active');
                    pass = false;
                } else {
                    $(this).closest('.form-control').removeClass('shake active');
                    $(this).closest('label').removeClass('text-danger');
                }

            } else { 
                if ($(this).prop('required') && !$(this).val()) {
                    $(this).addClass('shake active');
                    $("label[for='"+$(this).attr('id')+"']").addClass('text-danger shake active');
                    pass = false;
                } else {
                    $(this).closest('.form-control').removeClass('shake active');
                    $(this).closest('label').removeClass('text-danger');
                }
            }
        });
        if (pass === false) {
            return false;
        } else {
            grecaptcha.ready(function () {
                grecaptcha.execute(publicKey, {action: 'contactForm'}).then(function (token) {
                    $('form#' + formId).append('<input type="hidden" name="token" value="' + token + '" />');
                    $('form#' + formId).append('<input type="hidden" name="action" value="form_action" />');
                    $('.' + formId).css('opacity', '0');
                    $.ajax({
                        type: 'POST',
                        url: ajax_object.ajax_url,
                        data: $('form#' + formId).serialize(),
                        dataType: 'json',
                        success: function (data) {
                            if (data.responseCode == 1) {
                                $('form#' + formId)[0].reset();
                                $('.' + formId).addClass('d-flex align-items-center text-center');
                                $('.' + formId).html("<div class='ml-auto mr-auto'><i class='fas fa-check-circle ml-auto mr-auto'></i><h4>Thanks,<br>we'll be in touch</h4>");
                                $('.' + formId).css('opacity', '1');
                            } else {
                                $('.' + formId).addClass('d-flex align-items-center text-center');
                                $('.' + formId).html("<div class='ml-auto mr-auto'><i class='fas fa-exclamation-circle ml-auto mr-auto'></i><h4>Oops,<br>something went wrong</h4>");
                                $('.' + formId).css('opacity', '1');
                                console.log(data);
                            }
                        },
                        error: function (data) {
                            $('.' + formId).addClass('d-flex align-items-center text-center');
                            $('.' + formId).html("<div class='ml-auto mr-auto'><i class='fas fa-exclamation-circle ml-auto mr-auto'></i><h4>Oops,<br>something went wrong</h4>");
                            $('.' + formId).css('opacity', '1');
                            console.log(data);
                        }
                    });
                });
                ;
            });
        }
    });
});