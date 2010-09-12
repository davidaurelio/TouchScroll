function _scrollBy(matrix) {
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
        var bars = dom.bars;
        var scrollers = dom.scrollers;

        var offsetSpecs = [], numOffsetSpecs = 0;

        var axisScrollerMatrix, axisBouncerMatrix;
        var factor = isElastic ? this.config.elasticity.factorDrag : 1;
        var i = 0, axes = this._activeAxes, axis;
        while ((axis = axes[i++])) {
            axisMaxOffset = -maxOffset[axis];
            axisScrollOffset = scrollOffset[axis];
            axisNewOffset = newOffset[axis];

            axisScrollerMatrix = zeroMatrix.translate(0, 0, 0);
            axisBouncerMatrix = zeroMatrix.translate(0, 0, 0);

            if (isElastic) {
                axisScrollOffset = scrollOffset[axis];

                // whether the scroller was already beyond scroll bounds
                var wasOutOfBounds = axisScrollOffset < axisMaxOffset || axisScrollOffset > 0;
                if (wasOutOfBounds) {
                    axisNewOffset -= matrix[axis] * (1 - factor);
                }

                var isOutOfBounds = axisNewOffset < axisMaxOffset || axisNewOffset > 0;

                // whether the drag/scroll action went across scroller bounds
                var crossingBounds = (wasOutOfBounds && !isOutOfBounds) ||
                                     (!wasOutOfBounds || isOutOfBounds);

                if (crossingBounds) {
                    /*
                        If the drag went across scroll bounds, we need to apply a
                        "mixed strategy": The part of the drag outside the bounds
                        is mutliplicated by the elasticity factor.
                    */
                    if (axisScrollOffset > 0) {
                        axisNewOffset /= factor;
                        axisBouncerMatrix[axis] = axisNewOffset;
                    }
                    else if (axisNewOffset > 0) {
                        axisNewOffset *= factor;
                        axisBouncerMatrix[axis] = axisNewOffset;
                    }
                    else if (axisScrollOffset < axisMaxOffset) {
                        axisNewOffset += (axisMaxOffset - axisScrollOffset) / factor;
                        axisBouncerMatrix[axis] = axisNewOffset - axisMaxOffset;
                    }
                    else if (axisNewOffset < axisMaxOffset) {
                        axisNewOffset -= (axisMaxOffset - axisNewOffset) * factor;
                        axisBouncerMatrix[axis] = axisNewOffset - axisMaxOffset;
                    }
                }
            }
            // Constrain scrolling to scroller bounds
            if (axisNewOffset < axisMaxOffset) { axisNewOffset = axisMaxOffset; }
            else if (axisNewOffset > 0) { axisNewOffset = 0; }

            offsetSpecs[numOffsetSpecs++] = {};

            newOffset[axis] = axisNewOffset;
        }



        var offsetE = newOffset.translate(0, 0, 0); // faster than creating a new WebKitCSSMatrix instance
        var offsetF = newOffset.translate(0, 0, 0);
        offsetE.f = offsetF.e = 0;

        // TODO:cont

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
        this._scrollOffset = newOffset;
    }
