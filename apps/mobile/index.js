// Minimal polyfill — only DOMException. Do NOT touch Event/EventTarget.
(() => {
  const g = typeof globalThis !== "undefined" ? globalThis : global;
  if (typeof g.DOMException === "undefined") {
    Object.defineProperty(g, "DOMException", {
      configurable: true,
      writable: true,
      value: class DOMException extends Error {
        constructor(message = "", name = "Error") {
          super(message);
          this.name = name;
        }
      },
    });
  }
})();

require("expo-router/entry");
