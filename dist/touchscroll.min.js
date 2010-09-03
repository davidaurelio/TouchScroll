/*


 Copyright (C) 2008 Apple Inc. All Rights Reserved.
 Copyright (C) 2010 David Aurelio. All Rights Reserved.
 Copyright (C) 2010 uxebu Consulting Ltd. & Co. KG. All Rights Reserved.

 Redistribution and use in source and binary forms, with or without
 modification, are permitted provided that the following conditions
 are met:
 1. Redistributions of source code must retain the above copyright
 notice, this list of conditions and the following disclaimer.
 2. Redistributions in binary form must reproduce the above copyright
 notice, this list of conditions and the following disclaimer in the
 documentation and/or other materials provided with the distribution.

 THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS"
 AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
 IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE
 ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDERS OR CONTRIBUTORS BE
 LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR
 CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF
 SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS
 INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN
 CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE)
 ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE
 POSSIBILITY OF SUCH DAMAGE.
*/
var TouchScroll=function(){
//
//	SCROLLER CONFIGURATION
//
var config = {
    // the minimum move distance to trigger scrolling (in pixels)
    threshold: 5,

    // minimum scroll handle size
    scrollHandleMinSize: 25,

    // flicking detection and configuration
    flicking: {
        // longest duration between last touchmove and the touchend event to trigger flicking
        triggerThreshold: 150,

        // the friction factor (per milisecond).
        // This factor is used to precalculate the flick length. Lower numbers
        // make flicks decelerate earlier.
        friction: 0.998,

        // minimum speed needed before the animation stop (px/ms)
        // This value is used to precalculate the flick length. Larger numbers
        // lead to shorter flicking lengths and durations
        minSpeed: 0.15,

        // the timing function for flicking animinations (control points for a cubic bezier curve)
        timingFunc: [0, 0.3, 0.6, 1]
    },

    // bouncing configuration
    elasticity: {
        // factor for the bounce length while dragging
        factorDrag: 0.5,

        // factor for the bounce length while flicking
        factorFlick: 0.2,

        // maximum bounce (in px) when flicking
        max: 100
    },

    // snap back configuration
    snapBack: {
        // the timing function for snap back animations (control points for a cubic bezier curve)
        // when bouncing out before, the first control point is overwritten to achieve a smooth
        // transition between bounce and snapback.
        timingFunc: [0.4, 0, 1, 1],

        // default snap back time
        defaultTime: 400,

        // whether the snap back effect always uses the default time or
		// uses the bounce out time.
		alwaysDefaultTime: true
	}
};

function i(a,b,c,d){if(!(a>=0&&a<=1))throw new RangeError("'p1x' must be a number between 0 and 1. Got "+a+"instead.");if(!(b>=0&&b<=1))throw new RangeError("'p1y' must be a number between 0 and 1. Got "+b+"instead.");if(!(c>=0&&c<=1))throw new RangeError("'p2x' must be a number between 0 and 1. Got "+c+"instead.");if(!(d>=0&&d<=1))throw new RangeError("'p2y' must be a number between 0 and 1. Got "+d+"instead.");this._p1={x:a,y:b};this._p2={x:c,y:d}}function u(a){a.style.webkitTransformStyle=
"preserve-3d";a.style.webkitTransitionProperty="-webkit-transform"}function q(a,b,c,d){var e=a.style;if(c!=null)e.webkitTransitionDuration=c+"";if(d!=null)e.webkitTransitionTimingFunction=d+"";a.style.webkitTransform="translate("+b.e+"px, "+b.f+"px)"}function A(a){if(a.touches&&a.touches.length)a=a.touches[0];var b=new WebKitCSSMatrix;b.e=a.pageX;b.f=a.pageY;return b}function B(a){a.e=Math.round(a.e);a.f=Math.round(a.f);return a}function r(a,b){b=b||{};this.elastic=!!b.elastic;this.snapToGrid=!!b.snapToGrid;
this.containerSize=null;this.maxSegments={e:1,f:1};this.currentSegment={e:0,f:0};this.scrollers={container:a,outer:null,inner:null,e:null,f:null};this._scrolls={e:false,f:false};this._scrollMin={e:false,f:false};this._scrollbars=null;this._isScrolling=false;this._startEvent=null;this._currentOffset=new WebKitCSSMatrix;this._trackedEvents=null;this._flicking={e:false,f:false};this._bounces={e:null,f:null};this._animationTimeouts={e:[],f:[]};this._initDom();this.setupScroller()}i.prototype._getCoordinateForT=
function(a,b,c){var d=3*b;b=3*(c-b)-d;return(((1-d-b)*a+b)*a+d)*a};i.prototype._getCoordinateDerivateForT=function(a,b,c){var d=3*b;b=3*(c-b)-d;return(3*(1-d-b)*a+2*b)*a+d};i.prototype._getTForCoordinate=function(a,b,c,d){if(!isFinite(d)||d<=0)throw new RangeError("'epsilon' must be a number greater than 0.");for(var e=a,f=0,h,g;f<8;f++){h=this._getCoordinateForT(e,b,c)-a;if(Math.abs(h)<d)return e;g=this._getCoordinateDerivateForT(e,b,c);if(Math.abs(g)<1.0E-6)break;e-=h/g}e=a;f=0;g=1;if(e<f)return f;
if(e>g)return g;for(;f<g;){h=this._getCoordinateForT(e,b,c);if(Math.abs(h-a)<d)return e;if(a>h)f=e;else g=e;e=(g-f)*0.5+f}return e};i.prototype.getPointForT=function(a){if(a==0||a==1)return{x:a,y:a};else if(!(a>0)||!(a<1))throw new RangeError("'t' must be a number between 0 and 1Got "+a+" instead.");return{x:this._getCoordinateForT(a,this._p1.x,this._p2.x),y:this._getCoordinateForT(a,this._p1.y,this._p2.y)}};i.prototype.getTforX=function(a,b){return this._getTForCoordinate(a,this._p1.x,this._p2.x,
b)};i.prototype.getTforY=function(a,b){return this._getTForCoordinate(a,this._p1.y,this._p2.y,b)};i.prototype._getAuxPoints=function(a){if(!(a>0)||!(a<1))throw new RangeError("'t' must be greater than 0 and lower than 1");var b={x:a*this._p1.x,y:a*this._p1.y},c={x:this._p1.x+a*(this._p2.x-this._p1.x),y:this._p1.y+a*(this._p2.y-this._p1.y)},d={x:this._p2.x+a*(1-this._p2.x),y:this._p2.y+a*(1-this._p2.y)},e={x:b.x+a*(c.x-b.x),y:b.y+a*(c.y-b.y)},f={x:c.x+a*(d.x-c.x),y:c.y+a*(d.y-c.y)};return{i0:b,i1:c,
i2:d,j0:e,j1:f,k:{x:e.x+a*(f.x-e.x),y:e.y+a*(f.y-e.y)}}};i.prototype.divideAtT=function(a){if(a<0||a>1)throw new RangeError("'t' must be a number between 0 and 1. Got "+a+" instead.");if(a===0||a===1){var b=[];b[a]=i.linear();b[1-a]=this.clone();return b}b={};var c={},d=this._getAuxPoints(a);a=d.i0;var e=d.i2,f=d.j0,h=d.j1,g=d.k;d=g.x;g=g.y;b.p1={x:a.x/d,y:a.y/g};b.p2={x:f.x/d,y:f.y/g};c.p1={x:(h.x-d)/(1-d),y:(h.y-g)/(1-g)};c.p2={x:(e.x-d)/(1-d),y:(e.y-g)/(1-g)};return[new i(b.p1.x,b.p1.y,b.p2.x,
b.p2.y),new i(c.p1.x,c.p1.y,c.p2.x,c.p2.y)]};i.prototype.divideAtX=function(a,b){if(a<0||a>1)throw new RangeError("'x' must be a number between 0 and 1. Got "+a+" instead.");return this.divideAtT(this.getTforX(a,b))};i.prototype.divideAtY=function(a,b){if(a<0||a>1)throw new RangeError("'y' must be a number between 0 and 1. Got "+a+" instead.");return this.divideAtT(this.getTforY(a,b))};i.prototype.clone=function(){return new i(this._p1.x,this._p1.y,this._p2.x,this._p2.y)};i.prototype.toString=function(){return"cubic-bezier("+
[this._p1.x,this._p1.y,this._p2.x,this._p2.y].join(", ")+")"};i.linear=function(){return new i};i.ease=function(){return new i(0.25,0.1,0.25,1)};i.linear=function(){return new i(0,0,1,1)};i.easeIn=function(){return new i(0.42,0,1,1)};i.easeOut=function(){return new i(0,0,0.58,1)};i.easeInOut=function(){return new i(0.42,0,0.58,1)};var E=function(){if("createTouch"in document)return true;try{return!!document.createEvent("TouchEvent").initTouchEvent}catch(a){return false}}(),F=function(){var a=new WebKitCSSMatrix("matrix(1, 0, 0, 1, -20, -30)");
return a.e==-20&&a.f==-30}(),t;t=E?{start:"touchstart",move:"touchmove",end:"touchend",cancel:"touchcancel"}:{start:"mousedown",move:"mousemove",end:"mouseup",cancel:"touchcancel"};var v;if(F)v=function(a){a=window.getComputedStyle(a).webkitTransform;return new WebKitCSSMatrix(a)};else{var G=/matrix\(\s*-?\d+(?:\.\d+)?\s*,\s*-?\d+(?:\.\d+)?\s*,\s*-?\d+(?:\.\d+)?\s*,\s*-?\d+(?:\.\d+)?\s*\,\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*\)/;v=function(a){var b=window.getComputedStyle(a).webkitTransform;
a=new WebKitCSSMatrix;if(b=G.exec(b)){a.e=b[1];a.f=b[2]}return a}}var C=document.createElement("div");C.innerHTML='<div class="touchScrollTrack touchScrollTrackX"><div class="touchScrollHandle"></div></div><div class="touchScrollTrack touchScrollTrackY"><div class="touchScrollHandle"></div></div>';r.handleEvent=function(a){var b=r.prototype.currentScroller;if(b)b.handleEvent(a);else a.type===t.move&&a.preventDefault()};document.addEventListener(t.move,r.handleEvent,false);document.addEventListener(t.end,
r.handleEvent,false);document.addEventListener(t.cancel,r.handleEvent,false);r.prototype={currentScroller:null,handlerNames:{resize:"setupScroller",orientationchange:"setupScroller",webkitTransitionEnd:"onTransitionEnd",DOMSubtreeModified:"setupScroller",touchstart:"onTouchStart",mousedown:"onTouchStart",touchmove:"onTouchMove",mousemove:"onTouchMove",touchend:"onTouchEnd",mouseup:"onTouchEnd",touchcancel:"onTouchEnd"},_initDom:function(){var a=document.createElement("div"),b=a.cloneNode(false),c=
this.scrollers.container;a.className="touchScrollInner";c.className+=" touchScroll";for(var d=0,e=c.childNodes.length;d<e;d++)a.appendChild(c.firstChild);b.appendChild(a);c.appendChild(b);this.scrollers.outer=this.scrollers.f=b;this.scrollers.inner=this.scrollers.e=a;u(b);u(a);a.style.display="inline-block";a.style.minWidth="100%";a.style.webkitBoxSizing="border-box";a=C.cloneNode(true);d=a.querySelector(".touchScrollTrackX");e=a.querySelector(".touchScrollTrackY");var f=d.firstElementChild,h=e.firstElementChild,
g=a.style;g.pointerEvents="none";g.webkitTransitionProperty="opacity";g.webkitTransitionDuration="250ms";g.opacity="0";this._scrollbars={container:a,tracks:{e:d,f:e},handles:{e:f,f:h},sizes:{e:0,f:0}};u(f);u(h);c.insertBefore(a,b);if(window.getComputedStyle(c).position=="static")c.style.position="relative";this.setupScroller();c.addEventListener(t.start,this,false);b.addEventListener("webkitTransitionEnd",this,false);b.addEventListener("DOMSubtreeModified",this,true);window.addEventListener("orientationchange",
this,false);window.addEventListener("resize",this,false)},setupScroller:function(){var a=this.scrollers.outer.parentNode;a={e:a.offsetWidth,f:a.offsetHeight};var b=this.scrollers.inner;b={e:b.offsetWidth,f:b.offsetHeight};var c=this._scrollbars,d={e:Math.min(a.e-b.e,0),f:Math.min(a.f-b.f,0)};this.containerSize=a;this.maxSegments={e:Math.ceil(-d.e/a.e),f:Math.ceil(-d.f/a.f)};c.container.style.height=a.f+"px";this._scrollMin=d;var e=this._scrolls={e:d.e<0,f:d.f<0};this._doScroll=e.e||e.f;c.container.className=
"touchScrollBars";if(e.e&&e.f)c.container.className+=" touchScrollBarsBoth";c.tracks.e.style.display=e.e?"":"none";c.tracks.f.style.display=e.f?"":"none";var f={e:c.tracks.e.offsetWidth,f:c.tracks.f.offsetHeight};c.sizes={e:Math.round(Math.max(f.e*a.e/b.e,config.scrollHandleMinSize)),f:Math.round(Math.max(f.f*a.f/b.f,config.scrollHandleMinSize))};c.handles.e.style.width=c.sizes.e+"px";c.handles.f.style.height=c.sizes.f+"px";c.maxOffsets={e:f.e-c.handles.e.offsetWidth,f:f.f-c.handles.f.offsetHeight};
c.offsetRatios={e:e.e?(f.e-c.handles.e.offsetWidth)/d.e:0,f:e.f?(f.f-c.handles.f.offsetHeight)/d.f:0}},handleEvent:function(a){var b=this.handlerNames[a.type];b&&this[b](a)},onTouchStart:function(a){if(this._doScroll){this.__proto__.currentScroller=this;this._isScrolling=false;this._trackedEvents=[];this._determineOffset();this._trackEvent(a);this._startEventTarget=a.target;this._stopAnimations();this._snapBack(null,0);this._startEvent=a;a.stopPropagation();a.preventDefault()}},onTouchMove:function(a){if(this._doScroll){var b=
this._trackedEvents[1].matrix;b=A(a).translate(-b.e,-b.f,0);var c=this._isScrolling,d=c;a.stopPropagation();a.preventDefault();if(!d){d=config.threshold;d=b.e<=-d||b.e>=d||b.f<=-d||b.f>=d}if(d){if(!c){this._isScrolling=true;this.showScrollbars()}this._scrollBy(b);this._trackEvent(a)}}},onTouchEnd:function(a){var b=this._startEventTarget;if(!this._isScrolling&&b==a.target){for(b=a.target;b.nodeType!=1;)b=b.parentNode;var c=document.createEvent("HTMLEvents");c.initEvent("focus",false,false);b.dispatchEvent(c);
c=document.createEvent("MouseEvent");c.initMouseEvent("click",true,true,a.view,1,a.screenX,a.screenY,a.clientX,a.clientY,a.ctrlKey,a.altKey,a.shiftKey,a.metaKey,a.button,null);b.dispatchEvent(c);this.hideScrollbars()}else if(this._isScrolling){c=this._getLastMove();if(c.duration<=config.flicking.triggerThreshold&&c.length){a=this._getFlickingDuration(c.speed);var d=this._getFlickingLength(c.speed,a);b=c.matrix;c=d/c.length;b.e*=c;b.f*=c;this.startFlick(b,a)}}if(!this.isAnimating())if(this.snapToGrid)this._snapBackToGrid();
else this._snapBack()||this.hideScrollbars();delete this._startEventTarget;this._isScrolling=false;this.__proto__.currentScroller=null},onTransitionEnd:function(a){["e","f"].forEach(function(b){if(a.target===this.scrollers[b])this._flicking[b]=false},this);this.isAnimating()||this.hideScrollbars()},isAnimating:function(){var a=this._animationTimeouts,b=this._flicking.e||this._flicking.f;return a.e.length>0||a.f.length>0||b},scrollBy:function(a,b){this._stopAnimations();var c=new WebKitCSSMatrix;c.e=
-a;c.f=-b;return this._scrollBy(c)},scrollTo:function(a,b){this._stopAnimations();var c=this._scrollMin,d=new WebKitCSSMatrix;d.e=Math.min(0,Math.max(c.e,-a));d.f=Math.min(0,Math.max(c.f,-b));a=this._currentOffset;d.e-=a.e;d.f-=a.f;return this._scrollBy(d)},center:function(){var a=-Math.round(this._scrollMin.e/2),b=-Math.round(this._scrollMin.f/2);return this.scrollTo(a,b)},_scrollBy:function(a){var b=this._scrolls;if(!b.e)a.e=0;if(!b.f)a.f=0;var c=this._scrollMin,d=this._currentOffset;b=d.multiply(a);
var e={e:false,f:false},f={e:0,f:0};if(this.elastic){var h=config.elasticity.factorDrag,g={e:d.e<c.e||d.e>0,f:d.f<c.f||d.f>0};if(g.e)b.e-=a.e*(1-h);if(g.f)b.f-=a.f*(1-h);if(b.e<c.e||b.e>0){e.e=true;f.e=b.e>=0?b.e:c.e-b.e}if(b.f<c.f||b.f>0){e.f=true;f.f=b.f>=0?b.f:c.f-b.f}a={e:(!g.e||!e.e)&&(e.e||e.e),f:(!g.f||!e.f)&&(e.f||e.f)};if(a.e)if(d.e>0)b.e/=h;else if(b.e>0)b.e*=h;else if(d.e<c.e)b.e+=(c.e-d.e)/h;else if(b.e<c.e)b.e-=(c.e-b.e)*h;if(a.f)if(d.f>0)b.f/=h;else if(b.f>0)b.f*=h;else if(d.f<c.f)b.f+=
(c.f-d.f)/h;else if(b.f<c.f)b.f-=(c.f-b.f)*h}else{if(b.e<c.e)b.e=c.e;else if(b.e>0)b.e=0;if(b.f<c.f)b.f=c.f;else if(b.f>0)b.f=0}this._currentOffset=b;a=b.translate(0,0,0);c=b.translate(0,0,0);a.f=c.e=0;q(this.scrollers.e,a);q(this.scrollers.f,c);d=this._scrollbars.offsetRatios;a.e*=d.e;c.f*=d.f;e.e?this._squeezeScrollbar("e",f.e,b.e<0):q(this._scrollbars.handles.e,a);e.f?this._squeezeScrollbar("f",f.f,b.f<0):q(this._scrollbars.handles.f,c)},_trackEvent:function(a){var b=this._trackedEvents;b[0]=b[1];
b[1]={matrix:A(a),timeStamp:a.timeStamp}},showScrollbars:function(){if(!this.snapToGrid){var a=this._scrollbars.container.style;a.webkitTransitionDuration="";a.opacity="1"}},hideScrollbars:function(){var a=this._scrollbars.container.style;a.webkitTransitionDuration="250ms";a.opacity="0"},_squeezeScrollbar:function(a,b,c,d,e){var f=this._scrollbars,h=f.handles[a].style,g=f.sizes[a];b=Math.max(g-b,1);var w=new WebKitCSSMatrix;w[a]=c?f.maxOffsets[a]:0;w[a=="f"?"d":"a"]=b/g;h.webkitTransformOrigin=c?
"100% 100%":"0 0";h.webkitTransitionProperty="-webkit-transform";h.webkitTransform=w;if(d){h.webkitTransitionDuration=d+"ms";h.webkitTransitionTimingFunction=e;this._animationTimeouts[a].push(setTimeout(function(){h.webkitTransitionDuration=""},d))}else h.webkitTransitionDuration=""},_determineOffset:function(a){var b=v(this.scrollers.e),c=v(this.scrollers.f);b=b.multiply(c);a&&B(b);this._currentOffset=b},_stopAnimations:function(){var a=false,b=this._scrollbars;["e","f"].forEach(function(d){this.scrollers[d].style.webkitTransitionDuration=
"";var e=b.handles[d];e.style.webkitTransitionDuration="";u(e);b.tracks[d].style.webkitBoxPack="";d=this._animationTimeouts[d];a=a||d.length;d.forEach(function(f){clearTimeout(f)});d.length=0},this);this._determineOffset(true);this._scrollBy(new WebKitCSSMatrix);this._bounces.e=this._bounces.f=null;var c=this._flicking;c.e=c.f=false;return a},_getLastMove:function(){var a=this._trackedEvents,b=a[0],c=a[1];if(!b)return{duration:0,matrix:new WebKitCSSMatrix,length:0,speed:0};a=c.timeStamp-b.timeStamp;
b=c.matrix.multiply(b.matrix.inverse());c=this._scrolls;if(!c.e)b.e=0;if(!c.f)b.f=0;c=Math.sqrt(b.e*b.e+b.f*b.f);return{duration:a,matrix:b,length:c,speed:c/a}},_getFlickingDuration:function(a){a=Math.log(config.flicking.minSpeed/a)/Math.log(config.flicking.friction);return a>0?Math.round(a):0},_getFlickingLength:function(a,b){b=(1-Math.pow(config.flicking.friction,b+1))/(1-config.flicking.friction);return a*b},startFlick:function(a,b){if(b||this.snapToGrid){b=b||config.snapBack.defaultTime;var c=
1/b,d=config.flicking.timingFunc,e=new i(d[0],d[1],d[2],d[3]),f=this._scrollMin,h=this._currentOffset,g=this._scrollbars;B(a);var w=this._currentOffset.multiply(a),H=this._scrolls;if(this.snapToGrid)var I=this.maxSegments,J=this.currentSegment;var x={e:true,f:true};["e","f"].forEach(function(j){if(H[j]){var p=a[j],o=w[j],l=1,k=f[j],m=0;if(this.snapToGrid){k=this.containerSize[j];m=I[j];var n=J[j],s=n+(p>0?-1:1);if(s<0)s=0;else if(m<s)s=m;this.currentSegment[j]=s;if(s==n||!p)return this._snapBack(j,
null,-n*k);m=k=-s*k}if(this.snapToGrid){k=(p<0?k:m)-h[j];o=0;l=k/p}else{if(o<k)l=1-Math.max(Math.min((o-k)/a[j],1),0);else if(o>m)l=1-Math.max(Math.min((o-m)/a[j],1),0);k=l*p;o=p-k}if(k||o){l=e.getTforY(l,c);if(l>1)l=1;else if(l<0)l=0;p=e.getPointForT(l).x;m=e.divideAtT(l);n=new WebKitCSSMatrix;n[j]=h[j];l=p*b;if(k&&p){this._flicking[j]=true;n[j]+=k;q(this.scrollers[j],n,l+"ms",m[0]);k=n.translate(0,0,0);k[j]*=g.offsetRatios[j];q(g.handles[j],k,l+"ms",m[0])}if(this.elastic&&o){k=n.translate(0,0,0);
m=m[1];m._p2={x:1-config.snapBack.timingFunc[0],y:1-config.snapBack.timingFunc[1]};n=Math.min(config.elasticity.factorFlick,config.elasticity.max/Math.abs(o));k[j]+=o*n;var y=(1-p)*b*n;this._bounces[j]={timingFunc:m,duration:y+"ms",matrix:k,bounceLength:Math.abs(o*n)};var D=this,z=this._animationTimeouts[j];z.push(setTimeout(function(){D._playQueuedBounce(j)},l));z.push(setTimeout(function(){D._snapBack(j,config.snapBack.alwaysDefaultTime?null:y);z.length=0},l+y))}}else x[j]=this._snapBack(j)}else x[j]=
false},this);x.e||x.f||this.hideScrollbars()}else this._snapBack()},_playQueuedBounce:function(a){var b=this._bounces[a];if(b){var c=b.matrix,d=b.duration,e=b.timingFunc;q(this.scrollers[a],c,d,e);this._squeezeScrollbar(a,b.bounceLength,c[a]<0,d,e);this._bounces[a]=null;return true}return false},_snapBack:function(a,b,c){b=b!=null?b:config.snapBack.defaultTime;if(a==null){a=this._snapBack("e",b);c=this._snapBack("f",b);if(a=a||c){var d=this;this._animationTimeouts.f.push(setTimeout(function(){d.hideScrollbars()},
b))}else this.hideScrollbars();return a}d=this.scrollers[a];var e=v(d),f=config.snapBack.timingFunc;f=new i(f[0],f[1],f[2],f[3]);if(c!=null||e[a]<this._scrollMin[a]||e[a]>0){e[a]=c!=null?c:Math.max(Math.min(e[a],0),this._scrollMin[a]);this._squeezeScrollbar(a,0,e[a]<0,b,f);q(d,e,b+"ms",f);return Boolean(b)}return false},_snapBackToGrid:function(){var a=this._currentOffset,b=this.containerSize;["e","f"].forEach(function(c){var d=b[c],e=-Math.floor((a[c]+0.5*d)/d),f=this.maxSegments[c];if(e<0)e=0;else if(f<
e)e=f;this.currentSegment[c]=e;return this._snapBack(c,null,-e*d)},this)}};return r}();
