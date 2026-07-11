// rchan: patched copy — see docker-compose.yml's mount comment and
// deploy-fe.sh for why this needs its OWN ?v= cache-bust + lynxchan restart
// (a stale Cloudflare edge PoP can otherwise pin pre-edit content to a
// "fresh" hashed URL for up to an hour if the two restart steps ever race).
var catalog = {};

catalog.init = function() {

  catalog.catalogDiv = document.getElementById('divThreads');

  catalog.indicatorsRelation = {
    pinned : 'pinIndicator',
    locked : 'lockIndicator',
    cyclic : 'cyclicIndicator',
    autoSage : 'bumpLockIndicator'
  };

  catalog.refreshCheckBox = document
      .getElementById('autoCatalogRefreshCheckBox');
  catalog.refreshCheckBox.onchange = catalog.changeCatalogRefresh;
  // rchan: neither input has a <label>/aria-label in the engine template
  // (Lighthouse a11y "label" audit). Both are self-explanatory from their
  // adjacent text in the DOM, but that text isn't programmatically associated.
  catalog.refreshCheckBox.setAttribute('aria-label', 'Auto-refresh catalog');
  catalog.refreshLabel = document.getElementById('catalogRefreshLabel');
  catalog.originalAutoRefreshText = catalog.refreshLabel.innerHTML;
  catalog.searchField = document.getElementById('catalogSearchField');
  catalog.searchField.setAttribute('aria-label', 'Search catalog');

  var catalogCellTemplate = '<a class="linkThumb"></a>';
  catalogCellTemplate += '<p class="threadStats">R: ';
  catalogCellTemplate += '<span class="labelReplies"></span> / I: ';
  catalogCellTemplate += '<span class="labelImages"></span> / P: ';
  catalogCellTemplate += '<span class="labelPage"></span> ';
  catalogCellTemplate += '<span class="lockIndicator" title="Locked"></span> ';
  catalogCellTemplate += '<span class="pinIndicator" title="Sticky"></span> ';
  catalogCellTemplate += '<span class="cyclicIndicator" title="Cyclical Thread"></span> ';
  catalogCellTemplate += '<span class="bumpLockIndicator" title="Bumplocked"></span>';
  catalogCellTemplate += '</p><p><span class="labelSubject"></span></p>';
  catalogCellTemplate += '<div class="divMessage"></div>';

  catalog.catalogCellTemplate = catalogCellTemplate;

  var storedHidingData = localStorage.hidingData;

  if (storedHidingData) {
    storedHidingData = JSON.parse(storedHidingData);
  } else {
    storedHidingData = {};
  }

  catalog.storedHidingData = storedHidingData;

  catalog.initCatalog();

};

catalog.startTimer = function(time) {

  if (time > 600) {
    time = 600;
  }

  catalog.currentRefresh = time;
  catalog.lastRefresh = time;
  catalog.refreshLabel.innerHTML = catalog.originalAutoRefreshText + ' '
      + catalog.currentRefresh;
  catalog.refreshTimer = setInterval(function checkTimer() {

    // rchan: hidden tabs run the countdown at 1/5 speed, so a parked catalog
    // tab hits catalog.json ~5x less often; normal cadence resumes the moment
    // the tab is visible again. (The liveness badge in ux.js diffs off
    // whatever refreshes DO happen, so background title badges still work.)
    if (document.hidden) {
      catalog.hiddenTicks = (catalog.hiddenTicks || 0) + 1;
      if (catalog.hiddenTicks % 5) {
        return;
      }
    }

    catalog.currentRefresh--;

    if (!catalog.currentRefresh) {
      clearInterval(catalog.refreshTimer);
      catalog.refreshCatalog();
      catalog.refreshLabel.innerHTML = catalog.originalAutoRefreshText;
    } else {
      catalog.refreshLabel.innerHTML = catalog.originalAutoRefreshText + ' '
          + catalog.currentRefresh;
    }

  }, 1000);
};

catalog.changeCatalogRefresh = function() {

  catalog.autoRefresh = catalog.refreshCheckBox.checked;

  if (!catalog.autoRefresh) {
    catalog.refreshLabel.innerHTML = catalog.originalAutoRefreshText;
    clearInterval(catalog.refreshTimer);
  } else {
    catalog.startTimer(5);
  }

};

catalog.getHiddenMedia = function() {

  var hiddenMedia = localStorage.hiddenMedia;

  if (hiddenMedia) {
    hiddenMedia = JSON.parse(hiddenMedia);
  } else {
    hiddenMedia = [];
  }

  return hiddenMedia;

};

catalog.refreshCatalog = function(manual) {

  if (catalog.autoRefresh) {
    clearInterval(catalog.refreshTimer);
  }

  var currentData = JSON.stringify(catalog.catalogThreads);

  catalog.getCatalogData(function refreshed(error) {

    if (error) {
      return;
    }

    var changed = currentData != JSON.stringify(catalog.catalogThreads);

    if (catalog.autoRefresh) {
      catalog.startTimer(manual || changed ? 5 : catalog.lastRefresh * 2);
    }

    // rchan: this used to call catalog.search() unconditionally on every
    // auto-refresh tick (every 5s by default), which wipes and rebuilds every
    // catalog cell's DOM from scratch — even when `changed` says the fetched
    // data is byte-identical to what's already on screen. Every one of those
    // no-op rebuilds also fans out through ux.js's full re-decoration pass
    // (MutationObserver -> refresh()), so an idle catalog tab was paying the
    // full render+decorate cost every 5 seconds for literally nothing. Only
    // redraw when the data actually changed, or the user explicitly asked for
    // a refresh (manual) — a stale-but-unclicked search filter still applies
    // correctly since typing in the search field triggers its own search()
    // call independent of this one.
    if (manual || changed) {
      catalog.search();
    }

  });

};

catalog.initCatalog = function() {

  catalog.changeCatalogRefresh();

  // rchan: our clean-URL router serves this page at /<board>/catalog (no
  // .html) — same "trailing .html stripped" issue already fixed in
  // tooltips.js's quote-href regexes. Make it optional so this doesn't throw
  // on a null match and silently break the rest of initCatalog().
  api.boardUri = window.location.toString().match(/\/(\w+)\/catalog(?:\.html)?/)[1];

  document.getElementById('divTools').style.display = 'inline-block';

  document.getElementById('catalogRefreshButton').onclick = function() {
    catalog.refreshCatalog(true)
  };

  catalog.searchField.addEventListener('input', function() {

    if (catalog.searchTimer) {
      clearTimeout(catalog.searchTimer);
    }

    catalog.searchTimer = setTimeout(function() {
      delete catalog.searchTime;
      catalog.search();
    }, 1000);

  });

  var postingForm = document.getElementById('newPostFieldset');

  if (postingForm) {

    var toggleLink = document.getElementById('togglePosting');
    toggleLink.style.display = 'inline-block';
    postingForm.style.display = 'none';

    toggleLink.onclick = function() {
      toggleLink.style.display = 'none';
      postingForm.style.display = 'inline-block';
    };
  }

  var links = document.getElementsByClassName('linkThumb');

  for (var i = links.length - 1; i >= 0; i--) {

    var link = links[i];

    var child = link.childNodes[0];

    var matches = link.href.match(/(\w+)\/res\/(\d+)/);

    var board = matches[1];
    var thread = matches[2];

    var boardData = catalog.storedHidingData[board];

    if (boardData && boardData.threads.indexOf(thread) > -1) {
      var cell = link.parentNode;

      cell.parentNode.removeChild(cell);
    } else if (child.tagName === 'IMG') {
      catalog.checkForFileHiding(child);
    }

  }

  catalog.getCatalogData();

};

catalog.checkForFileHiding = function(child) {

  var srcParts = child.src.split('/');

  var hiddenMedia = catalog.getHiddenMedia();

  var finalPart = srcParts[srcParts.length - 1].substr(2);

  for (var j = 0; j < hiddenMedia.length; j++) {

    if (hiddenMedia[j].indexOf(finalPart) > -1) {
      child.parentNode.innerHTML = 'Open';
      break;
    }

  }
};

catalog.setCellThumb = function(thumbLink, thread) {
  thumbLink.href = '/' + api.boardUri + '/res/' + thread.threadId + '.html';
  // rchan: accessible name for the card link (Lighthouse image-alt/link-name).
  // The image is decorative (redundant with the subject/message text right
  // below it in the same cell), so alt="" is correct — but the anchor itself
  // still needs a name since it has no other text.
  thumbLink.setAttribute('aria-label', 'Thread ' + thread.threadId
      + (thread.subject ? ': ' + thread.subject : ''));

  if (thread.thumb) {
    var thumbImage = document.createElement('img');

    thumbImage.src = thread.thumb;
    thumbImage.alt = '';
    thumbLink.appendChild(thumbImage);
    catalog.checkForFileHiding(thumbImage);
  } else {
    thumbLink.innerHTML = 'Open';
  }
};

catalog.setCatalogCellIndicators = function(thread, cell) {

  for ( var key in catalog.indicatorsRelation) {
    if (!thread[key]) {
      cell.getElementsByClassName(catalog.indicatorsRelation[key])[0].remove();
    }
  }

};

catalog.setCell = function(thread) {

  var cell = document.createElement('div');

  cell.innerHTML = catalog.catalogCellTemplate;
  cell.className = 'catalogCell';

  catalog.setCellThumb(cell.getElementsByClassName('linkThumb')[0], thread);

  var labelReplies = cell.getElementsByClassName('labelReplies')[0];
  labelReplies.innerHTML = thread.postCount || 0;

  var labelImages = cell.getElementsByClassName('labelImages')[0];
  labelImages.innerHTML = thread.fileCount || 0;
  cell.getElementsByClassName('labelPage')[0].innerHTML = thread.page;

  if (thread.subject) {
    cell.getElementsByClassName('labelSubject')[0].innerHTML = thread.subject;
  }

  catalog.setCatalogCellIndicators(thread, cell);

  cell.getElementsByClassName('divMessage')[0].innerHTML = thread.markdown;

  return cell;

};

catalog.search = function() {

  if (!catalog.catalogThreads) {
    return;
  }

  var term = catalog.searchField.value.toLowerCase();

  while (catalog.catalogDiv.firstChild) {
    catalog.catalogDiv.removeChild(catalog.catalogDiv.firstChild);
  }

  var boardData = catalog.storedHidingData[api.boardUri];

  for (var i = 0; i < catalog.catalogThreads.length; i++) {

    var thread = catalog.catalogThreads[i];

    if ((boardData && boardData.threads.indexOf(thread.threadId.toString()) > -1)
        || (term.length && thread.message.toLowerCase().indexOf(term) < 0 && (thread.subject || '')
            .toLowerCase().indexOf(term) < 0)) {
      continue;
    }

    catalog.catalogDiv.appendChild(catalog.setCell(thread));

  }

};

catalog.getCatalogData = function(callback) {

  if (catalog.loadingData) {
    return;
  }

  catalog.loadingData = true;

  api.localRequest('/' + api.boardUri + '/catalog.json', function gotBoardData(
      error, data) {

    catalog.loadingData = false;

    if (error) {
      if (callback) {
        callback(error);
      } else {
        console.log(error);
      }
      return;
    }

    catalog.catalogThreads = JSON.parse(data);
    if (callback) {
      callback();
    }

  });

};

catalog.init();