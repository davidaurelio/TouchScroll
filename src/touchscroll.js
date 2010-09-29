/*
 Copyright (c) 2010 uxebu Consulting Ltd. & Co. KG
 Copyright (c) 2010 David Aurelio
 All rights reserved.

 Redistribution and use in source and binary forms, with or without
 modification, are permitted provided that the following conditions are met:

 1. Redistributions of source code must retain the above copyright
    notice, this list of conditions and the following disclaimer.
 2. Redistributions in binary form must reproduce the above copyright
    notice, this list of conditions and the following disclaimer in the
    documentation and/or other materials provided with the distribution.

 THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS"
 AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
 IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE
 ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE
 LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR
 CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF
 SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS
 INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN
 CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE)
 ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE
 POSSIBILITY OF SUCH DAMAGE.
*/

/**
 * @static
 * @type {Object} Global configuration options for TouchScroll.
 */
TouchScroll.config = {
    /** @type {Number} The minimum move distance to trigger scrolling (in pixels). */
    threshold: 5,

    /** @type {Number} The minimum scroll handle size. */
    scrollHandleMinSize: 25,

    /** @type {Object} Flicking detection and configuration. */
    flicking: {
        /**
         * Maximum duration between last touchmove and the touchend event
         * to trigger flicking.
         *
         * @type {Number}
         */
        triggerThreshold: 250,

        /**
         * Friction factor (per milisecond). This factor is used to
         * precalculate the flick length. Lower numbers make flicks
         * decelerate earlier.
         *
         * @type {Number}
         */
        friction: 0.998,

        /**
         * Minimum speed needed before the animation stop (px/ms) This value is
         * used to precalculate the flick length. Larger numbers lead to
         * shorter flicking lengths and durations.
         *
         * @type {Number}
         */
        minSpeed: 0.15,

        /**
         * The timing function for flicking animinations (control points
         * for a cubic bezier curve).
         *
         * @type {Number[]}
         */
        timingFunc: [0, 0.3, 0.6, 1]
    },

    /** @type {Object} Bouncing configuration */
    elasticity: {
        /** @type {Number} Factor for the bounce length while dragging. */
        factorDrag: 0.5,

        /** @type {Number} Factor for the bounce length while flicking. */
        factorFlick: 0.2,

        /** @type {Number} Maximum bounce (in px) when flicking. */
        max: 100
    },

    /** @type {Object} Snap back configuration. */
    snapBack: {
        /**
         * The timing function for snap back animations (control points for
         * a cubic bezier curve) when bouncing out before, the first
         * control point is overwritten to achieve a smooth transition
         * between bounce and snapback.
         *
         * @type {Number[]}
         */
        timingFunc: [0, 0.25, 0, 1],

        /** @type {Number} Default snap back time. */
        defaultTime: 750,

        /**
         * Whether the snap back effect always uses the default time or
         * uses the bounce out time.
         *
         * @type {Boolean}
         */
        alwaysDefaultTime: true
    }
};

//
// FEATURE DETECTION
//
/**
 * @type {Boolean} Whether touch events are supported by the user agent.
 * @private
 */
TouchScroll._hasTouchSupport = (function() {
    if ("createTouch" in document) { // True on the iPhone
        return true;
    }
    try {
        var event = document.createEvent("TouchEvent"); // Should throw an error if not supported
        return !!event.initTouchEvent; // Check for existance of initialization method
    } catch(error) {
        return false;
    }
}());

/**
 * Whether WebKitCSSMatrix is supported properly by the user agent.
 *
 * In some older versions of Android, WebKitCSSMatrix is broken and does
 * not parse a "matrix" directive properly.
 *
 * @type {Boolean}
 * @private
 */
TouchScroll._parsesMatrixCorrectly = (function() {
    var m = new WebKitCSSMatrix("matrix(1, 0, 0, 1, -20, -30)");
    return m.e === -20 && m.f === -30;
}());

/**
 * Whether we are on Android.
 *
 * @type {Number} Android version number or `null`.
 * @private
 */
TouchScroll._android = (function() {
    var match = navigator.userAgent.match(/Android\s+(\d+(?:\.\d+)?)/);
    return match && parseFloat(match[1]);
}());

/**
 * Contains the name of the events to listen for.
 *
 * Depends on touch support.
 *
 * @type {Object}
 * @private
 */
TouchScroll._eventNames = {
    /** @type {String} The name of the start event. */
    start: "touchstart",

    /** @type {String} The name of the move event. */
    move: "touchmove",

    /** @type {String} The name of the end event. */
    end: "touchend",

    /** @type {String} The name of the cancel event. */
    cancel: "touchcancel"
};

if (!TouchScroll._hasTouchSupport) { // overwrite event names
    TouchScroll._eventNames = {
        start: "mousedown",
        move: "mousemove",
        end: "mouseup",
        cancel: "touchcancel" // unnecessary here
    };
}

/**
 * @private
 * @static
 * @type {CSSStyleSheet}
 */
TouchScroll._styleSheet = (function() {
    var doc = document;
    var parent = doc.querySelector("head") || doc.documentElement;
    var styleNode = document.createElement("style");
    parent.insertBefore(styleNode, parent.firstChild);

    for (var i = 0, sheet; (sheet = doc.styleSheets[i]); i++) {
        if (styleNode === sheet.ownerNode) {
            return sheet; // return the newly created stylesheet
        }
    }

    return doc.styleSheets[0]; // return a random stylesheet
}());

[
    ".TouchScroll{" +
        "position:relative;" +
        "display:-webkit-box;" +
    "}",
    ".-ts-layer{" +
        "-webkit-transition-property:-webkit-transform;" +
        "-webkit-transform:translate3d(0,0,0);" +
        //"-webkit-transform-style:-3d;" +
        "position:absolute;" +
        "height:100%;" +
        "top:0;" +
        "right:0;" +
        "left:0;" +
    "}",
    ".-ts-outer{" +
        "-webkit-box-flex:1;" +
        "position:relative;" +
        "height:auto;" +
    "}",
    ".-ts-inner {" +
        "position:relative;" +
        "-webkit-transform-style:flat;" +
    "}",
    ".-ts-inner.scrolling{" +
        "-webkit-user-select:none;" +
        "pointer-events:none;" +
    "}",
    ".-ts-bars{" +
        "bottom:0;" +
        "left:0;" +
        "overflow:hidden;" +
        "pointer-events:none;" +
        "position:absolute;" +
        "opacity:0;" +
        "right:0;" +
        "top:0;" +
        "z-index:2147483647;" +
        "-webkit-transition:opacity 250ms;" +
    "}",
    ".-ts-bars-active{" +
        "opacity:1;" +
        "-webkit-transition:none;" +
    "}",
    ".-ts-bar{" +
        "display:none;" +
        "position:absolute;" +
        "right:3px;" +
        "bottom:3px;" +
        //"-webkit-transform-style:preserve-3d;" +
    "}",
    ".-ts-bar.active{" +
        "display:block;" +
    "}",
    ".-ts-bar-e{" +
        "height:7px;" +
        "left:3px;" +
        "-webkit-transform:rotate(-90deg) translateX(-7px);" +
        "-webkit-transform-origin:0 0;" +
    "}",
    ".-ts-bar-f{" +
        "width:7px;" +
        "top:3px;" +
    "}",
    ".-ts-bars-both .-ts-bar-e{" +
        "right:9px;" +
    "}",
    ".-ts-bars-both .-ts-bar-f{" +
        "bottom:9px;" +
    "}",
    ".-ts-indicator-e,.-ts-indicator-f,.-ts-bar-part{" +
        "position:absolute;" +
    "}",
    ".-ts-bar-part{" +
        "width: 7px;" +
        "-webkit-border-image:url(data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAA4AAAAOBAMAAADtZjDiAAAALVBMVEUAAAD///8AAAD///+kpKT///////////////////8nJycBAQEJCQn///9YWFgbIh+zAAAAD3RSTlOATQASUTVFQwMkaIB3TFtjuC6yAAAATElEQVQI12NQ0piaFtmkxKBkLigoWKzEoHzR68wSWSOGdrkNDNwPKxgmejMwMGyRZAhcAKS5RBkSDwBpHjE4DROHqYPpg5kDMxdqDwDB4xorHHHNdAAAAABJRU5ErkJggg==) 6 stretch;" +
        "-webkit-box-sizing:border-box;"+
        "-webkit-transform-origin:0 0;" +
        //"-webkit-transform-style:preserve-3d;" +
    "}",
    ".-ts-bar-1,.-ts-bar-3{" +
        "border-width:3px 3px 0;" +
        "height:0;" +
    "}",
    ".-ts-bar-3{" +
        "border-width:0 3px 3px;" +
    "}",
    ".-ts-bar-2{" +
        "height:1px;" +
        "border-width:0 3px;" +
    "}",
    ".-ts-bar-2{" +
        "height:1px;" +
    "}"
].forEach(function(rule, i) { this.insertRule(rule, i); }, TouchScroll._styleSheet);

/**
 * @class
 * @param {HTMLElement} scrollElement The HTML element to make scrollable.
 * @param {Objects} [options] An expando for options. Supported options are:#
 *                            - elastic {Boolean}, defaults to `false`
 *                            - scrollbars {Boolean}, defaults to `true`
 *                            - scrollevents {Boolean}, defaults to `false`
 */
function TouchScroll(scrollElement, options) {
    options = options || {};

    /** @type {Boolean} Whether the scroller bounces across its bounds. */
    this.elastic = !!options.elastic;

    /** @type {Boolean} Whether to fire DOM scroll events */
    this.scrollevents = !!options.scrollevents;


    var snapToGrid =
        /** @type {Boolean} Whether to snap to a 100%x100%-grid -- "paging mode". */
        this.snapToGrid = !!options.snapToGrid;

    /** @type {Object} Contains the number of segments for each axis (for paging mode). */
    this.maxSegments = {e: 1, f: 1};

    /** @type {Object} Contains the current of segments for each axis (for paging mode). */
    this.currentSegment = {e: 0, f: 0};


    /** @type {Boolean} Whether to build and use scrollbars. */
    var useScrollbars = !snapToGrid;
    if (useScrollbars && "scrollbars" in options) {
        useScrollbars = !!options.scrollbars;
    }

    /**
     * An array of timeout handles for queued animations and actions that have
     * to be cancelled on animation stop.
     *
     * @type {Number[]}
     */
    this._scrollTimeouts = [];

    /** @type {Object} Holds scrollbar related metrics. */
    this._barMetrics = {
        /** @type {Object} Stores the offset height of the scrollbar "tracks". */
        availLength: {e: 0, f: 0}, //TODO: Check if necessary!
        /** @type {Number} Stores the size of the bar ends in pixels (assuming all have the same size). */
        tipSize: 0,
        /** @type {Object} Stores the maximum offset for each scroll indicator. */
        maxOffset: {e: 0, f: 0}, //TODO: Check if necessary!
        /** @type {Object} Stores the ratio of scroll layer and scroll indicator offsets. */
        offsetRatios: {e: 0, f:0},
        /** @type {Object} Stores the calculated sizes of the scroll indicators. */
        sizes: {e: 0, f: 0}
    };

    /** @type {Object} Holds references to the DOM nodes used by the scroller. */
    this._dom = {
        /** @type {HTMLElement} A reference to the outer/main DOM node. */
        outer: scrollElement
    };

    /** @type {Object} Stores whether each axis is scrolling. */
    this._isScrolling = {e: false, f: false, general: false};

    /** @type {String[]} Stores the the ids of all scrolling axes */
    this._activeAxes = [];

    /** @type {Boolean} Whether the scroller is currently tracking touches (other than start). */
    this._isTracking = false;

    /** @type {Event[]} The last two tracked events .*/
    this._lastEvents = [];

    /** @type {Object} Stores the maximum scroll offset for each axis. */
    this._maxOffset = {e: 0, f: 0};

    /** @type {Object} Stores the relevant metrics of the last call to {@link setupScroller}. */
    this._metrics = {
        offsetWidth: -1,
        offsetHeight: -1,
        scrollWidth: -1,
        scrollHeight: -1
    };

    /** @type {Object} Stores the relevant metrics of the innermost scrolling layer. */
    this._innerSize = null;

    /** @type {Boolean} Whether the scroll threshold has been exceeded. */
    this._scrollBegan = false;

    /** @type {CSSMatrix} The current scroll offset. Not valid while flicking. */
    this._scrollOffset = new this._Matrix();

    this._initDom(useScrollbars);
}

TouchScroll.prototype = {
    config: TouchScroll.config,

    /**
     * All axes -- "e" is the x-axis, "f" is the y-axis.
     *
     * This property exists to avoid dynamic object creation during runtime.
     *
     * @private
     * @static
     * @type {String[]}
     */
    _axes: ["e", "f"],

    _eventNames: TouchScroll._eventNames,

    /**
     * @private
     * @static
     * @type {Object} Mapping from event types to handler names.
     */
    _handlerNames: {
        touchstart: "onTouchStart",
        mousedown: "onTouchStart",
        touchmove: "onTouchMove",
        mousemove: "onTouchMove",
        touchend: "onTouchEnd",
        mouseup: "onTouchEnd",
        touchcancel: "onTouchEnd",
        DOMSubtreeModified: "onDOMChange",
        focus: "onChildFocused"
    },

    /**
     * @private
     * @type Boolean
     * @static
     *
     * Whether the rendering engine has 3D-transform support. Can be sued to
     * enforce hardware-acceleration.
     */
    _has3d: "m11" in new WebKitCSSMatrix(),

    /**
     * The CSSMatrix constructor to use. Defaults to WebKitCSSMatrix.
     *
     * @static
     * @private
     * @type {Function}
     */
    _Matrix: WebKitCSSMatrix,

   /**
    * @private
    * @static
    * @type {String} HTML for TouchScroll instances.
    */
   _scrollerTemplate: [
            '<div class="-ts-layer -ts-outer">', // scrolling layer y-axis
                '<div class="-ts-layer">', // scrolling layer x-axis
                    '<div class="-ts-layer -ts-inner"></div>', // wrapper
                '</div>',
            '</div>',
            '<div class="-ts-bars"></div>'
        ].join(""),

   /**
    * @private
    * @static
    * @type {String} HTML for scrollbars. Used on instances with scrollbars.
    */
    _scrollbarTemplate : [
            '<div class="-ts-bar -ts-bar-e">',
                '<div class="-ts-indicator-e">',
                    '<div class="-ts-bar-part -ts-bar-1"></div>',
                    '<div class="-ts-bar-part -ts-bar-2"></div>',
                    '<div class="-ts-bar-part -ts-bar-3"></div>',
                '</div>',
            '</div>',
            '<div class="-ts-bar -ts-bar-f -ts-indicator-f">',
                '<div class="-ts-bar-part -ts-bar-1"></div>',
                '<div class="-ts-bar-part -ts-bar-2"></div>',
                '<div class="-ts-bar-part -ts-bar-3"></div>',
            '</div>'
        ].join(""),

    _styleSheet: TouchScroll._styleSheet,

    /**
     * Centers the scroller at given coordinates.
     *
     * @param {Number} left The horizontal offset.
     * @param {Number} top The vertical offset.
     * @param {Number} [duration] Duration in milliseconds for the transition.
     */
    centerAt: function centerAt(left, top, duration) {
        var m = this._metrics;
        left += Math.ceil(m.offsetWidth / 2);
        top += Math.ceil(m.offsetHeight / 2);
        this.scrollTo(left, top, duration);
    },

    /**
     * DOM Level 2 event handler method.
     *
     * @private
     * @param {Event} event.
     */
    handleEvent: function handleEvent(event) {
        var handlerName = this._handlerNames[event.type];
        if (handlerName) {
            this[handlerName](event);
        }
    },

    hideScrollbars: function hideScrollbars() {
        var bars = this._dom.bars;
        if (bars) {
            bars.outer.className = "-ts-bars";
        }
    },

    onChildFocused: function onChildFocused(event) {
        var innerScroller = this._dom.scrollers.inner;
        var node = event.target;
        if (node === innerScroller) {
            return;
        }

        var offsetLeft = 0, offsetTop = 0;
        do {
            offsetLeft += node.offsetLeft;
            offsetTop += node.offsetTop;
            node = node.offsetParent;
        } while (node !== innerScroller);

        var offset = this._scrollOffset.inverse();
        var m = this._metrics;

        // if element not visible scroll there
        var doScroll = false, scrollE = offset.e, scrollF = offset.f;
        var visibleHorizontal = offsetLeft > scrollE && offsetLeft < scrollE + m.offsetWidth;
        var visibleVertical = offsetTop > scrollF && offsetTop < scrollF + m.offsetHeight;

        if (!visibleHorizontal) { scrollE = offsetLeft; doScroll = true; }
        if (!visibleVertical) { scrollF = offsetTop; doScroll = true; }

        if (doScroll) {
            this.scrollTo(offsetLeft, offsetTop, 100);
        }
    },

    onDOMChange: function onDOMChange(){
        this.setupScroller();
    },

    onTouchStart: function onTouchStart(event) {
        if (!this._isScrolling.general) {
            return;
        }

        this._stopAnimations();
        this.setupScroller();
        this._isTracking = true;
        this._scrollBegan = false;

        event = event.touches && event.touches.length ? event.touches[0] : event;
        this._lastEvents[1] = {
            pageX: event.pageX,
            pageY: event.pageY,
            timeStamp: event.timeStamp
        };
    },

    onTouchMove: function onTouchMove(event) {
        if (!this._isTracking) {
            return;
        }

        event.preventDefault();

        var lastEvents = this._lastEvents;
        var lastEvent = lastEvents[1];
        var touch = event.touches && event.touches.length ? event.touches[0] : event;
        var pageX = touch.pageX;
        var pageY = touch.pageY;

        var scrollOffset = new this._Matrix();
        scrollOffset.e = pageX - lastEvent.pageX;
        scrollOffset.f = pageY - lastEvent.pageY;

        var scrollBegan = this._scrollBegan;

        if (!scrollBegan) {
            var threshold = this.config.threshold;
            this._scrollBegan = scrollBegan =
                threshold <= scrollOffset.e ||
                threshold <= -scrollOffset.e ||
                threshold <= scrollOffset.f ||
                threshold <= -scrollOffset.f;

            if (scrollBegan) {
                this.showScrollbars();
                // catch pointer events with the scrollbar layer
                this._dom.scrollers.inner.className = "-ts-layer -ts-inner scrolling";
            }
        }

        if (scrollBegan) {
            this._scrollBy(scrollOffset);
            lastEvents[0] = lastEvent;
            lastEvents[1] = {
                pageX: pageX,
                pageY: pageY,
                timeStamp: event.timeStamp
            };
        }
    },

    onTouchEnd: function onTouchEnd(event) {
        if (!this._isTracking || !this._scrollBegan) {
            this.hideScrollbars();
            return;
        }

        event.preventDefault();
        event.stopPropagation();
        this._isTracking = this._scrollBegan = false;

        // calculate flick
        var isScrolling = this._isScrolling;
        var configFlicking = this.config.flicking;
        var lastEvents = this._lastEvents;
        var event0 = lastEvents[0];
        var event1 = lastEvents[1];
        var lag = event.timeStamp - event1.timeStamp;
        var moveX = isScrolling.e ? event1.pageX - event0.pageX : 0;
        var moveY = isScrolling.f ? event1.pageY - event0.pageY : 0;
        var moveDistance = Math.sqrt(moveX * moveX + moveY * moveY);
        var moveDuration = event1.timeStamp - event0.timeStamp;
        var moveSpeed = moveDistance / moveDuration;

        var flickAllowed = lag <= configFlicking.triggerThreshold &&
            moveSpeed >= configFlicking.minSpeed;

        var flick, flickDistance, flickDuration;
        if (flickAllowed) {
            flick = this._computeFlick(moveSpeed);
            flickDuration = flick[0];
            flickDistance = flick[1];
        }

        if (flickAllowed && flickDuration && flickDistance) {
            var flickVector = new this._Matrix();
            flickVector.e = moveX / moveDistance * flickDistance;
            flickVector.f = moveY / moveDistance * flickDistance;
            this._flick(flickDuration, flickVector);
        }
        else {
            // snap back to bounds
            this.snapBack();
        }

        this._lastEvents[0] = this._lastEvents[1] = null;
    },

    /**
     * Scroll the scroller by the given amount of pixels.
     *
     * @param {Number} e The horizontal amount of pixels to scroll.
     * @param {Number} f The vertical amount of pixels to scroll.
     * @param {Number} [duration] Duration in milliseconds for the transition.
     */
    scrollBy: function scrollBy(e, f, duration) {
        var scrollMatrix = this._determineOffset(true).inverse().translate(e, f, 0);
        return this.scrollTo(scrollMatrix.e, scrollMatrix.f, duration);
    },

    /**
     * Scroll the scroller to the given coordinates.
     *
     * @param {Number} e The horizontal offset.
     * @param {Number} f The vertical offset.
     * @param {Number} [duration] Duration in milliseconds for the transition.
     */
    scrollTo: function scrollTo(e, f, duration) {
        if (duration <= 0) {
            // limit to bounds if not flicking
            var maxOffset = this._maxOffset;
            e = Math.max(Math.min(e, maxOffset.e), 0);
            f = Math.max(Math.min(f, maxOffset.f), 0);
        }
        var scrollMatrix = this._scrollOffset.translate(e, f, 0).inverse();

        if (duration > 0) {
            this._flick(duration, scrollMatrix);
        }
        else {
            this._scrollBy(scrollMatrix);
        }
    },

    /**
     * Sets up the scroller according to its metrics.
     *
     * This method does nothing if offsetWidth/Height and scrollWidth/Height
     * are unchanged.
     *
     * @param {Boolean} force Whether to force the setup.
     * @returns {Boolean} Whether setup has run. False, if skipped due to
     *                    unchanged metrics.
     */
    setupScroller: function setupScroller(force) {
        var dom = this._dom;
        var scrollerElement = dom.outer;

        var offsetWidth = scrollerElement.offsetWidth;
        var offsetHeight = scrollerElement.offsetHeight;
        var scrollWidth = scrollerElement.scrollWidth;
        var scrollHeight = scrollerElement.scrollHeight;
        var m = this._metrics;

        // Check whether we really need to refresh ... if not, leave here.
        if (!force &&
            offsetWidth === m.offsetWidth && offsetHeight === m.offsetHeight &&
            scrollWidth === m.scrollWidth && scrollHeight === m.scrollHeight
        ) {
                return false;
        }

        m.offsetWidth = offsetWidth;
        m.offsetHeight = offsetHeight;
        m.scrollWidth = scrollWidth;
        m.scrollHeight = scrollHeight;

        // instance properties
        var maxOffset = this._maxOffset = {
            e: Math.max(scrollWidth - offsetWidth, 0),
            f: Math.max(scrollHeight - offsetHeight, 0)
        };

        var isScrolling = this._isScrolling = {
            e: maxOffset.e > 0,
            f: maxOffset.f > 0
        };
        isScrolling.general = isScrolling.e || isScrolling.f;

        var activeAxes = this._activeAxes = this._axes.filter(function(axis) {
            return isScrolling[axis];
        });

        var scrollers = dom.scrollers
        var innerNode = scrollers.inner;
        var innerOffsetWidth = innerNode.offsetWidth;
        var innerOffsetHeight = innerNode.offsetHeight;
        var innerScrollWidth = innerNode.scrollWidth;
        var innerScrollHeight = innerNode.scrollHeight;

        var innerSize = this._innerSize = {e: innerOffsetWidth, f: innerOffsetHeight};

        this.maxSegments = {
            e: Math.ceil(innerScrollWidth / innerOffsetWidth),
            f: Math.ceil(innerScrollHeight / innerOffsetHeight)
        };

        // force scrollers into bounds
        var offsetSpecs = [];
        var scrollOffset = this._scrollOffset;
        var zeroMatrix = new this._Matrix(), matrix;
        var i = 0, axes = this._axes, axis;
        while ((axis = axes[i++])) {
            var axisOffset = scrollOffset[axis];
            var axisMinOffset = -maxOffset[axis];
            if (axisOffset > 0 || axisOffset < axisMinOffset) {
                scrollOffset[axis] = axisOffset = axisOffset > 0 ? 0 : axisMinOffset;
                matrix = zeroMatrix.translate(0, 0, 0);
                matrix[axis] = axisOffset;
                offsetSpecs[offsetSpecs.length] = {
                    style: scrollers[axis].style,
                    matrix: matrix
                };
            }
        }

        // hide/show scrollbars
        var bars = dom.bars;
        if (bars) {
            var bothScrolling = true, bar;
            i = 0;
            while ((axis = axes[i++])) {
                bar = bars[axis];
                bar.className = bar.className.replace(" active", "");
                if (isScrolling[axis]) {
                    bar.className += " active";
                }
                else {
                    bothScrolling = false;
                }
            }

            bars.outer.className = bars.outer.className.replace(" -ts-bars-both", "");
            if (bothScrolling) {
                bars.outer.className += " -ts-bars-both";
            }

            // calculate and apply scroll indicator sizes
            var scrollHandleMinSize = this.config.scrollHandleMinSize;
            var barMetrics = this._barMetrics;
            var availLength = barMetrics.availLength;
            availLength.e = bars.e.offsetWidth;
            availLength.f = bars.f.offsetHeight;

            var barSizes = barMetrics.sizes;
            barSizes.e = Math.round(Math.max(
                availLength.e * offsetWidth / scrollWidth
            ), scrollHandleMinSize);
            barSizes.f = Math.round(Math.max(
                availLength.f * offsetHeight / scrollHeight
            ), scrollHandleMinSize);

            var tipSize = barMetrics.tipSize;

            var barMaxOffset = barMetrics.maxOffset;
            barMaxOffset.e = availLength.e;
            barMaxOffset.f = availLength.f;

            var offsetRatios = barMetrics.offsetRatios;
            offsetRatios.e = barMaxOffset.e / -scrollWidth;
            offsetRatios.f = barMaxOffset.f / -scrollHeight;

            var parts, size, scale, offset;
            i = 0;
            axes = activeAxes;
            while ((axis = axes[i++])) {
                parts = bars.parts[axis];
                tipSize = tipSize || parts[0].offsetHeight;
                size = barSizes[axis];
                scale = size - tipSize * 2;
                barMetrics.maxOffset[axis] = availLength[axis] - size;
                offset = offsetRatios[axis] * scrollOffset[axis];
                parts[1].style.height = scale + "px";
                offsetSpecs.push(
                    {
                        style: parts[3].style,
                        matrix: {e: 0, f: offset}
                    },
                    {
                        style: parts[1].style,
                        matrix: {e: 0, f: tipSize}
                    },
                    {
                        style: parts[2].style,
                        matrix: {e: 0, f: tipSize + scale}
                    }
                );

            }
            barMetrics.tipSize = tipSize;
        }
        this._setStyleOffset(offsetSpecs);

        return true;
    },

    showScrollbars: function showScrollbars() {
        var bars = this._dom.bars;
        if (bars) {
            bars.outer.className += " -ts-bars-active";
        }
    },

    /**
     * Scrolls back to the bounds of the scroller if the scroll position
     * exceeds these.
     *
     * @param {String|null} [snapAxis] Which axis to snap back. `null` snaps
     *                                 back both axes.
     * @returns {Boolean} Whether the scroller was beyond regular bounds.
     */
    snapBack: function snapBack(snapAxis, duration, timeout) {
        if (timeout > 0) {
            var timeouts = this._scrollTimeouts;
            var that = this;
            timeouts[timeouts.length] = setTimeout(function() {
                that.snapBack();
            }, timeout);
            return null;
        }

        var axes = snapAxis ? [snapAxis] : this._activeAxes;

        var snapBackConfig = this.config.snapBack;
        if (typeof duration === "undefined") { duration = snapBackConfig.defaultTime; }
        var timingFunc = snapBackConfig.timingFunc;

        var dom = this._dom;
        var scrollers = dom.scrollers;
        var bars = dom.bars;
        var hasBars = !!bars;
        var snapToGrid = this.snapToGrid;

        var innerSize, maxSegments, currentSegments;
        if (snapToGrid) {
            innerSize = this._innerSize;
            maxSegments = this.maxSegments;
            currentSegments = this.currentSegment;
        }

        var barMetrics, barSizes, tipSize, barMaxOffset, barParts;
        if (hasBars) {
            barMetrics = this._barMetrics;
            barSizes = barMetrics.sizes;
            tipSize = barMetrics.tipSize;
            barMaxOffset = barMetrics.maxOffset;
            barParts = bars.parts;
        }

        var scrollOffset = this._determineOffset(true);
        var maxOffsets = this._maxOffset;

        var i = 0, axis;
        var zeroMatrix = new this._Matrix(), matrix;

        var snapsBack = false;

        var offsetSpecs = [], numOffsetSpecs = 0;
        while ((axis = axes[i++])) {
            var offset = scrollOffset[axis];
            var maxOffset = 0;
            var minOffset = -maxOffsets[axis];

            if (snapToGrid) {
                var axisInnerSize = innerSize[axis];
                var currentSegment = -Math.floor((offset + 0.5*axisInnerSize) / axisInnerSize);
                var axisMaxSegments = maxSegments[axis];
                if (currentSegment < 0) {
                    currentSegment = 0;
                }
                else if (currentSegment >= axisMaxSegments) {
                    currentSegment = axisMaxSegments - 1;
                }
                minOffset = maxOffset = -currentSegment * axisInnerSize;

                if (currentSegment !== currentSegments[axis]) {
                    currentSegments[axis] = currentSegment;
                    this._fireEvent("segmentchange", {
                        axis: axis,
                        segment: currentSegment,
                        numSegments: axisMaxSegments
                    });
                }
            }

            if (offset >= minOffset && offset <= maxOffset) {
                continue;
            }

            snapsBack = true;

            // snap back bouncer layer
            matrix = zeroMatrix.translate(0, 0, 0);
            matrix[axis] = offset > maxOffset ? maxOffset : minOffset;
            offsetSpecs[numOffsetSpecs++] = {
                style: scrollers[axis].style,
                matrix: matrix,
                duration: duration,
                timingFunc: timingFunc
            };

            var bounceAtEnd = offset < minOffset;
            var snapBackLength = bounceAtEnd ? minOffset - offset : offset - maxOffset;

            // snap back bars
            if (hasBars) {
                var size = barSizes[axis];
                var scale = size - 2 * tipSize;
                var barDuration = duration;
                var barTimingFunc = timingFunc;
                if (snapBackLength > scale && duration > 0) { // bars start growing during snap back
                    var bezier = bezier || new CubicBezier(timingFunc[0], timingFunc[1], timingFunc[2], timingFunc[3]);
                    var t = bezier.getTforY(1 - scale/snapBackLength, 1 / duration);
                    var timeFraction = bezier.getPointForT(t).x;
                    barDuration *= 1 - timeFraction;
                    barTimingFunc = bezier.divideAtT(t)[1];
                }

                var parts = barParts[axis];
                var barDelay = duration - barDuration;
                offsetSpecs[numOffsetSpecs++] = {
                    style: parts[0].style,
                    matrix: {e: 0, f: 0},
                    delay: barDelay,
                    duration: barDuration,
                    timingFunc: barTimingFunc
                };
                offsetSpecs[numOffsetSpecs++] = {
                    style: parts[1].style,
                    matrix: {e: 0, f: tipSize},
                    delay: barDelay,
                    duration: barDuration,
                    timingFunc: barTimingFunc
                };
                offsetSpecs[numOffsetSpecs++] = {
                    style: parts[2].style,
                    matrix: {e: 0, f: tipSize + scale},
                    delay: barDelay,
                    duration: barDuration,
                    timingFunc: barTimingFunc
                };
            }
        }

        this._setStyleOffset(offsetSpecs);
        if (snapsBack) {
            this.showScrollbars();
        }
        else if (!snapAxis) {
            this._endScroll();
        }
        return snapsBack;
    },

    /**
     * Computes the duration and the distance of a flick from a given initial
     * speed.
     *
     * @param {Number} initialSpeed The initial speed of the flick in
     *                              pixels per millisecond.
     * @returns {Number[]} An array containing flick duration (in milliseconds)
     *                     and flick distance (in pixels).
     */
    _computeFlick: function _computeFlick(initialSpeed) {
        /*
            The duration is computed as follows:

            variables:
                m = minimum speed before stopping = config.flicking.minSpeed
                d = duration
                s = speed = initialSpeed
                f = friction per milisecond = config.flicking.friction

            The minimum speed is computed as follows:
                    m = s * f ^ d

                // as the minimum speed is given and we need the duration we
                // can solve the equation for d:
            <=> d = log(m/s) / log(f)
        */
        var configFlicking = this.config.flicking;
        var friction = configFlicking.friction;
        var duration = Math.log(configFlicking.minSpeed / initialSpeed) /
                       Math.log(friction);

        duration = duration > 0 ? Math.round(duration) : 0;

        /*
            The amount of pixels to flick is the sum of the distance covered
            every milisecond of the flicking duration.

            Because the distance is decelerated by the friction factor, the
            speed at a given time t is:

                pixelsPerMilisecond * friction^t

            and the distance covered is:

                d = distance
                s = initial speed = pixelsPerMilisecond
                t = time = duration
                f = friction per milisecond = config.flicking.friction

                d = sum of s * f^n for n between 0 and t
            <=> d = s * (sum of f^n for n between 0 and t)

            which is a geometric series and thus can be simplified to:
                d = s *  (1 - f^(d+1)) / (1 - f)
        */
        var factor = (1 - Math.pow(friction, duration + 1)) / (1 - friction);
        var distance = initialSpeed * factor;

        return [duration, distance];
    },

    /**
     * Gets the current offset from the scrolling layers.
     *
     * @param {Boolean} round Whether to round the offfset to whole pixels.
     * @returns {CSSMatrix} This is a reference to {@link _scrollOffset}
     */
    _determineOffset: function _determineOffset(round) {
        var scrollers = this._dom.scrollers;
        var offset = this._scrollOffset;

        var i = 0, axes = this._activeAxes, axis;
        while ((axis = axes[i++])) {
            var axisOffset = this._getNodeOffset(scrollers[axis])[axis];
            if (round) {
                // This is a high performance rounding method:
                // Add 0.5 and then do a double binary inversion
                axisOffset = ~~(axisOffset + 0.5);
            }
            offset[axis] = axisOffset;
        }

        return offset;
    },


    /**
     * Does cleanup work after ending a scroll.
     */
    _endScroll: function _endScroll() {
        this._dom.scrollers.inner.className = "-ts-layer -ts-inner";
        this.hideScrollbars();
    },

    /**
     * Plays a flicking animation.
     *
     * @param {Number} duration The animation duration in milliseconds
     * @param {CSSMatrix} vector The scroller offsets.
     */
    _flick: function _flick(duration, vector) {
        // local variables for everything to minimize lookups
        var config = this.config;

        var scrollOffset = this._scrollOffset;
        var maxOffset = this._maxOffset;

        var dom = this._dom;
        var scrollers = dom.scrollers;
        var bars = dom.bars;
        var hasBars = !!bars;

        var maxSegments, currentSegments, innerSizes;
        var snapToGrid = this.snapToGrid;
        if(snapToGrid){
            maxSegments = this.maxSegments;
            currentSegments = this.currentSegment;
            innerSizes = this._innerSize;
        }

        var barMetrics, barOffsetRatios, barTipSize, barSizes, barParts;
        if (hasBars) {
            barMetrics = this._barMetrics;
            barOffsetRatios = barMetrics.offsetRatios;
            barTipSize = barMetrics.tipSize;
            barSizes = barMetrics.sizes;
            barParts = bars.parts;
        }

        var tf = config.flicking.timingFunc;
        var timingFunc = new CubicBezier(tf[0], tf[1], tf[2], tf[3]);
        var epsilon = 1 / duration; // precision for bezier computations

        var isElastic = this.elastic;

        var configElasticity = config.elasticity;
        var configBounceFactor = configElasticity.factorFlick;
        var maxBounceLength = configElasticity.max;

        var configSnapBack = config.snapBack;
        var configSnapBackAlwaysDefaultTime = configSnapBack.alwaysDefaultTime;
        var configSnapBackDefaultTime = configSnapBack.defaultTime;

        var flickTarget = scrollOffset.multiply(vector);
        var zeroMatrix = new this._Matrix();

        var offsetSpecs = [], numOffsetSpecs = 0;
        var bounceSpecs, numBounceSpecs; // set individually for each axis
        var maxDuration = 0;
        var animDuration;

        // flick for every axis
        var i = 0, axes = this._activeAxes, axis;
        while ((axis = axes[i++])) {
            var distance = vector[axis];
            if (!distance) {
                this.snapBack(axis);
                continue;
            }
            var targetFlick = flickTarget[axis];
            var axisMin = -maxOffset[axis];
            var axisMax = 0;
            var scrollFrom = scrollOffset[axis];

            if(snapToGrid){
                var innerSize = innerSizes[axis];
                var segmentIncrement = distance > 0 ? -1 : 1;
                var maxSegment = maxSegments[axis];
                var currentSegment = currentSegments[axis];
                var flickToSegment = currentSegment + segmentIncrement;
                if (flickToSegment < 0) {
                    flickToSegment = 0;
                }
                else if (maxSegment <= flickToSegment) {
                    flickToSegment = maxSegment - 1;
                }
                currentSegments[axis] = flickToSegment;

                if(flickToSegment === currentSegment){
                    this.snapBack(axis);
                    continue;
                }
                else {
                    this._fireEvent("segmentchange", {
                        axis: axis,
                        segment: flickToSegment,
                        numSegments: maxSegment
                    });
                }

                axisMin = axisMax = -flickToSegment * innerSize;
            }

            var distanceFlick = distance;

            // compute distance fraction where flicking crosses the bounds of the scroller.
            if (targetFlick < axisMin) {
                distanceFlick = axisMin - scrollFrom;
                targetFlick = axisMin;
            }
            else if (targetFlick > axisMax) {
                distanceFlick = axisMax - scrollFrom;
                targetFlick = axisMax;
            }
            var distanceBounce = snapToGrid ? 0 : distance - distanceFlick;

            // calculate timing functions
            var t = timingFunc.getTforY(distanceFlick / distance, epsilon);
            if (t < 0 || t > 1) { // already beyond scroller bounds
                t = 0;
                distanceFlick = 0;
                distanceBounce = distance;
            }

            var bezierCurves = timingFunc.divideAtT(t);
            var timingFuncFlick = bezierCurves[0];
            var timingFuncBounce = timingFuncFlick;

            var durationFlick = duration * timingFunc.getPointForT(t).x;
            var durationBounce = duration - durationFlick;
            animDuration = durationFlick;

            var bounceSign, distanceBounceAbs;
            if (isElastic && distanceBounce) {
                durationBounce *= configBounceFactor;
                distanceBounce *= configBounceFactor;

                bounceSign = distanceBounce < 0 ? -1 : 1;
                distanceBounceAbs = distanceBounce * bounceSign;

                // limit the bounce to the configured maximum
                if (distanceBounceAbs > maxBounceLength) {
                    durationBounce *=  maxBounceLength / distanceBounceAbs;
                    distanceBounce = maxBounceLength * bounceSign;
                    distanceBounceAbs = maxBounceLength;
                }
            }

            /*
                Assemble animation
            */
            // create matrixes for flick and bounce
            var flickMatrix = zeroMatrix.translate(0, 0, 0);
            flickMatrix[axis] = ~~(targetFlick + 0.5); // fast round
            var bounceMatrix = flickMatrix.translate(0, 0, 0);
            bounceMatrix[axis] += distanceBounce;

            // queue each transition
            // flick
            var scrollerStyle = scrollers[axis].style;
            if (distanceFlick) {
                offsetSpecs[numOffsetSpecs++] = {
                    style: scrollerStyle,
                    matrix: flickMatrix,
                    timingFunc: timingFuncFlick,
                    duration: durationFlick
                };
            }

            var parts = barParts && barParts[axis];
            if (hasBars) {
                offsetSpecs[numOffsetSpecs++] = {
                    style: parts[3].style,
                    matrix: {e: 0, f: ~~(flickMatrix[axis] * barOffsetRatios[axis])},
                    timingFunc: timingFuncFlick,
                    duration: durationFlick
                };
            }

            if (isElastic && distanceBounce) {
                animDuration += durationBounce;
                bounceSpecs = [];
                numBounceSpecs = 0;

                if (hasBars) {
                    var barSize = barSizes[axis] - 2 * barTipSize;

                    if (distanceFlick) {
                        // reset potential bar scaling. Will be applied with the flick
                        offsetSpecs[numOffsetSpecs++] = {
                            style: parts[0].style,
                            matrix: {e: 0, f: 0}
                        };
                        offsetSpecs[numOffsetSpecs++] = {
                            style: parts[1].style,
                            matrix: {e: 0, barTargetSize: 0}
                        };
                        offsetSpecs[numOffsetSpecs++] = {
                            style: parts[2].style,
                            matrix: {e: 0, f: barSize + barTipSize}
                        };
                    }

                    // bounce scrollbar
                    var durationBounceBar = durationBounce;
                    var timingFuncBounceBar = timingFuncBounce;
                    var barTargetSize = ~~(barSize - distanceBounceAbs + 0.5); // round
                    if (barTargetSize < 1) { barTargetSize = 1; }
                    if (distanceBounceAbs > barSize) {
                        t = timingFuncBounceBar.getTforY(barSize/ distanceBounceAbs, epsilon);
                        var timeFraction = timingFuncBounce.getPointForT(t).x;
                        durationBounceBar *= timeFraction;
                        timingFuncBounceBar = timingFuncBounceBar.divideAtT(t)[0];
                    }
                    var barOffset = distanceBounce < 0 ? barSize - barTargetSize : 0;
                    bounceSpecs[numBounceSpecs++] = {
                        style: parts[0].style,
                        matrix: {e: 0, f: barOffset},
                        duration: durationBounceBar
                    };
                    var barMatrix = zeroMatrix.translate(0, barOffset + barTipSize, 0);
                    barMatrix.d = barTargetSize/barSize;
                    bounceSpecs[numBounceSpecs++] = {
                        style: parts[1].style,
                        matrix: barMatrix,
                        duration: durationBounceBar
                    };
                    bounceSpecs[numBounceSpecs++] = {
                        style: parts[2].style,
                        matrix: {e: 0, f: barOffset + barTipSize + barTargetSize},
                        duration: durationBounceBar
                    };
                }

                // bounce layer
                bounceSpecs[numBounceSpecs++] = {
                    style: scrollerStyle,
                    matrix: bounceMatrix,
                    timingFunc: timingFuncBounce,
                    duration: durationBounce
                };
                this._setStyleOffset(bounceSpecs, durationFlick);
                animDuration += durationBounce;

                var durationSnapBack = configSnapBackAlwaysDefaultTime ? configSnapBackDefaultTime : durationBounce;
                this.snapBack(axis, durationSnapBack, animDuration);
                animDuration += durationSnapBack;
            }

            if (animDuration > maxDuration) {
                maxDuration = animDuration;
            }

        }
        this._setStyleOffset(offsetSpecs, 0);

        var that = this;
        var timeouts = this._scrollTimeouts;
        timeouts[timeouts.length] = setTimeout(function() {
            that._endScroll();
        }, maxDuration);

        if (this.scrollevents && maxDuration) {
            var iterations = 0;
            var interval = setInterval(function() {
                if (++iterations * 100 < maxDuration) {
                    that._fireEvent("scroll");
                }
                else {
                    clearInterval(interval);
                }
            }, 100);
        }

    },

    /**
     * Fires a custom event on the scroller element (default is "scroll").
     *
     * @param {String} [type] The type of event to fire. Defaults to "scroll".
     * @param {Object} [properties] All properties of this object will be mixed
     *                              into the event.
     */
    _fireEvent: function _fireEvent(type, properties) {
        var event = document.createEvent("Event");
        event.touchscroll = this;
        if (properties) {
            for (var prop in properties) {
                event[prop] = properties[prop];
            }
        }

        event.initEvent(type || "scroll", true, false);
        this._dom.outer.dispatchEvent(event);
    },

    /**
     * @private
     * @param {HTMLElement} node
     * @returns {CSSMatrix} A matrix representing the current css transform of a node.
     */
    _getNodeOffset: (function() {
        if (TouchScroll._parsesMatrixCorrectly) {
            return function _getNodeOffset(node) {
                var computedStyle = window.getComputedStyle(node);
                return new this._Matrix(computedStyle.webkitTransform);
            };
        }

        var reMatrix = /matrix\(\s*-?\d+(?:\.\d+)?\s*,\s*-?\d+(?:\.\d+)?\s*,\s*-?\d+(?:\.\d+)?\s*,\s*-?\d+(?:\.\d+)?\s*\,\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*\)/;
        return function _getNodeOffset(node) {
            var computedStyle = window.getComputedStyle(node);
            var match = reMatrix.exec(computedStyle.webkitTransform);
            var matrix = new this._Matrix();
            if (match) {
                matrix.e = match[0];
                matrix.f = match[1];
            }
            return matrix;
        };
    }()),

    /**
     * Initializes the DOM of the scroller.
     */
    _initDom: function _initDom(scrollbars) {
        var dom = this._dom;
        var scrollElement = dom.outer;

        scrollElement.className += " TouchScroll";

        // remove scroller contents
        var firstChild, children = document.createDocumentFragment();
        while ((firstChild = scrollElement.firstChild)) {
            children.appendChild(firstChild);
        }

        this._insertNodes(scrollbars);

        // put original contents back into DOM
        var innerScroller = dom.scrollers.inner;
        innerScroller.appendChild(children);

        // register event listeners
        var eventNames = this._eventNames;
        [
            eventNames.start,
            eventNames.move,
            eventNames.end
        ].forEach(function(type) { scrollElement.addEventListener(type, this, false); }, this);

        innerScroller.addEventListener("DOMSubtreeModified", this, false);
        innerScroller.addEventListener("focus", this, true);

        this.setupScroller();
    },

    /**
     * Inserts additional elements for scrolling layers and
     * scrollbars/indicators. Also sets up references.
     *
     * @private
     * @param {Boolean} scrollbars Whether to build scrollbars.
     */
    _insertNodes: function _insertNodes(scrollbars) {
        var dom = this._dom;
        var scrollElement = dom.outer;

        // set innerHTML from template
        scrollElement.innerHTML = this._scrollerTemplate;

        // setup references to scroller HTML nodes
        var scrollers = dom.scrollers = {
            inner: scrollElement.querySelector(".-ts-inner"),
            e: null, f: null
        };

        // find layers
        var layers = scrollElement.querySelectorAll(".-ts-layer");
        scrollers.f = layers[0];
        scrollers.e = layers[1];

        // build scrollbars
        if (scrollbars) {
            var bars = dom.bars = {
                outer: scrollElement.querySelector(".-ts-bars")
            };

            bars.outer.innerHTML = this._scrollbarTemplate;
            var parts = bars.parts = {};

            var i = 0, axes = this._axes, axis;
            while ((axis = axes[i++])) {
                var bar = bars[axis] = scrollElement.querySelector(".-ts-bar-"+axis);
                parts[axis] = [
                    bar.querySelector(".-ts-bar-1"),
                    bar.querySelector(".-ts-bar-2"),
                    bar.querySelector(".-ts-bar-3"),
                    bars.outer.querySelector(".-ts-indicator-" + axis)
                ];
            }
        }
    },

    /**
     * Scrolls by applying a transform matrix to the scroll layers.
     *
     * As this method is called for every touchmove event, the code is rolled
     * out for both axes (leading to redundancies) to get maximum performance.
     *
     * @param {CSSMatrix} matrix Holds the offsets to apply.
     */
    _scrollBy: function _scrollBy(matrix) {
        var isScrolling = this._isScrolling;
        if (!isScrolling.e) {
            matrix.e = 0;
        }
        if (!isScrolling.f) {
            matrix.f = 0;
        }

        var maxOffset = this._maxOffset, axisMaxOffset;
        var scrollOffset = this._scrollOffset, axisScrollOffset;
        var newOffset = scrollOffset.multiply(matrix), axisNewOffset;

        var axisBounce;

        var isElastic = this.elastic;
        var zeroMatrix = new this._Matrix();

        var dom = this._dom;
        var scrollers = dom.scrollers;
        var bars = dom.bars;
        var hasBars = !!bars;

        var barMetrics, barParts, sizes, tipSize, offsetRatios, barMaxOffsets;
        var parts, defaultSize, size, indicatorOffset, barMaxOffset, barMatrix, barSizeSubstract;
        if (hasBars) {
            barMetrics = this._barMetrics;
            barParts = bars.parts;
            sizes = barMetrics.sizes;
            tipSize = barMetrics.tipSize;
            offsetRatios = barMetrics.offsetRatios;
            barMaxOffsets = barMetrics.maxOffset;

        }

        var offsetSpecs = [], numOffsetSpecs = 0;
        var isOutOfBounds, wasOutOfBounds;

        var bounceOffset;
        var factor = this.config.elasticity.factorDrag;
        var i = 0, axes = this._activeAxes, axis;
        while ((axis = axes[i++])) {
            axisMaxOffset = -maxOffset[axis];
            axisScrollOffset = scrollOffset[axis];
            axisNewOffset = newOffset[axis];
            bounceOffset = 0;

            if (isElastic) {
                axisScrollOffset = scrollOffset[axis];

                // whether the scroller was already beyond scroll bounds
                wasOutOfBounds = axisScrollOffset < axisMaxOffset || axisScrollOffset > 0;
                if (wasOutOfBounds) {
                    axisNewOffset -= matrix[axis] * (1 - factor);
                }

                isOutOfBounds = axisNewOffset < axisMaxOffset || axisNewOffset > 0;

                // whether the drag/scroll action went across scroller bounds
                var crossingBounds = (wasOutOfBounds && !isOutOfBounds) ||
                                     (isOutOfBounds && !wasOutOfBounds);

                if (crossingBounds) {
                    /*
                        If the drag went across scroll bounds, we need to apply a
                        "mixed strategy": The part of the drag outside the bounds
                        is mutliplicated by the elasticity factor.
                    */
                    if (axisScrollOffset > 0) {
                        axisNewOffset /= factor;
                    }
                    else if (axisNewOffset > 0) {
                        axisNewOffset *= factor;
                    }
                    else if (axisScrollOffset < axisMaxOffset) {
                        axisNewOffset += (axisMaxOffset - axisScrollOffset) / factor;
                    }
                    else if (axisNewOffset < axisMaxOffset) {
                        axisNewOffset -= (axisMaxOffset - axisNewOffset) * factor;
                    }
                }

                if (isOutOfBounds) {
                    bounceOffset = axisNewOffset > 0 ? axisNewOffset : axisNewOffset - axisMaxOffset;
                }
            }

            // Constrain scrolling to scroller bounds
            var unlimitedNewOffset = axisNewOffset;
            if (axisNewOffset < axisMaxOffset) { axisNewOffset = axisMaxOffset; }
            else if (axisNewOffset > 0) { axisNewOffset = 0; }

            var scrollMatrix = zeroMatrix.translate(0, 0, 0);
            scrollMatrix[axis] = axisNewOffset + bounceOffset;
            offsetSpecs[numOffsetSpecs++] = {
                style: scrollers[axis].style,
                matrix: scrollMatrix
            };

            newOffset[axis] = isElastic ? unlimitedNewOffset : axisNewOffset;

            if (hasBars) {
                parts = barParts[axis];

                // adjust offset
                indicatorOffset = ~~(axisNewOffset * offsetRatios[axis] + 0.5); // round
                barMaxOffset = barMaxOffsets[axis];
                if (indicatorOffset < 0) { indicatorOffset = 0; }
                else if (indicatorOffset > barMaxOffset) { indicatorOffset = barMaxOffset + defaultSize - size - 2 * tipSize; }

                offsetSpecs[numOffsetSpecs++] = {
                    style: parts[3].style,
                    matrix: {e: 0, f: indicatorOffset}
                };

                // scale
                defaultSize = size = sizes[axis] - 2*tipSize;
                var partsOffset = 0;
                if (isOutOfBounds) {
                    barSizeSubstract = bounceOffset < 0 ? -bounceOffset : bounceOffset;
                    size -= ~~(barSizeSubstract + 0.5);
                    if (size < 1) { size = 1; }
                    if (bounceOffset < 0) {
                        partsOffset = defaultSize - size;
                    }
                }

                if (isOutOfBounds || wasOutOfBounds) {
                    // upper indicator tip
                    offsetSpecs[numOffsetSpecs++] = {
                        style: parts[0].style,
                        matrix: {e: 0, f: partsOffset}
                    };
                }

                // middle indicator part
                barMatrix = zeroMatrix.translate(0, partsOffset + tipSize, 0);
                barMatrix.d = size/defaultSize;
                offsetSpecs[numOffsetSpecs++] = {
                    style: parts[1].style,
                    matrix: barMatrix
                };
                // indicator end
                offsetSpecs[numOffsetSpecs++] = {
                    style: parts[2].style,
                    matrix: {e: 0, f: partsOffset + size + tipSize}
                };
            }
        }

        this._setStyleOffset(offsetSpecs);
        this._scrollOffset = newOffset;
        if (this.scrollevents && offsetSpecs.length) {
            this._fireEvent("scroll");
        }
    },

    /**
     * Sets transform offsets onto style elements.
     *
     * This function can apply individual transforms to multiple style
     * properties to ensure they are all applied within the same function call
     * and don't trigger repaints in between.
     *
     * @private
     * @param specs {Object[]} An array of transform "specs". Every spec
     * contains the following properties:
     *      {CSSStyleDeclaration} style A style property of an HTMLElement.
     *      {WebKitCSSMatrix|Object} matrix An object that has `e` and `f`
     *          properties for x and y offsets.
     *      {Array|Object|String} [timingFunc] Control points for a "cubic-bezier"
     *          declaration, or a string containing a valid easing functions.
     *          Non-arrays will be converted to strings.
     *      {Number} [duration] Miliseconds
     *      {Number} [delay] The `transition-delay` to apply in miliseconds.
     */
    _setStyleOffset: function _setStyleOffset(specs, timeout) {
        if (timeout) {
            var t = this._scrollTimeouts;
            t[t.length] = setTimeout(function() {_setStyleOffset(specs);}, timeout);
        }
        else {
            var beginTransform, endTransform;
            if (this._has3d) {
                beginTransform = "translate3d(";
                endTransform = ", 0)";
            }
            else {
                beginTransform = "translate(";
                endTransform = ")";
            }
            var style, matrix, timingFunc, duration;
            var spec, i = 0;
            while ((spec = specs[i++])) {
                style = spec.style;
                matrix = spec.matrix;
                duration = spec.duration;
                timingFunc = spec.timingFunc;
                if (timingFunc) {
                    timingFunc = timingFunc && timingFunc.join ?
                            "cubic-bezier(" + timingFunc.join(",") + ")" :
                            timingFunc;
                }
                else {
                    timingFunc = "";
                }

                //style.webkitTransitionDuration = (spec.duration || 0) + "ms";
                //style.webkitTransitionTimingFunction = timingFunc;
                //style.webkitTransitionDelay = (spec.delay || 0) + "ms";
                style.webkitTransition = duration ?
                    "-webkit-transform " + timingFunc + " " + spec.duration + "ms " + (spec.delay || 0) + "ms" :
                    "";

                var scaleY = matrix.d;
                style.webkitTransform = scaleY && scaleY !== 1 ?
                    matrix :
                    beginTransform + matrix.e + "px, " + matrix.f + "px" + endTransform;
            }
        }
    },

    /**
     * Stops all running animations.
     */
    _stopAnimations: function _stopAnimations() {
        var timeouts = this._scrollTimeouts;
        for (var i = 0, len = timeouts.length; i < len; i++) {
            clearTimeout(timeouts[i]);
        }
        timeouts.length = 0;

        var dom = this._dom;
        var scrollers = this._dom.scrollers;
        var bars = dom.bars;
        var barParts = bars && bars.parts;
        var offset = this._determineOffset();
        var maxOffset = this._maxOffset;

        var barMetrics = this._barMetrics;
        var barOffsetRatios = barMetrics.offsetRatios;
        var barTipSize = barMetrics.tipSize;
        var barSizes = barMetrics.sizes;

        var zeroMatrix = new this._Matrix();
        var axes = this._axes, axis, axisOffset, axisMaxOffset;
        var matrix, parts, part, barSize, barOffset;

        var offsetSpecs = [], j = 0;
        i = 0;
        while ((axis = axes[i++])) {
            axisOffset = offset[axis];
            axisMaxOffset = -maxOffset[axis];

            if (axisOffset > 0) {
                offset[axis] = axisOffset = 0;
            }
            else if (axisOffset < axisMaxOffset) {
                offset[axis] = axisOffset = axisMaxOffset;
            }

            matrix = {e: 0, f: 0};
            matrix[axis] = axisOffset;
            offsetSpecs[j++] = {
                style: scrollers[axis].style,
                matrix: matrix
            };

            if (barParts) {
                parts = barParts[axis];
                barSize = barSizes[axis] - 2 * barTipSize;
                offsetSpecs[j++] = {
                    style: parts[3].style,
                    matrix: {e: 0, f: ~~(axisOffset * barOffsetRatios[axis])}
                };

                offsetSpecs[j++] = {
                    style: parts[0].style,
                    matrix: {e: 0, f: 0}
                };

                offsetSpecs[j++] = {
                    style: parts[1].style,
                    matrix: {e: 0, f: barTipSize}
                };

                offsetSpecs[j++] = {
                    style: parts[2].style,
                    matrix: {e: 0, f: barTipSize + barSize}
                };
            }
        }
        this._setStyleOffset(offsetSpecs);
    }
};


// Add getter + setter functions for scroll positions
[
    [
        "scrollTop",
        function() {
            var offset = this._scrollTimeouts.length ? this._determineOffset() : this._scrollOffset;
            return -offset.f;
        },
        function (val) {
            this.scrollTo(0, val);
        }
    ],
    [
        "scrollLeft",
        function() {
            var offset = this._scrollTimeouts.length ? this._determineOffset() : this._scrollOffset;
            return -offset.e;
        },
        function (val) {
            this.scrollTo(val, 0);
        }
    ]
].forEach(function(p) {
    TouchScroll.prototype.__defineGetter__(p[0], p[1]);
    TouchScroll.prototype.__defineSetter__(p[0], p[2]);
});

// Add getter/setter functions for DOM facade
[
    "childNodes",
    "children",
    "firstChild",
    "firstElementChild",
    "innerHTML",
    "innerText",
    "lastChild",
    "lastElementChild"
].forEach(function(prop) {
    TouchScroll.prototype.__defineGetter__(prop, function() {
        return this._dom.scrollers.inner[prop];
    });
    TouchScroll.prototype.__defineSetter__(prop, function(val) {
        this._dom.scrollers.inner[prop] = val;
    });
});

// Add DOM methods facade
[
    "insertAdjacentElement",
    "insertAdjacentHTML",
    "insertAdjacentText",
    "querySelector",
    "querySelectorAll",
    "addEventListener",
    "appendChild",
    "insertBefore",
    "replaceChild"
].forEach(function(method) {
    TouchScroll.prototype[method] = function() {
        var inner = this._dom.scrollers.inner;
        return inner[method].apply(inner, arguments);
    };
});
