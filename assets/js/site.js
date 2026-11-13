/* Chaereve — site interactivity */
(function () {
  "use strict";

  var body = document.body;
  var prefix = body.dataset.prefix || "";
  var $ = function (sel, root) { return (root || document).querySelector(sel); };
  var $$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };

  /* ---------------------------------------------------------- toast */
  var toastEl = $("#toast");
  var toastTimer = null;
  function toast(msg) {
    if (!toastEl) return;
    toastEl.textContent = msg;
    toastEl.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toastEl.hidden = true; }, 2600);
  }

  /* ---------------------------------------------------------- theme */
  var themeBtn = $("#themeToggle");
  if (themeBtn) {
    themeBtn.addEventListener("click", function () {
      var next = document.documentElement.getAttribute("data-theme") === "light" ? "dark" : "light";
      document.documentElement.setAttribute("data-theme", next);
      try { localStorage.setItem("chaereve-theme", next); } catch (e) {}
    });
  }

  /* ---------------------------------------------------------- header */
  var bar = $(".bar");
  if (bar) {
    var onScroll = function () { bar.classList.toggle("scrolled", window.scrollY > 4); };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
  }
  var menuBtn = $("#menuBtn");
  var mainNav = $("#mainNav");
  if (menuBtn && mainNav) {
    menuBtn.addEventListener("click", function () {
      var open = mainNav.classList.toggle("open");
      menuBtn.setAttribute("aria-expanded", String(open));
    });
    document.addEventListener("click", function (e) {
      if (!mainNav.classList.contains("open")) return;
      if (mainNav.contains(e.target) || menuBtn.contains(e.target)) return;
      mainNav.classList.remove("open");
      menuBtn.setAttribute("aria-expanded", "false");
    });
  }

  /* ---------------------------------------------------------- search */
  var INDEX = window.SEARCH_INDEX || [];

  function hl(text, q) {
    if (!q) return text;
    var i = text.toLowerCase().indexOf(q.toLowerCase());
    if (i < 0) return text;
    return text.slice(0, i) + "<mark>" + text.slice(i, i + q.length) + "</mark>" + text.slice(i + q.length);
  }

  function searchIndex(q) {
    q = q.trim().toLowerCase();
    if (!q) return [];
    return INDEX.filter(function (e) { return e.hay.indexOf(q) >= 0; });
  }

  var drop = $("#searchDrop");
  var input = $("#siteSearch");
  if (drop && input) {
    var active = -1;
    var results = [];

    function renderDrop() {
      var q = input.value.trim();
      results = searchIndex(q).slice(0, 8);
      active = -1;
      if (!q) { drop.hidden = true; drop.innerHTML = ""; return; }
      if (!results.length) {
        drop.innerHTML = '<div class="drop-none">No matches for “' + q.replace(/</g, "&lt;") + '”</div>';
      } else {
        drop.innerHTML = results.map(function (e, i) {
          return '<a href="' + prefix + e.url + '" data-i="' + i + '"><b>' + hl(e.title, q) + "</b><span>" + hl(e.sub, q) + "</span></a>";
        }).join("") +
          '<a href="' + prefix + "search.html?q=" + encodeURIComponent(q) + '"><b>See all results →</b></a>';
      }
      drop.hidden = false;
    }

    function moveActive(delta) {
      var links = $$("a[data-i]", drop);
      if (!links.length) return;
      active = (active + delta + links.length) % links.length;
      links.forEach(function (l, i) { l.classList.toggle("active", i === active); });
      links[active].scrollIntoView({ block: "nearest" });
    }

    input.addEventListener("input", renderDrop);
    input.addEventListener("focus", renderDrop);
    input.addEventListener("keydown", function (e) {
      if (e.key === "Escape") { drop.hidden = true; input.blur(); }
      else if (e.key === "ArrowDown") { e.preventDefault(); moveActive(1); }
      else if (e.key === "ArrowUp") { e.preventDefault(); moveActive(-1); }
      else if (e.key === "Enter") {
        var links = $$("a[data-i]", drop);
        if (active >= 0 && links[active]) { e.preventDefault(); links[active].click(); }
        else if (input.value.trim()) {
          e.preventDefault();
          window.location.href = prefix + "search.html?q=" + encodeURIComponent(input.value.trim());
        }
      }
    });
    document.addEventListener("click", function (e) {
      if (!drop.hidden && !drop.contains(e.target) && e.target !== input) drop.hidden = true;
    });
    drop.addEventListener("click", function () { drop.hidden = true; });
  }

  /* ---------------------------------------------------------- search page */
  var resultsBox = $("#searchResults");
  if (resultsBox) {
    var pageInput = $("#pageSearch");
    var countEl = $("#searchCount");

    function renderResults() {
      var q = pageInput.value.trim();
      var res = searchIndex(q);
      if (!q) {
        countEl.textContent = INDEX.length + " entries — type to filter";
        resultsBox.innerHTML = INDEX.slice(0, 20).map(function (e) {
          return '<a class="res" href="' + prefix + e.url + '"><b>' + e.title + "</b><span>" + e.sub + "</span></a>";
        }).join("");
        return;
      }
      countEl.textContent = res.length + " result" + (res.length === 1 ? "" : "s") + " for “" + q + "”";
      resultsBox.innerHTML = res.length
        ? res.map(function (e) {
            return '<a class="res" href="' + prefix + e.url + '"><b>' + hl(e.title, q) + "</b><span>" + hl(e.sub, q) + "</span></a>";
          }).join("")
        : '<p class="mu">Nothing found. Try a shorter query — or browse the <a href="' + prefix + 'artists.html">artist index</a>.</p>';
    }

    var q0 = new URLSearchParams(window.location.search).get("q") || "";
    pageInput.value = q0;
    renderResults();
    pageInput.addEventListener("input", renderResults);
  }

  /* ---------------------------------------------------------- home: tabs + older posts */
  var grid = $("#songGrid");
  if (grid) {
    var cards = $$(".card", grid);
    var tabs = $$(".tabs button");
    var olderWrap = $("#olderWrap");
    var olderBtn = $("#olderBtn");
    var expanded = false;
    var INITIAL = 8;

    function applyFilter() {
      var lang = ($(".tabs button.on") || {}).dataset ? $(".tabs button.on").dataset.filter : "All";
      var shown = 0;
      cards.forEach(function (c) {
        var match = lang === "All" || c.dataset.lang === lang;
        var limit = expanded || lang !== "All" || shown < INITIAL;
        c.classList.toggle("hidden", !(match && limit));
        if (match) shown++;
      });
      var total = cards.filter(function (c) {
        return lang === "All" || c.dataset.lang === lang;
      }).length;
      if (olderWrap) olderWrap.style.display = (expanded || lang !== "All" || total <= INITIAL) ? "none" : "";
    }

    tabs.forEach(function (t) {
      t.addEventListener("click", function () {
        tabs.forEach(function (x) { x.classList.remove("on"); });
        t.classList.add("on");
        applyFilter();
      });
    });
    if (olderBtn) {
      olderBtn.addEventListener("click", function () {
        expanded = true;
        applyFilter();
      });
    }
    applyFilter();
  }

  /* ---------------------------------------------------------- song page */
  var lyrWrap = $(".lyr-wrap");
  if (lyrWrap) {
    var lyr = $(".lyr", lyrWrap);

    /* member spotlight */
    $$(".lg .chip", lyrWrap).forEach(function (chip) {
      chip.addEventListener("click", function () {
        var who = chip.dataset.spot;
        var already = chip.classList.contains("on");
        $$(".lg .chip", lyrWrap).forEach(function (c) { c.classList.remove("on"); });
        if (!who || already) {
          lyr.classList.remove("spot");
          $$(".lr.line", lyr).forEach(function (l) { l.classList.remove("spot-on"); });
          var allChip = $('.lg .chip[data-spot=""]', lyrWrap);
          if (allChip) allChip.classList.add("on");
          return;
        }
        chip.classList.add("on");
        lyr.classList.add("spot");
        $$(".lr.line", lyr).forEach(function (l) {
          l.classList.toggle("spot-on", (l.dataset.who || "").indexOf(who) >= 0);
        });
      });
    });

  }

  /* ---------------------------------------------------------- artist index filter */
  var idxFilter = $("#idxFilter");
  if (idxFilter) {
    idxFilter.addEventListener("input", function () {
      var q = idxFilter.value.trim().toLowerCase();
      $$(".idx-row").forEach(function (row) {
        row.classList.toggle("hidden", q ? row.dataset.name.indexOf(q) < 0 : false);
      });
      $$(".idx-sec").forEach(function (sec) {
        var any = $$(".idx-row:not(.hidden)", sec).length > 0;
        sec.style.display = any ? "" : "none";
      });
    });
  }

})();
