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
    return m.e == -20 && m.f == -30;
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
        if (styleNode == sheet.ownerNode) {
            return sheet; // return the newly created stylesheet
        }
    }

    return doc.styleSheets[0]; // return a random stylesheet
}());

[
    ".touchScroll { position: relative; }",
    ".tsBars { pointer-events: none; opacity: 0; -webkit-transition: opacity 250ms; }",
    ".tsInner { float: left; min-width: 100%; -webkit-box-sizing: border-box; -webkit-transform-style: preserve-3d }",
    ".tsBar { display: none; }",
    ".tsBar.active { display: block; }",
    ".tsPasteBoard { display: none; }"
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
    var useScrollbars = options.scrollbars == null ? true : !!options.scrollbars;

    /** @type {Object} Holds scrollbar related metrics. */
    this._barMetrics = {
        /** @type {Object} Stores the offset height of the scrollbar "tracks". */
        availLength: {e: 0, f: 0}, //TODO: Check if necessary!
        /** @type {Number} Stores the size of the bar ends in pixels (assuming all have the same size). */
        endSize: 0,
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

    /** @type {Object} Holds references to animation keyframes */
    this._animations = {
        scrollers: {
            e: this._createKeyframes(),
            f: this._createKeyframes()
        },
        bars: (useScrollbars ? {
            e: this._createKeyframes(),
            f: this._createKeyframes()
        } : null)
    };

    /** @type {Object} Stores whether each axis is scrolling. */
    this._isScrolling = {e: false, f: false, general: false};

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
     * @type {Number} The number of created keyframes rules.
     */
    _numKeyframeRules: 0,

    /**
    * @private
    * @static
    * @type {String} HTML for TouchScroll instances.
    */
   _scrollerTemplate: '<div><div class="tsInner"></div><div class="tsPasteBoard"></div></div>',

   /**
    * @private
    * @static
    * @type {String} HTML for scrollbars. Used on instances with scrollbars.
    */
   _scrollbarTemplate : [
            '<div class="tsBars">',
                '<div class="tsBar tsBarE">',
                    '<div class="tsBar1"></div>',
                    '<div class="tsBar2"></div>',
                    '<div class="tsBar3"></div>',
                '</div>',
                '<div class="tsBar tsBarF">',
                    '<div class="tsBar1"></div>',
                    '<div class="tsBar2"></div>',
                    '<div class="tsBar3"></div>',
                '</div>',
            '</div>'
        ].join("\n"),

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

        this.setupScroller();
        this._isTracking = true;
        this._scrollBegan = false;
        this._stopAnimations();

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
                threshold >= scrollOffset.e ||
                threshold >= -scrollOffset.e ||
                threshold >= scrollOffset.f ||
                threshold >= -scrollOffset.f;
            if(scrollBegan){
                //this._dom.pasteBoard.innerHTML = '<a href="' + event.timeStamp + '">&nbsp;</a>';
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
        if (!this._isTracking) {
            return;
        }

        this._isTracking = false;

        if (!this._scrollBegan) {
            return;
        }

        // calculate flick
        var configFlicking = this.config.flicking;
        var lastEvents = this._lastEvents;
        var event0 = lastEvents[0];
        var event1 = lastEvents[1];
        var lag = event.timeStamp - event1.timeStamp;
        var moveX = event1.pageX - event0.pageX;
        var moveY = event1.pageY - event0.pageY;
        var moveDistance = Math.sqrt(moveX * moveX + moveY * moveY);
        var moveDuration = event1.timeStamp - event0.timeStamp;
        var moveSpeed = moveDistance / moveDuration;

        if (lag <= configFlicking.triggerThreshold && moveSpeed >= configFlicking.minSpeed) {
            var flick = this._computeFlick(moveSpeed);
            var flickDuration = flick[0];
            var flickDistance = flick[1];
            var flickVector = new this._Matrix();
            flickVector.e = moveX / moveDistance * flickDistance;
            flickVector.f = moveY / moveDistance * flickDistance;
            this._flick(flickDuration, flickVector);
        }
        else {
            // snap back to bounds
            this.snapBack();
        }

        this._scrollBegan = false;
        this._lastEvents[0] = this._lastEvents[1] = null;
    },

    scrollTo: function scrollTo(e, f, duration) {
        var scrollOffset = this._scrollOffset;
        var scrollMatrix = new this._Matrix();
        scrollMatrix.e = -e - scrollOffset.e;
        scrollMatrix.f = -f - scrollOffset.f ;

        duration > 0 ? this._flick(duration, scrollMatrix) : this._scrollBy(scrollMatrix);
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
            offsetWidth == m.offsetWidth && offsetHeight == m.offsetHeight &&
            scrollWidth == m.scrollWidth && scrollHeight == m.scrollHeight
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

        // hide/show scrollbars
        var bars = dom.bars;
        if (bars) {
            var axes = ["e", "f"];
            for (var i = 0, axis, bar; (axis = axes[i++]); ) {
                bar = bars[axis];
                bar.className = bar.className.replace(" active", "");
                if (isScrolling[axis]) {
                    bar.className += " active";
                }
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
            ));
            barSizes.f = Math.round(Math.max(
                availLength.e * offsetHeight / scrollHeight
            ));

            var endSize = barMetrics.endSize;
            var setOffset = this._setStyleOffset;
            for (var i = 0, axis, parts, style1, size, scale, offset; (axis = axes[i++]); ) {
                parts = bars.parts[axis];
                style1 = parts[1].style;
                size = barSizes[axis];
                scale = size - endSize * 2;
                offset = new this._Matrix();
                offset[axis] = endSize;
                setOffset(style1, offset);
                style1.webkitTransform += " scale(" + scale + ")";

                barMetrics.maxOffset[axis] = availLength[axis] - size;
                offset[axis] += scale - 1;
                setOffset(parts[2].style, offset);
            }
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
        var axes = axis ? [axis] : ["e", "f"];
        var scrollOffset = this._scrollOffset;
        var maxOffset = this._maxOffset;
        var scrollerAnimations = this._animations.scrollers;
        var dom = this._dom;
        var scrollers = dom.scrollers;
        var snapBackConfig = this.config.snapBack;
        var duration = snapBackConfig.defaultTime;
        var timingFunc = snapBackConfig.timingFunc;
        var setStyleOffset = this._setStyleOffset;
        for (var i = 0, snapAxis; (snapAxis = axes[i++]); ) {
            var offset = scrollOffset[snapAxis];
            var minOffset = -maxOffset[snapAxis];
            var scrollerStyle = scrollers[snapAxis].style;
            if (offset >= minOffset && offset <= 0) {
                continue;
            }

            var keyFrames = scrollerAnimations[snapAxis];
            var snapBackFrame = keyFrames[2];
            var snapBackFrameStyle = snapBackFrame.style;
            var endFrameStyle = keyFrames[3].style;

            keyFrames[1].keyText = snapBackFrame.keyText = "0%";

            var offsetFrom = new this._Matrix
            var offsetTo = offsetFrom.translate(0, 0, 0);
            offsetFrom[snapAxis] = offset;
            offsetTo[snapAxis] = offset > 0 ? 0 : minOffset;
            setStyleOffset(snapBackFrameStyle, offsetFrom, timingFunc);
            setStyleOffset(endFrameStyle, offsetTo);
            setStyleOffset(scrollerStyle, offsetTo);
            scrollerStyle.webkitAnimationDuration = duration + "ms";
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
     * Creates a keyframes rule, appends it to the stylesheet, and returns an
     * array containg references to the single keyframes.
     *
     * The array has a "name" property, containing the name of the
     * keyframes rule.
     */
    _createKeyframes: function _createKeyframes(numFrames) {
        numFrames = parseInt(numFrames) || 3;
        var sheet = this._styleSheet, rulePos = sheet.length;
        var name = "touchScrollAnimation-" + this.__proto__._numKeyframeRules++;
        var rule = "@-webkit-keyframes " + name;

        var interval = Math.floor(100 / (numFrames - 1));
        var framePositions = [];
        for (var i = 0; i < numFrames - 1; i++) {
            framePositions[i] = i * interval;
        }
        framePositions[i] = 100;

        rule += "{" + framePositions.map(function(pos) {
            return pos + "% {}";
        }).join(" ") + "}";

        rulePos = sheet.insertRule(rule, rulePos);
        var keyframes = sheet.cssRules[rulePos];
        var frameRefs = framePositions.map(function (pos) {
            return keyframes.findRule(pos + "%");
        });
        frameRefs.name = name;

        return frameRefs;
    },

    /**
     * Gets the current offset from the scrolling layers.
     *
     * @param {Boolean} round Whether to round the offfset to whole pixels.
     * @returns {CSSMatrix} This is a reference to {@link _scrollOffset}
     */
    _determineOffset: function _determineOffset(round) {
        var isScrolling = this._isScrolling;
        var scrollers = this._dom.scrollers;
        var offset = this._scrollOffset;

        for (var i = 0, axes = ["e", "f"], axis, offset; (axis = axes[i++]); ) {
            if (isScrolling[axis]) {
                var axisOffset = this._getNodeOffset(scrollers[axis])[axis];
                if (round) {
                    // This is a high performance rounding method:
                    // Add 0.5 and then do a double binary inversion
                    axisOffset = ~~(axisOffset + 0.5);
                }
                offset[axis] = axisOffset;
            }
        }

        return offset;
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
        var animations = this._animations;
        var scrollerAnimations = animations.scrollers;
        var scrollOffset = this._scrollOffset;

        var isScrolling = this._isScrolling;
        var maxOffset = this._maxOffset;

        var configFlicking = config.flicking;
        var timingFuncPoints = configFlicking.timingFunc;
        var timingFunc = new CubicBezier(timingFuncPoints[0],
                                         timingFuncPoints[1],
                                         timingFuncPoints[2],
                                         timingFuncPoints[3]);
        var epsilon = 1 / duration; // precision for bezier computations

        var configSnapBack = config.snapBack;
        var snapBackAlwaysDefaultTime = configSnapBack.alwaysDefaultTime;
        var snapBackDefaultTime = configSnapBack.defaultTime;
        var configSnapBackTimingFunc = configSnapBack.timingFunc;

        var configElasticity = config.elasticity;
        var configBounceFactor = configElasticity.factorFlick;
        var maxBounceLength = configElasticity.max;

        var flickTarget = scrollOffset.multiply(vector);
        var zeroMatrix = new this._Matrix();

        var setStyleMatrix = this._setStyleOffset;

        // flick for every axis
        for (var i = 0, axes = ["e", "f"], axis; (axis = axes[i++]); ){
            var distance = vector[axis];
            if (!isScrolling[axis]) {
                continue;
            }
            else if (!distance) {
                this.snapBack(axis);
                continue;
            }
            var targetFlick = flickTarget[axis];
            var axisMin = -maxOffset[axis];
            var scrollFrom = scrollOffset[axis];

            var distanceFlick = distance;

            // compute distance fraction where flicking crosses the bounds of the scroller.
            if (targetFlick < axisMin) {
                distanceFlick = axisMin - scrollFrom;
                targetFlick = axisMin;
            }
            else if (targetFlick > 0) {
                distanceFlick = 0 - scrollFrom;
                targetFlick = 0;
            }
            var distanceBounce = distance - distanceFlick;

            // calculate timing functions
            var t = timingFunc.getTforY(distanceFlick / distance, epsilon);
            if (t < 0) { // already beyond scroller bounds
                t = 0;
                distanceBounce -= distanceFlick;
            }

            var bezierCurves = timingFunc.divideAtT(t);
            var timingFuncFlick = bezierCurves[0];
            var timingFuncBounce = timingFuncFlick;
            var timingFuncSnapBack = timingFuncFlick;

            var durationFlick = duration * timingFunc.getPointForT(t).x;
            var durationBounce = duration - durationFlick;
            var durationSnapBack = 0;


            if (distanceFlick !== distance && this.elastic) {
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

                //durationSnapBack = durationBounce !== 0 && snapBackAlwaysDefaultTime ?
                //                   snapBackDefaultTime : durationBounce;
            }

            var animationDuration = durationFlick + durationBounce + durationSnapBack;

            console.warn(durationFlick, durationBounce, durationSnapBack, animationDuration);
            console.log(distanceFlick, distanceBounce);

            /*
                Assemble animation
            */
            var keyFrames = scrollerAnimations[axis];
            var flickEndFrame = keyFrames[1];
            var bounceEndFrame = keyFrames[2];

            // set offsets to keyframes
            var fromMatrix = zeroMatrix.translate(0, 0, 0);
            fromMatrix[axis] = scrollFrom;
            var flickMatrix = zeroMatrix.translate(0, 0, 0);
            flickMatrix[axis] = ~~(targetFlick + 0.5); // fast round
            var bounceMatrix = flickMatrix.translate(0, 0, 0);
            bounceMatrix[axis] += distanceBounce;

            setStyleMatrix(keyFrames[0].style, fromMatrix, timingFuncFlick);
            setStyleMatrix(flickEndFrame.style, flickMatrix, timingFuncBounce);
            setStyleMatrix(bounceEndFrame.style, bounceMatrix, timingFuncBounce);
            //setStyleMatrix(keyFrames[3].style, flickMatrix);

            // set keyframe percents
            flickEndFrame.keyText = 100 * durationFlick / animationDuration + "%";
            //bounceEndFrame.keyText = 100 * (durationFlick + durationBounce) / animationDuration + "%";

            // start animation
            var scrollerStyle = scrollers[axis].style;
            scrollerStyle.webkitAnimationName = keyFrames.name;
            scrollerStyle.webkitAnimationDuration = animationDuration + "ms";
            setStyleMatrix(scrollerStyle, bounceMatrix);
            console.log("duration", durationFlick, durationFlick / animationDuration, durationBounce / configBounceFactor, durationFlick + durationBounce / configBounceFactor, duration)
            console.log(TouchScroll.prototype._styleSheet.cssRules[14].cssText, animationDuration);
        }
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

        scrollElement.className += " touchScroll";

        // remove scroller contents
        var firstChild, children = document.createDocumentFragment();
        while ((firstChild = scrollElement.firstChild)) {
            children.appendChild(firstChild);
        }

        // set innerHTML from template
        scrollElement.innerHTML = this._scrollerTemplate;
        if (scrollbars) {
            scrollElement.innerHTML += this._scrollbarTemplate;
        }

        // setup references to scroller HTML nodes
        var scrollers = dom.scrollers = {
            inner: scrollElement.querySelector(".tsInner")
        };
        scrollers.e = scrollers.inner.parentNode;
        scrollers.f = scrollers.inner;

        dom.pasteBoard = scrollElement.querySelector(".tsPasteBoard");

        if (scrollbars) {
            var bars = dom.bars = {
                outer: scrollElement.querySelector(".tsBars"),
                parts: {}
            };

            for (var i = 0, axes = ["e", "f"], axis, bar; (axis = axes[i++]); ) {
                var bar = bars[axis] = scrollElement.querySelector(".tsBar"+axis.toUpperCase());
                bars.parts[axis] = [
                    bar.querySelector(".tsBar1"),
                    bar.querySelector(".tsBar2"),
                    bar.querySelector(".tsBar3")
                ];
            }

            var cs = window.getComputedStyle(bars.parts.e[0]);
            this._barMetrics.endSize =
                parseFloat(cs.paddingTop) +
                parseFloat(cs.height) +
                parseFloat(cs.paddingBottom);
            cs = null; // release live objects
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

        var scrollbarSizeSubstractE = 0;
        var scrollbarSizeSubstractF = 0;

        if (this.elastic) {
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
                scrollbarSizeSubstractE = newOffsetE >= 0 ?
                                          newOffsetE : maxOffsetE - newOffsetE;
            }
            if (newOffsetF < maxOffsetF || newOffsetF > 0) {
                isOutOfBoundsE = true;
                scrollbarSizeSubstractF = newOffsetF >= 0 ?
                                          newOffsetF : maxOffsetF - newOffsetF;
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

        var setStyleOffset = this._setStyleOffset;
        var dom = this._dom;
        var scrollers = dom.scrollers;
        setStyleOffset(scrollers.e.style, offsetE);
        setStyleOffset(scrollers.f.style, offsetF);

        //TODO: add scrollbars
        if (dom.bars) {
        }
    },

    /**
     * @private
     * @static
     * @param {CSSStyleDeclaration} style
     * @param {WebKitCSSNatrix} matrix
     * @param {Array|Object|String} [timingFunc] Control points for a "cubic-bezier" declaration.
     *      If the duration parameter is given, this is regarded as transition
     *      timing function, defaults to animation timing function.
     * @param {Number} [duration] Miliseconds
     */
    _setStyleOffset: function _setStyleOffset(style, matrix, timingFunc, duration) {
        style.webkitTransform = "translate(" + matrix.e + "px, " + matrix.f + "px)";
        if (timingFunc) {
            var property = "webkit"
            property += duration == null ? "Animation" : "Transition";
            property += "TimingFunction";
            style[property] = timingFunc.join ? "cubic-bezier(" + timingFunc.join(",") + ")" : timingFunc;

            if (duration != null) {
                style.webkitTransitionDuration = duration + "ms";
            }
        }
    },

    /**
     * Stops all running animations.
     */
    _stopAnimations: function _stopAnimations() {
        var dom = this._dom;
        var scrollers = this._dom.scrollers;
        var bars = dom.bars;
        var offset = this._determineOffset();

        for (var axes = ["e", "f"], i = 0, axis, scroller, style, matrix; (axis = axes[i++]); ) {
            scroller = scrollers[axis];
            style = scroller.style;
            style.webkitAnimationName = "";
            style.webkitAnimationDuration = "0";

            if (bars) {
                bars[axis].style.webkitAnimationDuration = 0;
            }

            matrix = new this._Matrix();
            matrix[axis] = offset[axis];
            this._setStyleOffset(style, matrix);
        }
    }
};
