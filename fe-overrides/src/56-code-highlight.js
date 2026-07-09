  /* ---------- Code block syntax highlighting ----------
     The engine converts [code]...[/code] into a bare <code> with no language
     hint and no highlighting. Since there's no language tag to key off, this
     is a generic, hand-rolled tokenizer (no self-hosted highlight.js/prism —
     keeps the zero-dependency footprint) covering the token classes that read
     usefully across most C-like/scripting/SQL snippets: comments, strings,
     numbers, and a broad keyword union. Idempotent (data-hl guard) and re-run
     by refresh() alongside every other decorate* — so inline-quoted, live-WS,
     and infinite-scroll-appended posts get highlighted too. */
  var CODE_KEYWORDS = (function () {
    var words = ("if else elif for foreach while do switch case default break continue " +
      "return function func def fn lambda class struct interface enum trait impl " +
      "import export from package namespace using include require module " +
      "public private protected static final const let var void new delete " +
      "try catch finally throw throws raise except async await yield " +
      "true false null nil none undefined this self super extends implements " +
      "typeof instanceof in of is as not and or xor " +
      "int float double bool boolean string char byte long short " +
      "True False None end elsif puts print echo " +
      "SELECT FROM WHERE INSERT UPDATE DELETE JOIN INTO VALUES CREATE TABLE ALTER DROP " +
      "AND OR NOT NULL AS ORDER BY GROUP LIMIT").split(" ");
    var s = {};
    for (var i = 0; i < words.length; i++) { s[words[i]] = 1; }
    return s;
  })();
  // group order: (1) line comment, (2) block comment, (3) string, (4) number, (5) identifier
  var CODE_TOKEN_RE = /(\/\/[^\n]*|#[^\n]*)|(\/\*[\s\S]*?\*\/)|("(?:[^"\\\n]|\\.)*"|'(?:[^'\\\n]|\\.)*'|`(?:[^`\\]|\\.)*`)|(\b\d+\.?\d*(?:[eE][+-]?\d+)?\b)|(\b[A-Za-z_][A-Za-z0-9_]*\b)/g;
  function escHtmlCode(s) { return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }
  function highlightCode(rawText) {
    // escape the WHOLE string first, then tokenize the escaped text — so both
    // the matched tokens AND the untouched gaps between them (punctuation,
    // whitespace, operators) are safe to drop into innerHTML.
    return escHtmlCode(rawText).replace(CODE_TOKEN_RE, function (m, cmt1, cmt2, str, num, ident) {
      if (cmt1 || cmt2) { return '<span class="rchan-tok-cmt">' + m + "</span>"; }
      if (str) { return '<span class="rchan-tok-str">' + m + "</span>"; }
      if (num) { return '<span class="rchan-tok-num">' + m + "</span>"; }
      if (ident && CODE_KEYWORDS[ident]) { return '<span class="rchan-tok-kw">' + m + "</span>"; }
      return m;
    });
  }
  function decorateCodeBlocks(root) {
    var blocks = (root || document).querySelectorAll(".divMessage code");
    for (var i = 0; i < blocks.length; i++) {
      var el = blocks[i];
      if (el.getAttribute("data-hl")) { continue; }
      el.setAttribute("data-hl", "1");
      var raw = el.textContent;
      if (!raw || raw.length > 20000) { continue; }   // skip empty/pathologically huge blocks
      try { el.innerHTML = highlightCode(raw); } catch (e) { /* leave it plain on any surprise */ }
    }
  }
