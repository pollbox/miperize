'use strict';

var chai = require('chai')
  , expect = chai.expect
  , sinon = require('sinon')
  , sinonChai = require('sinon-chai')
  , nock = require('nock')
  , rewire = require('rewire')
  , Miperize = rewire('../lib/miperize')
  , miperize;

chai.use(sinonChai);
chai.config.includeStack = true;

describe('Miperize', function () {
  beforeEach(function () {
    miperize = new Miperize();
  });

  afterEach(function () {
    miperize = void 0;
  });

  describe('is a module', function () {
    it('which has a constructor', function () {
      expect(Miperize).to.be.a('function');
    });

    it('which has default options', function () {
      expect(miperize).to.have.property('config');
      expect(miperize.config).to.be.eql({
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
      });
    });

    it('which can be configured', function () {
      var configurable = new Miperize({some: 'options'});
      expect(configurable).to.have.property('config');
      expect(configurable.config.some).to.be.equal('options');
    });

    it('which has htmlParser', function () {
      expect(miperize).to.have.property('htmlParser');
      expect(miperize.htmlParser).to.be.a('object');
    });

    it('which has #parse', function () {
      expect(miperize).to.have.property('parse');
      expect(miperize.parse).to.be.a('function');
    });

    it('which has #miperizer', function () {
      expect(miperize).to.have.property('miperizer');
      expect(miperize.miperizer).to.be.a('function');
    });
  });

  describe('#parse', function () {
    var sizeOfMock,
        sizeOfStub;

    beforeEach(function () {
        // stubbing the `image-size` lib, so we don't to a request everytime
        sizeOfStub = sinon.stub();
    });

    afterEach(function () {
        sinon.restore();
    });

    it('throws an error if no callback provided', function () {
      function err() {
        miperize.parse('', null);
      }

      expect(err).throws('No callback provided');
    });

    it('transforms small <img> into <mip-img></mip-img> with full image dimensions and fixed layout', function (done) {
      sizeOfMock = nock('http://static.wixstatic.com')
            .get('/media/355241_d31358572a2542c5a44738ddcb59e7ea.jpg_256')
            .reply(200, {
                data: '<Buffer 2c be a4 40 f7 87 73 1e 57 2c c1 e4 0d 79 03 95 42 f0 42 2e 41 95 27 c9 5c 35 a7 71 2c 09 5a 57 d3 04 1e 83 03 28 07 96 b0 c8 88 65 07 7a d1 d6 63 50>'
            });

      sizeOfStub.returns({width: 50, height: 50, type: 'jpg'});
      Miperize.__set__('sizeOf', sizeOfStub);

      miperize.parse('<img src="http://static.wixstatic.com/media/355241_d31358572a2542c5a44738ddcb59e7ea.jpg_256">', function (error, result) {
        expect(result).to.exist;
        expect(Miperize.__get__('called')).to.be.equal(false);
        expect(result).to.contain('<mip-img');
        expect(result).to.contain('src="http://static.wixstatic.com/media/355241_d31358572a2542c5a44738ddcb59e7ea.jpg_256"');
        expect(result).to.contain('layout="fixed"');
        expect(result).to.contain('width="50"');
        expect(result).to.contain('height="50"');
        expect(result).to.contain('</mip-img>');
        done();
      });
    });

    it('transforms big <img> into <mip-img></mip-img> with full image dimensions and responsive layout', function (done) {
      sizeOfMock = nock('http://static.wixstatic.com')
            .get('/media/355241_d31358572a2542c5a44738ddcb59e7ea.jpg_256')
            .reply(200, {
                data: '<Buffer 2c be a4 40 f7 87 73 1e 57 2c c1 e4 0d 79 03 95 42 f0 42 2e 41 95 27 c9 5c 35 a7 71 2c 09 5a 57 d3 04 1e 83 03 28 07 96 b0 c8 88 65 07 7a d1 d6 63 50>'
            });

      sizeOfStub.returns({width: 350, height: 200, type: 'jpg'});
      Miperize.__set__('sizeOf', sizeOfStub);

      miperize.parse('<img src="http://static.wixstatic.com/media/355241_d31358572a2542c5a44738ddcb59e7ea.jpg_256">', function (error, result) {
        expect(result).to.exist;
        expect(Miperize.__get__('called')).to.be.equal(false);
        expect(result).to.contain('<mip-img');
        expect(result).to.contain('src="http://static.wixstatic.com/media/355241_d31358572a2542c5a44738ddcb59e7ea.jpg_256"');
        expect(result).to.contain('layout="responsive"');
        expect(result).to.contain('width="350"');
        expect(result).to.contain('height="200"');
        expect(result).to.contain('</mip-img>');
        done();
      });
    });

    it('transforms .gif <img> with only height property into <mip-anim></mip-anim> with full dimensions by overriding them', function (done) {
      sizeOfMock = nock('https://media.giphy.com')
            .get('/media/l46CtzgjhTm29Cbjq/giphy.gif')
            .reply(200, {
                data: '<Buffer 2c be a4 40 f7 87 73 1e 57 2c c1 e4 0d 79 03 95 42 f0 42 2e 41 95 27 c9 5c 35 a7 71 2c 09 5a 57 d3 04 1e 83 03 28 07 96 b0 c8 88 65 07 7a d1 d6 63 50>'
            });

      sizeOfStub.returns({width: 800, height: 600, type: 'gif'});
      Miperize.__set__('sizeOf', sizeOfStub);

      miperize.parse('<img src="https://media.giphy.com/media/l46CtzgjhTm29Cbjq/giphy.gif" height="500">', function (error, result) {
        expect(result).to.exist;
        expect(Miperize.__get__('called')).to.be.equal(false);
        expect(result).to.contain('<mip-anim');
        expect(result).to.contain('src="https://media.giphy.com/media/l46CtzgjhTm29Cbjq/giphy.gif"');
        expect(result).to.contain('layout="responsive"');
        expect(result).to.contain('width="800"');
        expect(result).to.contain('height="600"');
        expect(result).to.contain('</mip-anim>');
        done();
      });
    });

    it('transforms <iframe> with only width property into <mip-iframe></mip-iframe> with full dimensions withour overriding them', function (done) {
      miperize.parse('<iframe src="https://www.youtube.com/embed/HMQkV5cTuoY" width="400"></iframe>', function (error, result) {
        expect(result).to.exist;
        expect(Miperize.__get__('called')).to.be.equal(false);
        expect(result).to.contain('<mip-iframe');
        expect(result).to.contain('src="https://www.youtube.com/embed/HMQkV5cTuoY"');
        expect(result).to.contain('layout="responsive"');
        expect(result).to.contain('width="400"');
        expect(result).to.contain('height="400"');
        expect(result).to.contain('</mip-iframe>');
        expect(result).to.contain('sandbox="allow-script allow-same-origin"')
        done();
      });
    });

    it('adds \'https\' protocol to <iframe> if no protocol is supplied (e. e. giphy)', function (done) {
      var url = '<iframe src="//giphy.com/embed/3oEduKP4VaUxJvLwuA" width="480" height="372" frameBorder="0" class="giphy-embed" allowFullScreen></iframe>';
      miperize.parse(url, function (error, result) {
        expect(result).to.exist;
        expect(Miperize.__get__('called')).to.be.equal(false);
        expect(result).to.contain('<mip-iframe');
        expect(result).to.contain('src="https://giphy.com/embed/3oEduKP4VaUxJvLwuA"');
        expect(result).to.contain('layout="responsive"');
        expect(result).to.contain('width="480"');
        expect(result).to.contain('height="372"');
        expect(result).to.contain('</mip-iframe>');
        expect(result).to.contain('sandbox="allow-script allow-same-origin"')
        done();
      });
    });

    it('adds \'https\' protocol to <iframe> if only \'http\' protocol is supplied', function (done) {
      var url = '<iframe src="http://giphy.com/embed/3oEduKP4VaUxJvLwuA" width="480" height="372" frameBorder="0" class="giphy-embed" allowFullScreen></iframe><p><a href="http://giphy.com/gifs/afv-funny-fail-lol-3oEduKP4VaUxJvLwuA">via GIPHY</a></p></p>';
      miperize.parse(url, function (error, result) {
        expect(result).to.exist;
        expect(Miperize.__get__('called')).to.be.equal(false);
        expect(result).to.contain('<mip-iframe');
        expect(result).to.contain('src="https://giphy.com/embed/3oEduKP4VaUxJvLwuA"');
        expect(result).to.contain('layout="responsive"');
        expect(result).to.contain('width="480"');
        expect(result).to.contain('height="372"');
        expect(result).to.contain('</mip-iframe>');
        expect(result).to.contain('sandbox="allow-script allow-same-origin"')
        done();
      });
    });

    it('transforms local <img> into <mip-img></mip-img> with default image dimensions', function (done) {
      miperize.parse('<img src="/content/images/IMG_xyz.jpg">', function (error, result) {
        expect(result).to.exist;
        expect(Miperize.__get__('called')).to.be.equal(false);
        expect(result).to.contain('<mip-img');
        expect(result).to.contain('src="/content/images/IMG_xyz.jpg"');
        expect(result).to.contain('layout="responsive"');
        expect(result).to.contain('width="600"');
        expect(result).to.contain('height="400"');
        expect(result).to.contain('</mip-img>');
        done();
      });
    });

    it('can handle <img> tag without src and does not transform it', function (done) {
      miperize.parse('<img><//img><p>some text here</p>', function (error, result) {
        expect(result).to.exist;
        expect(Miperize.__get__('called')).to.be.equal(false);
        expect(result).to.be.equal('<img><p>some text here</p>');
        done();
      });
    });

    it('can handle <iframe> tag without src and does not transform it', function (done) {
      miperize.parse('<iframe>', function (error, result) {
        expect(result).to.exist;
        expect(Miperize.__get__('called')).to.be.equal(false);
        expect(result).to.be.equal('<iframe></iframe>');
        done();
      });
    });

    it('transforms <audio> with a fallback to <mip-audio>', function (done) {
      miperize.parse('<audio src="http://foo.mp3" autoplay>Your browser does not support the <code>audio</code> element.</audio>', function (error, result) {
        expect(result).to.exist;
        expect(Miperize.__get__('called')).to.be.equal(false);
        expect(result).to.contain('<mip-audio src="https://foo.mp3" autoplay="">');
        expect(result).to.contain('Your browser does not support the <code>audio</code> element.');
        expect(result).to.contain('</mip-audio>');
        done();
      });
    });

    it('transforms <audio> with a <source> tag to <mip-audio> and maintains the attributes', function (done) {
      miperize.parse('<audio controls="controls" width="auto" height="50" autoplay="mobile">Your browser does not support the <code>audio</code> element.<source src="//foo.wav" type="audio/wav"></audio>', function (error, result) {
        expect(result).to.exist;
        expect(Miperize.__get__('called')).to.be.equal(false);
        expect(result).to.contain('<mip-audio');
        expect(result).to.contain('controls="controls" width="auto" height="50" autoplay="mobile"');
        expect(result).to.contain('<source src="https://foo.wav" type="audio/wav">');
        expect(result).to.contain('</mip-audio>');
        done();
      });
    });

    it('transforms <audio> with a <track> tag to <mip-audio>', function (done) {
      miperize.parse('<audio src="foo.ogg"><track kind="captions" src="https://foo.en.vtt" srclang="en" label="English"><track kind="captions" src="https://foo.sv.vtt" srclang="sv" label="Svenska"></audio>', function (error, result) {
        expect(result).to.exist;
        expect(Miperize.__get__('called')).to.be.equal(false);
        expect(result).to.contain('<mip-audio src="foo.ogg">');
        expect(result).to.contain('<track kind="captions" src="https://foo.en.vtt" srclang="en" label="English">');
        expect(result).to.contain('<track kind="captions" src="https://foo.sv.vtt" srclang="sv" label="Svenska">');
        expect(result).to.contain('</mip-audio>');
        done();
      });
    });

    it('can handle request errors', function (done) {
      var callCounts;
      sizeOfMock = nock('http://example.com')
            .get('/images/IMG_xyz.jpg')
            .replyWithError('something awful happened');

      miperize.parse('<img src="http://example.com/images/IMG_xyz.jpg">', function (error, result) {
        expect(Miperize.__get__('called')).to.be.equal(true);
        expect(error).to.be.null;
        expect(result).to.contain('<img src="http://example.com/images/IMG_xyz.jpg');
        done();
      });
    });

    it('can handle errors of image-size module', function (done) {
      sizeOfMock = nock('http://example.com')
            .get('/images/IMG_xyz.jpg')
            .reply(200, {
                data: '<Buffer 2c be a4 40 f7 87 73 1e 57 2c c1 e4 0d 79 03 95 42 f0 42 2e 41 95 27 c9 5c 35 a7 71 2c 09 5a 57 d3 04 1e 83 03 28 07 96 b0 c8 88 65 07 7a d1 d6 63 50>'
            });
      sizeOfStub.throws('error');
      Miperize.__set__('sizeOf', sizeOfStub);

      miperize.parse('<img src="http://example.com/images/IMG_xyz.jpg">', function (error, result) {
        expect(Miperize.__get__('called')).to.be.equal(true);
        expect(error).to.be.null;
        expect(result).to.contain('<img src="http://example.com/images/IMG_xyz.jpg');
        done();
      });
    });

    it('can handle timeout errors', function (done) {
      sizeOfMock = nock('http://example.com')
            .get('/images/IMG_xyz.jpg')
            .socketDelay(5500)
            .reply(200, {
                data: '<Buffer 2c be a4 40 f7 87 73 1e 57 2c c1 e4 0d 79 03 95 42 f0 42 2e 41 95 27 c9 5c 35 a7 71 2c 09 5a 57 d3 04 1e 83 03 28 07 96 b0 c8 88 65 07 7a d1 d6 63 50>'
            });

      miperize.parse('<img src="http://example.com/images/IMG_xyz.jpg">', function (error, result) {
        expect(Miperize.__get__('called')).to.be.equal(true);
        expect(error).to.be.null;
        expect(result).to.contain('<img src="http://example.com/images/IMG_xyz.jpg');
        done();
      });
    });

  });

  describe('#miperizer', function () {
    it('throws an error if HTML parsing failed', function () {
      function err() {
        miperize.miperizer('some error', []);
      }

      expect(err).throws('Miperizer failed to parse DOM');
    });

    it('should start traversing the DOM as soon as HTML parser is ready', function (done) {
      var emit = sinon.spy(miperize, 'emit');

      miperize.parse('<html><body></body></html>', function () {
        expect(emit).to.be.calledTwice;

        var first = emit.getCall(0).args;
        expect(first).to.be.an('array');
        expect(first[0]).to.be.equal('read');
        expect(first[1]).to.be.equal(null);
        expect(first[2]).to.be.an('array');

        var second = emit.getCall(1).args;
        expect(second).to.be.an('array');
        expect(second[0]).to.be.include('parsed');
        expect(second[1]).to.be.equal(null);
        expect(second[2]).to.be.equal('<html><body></body></html>');

        done();
      });
    });
  });
});
