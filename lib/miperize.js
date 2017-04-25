'use strict';

var merge = require('lodash.merge')
  , EventEmitter = require('events').EventEmitter
  , emits = require('emits')
  , html = require('htmlparser2')
  , util = require('util')
  , uuid = require('uuid')
  , async = require('async')
  , url = require('url')
  , http = require('http')
  , https = require('https')
  , sizeOf = require('image-size')
  , helpers = require('./helpers');

var DEFAULTS = {
  'mip-img': {
    layout: 'responsive',
    width: 600,
    height: 400,
  },
  'mip-anim': {
    layout: 'responsive',
    width: 600,
    height: 400,
  },
  'mip-iframe': {
    layout: 'responsive',
    width: 600,
    height: 400,
    sandbox: 'allow-script allow-same-origin'
  }
};

var called;

/**
 * Miperizer constructor. Borrows from Minimize.
 *
 * https://github.com/Swaagie/minimize/blob/4b815e274a424ca89551d28c4e0dd8b06d9bbdc2/lib/minimize.js#L15
 *
 * @constructor
 * @param {Object} options Options object
 * @api public
 */
function Miperize(options) {
  this.config = merge({}, DEFAULTS, options || {});
  this.emits = emits;

  this.htmlParser = new html.Parser(
    new html.DomHandler(this.emits('read'))
  );
}

util.inherits(Miperize, EventEmitter);

/**
 * Parse the content and call the callback. Borrowed from Minimize.
 *
 * https://github.com/Swaagie/minimize/blob/4b815e274a424ca89551d28c4e0dd8b06d9bbdc2/lib/minimize.js#L51
 *
 * @param {String} content HTML
 * @param {Function} callback
 * @api public
 */
Miperize.prototype.parse = function parse(content, callback) {
  if (typeof callback !== 'function') throw new Error('No callback provided');
  var id = uuid.v4();

  this.once('read', this.miperizer.bind(this, id));
  this.once('parsed: ' + id, callback);

  this.htmlParser.parseComplete(content);
};

/**
 * Turn a traversible DOM into string content. Borrowed from Minimize.
 *
 * https://github.com/Swaagie/minimize/blob/4b815e274a424ca89551d28c4e0dd8b06d9bbdc2/lib/minimize.js#L74
 *
 * @param {Object} error
 * @param {Object} dom Traversible DOM object
 * @api private
 */
Miperize.prototype.miperizer = function miperizer(id, error, dom) {
  if (error) throw new Error('Miperizer failed to parse DOM', error);

  this.traverse(dom, '', this.emits('parsed: ' + id));
};

/**
 * Reduce the traversible DOM object to a string. Borrows from Minimize.
 *
 * https://github.com/Swaagie/minimize/blob/4b815e274a424ca89551d28c4e0dd8b06d9bbdc2/lib/minimize.js#L90
 *
 * @param {Array} data
 * @param {String} html Compiled HTML contents
 * @param {Function} done Callback function
 * @api private
 */
Miperize.prototype.traverse = function traverse(data, html, done) {
  var miperize = this;

  async.reduce(data, html, function reduce(html, element, step) {
    var children;

    function close(error, html) {
      if (error) {
        return step(error);
      }

      html += helpers.close(element);
      step(null, html);
    }

    function enter(error) {
      if (error) {
        return step(error);
      }

      children = element.children;
      html += helpers[element.type](element);

      if (!children || !children.length) return close(null, html);

      setImmediate(function delay() {
        traverse.call(miperize, children, html, close);
      });
    }

    function useSecureSchema(element) {
        if (element.attribs && element.attribs.src) {
            // Every src attribute must be with 'https' protocol otherwise it will not get validated by AMP.
            // If we're unable to replace it, we will deal with the valitation error, but at least
            // we tried.
            if (element.attribs.src.indexOf('https://') === -1) {
                if (element.attribs.src.indexOf('http://') === 0) {
                    // Replace 'http' with 'https', so the validation passes
                    element.attribs.src = element.attribs.src.replace(/^http:\/\//i, 'https://');
                } else if (element.attribs.src.indexOf('//') === 0) {
                    // Giphy embedded iFrames are without protocol and start with '//', so at least
                    // we can fix those cases.
                    element.attribs.src = 'https:' + element.attribs.src;
                }
            }
        }

      return;
    }

    function getLayoutAttribute(element) {
      var layout;

      // check if element.width is smaller than 300 px. In that case, we shouldn't use
      // layout="responsive", because the media element will be stretched and it doesn't
      // look nice. Use layout="fixed" instead to fix that.
      layout = element.attribs.width < 300 ? layout = 'fixed' : miperize.config[element.name].layout;

      element.attribs.layout = !element.attribs.layout ? layout : element.attribs.layout;

      return enter();
    }

    /**
     * Get the image sizes (width and heigth plus type of image)
     *
     * https://github.com/image-size/image-size
     *
     * @param {Object} element
     * @return {Object} element incl. width and height
     */
    function getImageSize(element) {
      var options = url.parse(element.attribs.src),
          timeout = 5000,
          request = element.attribs.src.indexOf('https') === 0 ? https : http;

      called = false;

      // We need the user-agent, otherwise some https request may fail (e. g. cloudfare)
      options.headers = { 'User-Agent': 'Mozilla/5.0' };

      return request.get(options, function (response) {
        var chunks = [];
        response.on('data', function (chunk) {
          chunks.push(chunk);
        }).on('end', function () {
            try {
                var dimensions = sizeOf(Buffer.concat(chunks));
                element.attribs.width = dimensions.width;
                element.attribs.height = dimensions.height;

                return getLayoutAttribute(element);
            } catch (err) {
                if (called) return;
                called = true;

                // revert this element, do not show
                element.name = 'img';
                return enter();
            }
        });
      }).on('socket', function (socket) {
        socket.setTimeout(timeout);
        socket.on('timeout', function () {
            if (called) return;
            called = true;

            // revert this element, do not show
            element.name = 'img';
            return enter();
        });
      }).on('error', function () {
        if (called) return;
        called = true;

        // revert this element, do not show
        element.name = 'img';
        return enter();
      });
    }

    if ((element.name === 'img' || element.name === 'iframe') && !element.attribs.src) {
      return enter();
    }

    if (element.name === 'img' && miperize.config['mip-img']) {
      // when we have a gif it should be <amp-anim>.
      element.name = element.attribs.src.match(/(\.gif$)/) ? 'mip-anim' : 'mip-img';

      if (!element.attribs.width || !element.attribs.height || !element.attribs.layout) {
        if (element.attribs.src.indexOf('http') === 0) {
            return getImageSize(element);
        }
      }
      // Fallback to default values for a local image
      element.attribs.width = miperize.config['mip-img'].width;
      element.attribs.height = miperize.config['mip-img'].height;
      return getLayoutAttribute(element);
    }

    if (element.name ==='iframe') {
      element.name = 'mip-iframe';

      if (!element.attribs.width || !element.attribs.height || !element.attribs.layout) {

        element.attribs.width = !element.attribs.width ? miperize.config['mip-iframe'].width : element.attribs.width;
        element.attribs.height = !element.attribs.height ? miperize.config['mip-iframe'].height : element.attribs.height;
        element.attribs.sandbox = !element.attribs.sandbox ? miperize.config['mip-iframe'].sandbox : element.attribs.sandbox;

        useSecureSchema(element);

        return getLayoutAttribute(element);
      }
    }

    if (element.name === 'audio') {
        element.name = 'mip-audio';
    }

    useSecureSchema(element);

    return enter();
  }, done);
};

module.exports = Miperize;
