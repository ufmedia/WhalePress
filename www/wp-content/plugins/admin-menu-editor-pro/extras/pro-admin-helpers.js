///<reference path="../js/jquery.d.ts"/>
///<reference path="../js/jquery.biscuit.d.ts"/>
'use strict';
(function ($) {
    var isHeadingStateRestored = false;
    function setCollapsedState($heading, isCollapsed) {
        $heading.toggleClass('ame-is-collapsed-heading', isCollapsed);
        //Show/hide all menu items between this heading and the next one.
        var containedItems = $heading.nextUntil('li.ame-menu-heading-item, #collapse-menu', 'li.menu-top');
        containedItems.toggle(!isCollapsed);
    }
    /**
     * Save the collapsed/expanded state of menu headings.
     */
    function saveCollapsedHeadings($adminMenu) {
        var collapsedHeadings = loadCollapsedHeadings();
        var currentTime = Date.now();
        $adminMenu.find('li[id].ame-collapsible-heading').each(function () {
            var $heading = $(this), id = $heading.attr('id');
            if (id) {
                if ($heading.hasClass('ame-is-collapsed-heading')) {
                    collapsedHeadings[id] = currentTime;
                }
                else if (collapsedHeadings.hasOwnProperty(id)) {
                    delete collapsedHeadings[id];
                }
            }
        });
        //Discard stored data associated with headings that haven't been seen in a long time.
        //It's likely that the headings no longer exist.
        if (Object.keys) {
            var threshold = currentTime - (90 * 24 * 3600 * 1000);
            var headingIds = Object.keys(collapsedHeadings);
            for (var i = 0; i < headingIds.length; i++) {
                var id = headingIds[i];
                if (!collapsedHeadings.hasOwnProperty(id)) {
                    continue;
                }
                if (collapsedHeadings[id] < threshold) {
                    delete collapsedHeadings[id];
                }
            }
        }
        $.cookie('ame-collapsed-menu-headings', JSON.stringify(collapsedHeadings), { expires: 90 });
    }
    function loadCollapsedHeadings() {
        var defaultValue = {};
        if (!$.cookie) {
            return defaultValue;
        }
        try {
            var settings = JSON.parse($.cookie('ame-collapsed-menu-headings'));
            if (typeof settings === 'object') {
                return settings;
            }
            return defaultValue;
        }
        catch (_a) {
            return defaultValue;
        }
    }
    /**
     * Restore the previous collapsed/expanded state of menu headings.
     */
    function restoreCollapsedHeadings() {
        isHeadingStateRestored = true;
        var previouslyCollapsedHeadings = loadCollapsedHeadings();
        var $adminMenu = $('#adminmenumain #adminmenu');
        for (var id in previouslyCollapsedHeadings) {
            if (!previouslyCollapsedHeadings.hasOwnProperty(id)) {
                continue;
            }
            var $heading = $adminMenu.find('#' + id);
            if ($heading.length > 0) {
                setCollapsedState($heading, true);
            }
        }
    }
    $(document).on('restoreCollapsedHeadings.adminMenuEditor', function () {
        if (!isHeadingStateRestored) {
            restoreCollapsedHeadings();
        }
    });
    jQuery(function ($) {
        //Menu headings: Handle clicks.
        var $adminMenu = $('#adminmenumain #adminmenu');
        $adminMenu.find('li.ame-menu-heading-item a').on('click', function () {
            var $heading = $(this).closest('li');
            var canBeCollapsed = $heading.hasClass('ame-collapsible-heading');
            if (!canBeCollapsed) {
                //By default, do nothing. The heading is implemented as a link due to how the admin menu
                //works, but we don't want it to go to a different URL on click.
                return false;
            }
            var isCollapsed = !$heading.hasClass('ame-is-collapsed-heading');
            setCollapsedState($heading, isCollapsed);
            //Remember the collapsed/expanded state.
            if ($.cookie) {
                setTimeout(saveCollapsedHeadings.bind(window, $adminMenu), 50);
            }
            return false;
        });
        if (!isHeadingStateRestored) {
            restoreCollapsedHeadings();
        }
        if (typeof wsAmeProAdminHelperData === 'undefined') {
            return;
        }
        //Menu headings: If the user hasn't specified a custom text color, make sure the color
        //doesn't change on hover/focus.
        if (wsAmeProAdminHelperData.setHeadingHoverColor && Array.prototype.map) {
            var baseTextColor = void 0;
            //Look at the first N menu items to discover the default text color.
            var $menus = $('#adminmenumain #adminmenu li.menu-top')
                .not('.wp-menu-separator')
                .not('.ame-menu-heading-item')
                .slice(0, 10)
                .find('> a .wp-menu-name');
            var mostCommonColor_1 = '#eeeeee', seenColors_1 = {};
            seenColors_1[mostCommonColor_1] = 0;
            $menus.each(function () {
                var color = $(this).css('color');
                if (color) {
                    if (seenColors_1.hasOwnProperty(color)) {
                        seenColors_1[color] = seenColors_1[color] + 1;
                    }
                    else {
                        seenColors_1[color] = 1;
                    }
                    if (seenColors_1[color] > seenColors_1[mostCommonColor_1]) {
                        mostCommonColor_1 = color;
                    }
                }
            });
            baseTextColor = mostCommonColor_1;
            //We want to override the default menu colors, but not per-item styles.
            var parentSelector_1 = '#adminmenu li.ame-menu-heading-item';
            var selectors = [':hover', ':active', ':focus', ' a:hover', ' a:active', ' a:focus'].map(function (suffix) {
                return parentSelector_1 + suffix;
            });
            var $newStyle = $('<style type="text/css">')
                .text(selectors.join(',\n') + ' { color: ' + baseTextColor + '; }');
            var $adminCssNode = $('link#admin-menu-css').first();
            if ($adminCssNode.length === 1) {
                $newStyle.insertAfter($adminCssNode);
            }
            else {
                $newStyle.appendTo('head');
            }
        }
    });
})(jQuery);
