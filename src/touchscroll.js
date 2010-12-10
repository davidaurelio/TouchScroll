function TouchScroll(domNode, options) {
    options = options || {};

    /** @type {Boolean} Whether the scroller bounces across its bounds. */
    this.elastic = this._hasHwAccel && !!options.elastic && false; //TODO: implement

    /** @type {Boolean} Whether to fire DOM scroll events */
    this.scrollevents = !!options.scrollevents; //TODO: implement


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

    this._translateX = 0;
    this._translateY = 0;

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
    "}",
    ".-ts-inner{" +
        "height:100%;" +
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
    scrollThreshold: 5,

    _flickInterval: null,

    /**
     * @private
     * @static
     * @type {boolean} Whether we are dealing with a performant device.
     */
    _isPerformantDevice: (function() {
        var start = new Date().getTime();
        var iterations = 0;
        while (new Date().getTime() - start < 20) {
            Math.random();
            iterations++;
        }
        return iterations > 1000;
    }()),

    /**
     * @private
     * @static
     * @type {boolean} Whether hardware acceleration is available.
     */
    _hasHwAccel: /^i(?:Phone|Pod|Pad)/.test(navigator.platform), //TODO: better test

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

    _lastMove: null,

    _scrollerTemplate: '<div class="-ts-inner"></div>',
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

        this._lastMove = {
            delta: 0,
            deltaX: 0,
            deltaY: 0,
            /** @type {number} */
            pageX: coords.pageX,
            /** @type {number} */
            pageY: coords.pageY,
            /** @type {number} */
            timeStamp: event.timeStamp,
            speed: 0,
            speedX: 0,
            speedY: 0
        };

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

        var lastMove = this._lastMove;
        var deltaX = lastMove.deltaX = lastMove.pageX - pageX;
        var deltaY = lastMove.deltaY = lastMove.pageY - pageY;
        var delta = lastMove.delta = Math.sqrt(deltaX*deltaX + deltaY*deltaY);

        if (!this._hasScrollStarted) {
            var scrollThreshold = this.scrollThreshold;
            var hasScrollStarted =
                deltaY >= scrollThreshold || deltaY <= -scrollThreshold
                deltaX >= scrollThreshold || deltaX <= -scrollThreshold;

            if (hasScrollStarted) {
                this._beginScroll();
            }
            else {
                return;
            }
        }

        var timeDelta = timeStamp - lastMove.timeStamp;
        lastMove.speedX = deltaX / timeDelta;
        lastMove.speedY = deltaY / timeDelta;
        lastMove.speed = delta / timeDelta;

        lastMove.pageX = pageX;
        lastMove.pageY = pageY;
        lastMove.timeStamp = timeStamp;

        this._moveBy(deltaX, deltaY);
    },

    onRelease: function onRelease(event) {
        var lastMove = this._lastMove;
        if (!this._hasScrollStarted || !lastMove) {
            return;
        }

        var timeDelta = event.timeStamp - lastMove.timeStamp;

        if (timeDelta <= this.flickThreshold && lastMove.speed >= this.flickMinSpeed) {
            // flick animation
            this._flick(lastMove.speedX, lastMove.speedY);
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

    },

    _beginScroll: function() {
        this._hasScrollStarted = true;
    },

    _endScroll: function _endScroll() {
        this._lastMove = null;
        this._hasScrollStarted = false;
    },

    _cancelNextEvent: function _cancelNextEvent(event) {
        event.preventDefault();
        event.stopPropagation();
        this.removeEventListener(event.type, _cancelNextEvent, true);

        return false;
    },

    _flick: function _flick(speedX, speedY) {
        var node = this._domNode;
        var friction = this.flickFriction;
        var lastMove = new Date() - 0;
        var pow = Math.pow;
        var scroller = this;

        // Keep internal scroll position, because node.scrollLeft/Top get rounded.
        var scrollLeft = node.scrollLeft;
        var scrollTop = node.scrollTop;

        function flick() {
            var now = new Date() - 0;
            var timeDelta = now - lastMove;
            var powFrictionTimedelta = pow(friction, timeDelta);

            var factorDelta =
                (1 - powFrictionTimedelta * friction /*pow(friction, timeDelta+1)*/) /
                (1 - friction);
            node.scrollLeft = scrollLeft += speedX * factorDelta;
            node.scrollTop = scrollTop += speedY * factorDelta;

            //scroller._moveBy(speedX * factorDelta, speedY * factorDelta);

            var factorSpeed = powFrictionTimedelta /*pow(friction, timeDelta)*/;
            speedX *= factorSpeed;
            speedY *= factorSpeed;

            if (0 !== speedX && speedX < 0.1 && speedX > -0.1) { speedX = 0; }
            if (0 !== speedY && speedY < 0.1 && speedY > -0.1) { speedY = 0; }

            if (0 === speedX && 0 === speedY) {
                clearInterval(flickInterval);
                scroller._endScroll();
            }

            lastMove = now;
        }

        var flickInterval = this._flickInterval = setInterval(flick, 1000/60);
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

        node.innerHTML = this._scrollerTemplate +
            (useScrollIndicators ? this._scrollbarTemplate : "");
        var nodeInner = this._domNodeInner = node.querySelector(".-ts-inner");
        nodeInner.appendChild(children);

        if (this._hasTouchEvents) {
            node.addEventListener("touchstart", this, false);
            node.addEventListener("touchmove", this, false);
            node.addEventListener("touchend", this, false);
            node.addEventListener("touchcancel", this, false);
        }
        else {
            node.addEventListener("mousedown", this, false);
        }
    },

    _moveBy: function _moveBy(x, y) {
        var node = this._domNode;
        var top = (node.scrollTop += y);
        var left = (node.scrollLeft += x);
        return [top, left];
    },

    _setOffset: function _setOffset(style, x, y) {
        style.left = x + "px";
        style.top = y + "px";
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
