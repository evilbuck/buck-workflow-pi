/* combined doc-app: N reports, one file, scoped per .docapp
   Data-driven — does NOT hardcode report keys, titles, defaults, or DOC_BY_HASH.
   Titles are read from `.dswitch[data-title]` (written by the packer).
   Default is whichever `.docapp[data-default="true"]` exists (first one wins).
   DOC_BY_HASH for any report key K covers both `K` and `doc-K`, built at runtime
   from `.docapp[data-doc]`.

   TypeScript source: scripts/pack.ts strips these types with Bun's transpiler
   and inlines the plain-JS output into the packed file. The DOM surface is
   declared in ./app-types.ts (repo tsconfig has no DOM lib).
*/
import type {
  PackComputedStyle,
  PackDocument,
  PackElement,
  PackEvent,
  PackHistory,
  PackIntersectionEntry,
  PackIntersectionObserver,
  PackIntersectionObserverCtor,
  PackLocation,
  PackWindow,
} from "./app-types.js";

// Ambient browser globals for this module. The `import type` above makes this
// file a module, so these declares stay file-scoped and are erased together
// with the types when pack.ts inlines the transpiled output.
declare const document: PackDocument;
declare const window: PackWindow;
declare const location: PackLocation;
declare const history: PackHistory;
declare const IntersectionObserver: PackIntersectionObserverCtor;
declare function getComputedStyle(el: PackElement): PackComputedStyle;
declare function requestAnimationFrame(fn: () => void): number;

/** Runtime state for one packed report (one .docapp root). */
interface PackDoc {
  root: PackElement;
  TABS: PackElement[];
  PANELS: Record<string, PackElement>;
  TOCS: Record<string, PackElement>;
  OWNER: Record<string, string>;
  current: string | null;
  observer: PackIntersectionObserver | null;
  toggle: PackElement | null;
  tocpanel: PackElement | null;
  title: string;
}

/** Result of locating a hash/id across all packed reports. */
interface DocHit {
  doc: string;
  tab: string | null;
  el: PackElement | null;
}

interface SelectOpts {
  focusPanel?: boolean;
  scrollTop?: boolean;
  smooth?: boolean;
  focusTab?: boolean;
}

interface ShowOpts {
  scrollTop?: boolean;
}

(function(){
  // ---- locate every packed report ----
  var docApps: PackElement[] = Array.prototype.slice.call(document.querySelectorAll(".docapp"));
  var docSwitches: PackElement[] = Array.prototype.slice.call(document.querySelectorAll(".dswitch"));
  if (!docApps.length) return;

  // ---- DOC_BY_HASH (built from .docapp[data-doc]) ----
  var DOC_BY_HASH: Record<string, string> = {};
  docApps.forEach(function(root: PackElement){
    var k = root.dataset.doc;
    DOC_BY_HASH[k] = k;
    DOC_BY_HASH["doc-" + k] = k;
  });

  // ---- DOCS keyed per .docapp (OWNER/TABS/PANELS/TOCS scoped to *this* root) ----
  // Panel/toc lookups are always inside `root`, never `document.getElementById`, so
  // tab ids that collided and were prefixed (e.g. `tab-ov` -> `plan-tab-ov`) still resolve.
  function registerTab(root: PackElement, t: PackElement, PANELS: Record<string, PackElement>, TOCS: Record<string, PackElement>, OWNER: Record<string, string>): void {
    var k = t.dataset.tab;
    // Sanitized tab keys can collide within one report; keep each mapping distinct.
    if (PANELS[k] || TOCS[k]) {
      var n = 2;
      while (PANELS[k + "-" + n] || TOCS[k + "-" + n]) n++;
      k = k + "-" + n;
      t.dataset.tab = k;
    }
    var panel = root.querySelector('[role="tabpanel"][aria-labelledby="' + t.id + '"]')
             || root.querySelector("#panel-" + k);
    var toc = root.querySelector('[data-toc="' + k + '"]');
    if (panel) {
      PANELS[k] = panel;
      Array.prototype.slice.call(panel.querySelectorAll("[id]")).forEach(function(el: PackElement){ OWNER[el.id] = k; });
    }
    if (toc) TOCS[k] = toc;
  }
  var DOCS: Record<string, PackDoc> = {};
  docApps.forEach(function(root: PackElement){
    var key = root.dataset.doc;
    var TABS: PackElement[] = Array.prototype.slice.call(root.querySelectorAll(".tab"));
    var PANELS: Record<string, PackElement> = {}, TOCS: Record<string, PackElement> = {}, OWNER: Record<string, string> = {};
    TABS.forEach(function(t: PackElement){ registerTab(root, t, PANELS, TOCS, OWNER); });
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

  // Empty string behaves like the original `null` sentinel: DOCS[""] is
  // undefined, so every `DOCS[currentDoc]` guard fails until a report is shown.
  var currentDoc = "";

  function sectionsIn(doc: PackDoc, key: string): PackElement[] {
    return Array.prototype.slice.call(doc.PANELS[key].querySelectorAll("[id]"))
      .filter(function(el: PackElement){ return doc.TOCS[key].querySelector('a[data-sec="' + el.id + '"]'); });
  }

  function spy(doc: PackDoc, key: string): void {
    if (doc.observer) doc.observer.disconnect();
    var links: Record<string, PackElement> = {};
    Array.prototype.slice.call(doc.TOCS[key].querySelectorAll("a[data-sec]")).forEach(function(a: PackElement){ links[a.dataset.sec] = a; });
    var visible: PackElement[] = [];
    doc.observer = new IntersectionObserver(function(entries: PackIntersectionEntry[]){
      entries.forEach(function(e){
        var i = visible.indexOf(e.target);
        if (e.isIntersecting) { if (i < 0) visible.push(e.target); }
        else if (i >= 0) visible.splice(i, 1);
      });
      if (!visible.length) return;
      visible.sort(function(a, b){ return a.getBoundingClientRect().top - b.getBoundingClientRect().top; });
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
    sectionsIn(doc, key).forEach(function(el){ doc.observer?.observe(el); });
  }

  function setTabState(doc: PackDoc, key: string): void {
    doc.TABS.forEach(function(t){
      var on = t.dataset.tab === key;
      t.setAttribute("aria-selected", on ? "true" : "false");
      t.tabIndex = on ? 0 : -1;
      doc.PANELS[t.dataset.tab].hidden = !on;
      doc.TOCS[t.dataset.tab].hidden = !on;
    });
  }

  function clearTocNav(doc: PackDoc): void {
    doc.root.querySelectorAll(".tocnav a.active").forEach(function(a){ a.classList.remove("active"); });
  }

  function focusTab(doc: PackDoc, key: string): void {
    var target: PackElement | null = null;
    for (var ti = 0; ti < doc.TABS.length; ti++) if (doc.TABS[ti].dataset.tab === key) { target = doc.TABS[ti]; break; }
    if (target) target.focus();
  }

  function select(docKey: string, key: string, opts?: SelectOpts): void {
    opts = opts || {};
    var doc = DOCS[docKey];
    if (!doc || !doc.PANELS[key]) return;
    if (key === doc.current) {
      if (opts.focusPanel) doc.PANELS[key].focus({preventScroll:true});
      return;
    }
    setTabState(doc, key);
    clearTocNav(doc);
    doc.current = key;
    spy(doc, key);
    if (opts.scrollTop !== false) window.scrollTo({ top: 0, behavior: opts.smooth ? "smooth" : "auto" });
    if (opts.focusTab) focusTab(doc, key);
  }

  function setSwitch(docKey: string): void {
    docSwitches.forEach(function(b){
      var on = b.dataset.doc === docKey;
      b.setAttribute("aria-selected", on ? "true" : "false");
    });
    var title = DOCS[docKey] && DOCS[docKey].title;
    if (title) document.title = title;
  }

  function showDoc(docKey: string, opts?: ShowOpts): void {
    opts = opts || {};
    if (!DOCS[docKey]) return;
    Object.keys(DOCS).forEach(function(k){ DOCS[k].root.hidden = k !== docKey; });
    setSwitch(docKey);
    var switched = currentDoc !== docKey;
    currentDoc = docKey;
    if (!DOCS[docKey].current) select(docKey, DOCS[docKey].TABS[0].dataset.tab, { scrollTop: false });
    if (switched && opts.scrollTop !== false) window.scrollTo({ top: 0, behavior: "auto" });
  }

  function locate(id: string): DocHit | null {
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

  function afterLayout(fn: () => void, delay?: number): void {
    delay = delay == null ? 80 : delay;
    requestAnimationFrame(function(){
      requestAnimationFrame(function(){
        setTimeout(fn, delay);
      });
    });
  }

  function scrollToTarget(el: PackElement | null, instant: boolean): number | undefined {
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

  function scrollToId(id: string, instant: boolean): void {
    function tryScroll(): void {
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

  function goTo(id: string, smooth: boolean): boolean {
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

  function closeMobileToc(): void {
    var doc = DOCS[currentDoc];
    if (!doc || !doc.toggle || !doc.tocpanel) return;
    if (getComputedStyle(doc.toggle).display === "none") return;
    doc.tocpanel.classList.remove("open");
    doc.toggle.setAttribute("aria-expanded", "false");
  }

  function safeDecode(s: string): string {
    try { return decodeURIComponent(s); } catch (e) { return s; }
  }

  function followAnchor(ev: PackEvent, a: PackElement): void {
    // Selector guarantees href exists; "" only when the attribute is somehow gone.
    var id = safeDecode((a.getAttribute("href") ?? "").slice(1));
    if (!id) return;
    if (goTo(id, true)) {
      ev.preventDefault();
      if (history.replaceState) history.replaceState(null, "", "#" + id);
      closeMobileToc();
    }
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
    followAnchor(ev, a);
  });

  window.addEventListener("hashchange", function(){
    var id = safeDecode(location.hash.slice(1));
    if (id) goTo(id, true);
  });

  function digitTabSelect(ev: PackEvent, order: string[]): boolean {
    if (!/^[1-9]$/.test(ev.key)) return false;
    var k = order[+ev.key - 1];
    if (k) { ev.preventDefault(); select(currentDoc, k); }
    return true;
  }

  function tabArrowSelect(ev: PackEvent, doc: PackDoc, order: string[]): boolean {
    if (!(ev.target && ev.target.classList && ev.target.classList.contains("tab"))) return false;
    if (ev.key !== "ArrowRight" && ev.key !== "ArrowLeft") return false;
    ev.preventDefault();
    var i = order.indexOf(String(doc.current));
    var n = ev.key === "ArrowRight" ? (i + 1) % order.length : (i - 1 + order.length) % order.length;
    select(currentDoc, order[n], { focusTab: true });
    return true;
  }

  document.addEventListener("keydown", function(ev){
    if (ev.metaKey || ev.ctrlKey || ev.altKey) return;
    var t = ev.target;
    if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
    var doc = DOCS[currentDoc];
    if (!doc) return;
    var order = doc.TABS.map(function(x){ return x.dataset.tab; });
    if (digitTabSelect(ev, order)) return;
    tabArrowSelect(ev, doc, order);
  });

  Object.keys(DOCS).forEach(function(k){
    var doc = DOCS[k];
    // The packer emits .toctoggle and .tocpanel as a pair; skipping the lone
    // toggle preserves the legacy behavior of a null-deref guard.
    if (!doc.toggle || !doc.tocpanel) return;
    var toggle = doc.toggle;
    var tocpanel = doc.tocpanel;
    toggle.addEventListener("click", function(){
      var open = tocpanel.classList.toggle("open");
      toggle.setAttribute("aria-expanded", open ? "true" : "false");
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
