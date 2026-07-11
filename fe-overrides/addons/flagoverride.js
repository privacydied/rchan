'use strict';

// flagoverride — admin-only manual flag selection on new threads/replies.
//
// A privileged poster may submit a `flagOverride` field (an ISO country code,
// e.g. "US") with newThread/replyThread. If — and only if — the requesting
// ACCOUNT's global role passes the threshold, the post's flag is forced to
// that country flag instead of the automatic geoip one. Board custom flags
// keep flowing through the engine's native `flag` field + validation.
//
// ┌─────────────────────── SECURITY BOUNDARY ────────────────────────┐
// │ The gate lives HERE, server-side, in wrappers around             │
// │ postingOps.thread.newThread and postingOps.post.newPost — the    │
// │ single entry points every posting path uses (form, JSON api,     │
// │ TOR/no-JS). The client dropdown is purely cosmetic.              │
// │  1. Any client-supplied `geo:` marker in the native flag field   │
// │     is stripped unconditionally (no smuggling for anyone).       │
// │  2. `flagOverride` is removed from parameters before the engine  │
// │     sees it, and only re-applied as a `geo:` marker AFTER:       │
// │       - userData exists (authenticated account, not anon/TOR)    │
// │       - userData.globalRole <= flagOverrideMinRole (default 1 =  │
// │         root + admin; tunable in settings/general.json)          │
// │       - the code is a real flag file baked into the fe           │
// │  3. Unauthorized/invalid values are dropped SILENTLY — the post  │
// │     proceeds with normal automatic flag logic, never a 500.      │
// └───────────────────────────────────────────────────────────────────┘

var fs = require('fs');
var path = require('path');

var thread = require('../engine/postingOps/thread');
var post = require('../engine/postingOps/post');
var common = require('../engine/postingOps/common');

exports.engineVersion = '2.3';

var MARKER = 'geo:';
var minRole = 1;                 // default: root(0) + admin(1)
var validCodes = {};             // { 'US': true, ... } from the shipped flag PNGs

var regionNames;
try { regionNames = new Intl.DisplayNames(['en'], { type: 'region' }); } catch (e) { regionNames = null; }
function countryName(code) {
  try { return (regionNames && regionNames.of(code)) || code; } catch (e) { return code; }
}

// The whitelist comes from the actual flag files shipped with the front-end,
// so a validated code can never point at a missing image.
function loadValidCodes() {
  try {
    var dir = path.join(__dirname, '../../fe/static/flags');
    fs.readdirSync(dir).forEach(function (f) {
      var m = f.match(/^([a-z]{2})\.png$/);
      if (m) { validCodes[m[1].toUpperCase()] = true; }
    });
  } catch (e) {
    // Same graceful-degrade contract as geoflags.js: a missing/renamed flags
    // dir must not crash addon init (which would silently wrap NOTHING and
    // vanish the entire feature) -- it just means validCodes stays empty, so
    // applyOverride()'s validCodes[code] check always falls back to auto.
    console.log('[flagoverride] could not load flag whitelist: ' + e.message);
  }
}

function loadMinRole() {
  // Read general.json directly: the engine's settings loader strips keys it
  // doesn't know about, so a custom setting can't ride settingsHandler.
  try {
    var raw = fs.readFileSync(path.join(__dirname, '../settings/general.json'));
    var parsed = JSON.parse(raw);
    if (typeof parsed.flagOverrideMinRole === 'number') {
      minRole = parsed.flagOverrideMinRole;
    }
  } catch (e) { /* keep default */ }
}

// SECURITY: decides whether the requester may override at all.
function allowed(userData) {
  return !!userData && typeof userData.globalRole === 'number'
      && userData.globalRole <= minRole;
}

// Shared pre-processing for both posting entry points.
function applyOverride(userData, parameters) {

  if (!parameters) { return; }

  // (0) "No location" (noFlag) is staff-only: strip it from every request
  // that doesn't pass the role gate, so normal posters can never hide
  // their location flag (the form checkbox is hidden for them too, but
  // this is the enforcement).
  if (!allowed(userData)) {
    delete parameters.noFlag;
  }

  // (1) nobody gets to hand-craft the internal marker through the native field
  if (typeof parameters.flag === 'string'
      && parameters.flag.indexOf(MARKER) === 0) {
    delete parameters.flag;
  }

  // (2) consume the override field so the engine never sees it
  var wanted = parameters.flagOverride;
  delete parameters.flagOverride;

  if (!wanted || wanted === 'auto') { return; }

  // (3) the actual privilege check — server-side, per request
  if (!allowed(userData)) { return; }          // silently fall back to auto

  var code = String(wanted).trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(code) || !validCodes[code]) { return; }  // unknown -> auto

  // authorized + validated: pass through the flag funnel as a marker
  parameters.flag = MARKER + code;
}

exports.init = function () {

  loadValidCodes();
  loadMinRole();

  // --- entry-point wrappers (cover form api, json api and TOR/no-JS) ---
  var origNewThread = thread.newThread;
  thread.newThread = function (req, userData, parameters, captchaId, cb) {
    try { applyOverride(userData, parameters); } catch (e) { /* never block posting */ }
    origNewThread(req, userData, parameters, captchaId, cb);
  };

  var origNewPost = post.newPost;
  post.newPost = function (req, userData, parameters, captchaId, callback) {
    try { applyOverride(userData, parameters); } catch (e) { /* never block posting */ }
    origNewPost(req, userData, parameters, captchaId, callback);
  };

  // --- flag resolution: turn the (server-set) marker into a country flag.
  // Output shape matches geoflags exactly (url, name, code), so the rendered
  // markup is indistinguishable from an automatic flag.
  var origGetFlagUrl = common.getFlagUrl;
  common.getFlagUrl = function (flagId, ip, boardData, noFlag, callback) {
    if (typeof flagId === 'string' && flagId.indexOf(MARKER) === 0) {
      var code = flagId.substring(MARKER.length);
      if (validCodes[code]) {
        return callback('/.static/flags/' + code.toLowerCase() + '.png',
            countryName(code), code);
      }
    }
    origGetFlagUrl(flagId, ip, boardData, noFlag, callback);
  };

  console.log('[flagoverride] admin flag override enabled (globalRole <= '
      + minRole + ', ' + Object.keys(validCodes).length + ' flags)');
};
