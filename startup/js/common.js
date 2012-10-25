/*
  Copyright (c) 2012 The Chromium Authors. All rights reserved.
  Use of this source code is governed by a BSD-style license that can be
  found in the LICENSE file.
*/

/*
  Common methods for performance-plotting JS.
*/

function Fetch(url, callback,graph) {
  var args = [];
  for (var key in arguments) {
    if (key > 1)
      args.push(arguments[key]);
  }
  var r = new XMLHttpRequest();
  r.open("GET", url, true);
  r.setRequestHeader("pragma", "no-cache");
  r.setRequestHeader("cache-control", "no-cache");
  r.onreadystatechange = function() {
    if (r.readyState == 4) {
      var error;
      var text = r.responseText;
      if (r.status != 200) {
        error = url + ": " + r.status + ": " + r.statusText;
      } else if (! text) {
        error = url + ": null response";
      }
      args.unshift(text, error,graph);
      callback.apply(this, args);
    }
  }

  r.send(null);
}

// Returns the keys of an object.
function Keys(obj) {
  result = [];
  for (key in obj) {
    result.push(key)
  }
  return result
}

// Returns the "directory name" portion of the string (URL),
// stripping the last element.
function DirName(s) {
  elements = s.split('/')
  elements.pop()
  return elements.join('/')
}

// Returns an Object with properties given by the parameters specified in the
// URL's query string.
function ParseParams() {
  var result = new Object();
  var s = window.location.search.substring(1).split('&');
  for (i = 0; i < s.length; ++i) {
    var v = s[i].split('=');
    var key = v[0];
    var value = unescape(v[1]);

    // Multiple 'trace' params are allowed, so define any specified entries
    // as keys in a hash.  Otherwise, treat the param as a string.
    if (key == 'trace') {
      if (typeof(result[key]) == 'undefined')
        result[key] = {}
      result[key][value] = 1;
    } else {
      result[key] = value;
    }
  }
  if ('history' in result) {
    result['history'] = parseInt(result['history']);
    result['history'] = Math.max(result['history'], 2);
  }
  if ('rev' in result) {
    result['rev'] = parseInt(result['rev']);
    result['rev'] = Math.max(result['rev'], -1);
  }
  return result;
}

// Creates the URL constructed from the current pathname and the given params.
function MakeURL(params) {
  var url = window.location.pathname;
  var sep = '?';
  for (p in params) {
    if (!p)
      continue;
    url = url + sep + p + '=' + params[p];
    sep = '&';
  }
  return url;
}

// Returns a string describing an object, recursively.  On the initial call,
// |name| is optionally the name of the object and |indent| is not needed.
function DebugDump(obj, opt_name, opt_indent) {
  var name = opt_name || '';
  var indent = opt_indent || '';
  if (typeof obj == "object") {
    var child = null;
    var output = indent + name + "\n";

    for (var item in obj) {
      try {
        child = obj[item];
      } catch (e) {
        child = "<Unable to Evaluate>";
      }
      output += DebugDump(child, item, indent + "  ");
    }

    return output;
  } else {
    return indent + name + ": " + obj + "\n";
  }
}


/**
 * Fetch a list of files and apply to callback function with a list of
 * data in order that they were listed in urls.
 *
 * @param {Array} urls list of urls to fetch.
 * @param {Object} callback function to call once fetch is completed.
 */
function FetchList(urls, callback) {
  this.urls_ = urls;
  this.callback_ = callback;
  this.fetchCount_ = this.urls_.length;
  this.data_ = [];
  this.callbackArgs_ = [];
  for (var key in arguments) {
    if (key > 1) {
      this.callbackArgs_.push(arguments[key]);
    }
  }

  var obj = this;
  for (var i = 0; i < this.urls_.length; i++) {
    Fetch(this.urls_[i], function(){obj.onReceived.apply(obj, arguments)}, i);
  }
}

FetchList.prototype.onReceived = function(data, error, i) {
  if (error) {
    console.log(error)
    data = null;
  }
  this.fetchCount_--;
  this.data_[i] = data;
  if (this.fetchCount_ == 0) {
    this.callbackArgs_.unshift(this.data_);
    this.callback_.apply(this, this.callbackArgs_);
  }
}
