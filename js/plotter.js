/*
  Copyright (c) 2012 The Chromium Authors. All rights reserved.
  Use of this source code is governed by a BSD-style license that can be
  found in the LICENSE file.
*/

// Collection of classes used to plot data in a <canvas>.  Create a Plotter()
// to generate a plot.

// Vertical marker for columns.
function Marker(color) {
  var m = document.createElement("DIV");
  m.setAttribute("class", "plot-cursor");
  m.style.backgroundColor = color;
  m.style.opacity = "0.3";
  m.style.position = "absolute";
  m.style.left = "-2px";
  m.style.top = "-2px";
  m.style.width = "0px";
  m.style.height = "0px";
  return m;
}

/**
 * Adds commas to |number|.
 *
 * Examples:
 *  1234.56 => "1,234.56"
 *  "99999" => "99,999"
 *
 * @param number {string|number} The number to format.
 * @return {string} String representation of |number| with commas every
 *     three places.
 */
function addCommas(number) {
  number += '';  // Convert number to string if not already.
  var numberParts = number.split('.');
  var integralPart = numberParts[0];
  var fractionalPart = numberParts.length > 1 ? '.' + numberParts[1] : '';
  var reThreeDigits = /(\d+)(\d{3})/;
  while (reThreeDigits.test(integralPart)) {
    integralPart = integralPart.replace(reThreeDigits, '$1' + ',' + '$2');
  }
  return integralPart + fractionalPart;
}

/**
 * HorizontalMarker class
 * Create a horizontal marker at the indicated mouse location.
 * @constructor
 *
 * @param canvasRect {Object} The canvas bounds (in client coords).
 * @param clientY {Number} The vertical mouse click location that spawned
 *     the marker, in the client coordinate space.
 * @param yValue {Number} The plotted value corresponding to the clientY
 *     click location.
 */
function HorizontalMarker(canvasRect, clientY, yValue) {
  // Add a horizontal line to the graph.
  var m = document.createElement("DIV");
  m.setAttribute("class", "plot-baseline");
  m.style.backgroundColor = HorizontalMarker.COLOR;
  m.style.opacity = "0.3";
  m.style.position = "absolute";
  m.style.left = canvasRect.offsetLeft;
  var h = HorizontalMarker.HEIGHT;
  m.style.top = (clientY - h/2).toFixed(0) + "px";
  m.style.width = canvasRect.offsetWidth + "px";
  m.style.height = h + "px";
  this.markerDiv_ = m;

  this.value = yValue;
}

HorizontalMarker.HEIGHT = 5;
HorizontalMarker.COLOR = "rgb(0,100,100)";

// Remove the horizontal line from the graph.
HorizontalMarker.prototype.remove_ = function() {
  this.markerDiv_.parentNode.removeChild(this.markerDiv_);
};


/**
 * Plotter class
 * @constructor
 *
 * Draws a chart using CANVAS element. Takes array of lines to draw with
 * deviations values for each data sample.
 *
 * @param {Array} clNumbers list of clNumbers for each data sample.
 * @param {Array} plotData list of arrays that represent individual lines.
 *                         The line itself is an Array of value and stdd.
 * @param {Array} dataDescription list of data description for each line
 *                         in plotData.
 * @param {string} units name of measurement used to describe plotted data.
 *
 * Example of the plotData:
 *  [
 *    [line 1 data],
 *    [line 2 data]
 *  ].
 *  Line data looks like  [[point one], [point two]].
 *  And individual points are [value, deviation value]
 */
function Plotter(clNumbers, plotData, dataDescription, units, resultNode,
                 width, height) {
  this.clNumbers_ = clNumbers;
  this.plotData_ = plotData;
  this.dataDescription_ = dataDescription;
  this.dataColors_ = [];
  this.dataIndexByName_ = {};
  this.resultNode_ = resultNode;
  this.units_ = units;
  this.selectedTraces_ = [];
  this.imageCache_ = null;
  this.enableMouseScroll = true;
  this.coordinates = new Coordinates(plotData, width, height);
  if (isNaN(width))
    this.width = this.coordinates.widthMax;
  else
    this.width = width;

  this.plotPane_ = null;

  // A color palette that's unambigous for normal and color-deficient viewers.
  // Values are (red, green, blue) on a scale of 255.
  // Taken from http://jfly.iam.u-tokyo.ac.jp/html/manuals/pdf/color_blind.pdf
  this.colors = [[0, 114, 178],   // blue
                 [230, 159, 0],   // orange
                 [0, 158, 115],   // green
                 [204, 121, 167], // purplish pink
                 [86, 180, 233],  // sky blue
                 [213, 94, 0],    // dark orange
                 [0, 0, 0],       // black
                 [240, 228, 66]   // yellow
                ];

  var categoryColors = {};
  var colorIndex = 0;
  for (var i = 0; i < this.dataDescription_.length; i++) {
    this.dataIndexByName_[this.dataDescription_[i]] = i;
    var category = this.dataDescription_[i].replace(/-.*/, "");
    if (this.dataDescription_[i].indexOf("ref") == -1) {
      category += "-ref";
    }
    if (!categoryColors[category]) {
      categoryColors[category] = this.makeColor(colorIndex++);
    }
    this.dataColors_[i] = categoryColors[category];
  }
}

/**
 * Does the actual plotting.
 */
Plotter.prototype.plot = function() {
  this.canvas_elt_ = this.canvas();
  this.coordinates_div_ = this.coordinates_();
  this.ruler_div_ = this.ruler();
  // marker for the result-point that the mouse is currently over
  this.cursor_div_ = new Marker("rgb(100,80,240)");
  // marker for the result-point for which details are shown
  this.marker_div_ = new Marker("rgb(100,100,100)");

  this.plotPane_ = document.createElement('div');
  this.plotPane_.setAttribute('class', 'plot');
  this.plotPane_.setAttribute('style', 'position: relative');
  this.resultNode_.appendChild(this.plotPane_);
  this.plotPane_.appendChild(this.canvas_elt_);
  this.plotPane_.appendChild(this.ruler_div_);
  this.plotPane_.appendChild(this.cursor_div_);
  this.plotPane_.appendChild(this.marker_div_);
  
  this.resultNode_.appendChild(this.coordinates_div_);
  this.attachEventListeners(this.canvas_elt_);

  this.redraw();

  this.graduation_divs_ = this.graduations();
  for (var i = 0; i < this.graduation_divs_.length; i++)
    this.plotPane_.appendChild(this.graduation_divs_[i]);
};

/**
 * Redraws the canvas with selected traces highlighted.
 */
Plotter.prototype.redraw = function() {
  var ctx = this.canvas_elt_.getContext("2d");
  var doDrawImage = this.selectedTraces_.length || this.imageCache_;
  // Drawing all lines can take a few seconds on large graphs, so use a cache.
  // After the initial render, the cache draws quickly on Firefox and Chrome.
  if (!this.imageCache_) {
    // Clear it with white: otherwise canvas will draw on top of existing data.
    ctx.clearRect(0, 0, this.canvas_elt_.width, this.canvas_elt_.height);
    // Draw all data lines.
    for (var i = 0; i < this.plotData_.length; i++)
      this.plotLine_(ctx, this.getDataColor(i), this.plotData_[i]);
    // Here we convert the canvas to an image by making a new Image with
    // src set to the canvas's Data URL.
    var imageDataURL = this.canvas_elt_.toDataURL();
    this.imageCache_ = new Image;
    this.imageCache_.src = imageDataURL;
  }
  if (doDrawImage) {
    // Clear it again so we don't draw on top of the old line.
    ctx.clearRect(0, 0, this.canvas_elt_.width, this.canvas_elt_.height);
    // If we have selections, dim the other traces by first setting low alpha.
    if (this.selectedTraces_.length)
      ctx.globalAlpha = 0.2;
    // Draw the cached image.
    ctx.drawImage(this.imageCache_, 0, 0);
    // Restore the alpha so we can draw selected lines in full opacity.
    ctx.globalAlpha = 1;
  }
  // Now draw all selected traces in order of selection.
  for (var i = 0; i < this.selectedTraces_.length; i++) {
    var index = this.selectedTraces_[i];
    this.plotLine_(ctx, this.getDataColor(index), this.plotData_[index]);
  }
};

/**
 * Sets the selected state of a given trace.
 * @param {number} trace_index
 * @return {boolean} true if the trace has been selected, false if deselected.
 */
Plotter.prototype.toggleSelection = function(trace_index) {
  var i = this.selectedTraces_.indexOf(trace_index);
  var ret = (i == -1);
  if (ret)
    this.selectedTraces_.push(trace_index);
  else
    this.selectedTraces_.splice(i, 1);
  this.redraw();
  return ret;
};

Plotter.prototype.drawDeviationBar_ = function(context, strokeStyles, x,
                                               y_errLow, y_errHigh) {
  context.strokeStyle = strokeStyles;
  context.lineWidth = 1.0;
  context.beginPath();
  context.moveTo(x, y_errHigh);
  context.lineTo(x, y_errLow);
  context.closePath();
  context.stroke();
};

Plotter.prototype.plotLine_ = function(ctx, strokeStyles, data) {
  ctx.strokeStyle = strokeStyles;
  ctx.lineWidth = 2.0;
  ctx.beginPath();
  var initial = true;
  var deviationData = [];
  for (var i = 0; i < data.length; i++) {
    var x = this.coordinates.xPoints(i);
    var value = parseFloat(data[i][0]);
    var stdd = parseFloat(data[i][1]);
    var y = 0.0;
    var y_errLow = 0.0;
    var y_errHigh = 0.0;
    if (isNaN(value)) {
      // Re-set 'initial' if we're at a gap in the data.
      initial = true;
    } else {
      y = this.coordinates.yPoints(value);
      // We assume that the stdd will only be NaN (missing) when the value is.
      if (value != 0.0) {
        y_errLow = this.coordinates.yPoints(value - stdd);
        y_errHigh = this.coordinates.yPoints(value + stdd);
      }
      if (initial)
        initial = false;
      else
        ctx.lineTo(x, y);
    }

    ctx.moveTo(x, y);
    deviationData.push([x, y_errLow, y_errHigh])
  }
  ctx.closePath();
  ctx.stroke();

  for (var i = 0; i < deviationData.length; i++) {
    this.drawDeviationBar_(ctx, strokeStyles, deviationData[i][0],
                            deviationData[i][1], deviationData[i][2]);
  }
};

Plotter.prototype.attachEventListeners = function(canvas) {
  var self = this;
  if (this.enableMouseScroll) {
    canvas.parentNode.addEventListener(
      "mousewheel", function(evt) { self.onMouseScroll_(evt) }, false);
    canvas.parentNode.addEventListener(
      "DOMMouseScroll", function(evt) { self.onMouseScroll_(evt); }, false);
  }
  canvas.parentNode.addEventListener(
    "mousemove", function(evt) { self.onMouseMove_(evt); }, false);
  this.cursor_div_.addEventListener(
    "click", function(evt) { self.onMouseClick_(evt); }, false);
};

Plotter.prototype.onMouseScroll_ = function(evt) {
  // Chrome uses wheelDelta and Mozilla uses detail with opposite sign values.
  var zoom = evt.wheelDelta ? evt.wheelDelta : -evt.detail;
  zoom = zoom < 0 ? -1 : 1;
  // Zoom less if the shift key is held.
  if (evt.shiftKey)
    zoom /= 10;

  var positionY = evt.clientY - this.canvas_elt_.offsetTop;
  var yValue = this.coordinates.yValue(positionY);
  var yTopToMouse = this.coordinates.yMaxValue - (this.coordinates.yMaxValue +
      yValue) / 2;
  var yBottomToMouse = (yValue + this.coordinates.yMinValue) / 2 -
      this.coordinates.yMinValue;

  this.coordinates.yMinValue += yBottomToMouse * zoom;
  this.coordinates.yMaxValue -= yTopToMouse * zoom;
  this.imageCache_ = null;
  if(this.horizontal_marker_) {
    this.horizontal_marker_.remove_();
    this.horizontal_marker_ = null;
  }
  for (var i = 0; i < this.graduation_divs_.length; i++)
    this.plotPane_.removeChild(this.graduation_divs_[i]);
  this.graduation_divs_ = this.graduations();
  for (var i = 0; i < this.graduation_divs_.length; i++)
    this.plotPane_.appendChild(this.graduation_divs_[i]);
  this.redraw();
};

Plotter.prototype.updateRuler_ = function(evt) {
  var r = this.ruler_div_;
  var obj = this.canvas_elt_;
  var offsetTop = 0;
  do {
    offsetTop += obj.offsetTop;
  } while (obj = obj.offsetParent);
  r.style.left = this.canvas_elt_.offsetLeft + "px";
  r.style.top = this.canvas_elt_.offsetTop + "px";
  r.style.width = this.canvas_elt_.offsetWidth + "px";
  var h = evt.clientY + document.body.scrollTop - offsetTop;
  if (h > this.canvas_elt_.offsetHeight)
    h = this.canvas_elt_.offsetHeight;
  r.style.height = h + "px";
};

Plotter.prototype.updateCursor_ = function() {
  var c = this.cursor_div_;
  c.style.top = this.canvas_elt_.offsetTop + "px";
  c.style.height = this.canvas_elt_.offsetHeight + "px";
  var w = this.canvas_elt_.offsetWidth / this.clNumbers_.length;
  var x = (this.canvas_elt_.offsetLeft + w * this.current_index_).toFixed(0);
  c.style.left = x + "px";
  c.style.width = w + "px";
};

Plotter.prototype.chromiumCLNumber_ = function(index) {
  // CL number entries are either revisions or objects of the form
  // {chromium: revision, webkit: revision}
  return this.clNumbers_[index].chromium || this.clNumbers_[index];
};

Plotter.prototype.onMouseMove_ = function(evt) {
  var obj = this.canvas_elt_;
  var offsetTop = 0;
  var offsetLeft = 0;
  do {
    offsetTop += obj.offsetTop;
    offsetLeft += obj.offsetLeft;
  } while (obj = obj.offsetParent);

  var canvas = evt.currentTarget.firstChild;
  var positionX = evt.clientX + document.body.scrollLeft - offsetLeft;
  var positionY = evt.clientY + document.body.scrollTop - offsetTop;

  this.current_index_ = this.coordinates.dataSampleIndex(positionX);
  var yValue = this.coordinates.yValue(positionY);

  var html = "";
  if (!isNaN(this.chromiumCLNumber_(0)))
    html = "r";
  html += this.chromiumCLNumber_(this.current_index_);
  var webkitCLNumber = this.clNumbers_[this.current_index_].webkit;
  if (webkitCLNumber) {
    html += ", webkit ";
    if (!isNaN(webkitCLNumber))
      html += "r";
    html += webkitCLNumber;
  }

  html += ": " +
    addCommas(this.plotData_[0][this.current_index_][0].toFixed(2)) +
    " " + this.units_ + " +/- " +
    addCommas(this.plotData_[0][this.current_index_][1].toFixed(2)) +
    " " + addCommas(yValue.toFixed(2)) + " " + this.units_;

  this.coordinates_td_.innerHTML = html;

  // If there is a horizontal marker, also display deltas relative to it.
  if (this.horizontal_marker_) {
    var baseline = this.horizontal_marker_.value;
    var delta = yValue - baseline;
    var fraction = delta / baseline; // allow division by 0

    var deltaStr = (delta >= 0 ? "+" : "") + delta.toFixed(0) + " " +
        this.units_;
    var percentStr = (fraction >= 0 ? "+" : "") +
        (fraction * 100).toFixed(3) + "%";

    this.baseline_deltas_td_.innerHTML = deltaStr + ": " + percentStr;
  }

  this.updateRuler_(evt);
  this.updateCursor_();
};

Plotter.incrementNumericCLNumber = function(value) {
  if (isNaN(value))
    return value;
  return value + 1;
}

Plotter.prototype.onMouseClick_ = function(evt) {
  // Shift-click controls the horizontal reference line.
  if (evt.shiftKey) {
    if (this.horizontal_marker_) {
      this.horizontal_marker_.remove_();
    }
    var obj = this.canvas_elt_;
    var offsetTop = 0;
    do {
      offsetTop += obj.offsetTop;
    } while (obj = obj.offsetParent);
    var canvasY = evt.clientY + document.body.scrollTop - offsetTop;
    this.horizontal_marker_ = new HorizontalMarker(
        this.canvas_elt_, evt.clientY + document.body.scrollTop - offsetTop,
        this.coordinates.yValue(canvasY));

    // Insert before cursor node, otherwise it catches clicks.
    this.cursor_div_.parentNode.insertBefore(
        this.horizontal_marker_.markerDiv_, this.cursor_div_);
  } else {
    var index = this.current_index_;
    var m = this.marker_div_;
    var c = this.cursor_div_;
    m.style.top = c.style.top;
    m.style.left = c.style.left;
    m.style.width = c.style.width;
    m.style.height = c.style.height;
    if ("onclick" in this) {
      var this_x = this.clNumbers_[index];
      // TODO(tonyg): When the clNumber is not numeric, the range includes one
      // too many revisions on the starting side.
      var prev_x = this_x;
      if (index > 0) {
        prev_x_source = this.clNumbers_[index-1];
        if (typeof prev_x_source == 'object') {
          prev_x = {};
          for (var key in prev_x_source) {
            prev_x[key] = Plotter.incrementNumericCLNumber(prev_x_source[key]);
          }
        } else {
          prev_x = Plotter.incrementNumericCLNumber(prev_x_source);
        }
      }
      this.onclick(prev_x, this_x);
    }
  }
};

Plotter.prototype.canvas = function() {
  var canvas = document.createElement("CANVAS");
  canvas.setAttribute("class", "plot");
  canvas.setAttribute("width", this.coordinates.widthMax);
  canvas.setAttribute("height", this.coordinates.heightMax);
  canvas.plotter = this;
  return canvas;
};

Plotter.prototype.ruler = function() {
  var ruler = document.createElement("DIV");
  ruler.setAttribute("class", "plot-ruler");
  ruler.style.borderBottom = "1px dotted black";
  ruler.style.position = "absolute";
  ruler.style.left = "-2px";
  ruler.style.top = "-2px";
  ruler.style.width = "0px";
  ruler.style.height = "0px";
  return ruler;
};

Plotter.prototype.graduations = function() {
  // Don't allow a graduation in the bottom 5% of the chart
  // or the number label would overflow the chart bounds.
  var yMin = this.coordinates.yMinValue + .05 * this.coordinates.yValueRange();
  var yRange = this.coordinates.yMaxValue - yMin;

  // Use the largest scale that fits 3 or more graduations.
  // We allow scales of [...,500, 250, 100, 50, 25, 10,...].
  var scale = 5000000000;
  while (scale) {
    if (Math.floor(yRange / scale) > 2) break;  // 5s
    scale /= 2;
    if (Math.floor(yRange / scale) > 2) break;  // 2.5s
    scale /= 2.5;
    if (Math.floor(yRange / scale) > 2) break;  // 1s
    scale /= 2;
  }

  var graduationPosition = yMin + (scale - yMin % scale);
  var graduationDivs = [];
  while (graduationPosition < this.coordinates.yMaxValue) {
    var graduation = document.createElement("DIV");
    var canvasPosition = this.coordinates.yPoints(graduationPosition);
    graduation.style.borderTop = "1px dashed rgba(0,0,0,.08)";
    graduation.style.position = "absolute";
    graduation.style.left = this.canvas_elt_.offsetLeft + "px";
    graduation.style.top = canvasPosition + this.canvas_elt_.offsetTop + "px";
    graduation.style.width =
        this.canvas_elt_.offsetWidth - 4 + "px";
    graduation.style.paddingLeft = "4px";
    graduation.style.color = "rgba(0,0,0,.4)";
    graduation.style.fontSize = "9px";
    graduation.style.paddingTop = "0";
    graduation.style.zIndex = "-1";
    graduation.innerHTML = addCommas(graduationPosition);
    graduationDivs.push(graduation);
    graduationPosition += scale;
  }
  return graduationDivs;
};

Plotter.prototype.coordinates_ = function() {
  var coordinatesDiv = document.createElement("DIV");
  var fontSize = Math.max(0.8, this.width / 400 * 0.75);
  fontSize = Math.min(1.0, fontSize);

  var table = document.createElement("table");
  coordinatesDiv.appendChild(table);
  table.style.cssText = "border=0; width=100%; font-size:" + fontSize + "em;";
  var tr = document.createElement("tr");
  table.appendChild(tr);
  var td = document.createElement("td");
  tr.appendChild(td);
  td.className = "legend";
  td.innerHTML = "Legend: ";
  
  for (var i = 0; i < this.dataDescription_.length; i++) {
    if (i > 0)
      td.appendChild(document.createTextNode(", "));
    var legendItem = document.createElement("a");
    td.appendChild(legendItem);
    legendItem.className = "legend_item";
    legendItem.href = "#";
    legendItem.style.cssText = "text-decoration: none; color: " +
        this.getDataColor(i);
    var obj = this;
    legendItem.onclick = (
      function(){
        var index = i;
        return function() {
          this.style.fontWeight = (obj.toggleSelection(index)) ?
              "bold" : "normal";
          return false;
        }
      })();
    legendItem.innerHTML = this.dataDescription_[i];
  }
  
  this.coordinates_td_ = document.createElement("td");
  this.coordinates_td_.innerHTML = "<i>move mouse over graph</i>";
  tr.appendChild(this.coordinates_td_);

  this.baseline_deltas_td_ = document.createElement("td");
  this.baseline_deltas_td_.style.color = HorizontalMarker.COLOR;
  tr.appendChild(this.baseline_deltas_td_);

  return coordinatesDiv;
};

Plotter.prototype.makeColor = function(i) {
  var index = i % this.colors.length;
  return "rgb(" + this.colors[index][0] + "," +
                  this.colors[index][1] + "," +
                  this.colors[index][2] + ")";
};

Plotter.prototype.getDataColor = function(i) {
  if (this.dataColors_[i]) {
    return this.dataColors_[i];
  } else {
    return this.makeColor(i);
  }
};

Plotter.prototype.log = function(val) {
  document.getElementById('log').appendChild(
    document.createTextNode(val + '\n'));
};
