// Polyfills must run before ANYTHING else — especially expo-router/entry
// which triggers @tanstack/react-query initialization that references DOMException.

// Patch on every possible global object so Hermes always finds it
const _g = typeof globalThis !== "undefined" ? globalThis
         : typeof global    !== "undefined" ? global
         : typeof window    !== "undefined" ? window
         : this;

if (typeof _g.DOMException === "undefined") {
  const CODES = {
    IndexSizeError: 1, HierarchyRequestError: 3, WrongDocumentError: 4,
    InvalidCharacterError: 5, NoModificationAllowedError: 7,
    NotFoundError: 8, NotSupportedError: 9, InUseAttributeError: 10,
    InvalidStateError: 11, SyntaxError: 12, InvalidModificationError: 13,
    NamespaceError: 14, InvalidAccessError: 15, TypeMismatchError: 17,
    SecurityError: 18, NetworkError: 19, AbortError: 20,
    URLMismatchError: 21, QuotaExceededError: 22, TimeoutError: 23,
    InvalidNodeTypeError: 24, DataCloneError: 25,
  };

  function DOMException(message, name) {
    this.message = message || "";
    this.name    = name    || "Error";
    this.code    = CODES[this.name] || 0;
  }
  DOMException.prototype = Object.create(Error.prototype);
  DOMException.prototype.constructor = DOMException;

  _g.DOMException = DOMException;

  // Belt-and-suspenders: also set on the other globals
  if (typeof globalThis !== "undefined") globalThis.DOMException = DOMException;
  if (typeof global    !== "undefined") global.DOMException    = DOMException;
  if (typeof window    !== "undefined") window.DOMException    = DOMException;
}

// Now it's safe to load the router
require("expo-router/entry");
