function TouchScroll(domNode, options) {
    options = options || {};

    /** @type {Boolean} Whether the scroller bounces across its bounds. */
    this.elastic =
        //false &&
        true ||
        this._hasTransforms && this._hasHwAccel && options.elastic; //TODO: implement

    /** @type {Boolean} Whether to fire DOM scroll events */
    this.scrollevents = !!options.scrollevents; //TODO: implement

    /**
     * @type {boolean} Whether to use transforms for scrolling (rather than scroll offset).
     */
    this._useTransforms =
        false &&
        //true ||
        options.useTransforms !== false &&
        this._hasTransforms &&
        (options.useTransforms === true || this._hasHwAccel && this._performance > 1000);

    var snapToGrid =
        /** @type {Boolean} Whether to snap to a 100%x100%-grid -- "paging mode". */
        this.snapToGrid = !!options.snapToGrid; //TODO: implement


    /** @type {Object} Contains the number of segments for each axis (for paging mode). */
    //this.maxSegments = {e: 1, f: 1};

    /** @type {Object} Contains the current of segments for each axis (for paging mode). */
    //this.currentSegment = {e: 0, f: 0};

    /** @type {Boolean} Whether to build and use scrollbars. */
    var useScrollIndicators = !snapToGrid;
    if (!snapToGrid && "scrollbars" in options) {
        useScrollIndicators = !!options.useScrollIndicators;
    }

    /**
     * @type {HTMLElement}
     */
    this._domNode = domNode;

    /**
     * @type {HTMLElement}
     */
    this._scrollNode = null;

    this._offsetX = domNode.scrollLeft
    this._offsetY = domNode.scrollTop;
    this._translateX = 0;
    this._translateY = 0;
    this._scrollsX = false;
    this._scrollsY = false;

    this._width = 0;
    this._height = 0;
    this._scrollWidth = 0;
    this._scrollHeight = 0;
    this._maxX = 0;
    this._maxY = 0;

    this._currentMove = null;
    this._lastMove = null;

    this._initDom(useScrollIndicators);
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
        "-webkit-tap-highlight-color:transparent;" +
        "overflow:hidden!important;" +
        "position:relative;" +
    "}",
    ".-ts-scroller{" +
        "overflow:hidden;" +
        "position:absolute;" +
        "top:0;right:0;bottom:0;left:0;" +
    "}",
    ".-ts-transform{"+
        "overflow:visible;" +
        "-webkit-transform:translate3d(0,0,0);" +
        //"-webkit-transition:-webkit-transform 0 linear;" +
    "}",
    ".-ts-scrolling{"+
        "-webkit-user-select:none;" +
    "}"
].forEach(function(rule, i) { this.insertRule(rule, i); }, TouchScroll._styleSheet);

TouchScroll.prototype = {
    /**
     * Configuration option: The friction factor (per ms) for flicks.
     *
     * @type {number}
     */
    flickFriction: 0.998,

    /**
     * Configuration option: The minimum speed (in px/ms) that triggers a flick
     * on release.
     *
     * @type {number}
     */
    flickMinSpeed: 0.3,

    /**
     * Configuration option: The minimum speed (in px/ms) for ongoing flicks.
     *
     * All flicks with lower speed will be stopped.
     *
     * @type {Number}
     */
    flickStopSpeed: 0.05,

    /**
     * Configuration option: The maximum time delta (in ms) between last move
     * and release event to trigger a flick.
     *
     * @type {number}
     */
    flickThreshold: 200,

    /**
     * Configuration option: The minimum amount of pixels travelled to trigger
     * scrolling.
     *
     * @type {number}
     */
    minScroll: 3,

    /**
     * Configuration option: Snap back duration (in ms).
     *
     * @type {Number}
     */
    snapBackDuration: 400,

    _android: (function() {
        var match = navigator.userAgent.match(/Android\s+(\d+(?:\.\d+)?)/);
        return match && parseFloat(match[1]);
    }()),

    _flickInterval: null,

    /**
     * @private
     * @static
     * @type {boolean} Whether hardware acceleration is available.
     */
    _hasHwAccel: false && /^i(?:Phone|Pod|Pad)/.test(navigator.platform), //TODO: better test

    /**
     * @private
     * @static
     * @type {boolean} Whether webkit transformations are available.
     */
    _hasTransforms: this.hasOwnProperty("WebKitCSSMatrix"),

    /**
     * @private
     * @static
     * @type {boolean} Whether touch events are supported.
     */
    _hasTouchEvents: (function() {
        if ("createTouch" in document) { // True on iOS
            return true;
        }
        try {
            var event = document.createEvent("TouchEvent"); // Should throw an error if not supported
            return !!event.initTouchEvent; // Check for existance of initialization method
        } catch(error) {
            return false;
        }
    }()),

    _parsesMatrixCorrectly: (function() {
        if (!this.hasOwnProperty("WebKitCSSMatrix")) {
            return false;
        }

        var m = new WebKitCSSMatrix("matrix(1, 0, 0, 1, -20, -30)");
        return m.e === -20 && m.f === -30;
    }()),

    _lastMove: null,

    /**
     * A performance index. Can be used to distinguish between weak and strong devices.
     *
     * @private
     * @static
     * @type {Number}
     */
    _performance: (function() {
        var start = new Date().getTime();
        var iterations = 0;
        while (new Date().getTime() - start < 20) {
            Math.random();
            iterations++;
        }

        return iterations;
    }()),

    _scrollerTemplate: '<div class="-ts-scroller"></div>',
    _scrollIndicatorTemplate:
        '<div class="-ts-indicator -ts-indicator-x"><img><img><img></div>' +
        '<div class="-ts-indicator -ts-indicator-y"><img><img><img></div>',

    handleEvent: function(event) {
        var type = event.type;
        if ("touchmove" === type || "mousemove" === type) {
            return this.onDrag(event);
        }
        else if ("touchstart" === type || "mousedown" === type) {
            return this.onTouch(event);
        }
        else if ("touchend" === type || "touchcancel" === type ||
                 "mouseup" === type || "mouseout" === type) {
            return this.onRelease(event);
        }
    },

    onTouch: function onTouch(event) {
        var node = this._domNode;
        //event.preventDefault();
        clearInterval(this._flickInterval);
        node.removeEventListener("click", this._cancelNextEvent, true);

        var touches = event.touches;
        var coords = touches && touches.length ? touches[0] : event;

        this._lastMove = null;
        this._currentMove = [event.timeStamp, coords.pageX, coords.pageY];
        this._hasScrollStarted = false;

        if (!this._hasTouchEvents) {
            // Simulate touch behaviour:
            // Touch events fire on the event a move started from.
            /** @type HTMLHtmlElement */
            var root = node.ownerDocument.documentElement;
            root.addEventListener("mousemove", this, false);
            root.addEventListener("mouseup", this, false);
        }
    },

    onDrag: function onDrag(event) {
        event.preventDefault();

        var touches = event.touches;
        var coords = touches && touches.length ? touches[0] : event;

        var pageX = coords.pageX;
        var pageY = coords.pageY;
        var timeStamp = event.timeStamp;

        var lastMove = this._lastMove = this._currentMove;
        var deltaX = this._scrollsX ? lastMove[1] - pageX : 0;
        var deltaY = this._scrollsY ? lastMove[2] - pageY : 0;

        this._currentMove = [timeStamp, pageX, pageY];

        if (!this._hasScrollStarted) {
            var minScroll = this.minScroll;
            var hasScrollStarted =
                deltaY >= minScroll || deltaY <= -minScroll ||
                deltaX >= minScroll || deltaX <= -minScroll;

            if (hasScrollStarted) {
                this._beginScroll();
            }
            else {
                return;
            }
        }

        this._moveBy(deltaX, deltaY);
    },

    onRelease: function onRelease(event) {
        var lastMove = this._lastMove, currentMove = this._currentMove;
        if (!this._hasScrollStarted || !lastMove) {
            return;
        }

        var timeDeltaRelease = event.timeStamp - lastMove[0];
        var timeDeltaDrag = currentMove[0] - lastMove[0];
        var speedX = (lastMove[1] - currentMove[1]) / timeDeltaDrag;
        var speedY = (lastMove[2] - currentMove[2]) / timeDeltaDrag;
        var speed = Math.sqrt(speedX*speedX + speedY*speedY);

        if (timeDeltaRelease <= this.flickThreshold && speed >= this.flickMinSpeed) {
            // flick animation
            this._flick(speedX, speedY);
        }
        else {
            // no flick
            this._endScroll();
        }

        // prevent next click
        this._domNode.addEventListener("click", this._cancelNextEvent, true);

        if (!this._hasTouchEvents) {
            // Simulate touch behaviour:
            // Touch events fire on the event a move started from.
            /** @type HTMLHtmlElement */
            var root = this._domNode.ownerDocument.documentElement;
            root.removeEventListener("mousemove", this, false);
            root.removeEventListener("mouseup", this, false);
        }
    },

    setupScroller: function setupScroller() {
        var scrollNode = this._scrollNode;

        var width = scrollNode.offsetWidth;
        var height = scrollNode.offsetHeight;
        var scrollWidth = scrollNode.scrollWidth;
        var scrollHeight = scrollNode.scrollHeight;
        var maxX = scrollWidth - width;
        var maxY = scrollHeight - height;

        this._scrollsX = scrollWidth > width;
        this._scrollsY = scrollHeight > height || this.elastic;

        this._width = width;
        this._height = height;
        this._scrollWidth = scrollWidth;
        this._scrollHeight = scrollHeight;
        this._maxX = maxX;
        this._maxY = maxY;
    },

    _beginScroll: function() {
        this._hasScrollStarted = true;
        this._scrollNode.className += " -ts-scrolling";
    },

    _endScroll: function _endScroll() {
        if (this._snapBack()) { return; }

        clearInterval(this._flickInterval);
        var scrollNode = this._scrollNode;
        scrollNode.className = scrollNode.className.replace(/ -ts-scrolling/g, "");
        //if (this._useTransforms) {
        //    scrollNode.style.webkitTransitionDuration = "";
        //}
    },

    _cancelNextEvent: function _cancelNextEvent(event) {
        event.preventDefault();
        event.stopPropagation();
        this.removeEventListener(event.type, _cancelNextEvent, true);

        return false;
    },

    _flick: function _flick(speedX, speedY) {
        console.log(speedX, speedY);
        var scroller = this;

        var frictionX = this.flickFriction;
        var frictionY = frictionX;

        var stopSpeed = this.flickStopSpeed;
        var lastMove = new Date() - 0;
        var start = lastMove;
        var pow = Math.pow;

        if (!this._scrollsX) { speedX = 0; }
        if (!this._scrollsY) { speedY = 0; }

        var maxX = this._maxX;
        var maxY = this._maxY;
        var offsetX = this._offsetX;
        var offsetY = this._offsetY;
        var isOutOfBoundsX = offsetX < 0 || offsetX > maxX;
        var isOutOfBoundsY = offsetY < 0 || offsetY > maxY;
        var wasOutOfBoundsX = false, wasOutOfBoundsY = false;
        var snappingBackX = false;
        var snappingBackY = false;
        var snapBackDuration = this.snapBackDuration;

        var delay = /*this._useTransforms ? 25 : */1000/60;

        //if (useTransforms) {
        //    scrollNode.style.webkitTransitionDuration = "10ms";
        //}

        function flick() {
            var now = new Date() - 0;
            var timeDelta = now - lastMove;

            if (isOutOfBoundsX && !wasOutOfBoundsX) {
                frictionX *= frictionX; //TODO: prevent long bounces
                wasOutOfBoundsX = true;
            }
            if (isOutOfBoundsY && !wasOutOfBoundsY) {
                frictionY *= frictionY;
                wasOutOfBoundsX = true;
            }

            var factorX = pow(frictionX, timeDelta);
            var factorY = pow(frictionY, timeDelta);

            var factorDeltaX = (1 - factorX * frictionX) / (1 - frictionX); // geometric series
            var factorDeltaY = (1 - factorY * frictionY) / (1 - frictionY);

            var deltaX = speedX * factorDeltaX;
            var deltaY = speedY * factorDeltaY;

            var move = scroller._moveBy(deltaX, deltaY);
            offsetX = move[0];
            offsetY = move[1];
            isOutOfBoundsX = move[4];
            isOutOfBoundsY = move[5];

            speedX *= factorX;
            speedY *= factorY;

            if (0 !== speedX && speedX < stopSpeed && speedX > -stopSpeed) { speedX = 0; }
            if (0 !== speedY && speedY < stopSpeed && speedY > -stopSpeed) { speedY = 0; }

            //TODO correct speed computation
            if (0 === speedX && isOutOfBoundsX) {
                var distanceX = offsetX < 0 ? offsetX : (offsetX > maxX ? offsetX - maxX : 0);
                speedX = -distanceX /
                    ((1 - pow(frictionX, snapBackDuration+1)) / (1 - frictionX));
            }
            if (0 === speedY && isOutOfBoundsY) {
                var distanceY = offsetY < 0 ? offsetY : (offsetY > maxY ? offsetY - maxY : 0);
                speedY = -distanceY /
                    ((1 - pow(frictionY, snapBackDuration+1)) / (1 - frictionY));
            }

            if (0 === speedX && 0 === speedY) {
                //clearTimeout(flickInterval);
                console.log(now - start);
                scroller._forceIntoBounds();
                scroller._endScroll();
            }

            lastMove = now;
        }

        var flickInterval = this._flickInterval = setInterval(flick, delay);
        //setTimeout(function() {
        //    this._domNode.removeEventListener("click", scroller._cancelNextEvent, true);
        //}, 0);
        //flick();
    },

    /**
     * Initializes the DOM of the scroller:
     *
     * Wraps the contents in a div element and optionally adds scroll indicators.
     *
     * @param {boolean} useScrollIndicators Whether to add DOM for scroll indicators.
     */
    _initDom: function initDom(useScrollIndicators) {
        var node = this._domNode;
        node.className += " TouchScroll";

        var children = node.ownerDocument.createDocumentFragment();
        while ((firstChild = node.firstChild)) {
            children.appendChild(firstChild);
        }

        var html = this._scrollerTemplate;
        if (useScrollIndicators) { html += this._scrollIndicatorTemplate; }

        node.innerHTML = html;
        var scrollNode = this._scrollNode = node.querySelector(".-ts-scroller");
        if (this._useTransforms) { scrollNode.className += " -ts-transform"; }
        scrollNode.appendChild(children);

        if (this._hasTouchEvents) {
            node.addEventListener("touchstart", this, false);
            node.addEventListener("touchmove", this, false);
            node.addEventListener("touchend", this, false);
            node.addEventListener("touchcancel", this, false);
        }
        else {
            node.addEventListener("mousedown", this, false);
        }

        this.setupScroller();
    },

    _forceIntoBounds: function _forceIntoBounds() {
        var offsetX = this._offsetX;
        var offsetY = this._offsetY;
        var maxX = this._maxX;
        var maxY = this._maxY;
        var scrollNode = this._scrollNode

        this._offsetX = offsetX =
            offsetX < 0 ? 0 : (offsetX > maxX ? maxX : offsetX + .5 | 0);
        this._offsetY = offsetY =
            offsetY < 0 ? 0 : (offsetY > maxY ? maxY : offsetY + .5 | 0);

        if (this._useTransforms) {
            this._scrollNode.style.webkitTransform =
                "translate3d(" + offsetX + "px," + offsetY + "px,0)";
        }
        else {
            var s = scrollNode.style;
            s.webkitTransform = "";
            scrollNode.scrollLeft = offsetX;
            scrollNode.scrollTop = offsetY;
        }
    },

    _moveBy: function _moveBy(deltaX, deltaY) {
        var scrollNode = this._scrollNode;
        var offsetX = this._offsetX;
        var offsetY = this._offsetY;
        var maxX = this._maxX;
        var maxY = this._maxY;
        var isElastic = this.elastic;
        var wasOutOfBoundsX = offsetX < 0 || offsetX > maxX;
        var wasOutOfBoundsY = offsetY < 0 || offsetY > maxY;
        var isOutOfBoundsX =
            deltaX > 0 && offsetX >= maxX ||
            deltaX < 0 && offsetX <= 0 ||
            deltaX === 0 && wasOutOfBoundsX;
        var isOutOfBoundsY =
            deltaY > 0 && offsetY >= maxY ||
            deltaY < 0 && offsetY <= 0 ||
            deltaY === 0 && wasOutOfBoundsY;

        if (isOutOfBoundsX) {
            if (isElastic) { deltaX /= 2; }
            else { deltaX = 0; }
        }
        if (isOutOfBoundsY) {
            if (isElastic) { deltaY /= 2; }
            else { deltaY = 0; }
        }

        offsetX = (this._offsetX += deltaX);
        offsetY = (this._offsetY += deltaY);

        if (this._useTransforms) {
            scrollNode.style.webkitTransform =
                "translate3d(" + -offsetX + "px," + -offsetY + "px,0)";
        }
        else {
            // auto-rounding, auto-constraining to bounds
            scrollNode.scrollLeft = offsetX;
            scrollNode.scrollTop = offsetY;
            var bounceX = 0, bounceY = 0;

            if (isOutOfBoundsX && isElastic) {
                bounceX = deltaX < 0 ? offsetX : offsetX - maxX;
            }
            if (isOutOfBoundsY && isElastic) {
                bounceY = deltaY < 0 ? offsetY : offsetY - maxY;
            }

            if (isOutOfBoundsY || wasOutOfBoundsY || isOutOfBoundsX || wasOutOfBoundsX) {
                scrollNode.style.webkitTransform = bounceY || bounceX ?
                    "translate3d(" + -bounceX + "px," + -bounceY + "px,0)" : "";
            }
        }

        return [offsetX, offsetY, deltaX, deltaY, isOutOfBoundsX, isOutOfBoundsY];
    },

    /**
     * Forces the scroller back into the bounds, using an animation.
     *
     * @returns {boolean} Whether a snapback animation has been started.
     */
    _snapBack: function() {
        var offsetX = this._offsetX;
        var offsetY = this._offsetY;
        var maxX = this._maxX;
        var maxY = this._maxY;
        alert("snapback")

        var distanceX = offsetX < 0 ? offsetX : (offsetX > maxX ? offsetX - maxX : 0);
        var distanceY = offsetY < 0 ? offsetY : (offsetY > maxY ? offsetY - maxY : 0);

        if (distanceX || distanceY) { // TODO correct speed computation
            var f = this.flickFriction;
            f *= f;
            var t = this.snapBackDuration;
            var q = Math.pow(f, t+1) - 1;

            this._flick(-distanceX * (f - 1) / q, // speedX
                        -distanceY * (f - 1) / q); // speedY
            return true;
        }

        return false;
    }
};

//if (TouchScroll.prototype._hasHwAccel) {
//    TouchScroll.prototype._transformToScroll = function _transformToScroll() {
//    };
//
//    TouchScroll.prototype._moveBy = function _moveBy(x, y) {
//        var style = this._domNode.style;
//        var top = (this._translateY += y);
//        var left = (this._translateX += x);
//        style.webkitTransform = "translate3d(" + -translateX +"px," + -translateY +"px,0)";
//
//        return [top, left];
//    };
//}
