import "@testing-library/jest-dom/vitest";

// jsdom has no ResizeObserver; Radix measures with it.
class NoResize {
  observe() {}
  unobserve() {}
  disconnect() {}
}
globalThis.ResizeObserver ??= NoResize as unknown as typeof ResizeObserver;

// Nor pointer capture or scrollIntoView, which Radix Select and cmdk call.
Element.prototype.hasPointerCapture ??= () => false;
Element.prototype.releasePointerCapture ??= () => {};
Element.prototype.scrollIntoView ??= () => {};
