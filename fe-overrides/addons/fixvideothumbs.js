'use strict';

// fixvideothumbs — this LynxChan build's native thumbNailVideo is broken: it returns
// genericThumb even when dimensions are valid, while native getVideoBounds + image + captcha
// all work. Replace ONLY thumbNailVideo with an ffmpeg exec that writes the thumb frame to
// `dest`. Kept surgical so native still handles everything else (faster than full exec).
//
// NOTE: also requires "mediaThumb": true in general.json — without it LynxChan never measures
// or thumbnails video/audio at all (the real root cause of "no video thumbnails").

var kernel = require('../kernel');
var cp = require('child_process');

exports.engineVersion = '2.3';

exports.init = function () {
  var native = kernel.native;
  if (!native) { return; }   // native disabled -> engine already uses its own ffmpeg exec path

  // signature per uploadHandler.generateVideoThumb:
  // thumbNailVideo(path, dest, width, height, callback, audio, percentage)
  native.thumbNailVideo = function (path, dest, width, height, callback, audio, percentage) {
    // A crafted/malformed upload can make ffprobe or ffmpeg hang the decoder
    // indefinitely; without a timeout the callback never fires (stalling
    // that upload's thumbnail step forever) and the child process leaks
    // until manually killed. execFile treats a timeout as a normal error,
    // which the existing `function (err) { callback(err || null); }` path
    // already handles as a thumbnail failure.
    cp.execFile('ffprobe', ['-v', 'error', '-show_entries', 'format=duration',
      '-of', 'default=noprint_wrappers=1:nokey=1', path], { timeout: 15000 }, function (e, dur) {
      var d = parseFloat(dur), seek = 0;
      if (percentage > 0 && percentage < 100 && d > 0) { seek = d * (percentage / 100); }
      // ffmpeg's scale filter rejects a literal 0 (only -1/-2 mean "auto") --
      // an extreme source aspect ratio can floor one dimension to 0 in the
      // caller's own math, so clamp to at least 1px rather than handing
      // ffmpeg an invalid filter graph and failing the whole thumbnail.
      var w = Math.max(1, width | 0), h = Math.max(1, height | 0);
      cp.execFile('ffmpeg', ['-y', '-ss', seek.toFixed(2), '-i', path,
        '-vframes', '1', '-vf', 'scale=' + w + ':' + h, dest],
        { timeout: 30000 },
        function (err) { callback(err || null); });
    });
  };

  console.log('[fixvideothumbs] native thumbNailVideo replaced with ffmpeg');
};
