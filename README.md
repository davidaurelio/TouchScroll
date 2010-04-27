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

    <div id="scroller">
        <!-- contents go here -->
    </div>
    <script src="css-beziers.js"></script>
    <script src="touchscroll.js"></script>
    <script>
        var scroller = new TouchScroll(document.querySelector("#scroller"));
    </script>

Set the scroller to `overflow: auto` to enable scrolling in other environments.

The scroller automatically adapts it’s size to content changes and window resizes/orientation changes.



Limitations
---------------------------------------

 - TouchScroll currently doesn’t work well with forms on Android.
 - The scroller element shouldn’t have any padding.
 - Because two wrapper `<div>`s are inserted inside of the scroller, the CSS
   child selector (`#scroller > foo`) might not work as expected.
 - When a scroller is invisible, it can’t adapt it’s size correctly. Call its
   `setupScroller` method to fix that.



To Do
---------------------------------------
 - Keep the scrollbars round while bouncing – I already know how to do this.
 - Add an option to completely switch off scrollbars.
 - Find a solution to the event problems on Android – help greatly appreciated!



Contact
---------------------------------------

E-Mail: [da AT uxebu.com](mailto:da%20AT%20uxebu.com)
Twitter: [@void_0](http://twitter.com/void_0)
