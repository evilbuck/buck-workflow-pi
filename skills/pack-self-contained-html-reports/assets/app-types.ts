/**
 * app-types.ts — structural DOM/browser contract for assets/app.ts.
 *
 * The repo tsconfig has no DOM lib, and adding one (e.g. `/// <reference lib="dom" />`)
 * would leak DOM declarations program-wide, changing timer overload inference
 * (`ReturnType<typeof setTimeout>`, `NodeJS.Timeout`) in existing extension files.
 * These interfaces instead declare exactly the DOM surface app.ts touches, so
 * app.ts type-checks strictly while its transpiled output stays verbatim browser JS.
 *
 * Contract notes:
 * - `dataset` values are typed `string` (not `string | undefined`): the packer
 *   generates `data-doc`/`data-title`/`data-default` itself, and packed reports
 *   ship `data-tab`/`data-sec` on the elements app.ts selects for them.
 * - `PackEvent.target` is non-null: these handlers fire on interaction events
 *   whose target is an element inside the packed document.
 */

/** Subset of DOM rects used by the scroll spier. */
export interface PackRect {
  top: number;
  bottom: number;
}

export interface PackClassList {
  contains(token: string): boolean;
  add(...tokens: string[]): void;
  remove(...tokens: string[]): void;
  toggle(token: string, force?: boolean): boolean;
}

/** Inline style surface; app.ts only writes `scrollBehavior`. */
export interface PackStyle {
  scrollBehavior: string;
}

/** getComputedStyle surface; app.ts only reads `display`. */
export interface PackComputedStyle {
  display: string;
}

/**
 * One structural event type covering the click and keydown handlers
 * (click handlers never read the key flags; the keydown handler never
 * produces click-specific state).
 */
export interface PackEvent {
  target: PackElement;
  key: string;
  metaKey: boolean;
  ctrlKey: boolean;
  altKey: boolean;
  preventDefault(): void;
}

export interface PackIntersectionEntry {
  target: PackElement;
  isIntersecting: boolean;
}

export interface PackIntersectionObserver {
  disconnect(): void;
  observe(target: PackElement): void;
}

export interface PackIntersectionObserverCtor {
  new (
    callback: (entries: PackIntersectionEntry[]) => void,
    options: { rootMargin: string; threshold: number },
  ): PackIntersectionObserver;
}

export interface PackElement {
  id: string;
  tagName: string;
  tabIndex: number;
  hidden: boolean;
  offsetHeight: number;
  offsetParent: PackElement | null;
  clientHeight: number;
  scrollHeight: number;
  isContentEditable: boolean;
  dataset: Record<string, string>;
  classList: PackClassList;
  style: PackStyle;
  getAttribute(name: string): string | null;
  setAttribute(name: string, value: string): void;
  addEventListener(type: string, listener: (ev: PackEvent) => void): void;
  focus(options?: { preventScroll?: boolean }): void;
  scrollIntoView(options?: { block?: string }): void;
  closest(selector: string): PackElement | null;
  getBoundingClientRect(): PackRect;
  querySelector(selector: string): PackElement | null;
  querySelectorAll(selector: string): PackElement[];
}

export interface PackDocument {
  getElementById(id: string): PackElement | null;
  documentElement: PackElement;
  body: PackElement;
  title: string;
  querySelector(selector: string): PackElement | null;
  querySelectorAll(selector: string): PackElement[];
  addEventListener(type: string, listener: (ev: PackEvent) => void): void;
}

export interface PackLocation {
  hash: string;
}

export interface PackHistory {
  replaceState(data: unknown, unused: string, url: string): void;
}

export interface PackWindow {
  document: PackDocument;
  location: PackLocation;
  history: PackHistory;
  innerHeight: number;
  pageYOffset: number;
  scrollTo(options: { top: number; behavior: string }): void;
  getComputedStyle(el: PackElement): PackComputedStyle;
  requestAnimationFrame(fn: () => void): number;
  addEventListener(type: string, listener: (ev: PackEvent) => void): void;
  IntersectionObserver: PackIntersectionObserverCtor;
}
