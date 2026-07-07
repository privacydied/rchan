'use strict';

// geoflags — FAMFAMFAM country flags next to the poster name (like /pol/ and /int/).
//
// LynxChan has native country-flag support (per-board locationFlagMode=1, the 249 flag PNGs
// in /.static/flags/, and post-time flag rendering) but it needs a compiled GeoIP database +
// locationData/data.json, neither of which ship. This addon skips both: it overrides
// postingOps/common.getLocationFlagUrl to resolve the poster's IP -> country with geoip-lite
// (self-contained data) and returns /.static/flags/<code>.png at post time. Country names
// come from Intl.DisplayNames. Enable per board by setting locationFlagMode = 1.

var common = require('../engine/postingOps/common');

var geoip;
try { geoip = require('geoip-lite'); } catch (e) { geoip = null; }

var regionNames;
try { regionNames = new Intl.DisplayNames(['en'], { type: 'region' }); } catch (e) { regionNames = null; }

exports.engineVersion = '2.3';

// LynxChan hands the flag resolver the IP as an octet array (4 = v4, 16 = v6); geoip-lite
// wants a string. Handle array + already-string.
function ipStr(ip) {
  if (!ip) { return null; }
  if (typeof ip === 'string') { return ip; }
  if (Array.isArray(ip)) {
    if (ip.length === 4) { return ip.join('.'); }
    if (ip.length === 16) {
      var p = [];
      for (var i = 0; i < 16; i += 2) { p.push(((ip[i] << 8) | ip[i + 1]).toString(16)); }
      return p.join(':');
    }
  }
  return null;
}

function countryName(code) {
  try { return (regionNames && regionNames.of(code)) || code; } catch (e) { return code; }
}

exports.init = function () {
  if (!geoip) {
    console.log('[geoflags] geoip-lite unavailable — country flags disabled');
    return;
  }

  // callback signature matches the engine's: (flagUrl, flagName, flagCode)
  common.getLocationFlagUrl = function (ip, boardData, noFlag, callback) {
    var mode = boardData.locationFlagMode || 0;
    if (!ip || !mode || (mode === 1 && noFlag)) { return callback(); }
    try {
      var s = ipStr(ip);
      var g = s && geoip.lookup(s);
      if (g && g.country) {
        var code = String(g.country).toUpperCase();
        return callback('/.static/flags/' + code.toLowerCase() + '.png', countryName(code), code);
      }
    } catch (e) { /* fall through to no flag */ }
    callback();
  };

  console.log('[geoflags] country flags enabled (geoip-lite)');
};
