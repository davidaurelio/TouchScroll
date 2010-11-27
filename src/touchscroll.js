function Scroll(domNode, options) {
    this._domNode = domNode;
    this.elastic = this._hasHwAccel && false;

    this._translateX = 0;
    this._translateY = 0;

    this._initDom();
}

Scroll.prototype = {
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
    flickMinSpeed: 0.5,

    /**
     * Configuration option: The maximum time delta (in ms) between last move
     * and release event to trigger a flick.
     *
     * @type {number}
     */
    flickThreshold: 150,

    _flickInterval: null,

    /**
     * @private
     * @static
     * @type {boolean} Whether hardware acceleration is available.
     */
    _hasHwAccel: /^i(?:Phone|Pod|Pad)/.test(navigator.platform), //TODO: is there a better test?

    /**
     * @private
     * @static
     * @type {boolean} Whether touch events are supported.
     */
    _hasTouchEvents: (function() {
        if ("createTouch" in document) { // True on the iPhone
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
        event.preventDefault();
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
            var root = this._domNode.ownerDocument.documentElement;
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
        var timeDelta = event.timeStamp - lastMove.timeStamp;

        if (timeDelta <= this.flickThreshold && lastMove.speed >= this.flickMinSpeed) {
            // flick animation
            this._flick(lastMove.speedX, lastMove.speedY);
        }
        else {
            // no flick
            this._endScroll();
        }

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

    _flick: function _flick(speedX, speedY) {
        var node = this._domNode;
        var friction = this.flickFriction;
        var scroller = this;
        var lastMove = new Date() - 0;
        var pow = Math.pow;

        function flick() {
            var now = new Date() - 0;
            var timeDelta = now - lastMove;

            var factorDelta = (1 - pow(friction, timeDelta + 1)) / (1 - friction);
            scroller._moveBy(speedX * factorDelta, speedY * factorDelta);

            var factorSpeed = pow(friction, timeDelta);
            speedX *= factorSpeed;
            speedY *= factorSpeed;

            if (0 !== speedX && speedX < 0.1 && speedX > -0.1) { speedX = 0; }
            if (0 !== speedY && speedY < 0.1 && speedY > -0.1) { speedY = 0; }

            if (0 === speedX && 0 === speedY) {
                clearInterval(flickInterval);
            }

            lastMove = now;
        }

        var flickInterval = this._flickInterval = setInterval(flick, 16);
        //flick();
    },

    _endScroll: function _endScroll() {

    },

    _initDom: function initDom() {
        var node = this._domNode;

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

//if (Scroll.prototype._hasHwAccel) {
//    Scroll.prototype._transformToScroll = function _transformToScroll() {
//    };
//
//    Scroll.prototype._moveBy = function _moveBy(x, y) {
//        var style = this._domNode.style;
//        var top = (this._translateY += y);
//        var left = (this._translateX += x);
//        style.webkitTransform = "translate3d(" + -translateX +"px," + -translateY +"px,0)";
//
//        return [top, left];
//    };
//}
