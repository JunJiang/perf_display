/*
  Copyright (c) 2012 The Chromium Authors. All rights reserved.
  Use of this source code is governed by a BSD-style license that can be
  found in the LICENSE file.
*/

/**
 * 'Understands' plot data positioning.
 *  @constructor
 *
 * @param {Array} plotData data that will be displayed
 */
function Coordinates(plotData, width, height) {
  this.plotData = plotData;

  if (!height)
    height = window.innerHeight - 16;
  if (!width)
    width = window.innerWidth - 16;

  this.widthMax = width;
  this.heightMax = Math.min(400, height - 85);

  this.xMinValue = -0.5;
  this.xMaxValue = (this.plotData[0].length - 1) + 0.5;
  this.processYValues_();
}

Coordinates.prototype.processYValues_ = function () {
  var merged = [];
  var mergedErr = [];
  for (var i = 0; i < this.plotData.length; i++)
    for (var j = 0; j < this.plotData[i].length; j++) {
      merged.push(parseFloat(this.plotData[i][j][0]));
      mergedErr.push(parseFloat(this.plotData[i][j][1]));
    }
  var max = Math.max.apply( Math, merged );
  var min = Math.min.apply( Math, merged );
  var maxErr = Math.max.apply( Math, mergedErr );

  // If we have a missing value, find the real max and min the hard way.
  if (isNaN(min)) {
    for (var i = 0; i < merged.length; ++i) {
      if (isNaN(min) || merged[i] < min)
        min = merged[i];
      if (isNaN(max) || merged[i] > max)
        max = merged[i];
      if (isNaN(maxErr) || mergedErr[i] > maxErr)
        maxErr = mergedErr[i];
    }
  }

  this.yMinValue = min - maxErr;
  this.yMaxValue = max + maxErr;
};

/**
 * Difference between horizontal max min values.
 */
Coordinates.prototype.xValueRange = function() {
  return this.xMaxValue - this.xMinValue;
};

/**
 * Difference between vertical max min values.
 */
Coordinates.prototype.yValueRange = function() {
  return this.yMaxValue - this.yMinValue
};

/**
 * Converts horizontal data value to pixel value on canvas.
 * @param {number} value horizontal data value
 */
Coordinates.prototype.xPoints = function(value) {
  return this.widthMax * ((value - this.xMinValue) / this.xValueRange());
};

/**
 * Converts vertical data value to pixel value on canvas.
 * @param {number} value vertical data value
 */
Coordinates.prototype.yPoints = function(value) {
  // yValueRange() can be 0.  If it is, place |value| in the middle of
  // the region.
  if (this.yValueRange() == 0)
    return this.heightMax / 2;

  // Converts value to canvas Y position in pixels.
  return this.heightMax  - this.heightMax * (value - this.yMinValue) / 
    this.yValueRange();
};

/**
 * Converts X point on canvas to value it represents.
 * @param {number} position horizontal point on canvas.
 */
Coordinates.prototype.xValue = function(position) {
  /* Converts canvas X pixels to value. */
  return position / this.widthMax * (this.xValueRange()) + this.xMinValue;
};

/**
 * Converts Y point on canvas to value it represents.
 * @param {number} position vertical point on canvas.
 */
Coordinates.prototype.yValue = function(position) {
  /* Converts canvas Y pixels to value. 
  position is point value is from top.
  */
  var position = this.heightMax - position;
  var ratio = parseFloat(this.heightMax / position);
  return  this.yMinValue + this.yValueRange() / ratio;
};

/**
 * Converts canvas X pixel to data index.
 * @param {number} xPosition horizontal point on canvas
 */
Coordinates.prototype.dataSampleIndex = function(xPosition) {
  var xValue = this.xValue(xPosition);
  var index;
  if (xValue < 0) {
    index = 0;
  } else if (xValue > this.plotData[0].length - 1) {
    index = this.plotData[0].length - 1;
  } else {
    index = xValue.toFixed(0);
  }
  return index;
};

Coordinates.prototype.log = function(val) {
  document.getElementById('log').appendChild(
    document.createTextNode(val + '\n'));
};
