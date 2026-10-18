/* combined doc-app: N reports, one file, scoped per .docapp
   Data-driven — does NOT hardcode report keys, titles, defaults, or DOC_BY_HASH.
   Titles are read from `.dswitch[data-title]` (written by the packer).
   Default is whichever `.docapp[data-default="true"]` exists (first one wins).
   DOC_BY_HASH for any report key K covers both `K` and `doc-K`, built at runtime
   from `.docapp[data-doc]`.
*/
(function(){
  // ---- locate every packed report ----
  var docApps = Array.prototype.slice.call(document.querySelectorAll(".docapp"));
  var docSwitches = Array.prototype.slice.call(document.querySelectorAll(".dswitch"));
  if (!docApps.length) return;

  // ---- DOC_BY_HASH (built from .docapp[data-doc]) ----
  var DOC_BY_HASH = {};
  docApps.forEach(function(root){
    var k = root.dataset.doc;
    DOC_BY_HASH[k] = k;
    DOC_BY_HASH["doc-" + k] = k;
  });

  // ---- DOCS keyed per .docapp (OWNER/TABS/PANELS/TOCS scoped to *this* root) ----
  // Panel/toc lookups are always inside `root`, never `document.getElementById`, so
  // tab ids that collided and were prefixed (e.g. `tab-ov` -> `plan-tab-ov`) still resolve.
  var DOCS = {};
  docApps.forEach(function(root){
    var key = root.dataset.doc;
    var TABS = Array.prototype.slice.call(root.querySelectorAll(".tab"));
    var PANELS = {}, TOCS = {}, OWNER = {};
    TABS.forEach(function(t){
      var k = t.dataset.tab;
      // IMPORTANT: scope to `root` so a prefixed `panel-X` / [data-toc="X"] inside
      // this report maps to its own tab, not some other report's tab.
      var panel = root.querySelector('[role="tabpanel"][aria-labelledby="' + t.id + '"]')
               || root.querySelector("#panel-" + k);
      var toc = root.querySelector('[data-toc="' + k + '"]');
      if (panel) {
        PANELS[k] = panel;
        Array.prototype.slice.call(panel.querySelectorAll("[id]")).forEach(function(el){ OWNER[el.id] = k; });
      }
      if (toc) TOCS[k] = toc;
    });
    DOCS[key] = {
      root: root, TABS: TABS, PANELS: PANELS, TOCS: TOCS, OWNER: OWNER,
      current: null, observer: null,
      toggle: root.querySelector(".toctoggle"),
      tocpanel: root.querySelector(".tocpanel"),
      title: (function(){ var btn = document.querySelector('.dswitch[data-doc="' + key + '"]'); return btn ? btn.dataset.title : ""; })()
    };
  });

  // ---- default = the .docapp with data-default="true" (set by the packer) ----
  var defaultKey = (function(){
    for (var i = 0; i < docApps.length; i++) {
      if (docApps[i].dataset.default === "true") return docApps[i].dataset.doc;
    }
    return docApps[0].dataset.doc;
  })();

  var currentDoc = null;

  function sectionsIn(doc, key){
    return Array.prototype.slice.call(doc.PANELS[key].querySelectorAll("[id]"))
      .filter(function(el){ return doc.TOCS[key].querySelector('a[data-sec="' + el.id + '"]'); });
  }

  function spy(doc, key){
    if (doc.observer) doc.observer.disconnect();
    var links = {};
    Array.prototype.slice.call(doc.TOCS[key].querySelectorAll("a[data-sec]")).forEach(function(a){ links[a.dataset.sec] = a; });
    var visible = [];
    doc.observer = new IntersectionObserver(function(entries){
      entries.forEach(function(e){
        var i = visible.indexOf(e.target);
        if (e.isIntersecting) { if (i < 0) visible.push(e.target); }
        else if (i >= 0) visible.splice(i, 1);
      });
      if (!visible.length) return;
      visible.sort(function(a,b){ return a.getBoundingClientRect().top - b.getBoundingClientRect().top; });
      var id = visible[0].id;
      Object.keys(links).forEach(function(k){ links[k].classList.toggle("active", k === id); });
      var act = links[id];
      if (act && act.offsetParent) {
        var box = act.closest("aside");
        if (box && box.scrollHeight > box.clientHeight) {
          var r = act.getBoundingClientRect(), br = box.getBoundingClientRect();
          if (r.top < br.top + 8 || r.bottom > br.bottom - 8) act.scrollIntoView({ block: "nearest" });
        }
      }
    }, { rootMargin: "-130px 0px -66% 0px", threshold: 0 });
    sectionsIn(doc, key).forEach(function(el){ doc.observer.observe(el); });
  }

  function select(docKey, key, opts){
    opts = opts || {};
    var doc = DOCS[docKey];
    if (!doc || !doc.PANELS[key]) return;
    if (key === doc.current) {
      if (opts.focusPanel) doc.PANELS[key].focus({preventScroll:true});
      return;
    }
    doc.TABS.forEach(function(t){
      var on = t.dataset.tab === key;
      t.setAttribute("aria-selected", on ? "true" : "false");
      t.tabIndex = on ? 0 : -1;
      doc.PANELS[t.dataset.tab].hidden = !on;
      doc.TOCS[t.dataset.tab].hidden = !on;
    });
    doc.root.querySelectorAll(".tocnav a.active").forEach(function(a){ a.classList.remove("active"); });
    doc.current = key;
    spy(doc, key);
    if (opts.scrollTop !== false) window.scrollTo({ top: 0, behavior: opts.smooth ? "smooth" : "auto" });
    if (opts.focusTab) {
      var target = null;
      for (var ti = 0; ti < doc.TABS.length; ti++) if (doc.TABS[ti].dataset.tab === key) { target = doc.TABS[ti]; break; }
      if (target) target.focus();
    }
  }

  function setSwitch(docKey){
    docSwitches.forEach(function(b){
      var on = b.dataset.doc === docKey;
      b.setAttribute("aria-selected", on ? "true" : "false");
    });
    var title = DOCS[docKey] && DOCS[docKey].title;
    if (title) document.title = title;
  }

  function showDoc(docKey, opts){
    opts = opts || {};
    if (!DOCS[docKey]) return;
    Object.keys(DOCS).forEach(function(k){ DOCS[k].root.hidden = k !== docKey; });
    setSwitch(docKey);
    var switched = currentDoc !== docKey;
    currentDoc = docKey;
    if (!DOCS[docKey].current) select(docKey, DOCS[docKey].TABS[0].dataset.tab, { scrollTop: false });
    if (switched && opts.scrollTop !== false) window.scrollTo({ top: 0, behavior: "auto" });
  }

  function locate(id){
    if (!id) return null;
    if (DOC_BY_HASH[id]) return { doc: DOC_BY_HASH[id], tab: null, el: document.getElementById("doc-" + DOC_BY_HASH[id]) };
    var keys = Object.keys(DOCS);
    for (var i = 0; i < keys.length; i++) {
      var d = DOCS[keys[i]];
      if (d.OWNER[id]) return { doc: keys[i], tab: d.OWNER[id], el: document.getElementById(id) };
      if (d.PANELS[id]) return { doc: keys[i], tab: id, el: d.PANELS[id] };
    }
    return null;
  }

  function afterLayout(fn, delay) {
    delay = delay == null ? 80 : delay;
    requestAnimationFrame(function(){
      requestAnimationFrame(function(){
        setTimeout(fn, delay);
      });
    });
  }

  function scrollToTarget(el, instant) {
    if (!el) return;
    var root = document.documentElement;
    root.style.scrollBehavior = "auto";
    void el.offsetHeight;
    var margin = 128;
    var top = el.getBoundingClientRect().top;
    var y = top + window.pageYOffset - margin;
    var max = Math.max(document.body.scrollHeight, root.scrollHeight) - window.innerHeight;
    window.scrollTo({ top: Math.max(0, Math.min(y, max)), behavior: instant ? "auto" : "smooth" });
    return top;
  }

  function scrollToId(id, instant) {
    function tryScroll() {
      var el = document.getElementById(id);
      if (!el || el.classList.contains("docapp")) return;
      document.documentElement.style.scrollBehavior = "auto";
      void el.offsetHeight;
      var top = el.getBoundingClientRect().top;
      if (top >= 70 && top <= 180) return;
      scrollToTarget(el, instant);
    }
    tryScroll();
    [16, 50, 100, 200, 400].forEach(function(delay){
      afterLayout(tryScroll, delay);
    });
  }

  function goTo(id, smooth){
    var hit = locate(id);
    if (!hit) return false;
    var switchedDoc = hit.doc !== currentDoc;
    showDoc(hit.doc, { scrollTop: false });
    if (switchedDoc) window.scrollTo({ top: 0, behavior: "auto" });
    var switchedTab = false;
    if (hit.tab) {
      switchedTab = DOCS[hit.doc].current !== hit.tab;
      select(hit.doc, hit.tab, { scrollTop: false });
    }
    if (!hit.el || hit.el.classList.contains("docapp")) return true;
    var instant = switchedDoc || switchedTab || !smooth;
    scrollToId(id, instant);
    return true;
  }

  function closeMobileToc(){
    var doc = DOCS[currentDoc];
    if (!doc || !doc.toggle) return;
    if (getComputedStyle(doc.toggle).display === "none") return;
    doc.tocpanel.classList.remove("open");
    doc.toggle.setAttribute("aria-expanded", "false");
  }

  document.addEventListener("click", function(ev){
    var sw = ev.target.closest(".dswitch");
    if (sw) {
      ev.preventDefault();
      var k = sw.dataset.doc;
      showDoc(k);
      if (history.replaceState) history.replaceState(null, "", "#doc-" + k);
      return;
    }
    var app = ev.target.closest(".docapp");
    if (!app) return;
    var tab = ev.target.closest("[data-tab]");
    if (tab) {
      ev.preventDefault();
      select(app.dataset.doc, tab.dataset.tab, { smooth: tab.classList.contains("tab") === false });
      if (history.replaceState) history.replaceState(null, "", "#" + tab.dataset.tab);
      return;
    }
    var a = ev.target.closest('a[href^="#"]');
    if (!a) return;
    var id = decodeURIComponent(a.getAttribute("href").slice(1));
    if (!id) return;
    if (goTo(id, true)) {
      ev.preventDefault();
      if (history.replaceState) history.replaceState(null, "", "#" + id);
      closeMobileToc();
    }
  });

  window.addEventListener("hashchange", function(){
    var id = decodeURIComponent(location.hash.slice(1));
    if (id) goTo(id, true);
  });

  document.addEventListener("keydown", function(ev){
    if (ev.metaKey || ev.ctrlKey || ev.altKey) return;
    var t = ev.target;
    if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
    var doc = DOCS[currentDoc];
    if (!doc) return;
    var order = doc.TABS.map(function(x){ return x.dataset.tab; });
    if (/^[1-9]$/.test(ev.key)) {
      var k = order[+ev.key - 1];
      if (k) { ev.preventDefault(); select(currentDoc, k); }
      return;
    }
    if (t && t.classList && t.classList.contains("tab") && (ev.key === "ArrowRight" || ev.key === "ArrowLeft")) {
      ev.preventDefault();
      var i = order.indexOf(doc.current);
      var n = ev.key === "ArrowRight" ? (i + 1) % order.length : (i - 1 + order.length) % order.length;
      select(currentDoc, order[n], { focusTab: true });
    }
  });

  Object.keys(DOCS).forEach(function(k){
    var doc = DOCS[k];
    if (!doc.toggle) return;
    doc.toggle.addEventListener("click", function(){
      var open = doc.tocpanel.classList.toggle("open");
      doc.toggle.setAttribute("aria-expanded", open ? "true" : "false");
    });
  });

  var start = decodeURIComponent(location.hash.slice(1));
  var hit = start ? locate(start) : null;
  if (hit) {
    showDoc(hit.doc, { scrollTop: false });
    if (hit.tab) select(hit.doc, hit.tab, { scrollTop: false });
    if (!hit.el || !hit.el.classList.contains("docapp")) scrollToId(start, true);
  } else {
    showDoc(defaultKey);
  }
})();
