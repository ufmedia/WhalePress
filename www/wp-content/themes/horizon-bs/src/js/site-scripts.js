//**************************** SCRIPTS.JS *******************************/ 
//** Horizon theme scripts **/ 
//** Author: John Thompson **/   

jQuery(document).ready(function ($) {
    loadIMGs();  
    responsiveHeights();  
    loadAnims();  
    jQuery('.navbar-toggler').click(function () {

        if (jQuery(this).hasClass('collapsed')) {
            jQuery(this).addClass("is-active"); 
        } else {
            jQuery(this).removeClass("is-active");
        }     
    });    
});  
 
//Resize Events  
jQuery(window).resize(function () { 
    responsiveHeights();
});
//Scoll events
jQuery(window).scroll(function () {
    loadIMGs();
    loadAnims();
});

//Kick ass responsive height function
function responsiveHeights() {
    jQuery('.res-height-container').each(function () {
        jQuery(this).find('.res-height').height('auto');
        jQuery(this).find('.res-height-2').height('auto');
        var startPoint = jQuery(this).attr('data-start-point');
        var endPoint = jQuery(this).attr('data-end-point');
        if (typeof startPoint == 'undefined') {
            startPoint = 768;
        }
        if (typeof endPoint == 'undefined') {
            endPoint = 5001;
        }
        if (jQuery(window).width() > startPoint && jQuery(window).width() < endPoint) {
            var highestBox = 0;
            var highestBox2 = 0;
            jQuery(this).find('.res-height').each(function () {
                if (jQuery(this).height() > highestBox) {
                    highestBox = jQuery(this).height();
                }
            })
            jQuery(this).find('.res-height').height(highestBox);
            jQuery(this).find('.res-height-2').each(function () {
                if (jQuery(this).height() > highestBox2) {
                    highestBox2 = jQuery(this).height();
                }
            })
            jQuery(this).find('.res-height-2').height(highestBox2);
        }
    });
}

//Lazy load images
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

//Is an element within the viewport
jQuery.fn.isInViewport = function () {
    var elementTop = jQuery(this).offset().top;
    var elementBottom = elementTop + jQuery(this).outerHeight();
    var viewportTop = jQuery(window).scrollTop();
    var viewportBottom = viewportTop + jQuery(window).height();
    return elementBottom > viewportTop && elementTop < viewportBottom;
};