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
        triggerThreshold: 150,

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
        max: 200
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
    ".TouchScroll { position: relative; display: -webkit-box; }",
    ".-ts-layer { -webkit-transition-property: -webkit-transform; -webkit-transform: translate3d(0, 0, 0); " +
        "-webkit-transform-style: preserve-3d; -webkit-box-flex: 1; position: relative; }",
    ".-ts-inner { position: absolute; height: 100%; top: 0; right: 0; left: 0; }",
    ".-ts-bars { bottom: 0; left: 0; pointer-events: none; position: absolute; " +
        "opacity: 0; right: 0; top: 0; z-index: 2147483647; " +
        "-webkit-transition: opacity 250ms; }",
    ".-ts-bar { display: none; position: absolute; right: 3px; bottom: 3px; }",
    ".-ts-bar.active { display: block; }",
    ".-ts-bar-e { height: 7px; left: 3px; " +
        "-webkit-transform: rotate(-90deg) translateX(-7px); -webkit-transform-origin: 0 0; }",
    ".-ts-bar-f { width: 7px; top: 3px; }",
    ".-ts-bars-both .-ts-bar-e { right: 9px; }",
    ".-ts-bars-both .-ts-bar-f { bottom: 9px; }",
    ".-ts-indicator-e, .-ts-indicator-f, .-ts-bar-part { position: absolute; }",
    ".-ts-bar-part { background: url(data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAA4AAAAOBAMAAADtZjDiAAAALVBMVEUAAAD///8AAAD///+kpKT///////////////////8nJycBAQEJCQn///9YWFgbIh+zAAAAD3RSTlOATQASUTVFQwMkaIB3TFtjuC6yAAAATElEQVQI12NQ0piaFtmkxKBkLigoWKzEoHzR68wSWSOGdrkNDNwPKxgmejMwMGyRZAhcAKS5RBkSDwBpHjE4DROHqYPpg5kDMxdqDwDB4xorHHHNdAAAAABJRU5ErkJggg==) no-repeat center top; " +
        "-webkit-background-size: 7px; width: 7px; " +
        "-webkit-transform-origin: left top; -webkit-transform: translate3d(0,0,0); " +
        "-webkit-transform-style: preserve-3d; }",
    ".-ts-bar-1, .-ts-bar-3 { height: 3px; } ",
    ".-ts-bar-3 { background-position: center bottom; }",
    ".-ts-bar-2 { height: 1px; background-position: center; }",
    ".-ts-bar-2 { height: 1px; border-width: 0 1px; }",
].forEach(function(rule, i) { this.insertRule(rule, i); }, TouchScroll._styleSheet);

/**
 * @class
 * @param {HTMLElement} scrollElement The HTML element to make scrollable.
 * @param {Objects} [options] An expando for options. Supported options are:#
 *                            - elastic {Boolean}, defaults to `false`
 *                            - scrollbars {Boolean}, defaults to `true`
 */
function TouchScroll(scrollElement, options) {
    options = options || {};

    /** @type {Boolean} Whether the scroller bounces across its bounds. */
    this.elastic = !!options.elastic;

    /** @type {Boolean} Whether to build and use scrollbars. */
    var useScrollbars = "scrollbars" in options ?  !!options.scrollbars : true;

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

    /** @type {String[]} Stores the te ids of all scrolling axes */
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
        touchcancel: "onTouchEnd"
    },

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
            '<div class="-ts-layer">',
                '<div class="-ts-layer -ts-inner"></div>',
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
     * Centers the scroller.
     *
     * @returns {TouchScroll} Returns the TouchScroll instance.
     */
    center: function center() {
        return this;
    },

    /**
     * Centers the scroller at given coordinates.
     *
     * @param {Number} left The horizontal offset.
     * @param {Number} top The vertical offset.
     * @returns {TouchScroll} Returns the TouchScroll instance.
     */
    centerAt: function centerAt(left, top) {
        return this;
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
                // catch pointer events with the scrollbar layer
                this._dom.bars.outer.style.pointerEvents = "auto";
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
            return;
        }

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

        if (flickAllowed) {
            var flick = this._computeFlick(moveSpeed);
            var flickDuration = flick[0];
            var flickDistance = flick[1];
        }

        if (flickAllowed && flick[0] && flick[1]) {
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

    scrollTo: function scrollTo(e, f, duration) {
        var scrollOffset = this._scrollOffset;
        var scrollMatrix = new this._Matrix();
        scrollMatrix.e = -e - scrollOffset.e;
        scrollMatrix.f = -f - scrollOffset.f ;

        if (duration > 0) {
            this._flick(duration, scrollMatrix);
        }
        else {
            this._scrollBy(scrollMatrix);
        }
    },

    /**
     * Sets up the scroller according to its metrics.
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
                return;
        }

        m.offsetWidth = offsetWidth;
        m.offsetHeight = offsetHeight;
        m.scrollWidth = scrollWidth;
        m.scrollHeight = scrollHeight;

        // instance properties
        var maxOffset = this._maxOffset = {
            e: Math.max(scrollWidth - offsetWidth),
            f: Math.max(scrollHeight - offsetHeight)
        };

        var isScrolling = this._isScrolling = {
            e: maxOffset.e > 0,
            f: maxOffset.f > 0
        };
        isScrolling.general = isScrolling.e || isScrolling.f;

        var activeAxes = this._activeAxes = this._axes.filter(function(axis) {
            return isScrolling[axis];
        });

        // hide/show scrollbars
        var bars = dom.bars;
        if (bars) {
            var i = 0, axes = this._axes, bothScrolling = true, axis, bar;
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

            var maxOffset = barMetrics.maxOffset;
            maxOffset.e = availLength.e; - barSizes.e;
            maxOffset.f = availLength.f; - barSizes.f;

            var offsetRatios = barMetrics.offsetRatios;
            offsetRatios.e = maxOffset.e / -scrollWidth;
            offsetRatios.f = maxOffset.f / -scrollHeight;

            var i = 0, axes = activeAxes;
            var axis, parts, size, scale, tipSize, offset;
            var offsetSpecs = [];
            var scrollOffset = this._scrollOffset;
            var barMatrix, zeroMatrix = new this._Matrix();
            while ((axis = axes[i++])) {
                parts = bars.parts[axis];
                tipSize = tipSize || parts[0].offsetHeight;
                size = barSizes[axis];
                scale = size - tipSize * 2;
                barMetrics.maxOffset[axis] = availLength[axis] - size;
                offset = offsetRatios[axis] * scrollOffset[axis];
                barMatrix = zeroMatrix.translate(0, tipSize, 0);
                barMatrix.d = scale;
                offsetSpecs.push(
                    {
                        style: parts[3].style,
                        matrix: {e: 0, f: offset}
                    },
                    {
                        style: parts[1].style,
                        matrix: barMatrix,
                        useMatrix: true
                    },
                    {
                        style: parts[2].style,
                        matrix: {e: 0, f: tipSize + scale}
                    }
                );

            }
            barMetrics.tipSize = tipSize;
            this._setStyleOffset(offsetSpecs);
        }
    },

    /**
     * Scrolls back to the bounds of the scroller if the scroll position
     * exceeds these.
     *
     * @param {String|null} [axis] Which axis to snap back. `null` snaps back
     *                             both axes.
     * @returns {Boolean} Whether the scroller was beyond regular bounds.
     */
    snapBack: function snapBack(axis) {
        var axes = axis ? [axis] : this._activeAxes;
        var scrollOffset = this._scrollOffset;
        var maxOffset = this._maxOffset;
        var dom = this._dom;
        var scrollers = dom.scrollers;
        var snapBackConfig = this.config.snapBack;
        var duration = snapBackConfig.defaultTime;
        var timingFunc = snapBackConfig.timingFunc;

        var i = 0, snapAxis;
        var timeout = 0;
        var zeroMatrix = new this._Matrix();

        var bars = dom.bars;
        var barMetrics = this._barMetrics;
        var barSizes = barMetrics.sizes;
        var tipSize = barMetrics.tipSize;
        var barMaxOffset = barMetrics.maxOffset;
        var barMatrix;

        var offsetSpecs = [];

        while ((snapAxis = axes[i++])) {
            var offset = scrollOffset[snapAxis];
            var minOffset = -maxOffset[snapAxis];
            if (offset >= minOffset && offset <= 0) {
                continue;
            }

            var offsetTo = zeroMatrix.translate(0, 0, 0);
            var snapBackLength;
            var bounceAtEnd;
            if (offset > 0) {
                offsetTo[snapAxis] = 0;
                snapBackLength = offset;
                bounceAtEnd = false;
            }
            else {
                offsetTo[snapAxis] = minOffset;
                snapBackLength = minOffset - offset;
                bounceAtEnd = true;
            }

            var scrollerStyle = scrollers[snapAxis].style;
            offsetSpecs[offsetSpecs.length] = {
                style: scrollerStyle,
                matrix: offsetTo,
                timingFunc: timingFunc,
                duration: duration
            };

            if (duration > timeout) {
                timeout = duration;
            }

            if (bars) {
                var size = barSizes[snapAxis];
                var scale = size - 2 * tipSize;
                var barDuration = duration;
                var barTimingFunc = timingFunc;
                if (snapBackLength > scale) {
                    var bezier = bezier || new CubicBezier(timingFunc[0], timingFunc[1], timingFunc[2], timingFunc[3]);
                    var t = bezier.getTforY(1 - scale/snapBackLength, 1 / duration);
                    var timeFraction = bezier.getPointForT(t).x;
                    barDuration *= 1 - timeFraction;
                    barTimingFunc = bezier.divideAtT(t)[1];
                }

                var parts = bars.parts[snapAxis];
                var barDelay = duration - barDuration;
                var barOffsetF = bounceAtEnd ? barMaxOffset[snapAxis] : 0;
                offsetSpecs[offsetSpecs.length] = {
                    style: parts[3].style,
                    matrix: {e: 0, f: barOffsetF},
                    timingFunc: barTimingFunc,
                    duration: barDuration,
                    delay: barDelay
                };

                barOffsetF = tipSize;
                barMatrix = zeroMatrix.translate(0, barOffsetF, 0);
                barMatrix.d = scale;
                offsetSpecs[offsetSpecs.length] = {
                    style: parts[1].style,
                    matrix: barMatrix,
                    timingFunc: barTimingFunc,
                    duration: barDuration,
                    delay: barDelay,
                    useMatrix: true
                };

                barOffsetF += scale;
                offsetSpecs[offsetSpecs.length] = {
                    style: parts[2].style,
                    matrix: {e: 0, f: barOffsetF},
                    timingFunc: barTimingFunc,
                    duration: barDuration,
                    delay: barDelay
                };
            }
            this._setStyleOffset(offsetSpecs);
        }

        if (!axis) {
            var scroller = this;
            var timeouts = this._scrollTimeouts;
            timeouts[timeouts.length] = setTimeout(function() {
                scroller._endScroll();
            }, timeout);
        }


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
        this._dom.bars.outer.style.pointerEvents = "";
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

        var dom = this._dom;
        var scrollers = dom.scrollers;
        var bars = dom.bars;

        var scrollOffset = this._scrollOffset;
        var maxOffset = this._maxOffset;

        var barMetrics = this._barMetrics;
        var barOffsetRatios = barMetrics.offsetRatios;
        var barTipSize = barMetrics.tipSize;
        var barSizes = barMetrics.sizes;

        var tf = config.flicking.timingFunc;
        var timingFunc = new CubicBezier(tf[0], tf[1], tf[2], tf[3]);
        var epsilon = 1 / duration; // precision for bezier computations

        var configSnapBack = config.snapBack;
        var snapBackAlwaysDefaultTime = configSnapBack.alwaysDefaultTime;
        var snapBackDefaultTime = configSnapBack.defaultTime;
        var configSnapBackTimingFunc = configSnapBack.timingFunc;

        var isElastic = this.elastic;

        var configElasticity = config.elasticity;
        var configBounceFactor = configElasticity.factorFlick;
        var maxBounceLength = configElasticity.max;

        var flickTarget = scrollOffset.multiply(vector);
        var zeroMatrix = new this._Matrix();

        var maxDuration = 0;

        var offsetSpecsFlick = [];
        var offsetSpecsBounce = [];
        var offsetSpecsSnapBack = [];

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
            var distanceBounce = distance - distanceFlick;

            // calculate timing functions
            var t = timingFunc.getTforY(distanceFlick / distance, epsilon);
            if (t < 0) { // already beyond scroller bounds
                t = 0;
                distanceBounce = distance;
            }

            var bezierCurves = timingFunc.divideAtT(t);
            var timingFuncFlick = bezierCurves[0];
            var timingFuncBounce = timingFuncFlick;
            var timingFuncSnapBack = timingFuncFlick;

            var durationFlick = duration * timingFunc.getPointForT(t).x;
            var durationBounce = duration - durationFlick;
            var durationSnapBack = 0;

            if (isElastic && distanceBounce) {
                durationBounce *= configBounceFactor;
                distanceBounce *= configBounceFactor;

                // limit the bounce to the configured maximum
                if (distanceBounce > maxBounceLength || distanceBounce < -maxBounceLength) {
                    var sign = distanceBounce < 0 ? -1 : 1;
                    durationBounce *=  maxBounceLength / distanceBounce * sign;
                    distanceBounce = maxBounceLength * sign;
                }

                // overwrite control points to achieve a smooth transition between flick and bounce
                timingFuncBounce = bezierCurves[1];
                timingFuncSnapBack = configSnapBackTimingFunc;

                durationSnapBack = durationBounce !== 0 && snapBackAlwaysDefaultTime ?
                                   snapBackDefaultTime : durationBounce;
            }

            /*
                Assemble animation
            */
            // create matrixes for every step (flick, bounce, snap back == flick)
            var flickMatrix = zeroMatrix.translate(0, 0, 0);
            flickMatrix[axis] = ~~(targetFlick + 0.5); // fast round
            var bounceMatrix = flickMatrix.translate(0, 0, 0);
            bounceMatrix[axis] += distanceBounce;

            // queue each transition
            var scrollerStyle = scrollers[axis].style;
            var barParts = bars && bars.parts[axis];
            // flick
            offsetSpecsFlick[0] = {
                style: scrollerStyle,
                matrix: flickMatrix,
                timingFunc: timingFuncFlick,
                duration: durationFlick
            };
            //console.log(timingFuncFlick.toString())
            if (barParts) {
                var barScale = barSizes[axis] - 2 * barTipSize;
                offsetSpecsFlick[1] = {
                    style: barParts[3].style,
                    matrix: {e: 0, f: ~~(flickMatrix[axis] * barOffsetRatios[axis])},
                    timingFunc: timingFuncFlick,
                    duration: durationFlick
                };
            }

            if (isElastic) {
                // bounce
                offsetSpecsBounce[0] = {
                    style: scrollerStyle,
                    matrix: bounceMatrix,
                    timingFunc: timingFuncBounce,
                    duration: durationBounce
                };

                this._setStyleOffset(offsetSpecsBounce, durationFlick);

                // snapback
                offsetSpecsSnapBack[0] = {
                    style: scrollerStyle,
                    matrix: flickMatrix,
                    timingFunc: timingFuncSnapBack,
                    duration: durationSnapBack
                };

                this._setStyleOffset(offsetSpecsSnapBack, durationFlick + durationBounce)
            }

            var animDuration = durationFlick + durationBounce + durationSnapBack;
            if (animDuration > maxDuration) {
                maxDuration = animDuration;
            }
        }
        this._setStyleOffset(offsetSpecsFlick);

        var scroller = this;
        var timeouts = this._scrollTimeouts;
        timeouts[timeouts.length] = setTimeout(function() {
            scroller._endScroll();
        }, maxDuration);
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
     *
     * Inserts additional elements for scrolling layers and scrollbars/indicators.
     *
     * @private
     * @param {Boolean} scrollbars Whether to build scrollbars.
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

        // set innerHTML from template
        scrollElement.innerHTML = this._scrollerTemplate;

        // setup references to scroller HTML nodes
        var scrollers = dom.scrollers = {
            inner: scrollElement.querySelector(".-ts-inner")
        };
        scrollers.e = scrollers.inner.parentNode;
        scrollers.f = scrollers.inner;

        var bars = dom.bars = {
            outer: scrollElement.querySelector(".-ts-bars")
        };

        if (scrollbars) {
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

        // register event listeners
        var eventNames = this._eventNames;
        scrollElement.addEventListener(eventNames.start, this);
        scrollElement.addEventListener(eventNames.move, this);
        scrollElement.addEventListener(eventNames.end, this);

        // put original contents back into DOM
        dom.scrollers.inner.appendChild(children);

        this.setupScroller();
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

        var maxOffset = this._maxOffset;
        var maxOffsetE = -maxOffset.e;
        var maxOffsetF = -maxOffset.f;
        var scrollOffset = this._scrollOffset;
        var newOffset = scrollOffset.multiply(matrix);
        var newOffsetE = newOffset.e;
        var newOffsetF = newOffset.f;

        var isElastic = this.elastic;

        if (isElastic) {
            var factor = this.config.elasticity.factorDrag;
            var scrollOffsetE = scrollOffset.e;
            var scrollOffsetF = scrollOffset.f;

            // whether the scroller was already beyond scroll bounds
            var wasOutOfBoundsE = scrollOffsetE < maxOffsetE || scrollOffsetE > 0;
            var wasOutOfBoundsF = scrollOffsetF < maxOffsetF || scrollOffsetF > 0;

            var isOutOfBoundsE = false, isOutOfBoundsF = false;

            if (wasOutOfBoundsE) {
                // if out of scroll bounds, apply the elasticity factor
                newOffsetE -= matrix.e * (1 - factor);
            }
            if (wasOutOfBoundsF) {
                newOffsetF -= matrix.f * (1 - factor);
            }

            if (newOffsetE < maxOffsetE || newOffsetE > 0) {
                isOutOfBoundsE = true;
            }
            if (newOffsetF < maxOffsetF || newOffsetF > 0) {
                isOutOfBoundsF = true;
            }

            // whether the drag/scroll action went across scroller bounds
            var crossingBoundsE = (!wasOutOfBoundsE || !isOutOfBoundsE) &&
                                  (isOutOfBoundsE || isOutOfBoundsE);
            var crossingBoundsF = (!wasOutOfBoundsF || !isOutOfBoundsF) &&
                                  (isOutOfBoundsF || isOutOfBoundsF);

            if (crossingBoundsE) {
                /*
                    If the drag went across scroll bounds, we need to apply a
                    "mixed strategy": The part of the drag outside the bounds
                    is mutliplicated by the elasticity factor.
                */
                if (scrollOffsetE > 0) {
                    newOffsetE /= factor;
                }
                else if (newOffsetE > 0) {
                    newOffsetE *= factor;
                }
                else if (scrollOffsetE < maxOffsetE) {
                    newOffsetE += (maxOffsetE - scrollOffsetE) / factor;
                }
                else if (newOffsetE < maxOffsetE) {
                    newOffsetE -= (maxOffsetE - newOffsetE) * factor;
                }
            }
            if (crossingBoundsF) {
                if (scrollOffsetF > 0) {
                    newOffsetF /= factor;
                }
                else if (newOffsetF > 0) {
                    newOffsetF *= factor;
                }
                else if (scrollOffsetF < maxOffsetF) {
                    newOffsetF += (maxOffsetF - scrollOffsetF) / factor;
                }
                else if (newOffsetF < maxOffsetF) {
                    newOffsetF -= (maxOffsetF - newOffsetF) * factor;
                }
            }
        }
        else { // not elastic
            // Constrain scrolling to scroller bounds
            if (newOffsetE < maxOffsetE) {
                newOffsetE = maxOffsetE;
            }
            else if (newOffsetE > 0) {
                newOffsetE = 0;
            }

            if (newOffsetF < maxOffsetF) {
                newOffsetF = maxOffsetF;
            }
            else if (newOffsetF > 0) {
                newOffsetF = 0;
            }
        }

        newOffset.e = newOffsetE;
        newOffset.f = newOffsetF;
        this._scrollOffset = newOffset;

        var offsetE = newOffset.translate(0, 0, 0); // faster than creating a new WebKitCSSMatrix instance
        var offsetF = newOffset.translate(0, 0, 0);
        offsetE.f = offsetF.e = 0;

        var dom = this._dom;
        var bars = dom.bars;
        var scrollers = dom.scrollers;
        var offsetSpecs = [
            {style: scrollers.e.style, matrix: offsetE},
            {style: scrollers.f.style, matrix: offsetF}
        ];

        // move and resize scrollbars
        if (bars) {
            var barMetrics = this._barMetrics;
            var scrollbarSizeSubstractE = isOutOfBoundsE ?
                ~~(newOffsetE >= 0 ? newOffsetE : maxOffsetE - newOffsetE) : 0;
            var scrollbarSizeSubstractF = isOutOfBoundsF ?
                ~~(newOffsetF >= 0 ? newOffsetF : maxOffsetF - newOffsetF) : 0;

            var parts, defaultSize, size, indicatorOffset, barMaxOffset;
            var sizes = barMetrics.sizes;
            var tipSize = barMetrics.tipSize;
            var offsetRatios = barMetrics.offsetRatios;
            var barMaxOffsets = barMetrics.maxOffset;
            var barMatrix, zeroMatrix = new this._Matrix();
            var i = 2;
            if (isScrolling.e) {
                parts = bars.parts.e;

                // scale
                defaultSize = sizes.e;
                size = defaultSize - scrollbarSizeSubstractE - tipSize * 2;
                if (size < 1) { size = 1 };

                // adjust offset
                indicatorOffset = ~~(newOffsetE * offsetRatios.e + .5);
                barMaxOffset = barMaxOffsets.e;
                if (indicatorOffset < 0) { indicatorOffset = 0; }
                else if (indicatorOffset > barMaxOffset) { indicatorOffset = barMaxOffset + defaultSize - size - 2 * tipSize; }

                offsetSpecs[i++] = {
                    style: parts[3].style,
                    matrix: {e: 0, f: indicatorOffset}
                };

                barMatrix = zeroMatrix(0, tipSize, 0);
                barMatrix.d = size;
                offsetSpecs[i++] = {
                    style: parts[1].style,
                    matrix: barMatrix,
                    useMatrix: true
                };

                offsetSpecs[i++] = {
                    style: parts[2].style,
                    matrix: {e: 0, f: tipSize + size}
                };
            }
            if (isScrolling.f) {
                parts = bars.parts.f;

                // scale
                defaultSize = sizes.f;
                size = defaultSize - scrollbarSizeSubstractF - tipSize * 2;
                if (size < 1) { size = 1 };

                // adjust offset
                indicatorOffset = ~~(newOffsetF * offsetRatios.f + .5);
                barMaxOffset = barMaxOffsets.f;
                if (indicatorOffset < 0) { indicatorOffset = 0; }
                else if (indicatorOffset > barMaxOffset) { indicatorOffset = barMaxOffset + defaultSize - size - 2 * tipSize; }

                offsetSpecs[i++] = {
                    style: parts[3].style,
                    matrix: {e: 0, f: indicatorOffset}
                };

                barMatrix = zeroMatrix.translate(0, tipSize, 0);
                barMatrix.d = size;
                offsetSpecs[i++] = {
                    style: parts[1].style,
                    matrix: barMatrix,
                    useMatrix: true
                };

                offsetSpecs[i++] = {
                    style: parts[2].style,
                    matrix: {e: 0, f: tipSize + size}
                };
            }
        }
        this._setStyleOffset(offsetSpecs);
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
     *      {Boolean} [useMatrix] Whether to use the whole matrix or only the
     *          translation values (which is faster). Defaults to false.
     *
     * @param {Number} [timeout] A timeout length to use for style application in miliseconds.
     */
    _setStyleOffset: function _setStyleOffset(specs, timeout) {
        if (timeout) {
            var timeouts = this._scrollTimeouts;
            timeouts[timeouts.length] = setTimeout(function() {
                _setStyleOffset(specs);
            }, timeout);
        }
        else {
            var style, matrix, timingFunc;
            var spec, i = 0;
            while ((spec = specs[i++])) {
                style = spec.style;
                matrix = spec.matrix;
                timingFunc = spec.timingFunc;
                timingFunc = timingFunc && timingFunc.join ?
                        "cubic-bezier(" + timingFunc.join(",") + ")" :
                        timingFunc;

                style.webkitTransitionDuration = (spec.duration || 0) + "ms";
                style.webkitTransitionTimingFunction = timingFunc;
                style.webkitTransitionDelay = (spec.delay || 0) + "ms";
                style.webkitTransform = spec.useMatrix ?
                    matrix : "translate(" + matrix.e + "px, " + matrix.f + "px) ";
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

        var dom = this._dom;
        var scrollers = this._dom.scrollers;
        var bars = dom.bars;
        var barParts = bars && bars.parts;
        var offset = this._determineOffset();

        var barMetrics = this._barMetrics;
        var barOffsetRatios = barMetrics.offsetRatios;
        var barTipSize = barMetrics.tipSize;
        var barSizes = barMetrics.sizes;

        var i = 0, axes = this._axes, axis, axisOffset, style, matrix, parts, part, barSize;
        var zeroMatrix = new this._Matrix(), barOffset;

        var offsetSpecs = [], j = 0;
        while ((axis = axes[i++])) {
            axisOffset = offset[axis];
            matrix = zeroMatrix.translate(0, 0, 0);
            matrix[axis] = axisOffset;
            offsetSpecs[j++] = {
                style: style = scrollers[axis].style,
                matrix: matrix
            };
            if (barParts) {
                parts = barParts[axis];
                barSize = barSizes[axis] - 2 * barTipSize;
                offsetSpecs[j++] = {
                    style: parts[3].style,
                    matrix: {e: 0, f: ~~(axisOffset * barOffsetRatios[axis])}
                };

                barOffset = zeroMatrix.translate(0, barTipSize, 0);
                barOffset.d = barSize;
                offsetSpecs[j++] = {
                    style: parts[1].style,
                    matrix: barOffset,
                    useMatrix: true
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
