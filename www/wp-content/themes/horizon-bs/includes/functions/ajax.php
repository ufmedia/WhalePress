<?php

function ajax_form_action_callback() {

    $responseCode = 0;
    $status = '';

    if (empty($_POST['name']) || empty($_POST['email']) || empty($_POST['message'])) {
        $status .= 'Key fields are required!';
    } else {
        $status .= 'All fields present';
        $secretKey = get_field('captcha_secret', 'options');
        $curlData = array(
            'secret' => $secretKey,
            'response' => $_POST['token']
        );
        $ch = curl_init();
        curl_setopt($ch, CURLOPT_URL, "https://www.google.com/recaptcha/api/siteverify");
        curl_setopt($ch, CURLOPT_POST, 1);
        curl_setopt($ch, CURLOPT_POSTFIELDS, http_build_query($curlData));
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        $curlResponse = curl_exec($ch);

        $captchaResponse = json_decode($curlResponse, true);

        if ($captchaResponse['success'] == '1' && $captchaResponse['score'] >= 0.5 && $captchaResponse['hostname'] == $_SERVER['SERVER_NAME']) {
            $status = ' - Captcha Passed';

            $email = filter_var($_POST['email'], FILTER_SANITIZE_EMAIL);
            $subject = filter_var($_POST['subject'], FILTER_DEFAULT);
            $name = filter_var($_POST['name'], FILTER_DEFAULT);

            $message = "<!DOCTYPE html>";
            $message .= '<html><head><meta http-equiv="Content-Type" content="text/html charset=UTF-8" /></head>';
            $message .= '<body>';
            $message .= '<h3>A new message has been received from your website:</h3>';
            $message .= '<p>From: ' . filter_var($_POST['name'], FILTER_DEFAULT) . '</p>';
            $message .= '<p>E-mail address: ' . $email . '</p>';
            $message .= '<p>Message: ' . stripslashes($_POST['message']) . '</p>';
            $message .= '</body></html>';

            $toEmail = get_field('contact_email', 'options');

            $to = get_bloginfo('name') . ' Website <' . $toEmail . '>';

            $headers = array(
                'From: ' . $name . ' <' . $email . '>',
                'Return-Path: ' . $email,
            );

            if (wp_mail($to, $subject, $message, $headers)) {
                $status .= ' - Email sent';
                $responseCode = 1;
                set_transient('Form-' . str_replace(' ', '', $name) . '-' . time(), json_encode(array($subject, $name, $email, $message)), WEEK_IN_SECONDS);
            } else {
                $status .= ' - Email failed';
            }
        } else {
            $status = ' - Captcha Failed!';
        }
    }
    $resp = array('status' => $status, 'responseCode' => $responseCode);
    header("Content-Type: application/json");
    sleep(.5);

    echo json_encode($resp);
    die();
}

add_action('wp_ajax_form_action', 'ajax_form_action_callback');
add_action('wp_ajax_nopriv_form_action', 'ajax_form_action_callback');
