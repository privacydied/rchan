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
    cp.execFile('ffprobe', ['-v', 'error', '-show_entries', 'format=duration',
      '-of', 'default=noprint_wrappers=1:nokey=1', path], function (e, dur) {
      var d = parseFloat(dur), seek = 0;
      if (percentage > 0 && percentage < 100 && d > 0) { seek = d * (percentage / 100); }
      cp.execFile('ffmpeg', ['-y', '-ss', seek.toFixed(2), '-i', path,
        '-vframes', '1', '-vf', 'scale=' + width + ':' + height, dest],
        function (err) { callback(err || null); });
    });
  };

  console.log('[fixvideothumbs] native thumbNailVideo replaced with ffmpeg');
};
