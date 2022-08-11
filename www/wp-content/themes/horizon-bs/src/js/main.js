//**************************** SCRIPTS.JS *******************************/ 
//** Horizon theme scripts **/ 
//** Author: John Thompson **/   


import 'bootstrap';
import '../scss/main.scss';

window.bootstrap = require("bootstrap");

//On document ready
jQuery(function () {

    //Welcome console message
    console.log('Welcome!');

    loadIMGs();
    loadAnims();
    jQuery('.navbar-toggler').on('click', function () {
        if (jQuery(this).hasClass('collapsed')) {
            jQuery(this).addClass("is-active");
        } else {
            jQuery(this).removeClass("is-active");
        }
    });

});

//Resize Events  
jQuery(window).on('resize', function () {
    responsiveHeights();
});

//Scoll events
jQuery(window).on('scroll', function () {
    loadIMGs();
    loadAnims();
});


function loadIMGs() {
    jQuery('.b-lazy').each(function () {
        if (jQuery(this).isInViewport()) {
            var src = jQuery(this).data('src');
            jQuery(this).prop('src', src);
            jQuery(this).load(function () {
                jQuery(this).addClass('b-loaded');
                jQuery(this).removeClass('b-lazy');
            });
        }
    });
}

function loadAnims() {
    jQuery('.slide-left, .slide-right, .bounce, .zoom, .shake').each(function () {
        if (!jQuery(this).hasClass("active")) {
            if (jQuery(this).isInViewport()) {
                jQuery(this).addClass("active");

            }
        }
    });

}

jQuery.fn.isInViewport = function () {
    var elementTop = jQuery(this).offset().top;
    var elementBottom = elementTop + jQuery(this).outerHeight();
    var viewportTop = jQuery(window).scrollTop();
    var viewportBottom = viewportTop + jQuery(window).height();
    return elementBottom > viewportTop && elementTop < viewportBottom;
};



function isIos() {
    if (navigator.standalone) {
        return false;
    }
    return ['iPhone', 'iPad', 'iPod'].includes(navigator.platform);
}

function isIosChrome() {
    if (/CriOS/i.test(navigator.userAgent)) {
        return true;
    } else {
        return false;
    }
}

function detectBrowser() {
    if ((navigator.userAgent.indexOf("Opera") || navigator.userAgent.indexOf('OPR')) != -1) {
        return 'Opera';
    } else if (navigator.userAgent.indexOf("Chrome") != -1) {
        return 'Chrome';
    } else if (navigator.userAgent.indexOf("Safari") != -1) {
        return 'Safari';
    } else if (navigator.userAgent.indexOf("Firefox") != -1) {
        return 'Firefox';
    } else if ((navigator.userAgent.indexOf("MSIE") != -1) || (!!document.documentMode == true)) {
        return 'IE'; //crap
    } else {
        return 'Unknown';
    }
}


function setCookie(cname, cvalue, exp) {
    var d = new Date();
    d.setTime(d.getTime() + exp);
    var expires = "expires=" + d.toUTCString();
    document.cookie = cname + "=" + cvalue + ";" + expires + ";path=/";
    console.log('Setting cookie ' + cname);
}

function getCookie(cname) {
    var name = cname + "=";
    var decodedCookie = decodeURIComponent(document.cookie);
    var ca = decodedCookie.split(';');
    for (var i = 0; i < ca.length; i++) {
        var c = ca[i];
        while (c.charAt(0) == ' ') {
            c = c.substring(1);
        }
        if (c.indexOf(name) == 0) {
            return c.substring(name.length, c.length);
        }
    }
    return "";
}

function checkCookie(name) {
    var check = getCookie(name);
    if (check != "") {
        return 1;
    } else {
        return 0;
    }
}