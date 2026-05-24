/**
 * Polyfills for React Native / Hermes
 * Import this file FIRST in app/_layout.tsx before any other imports.
 */

// ── DOMException ──────────────────────────────────────────────────────────────
// Used by axios v1.x and some fetch implementations for abort/cancel handling.
// Hermes / React Native does not expose this as a global.
if (typeof global.DOMException === "undefined") {
  const CODES: Record<string, number> = {
    IndexSizeError: 1,
    HierarchyRequestError: 3,
    WrongDocumentError: 4,
    InvalidCharacterError: 5,
    NoModificationAllowedError: 7,
    NotFoundError: 8,
    NotSupportedError: 9,
    InUseAttributeError: 10,
    InvalidStateError: 11,
    SyntaxError: 12,
    InvalidModificationError: 13,
    NamespaceError: 14,
    InvalidAccessError: 15,
    TypeMismatchError: 17,
    SecurityError: 18,
    NetworkError: 19,
    AbortError: 20,
    URLMismatchError: 21,
    QuotaExceededError: 22,
    TimeoutError: 23,
    InvalidNodeTypeError: 24,
    DataCloneError: 25,
  };

  class DOMExceptionPolyfill extends Error {
    readonly code: number;
    constructor(message = "", name = "Error") {
      super(message);
      this.name = name;
      this.code = CODES[name] ?? 0;
    }
  }

  // @ts-expect-error — adding missing global
  global.DOMException = DOMExceptionPolyfill;
}

// ── TextEncoder / TextDecoder ─────────────────────────────────────────────────
// Required by some versions of @tanstack/react-query and other libs.
// Available in newer Hermes builds but guard defensively.
if (typeof global.TextEncoder === "undefined") {
  // @ts-expect-error
  global.TextEncoder = class TextEncoder {
    encode(str: string): Uint8Array {
      const buf = [];
      for (let i = 0; i < str.length; i++) {
        const code = str.charCodeAt(i);
        if (code < 0x80) {
          buf.push(code);
        } else if (code < 0x800) {
          buf.push(0xc0 | (code >> 6), 0x80 | (code & 0x3f));
        } else {
          buf.push(0xe0 | (code >> 12), 0x80 | ((code >> 6) & 0x3f), 0x80 | (code & 0x3f));
        }
      }
      return new Uint8Array(buf);
    }
  };
}

export {};
