TouchScroll
=======================================

TouchScroll is a JavaScript/CSS 3-based scrolling layer for Webkit Mobile, espeacially iPhone, Android, and iPad. It allows to configure scrolling behaviour in many ways and to use fixed interface elements.



Dependencies
---------------------------------------

TouchScroll depends on [css-beziers][], a library for computations on cubic bezier curves.

[css-beziers]: http://github.com/davidaurelio/css-beziers



Usage
---------------------------------------

To use TouchScroll you need an element with fixed height. Have a look at the demo for an elegant solution using `display: -webkit-box`.

The stylesheet is mandatory at the moment. It will be made optional in the future for cases when scrollbars aren’t needed.

    <link rel="stylesheet" src="touchscroll.css">
    <!-- … -->
    <div id="scroller">
        <!-- contents go here -->
    </div>
    <script src="css-beziers.js"></script>
    <script src="touchscroll.js"></script>
    <script>
        var scroller = new TouchScroll(document.querySelector("#scroller"));
    </script>

To enable the elasticity/bouncing effect, add `{elastic: true}` as second parameter to the instantiation:

    <script>
        var scroller = new TouchScroll(document.querySelector("#scroller"), {elastic: true});
    </script>

Set the scroller to `overflow: auto` to enable scrolling in other environments.

The scroller automatically adapts its size to content changes and window resizes/orientation changes.



Limitations/Known Issues
---------------------------------------

 - TouchScroll currently doesn’t work well with forms on Android.
 - The scroller element shouldn’t have any padding.
 - Because two wrapper `<div>`s are inserted inside of the scroller, the CSS
   child selector (`#scroller > foo`) might not work as expected.
 - When a scroller is invisible, it can’t adapt its size correctly. Call its `setupScroller` method to fix that (e.g. after making a scroller visible by setting `display: block` on it).
 - Tapping the status bar on iPhone doesn’t trigger “scroll to top”.
 - Selecting text doesn’t work on the iPad and on some iPhone versions (OS 4.0b2) – an issue with cancelling events?



To Do
---------------------------------------
 - Keep the scrollbars round while bouncing – I already know how to do this.
 - Investigate whether support for tapping the status bar on iPhone can be added.
 - Investigate how selecting text and using the context menu can be re-enabled on iPhone/iPad.
 - Add an option to completely switch off scrollbars.
 - Find a solution to the event problems on Android – help greatly appreciated!



Contact
---------------------------------------

E-Mail: [da AT uxebu.com](mailto:da%20AT%20uxebu.com)
Twitter: [@void_0](http://twitter.com/void_0)
