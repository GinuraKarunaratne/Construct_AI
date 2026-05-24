/**
 * Custom entry point — runs polyfills BEFORE expo-router/entry loads any
 * modules (including @tanstack/react-query which triggers DOMException).
 */

// ── Patch missing Hermes / React Native globals ───────────────────────────────

if (typeof global.DOMException === "undefined") {
  const CODES = {
    IndexSizeError: 1, HierarchyRequestError: 3, WrongDocumentError: 4,
    InvalidCharacterError: 5, NoModificationAllowedError: 7, NotFoundError: 8,
    NotSupportedError: 9, InUseAttributeError: 10, InvalidStateError: 11,
    SyntaxError: 12, InvalidModificationError: 13, NamespaceError: 14,
    InvalidAccessError: 15, TypeMismatchError: 17, SecurityError: 18,
    NetworkError: 19, AbortError: 20, URLMismatchError: 21,
    QuotaExceededError: 22, TimeoutError: 23, InvalidNodeTypeError: 24,
    DataCloneError: 25,
  };
  global.DOMException = class DOMException extends Error {
    constructor(message = "", name = "Error") {
      super(message);
      this.name = name;
      this.code = CODES[name] ?? 0;
    }
  };
}

if (typeof global.TextEncoder === "undefined") {
  global.TextEncoder = class TextEncoder {
    encode(str) {
      const buf = [];
      for (let i = 0; i < str.length; i++) {
        const c = str.charCodeAt(i);
        if (c < 0x80) buf.push(c);
        else if (c < 0x800) buf.push(0xc0 | (c >> 6), 0x80 | (c & 0x3f));
        else buf.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 0x3f), 0x80 | (c & 0x3f));
      }
      return new Uint8Array(buf);
    }
  };
}

// ── Hand off to expo-router (loads the app/ directory) ───────────────────────
import "expo-router/entry";
