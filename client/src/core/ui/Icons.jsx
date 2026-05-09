// Tiny SVG icons used across the app. Lifted byte-identical from App.jsx
// in stage F13. Both are 14×14 inline SVGs with brand colors baked in
// (Email = Gmail red, WhatsApp = brand green).
//
// See docs/platform/PLATFORM_ARCHITECTURE.md §11 frontend stage F13.

import React from "react";

export const IconWhatsApp = () => (
  <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true" style={{flexShrink:0}}>
    <circle cx="12" cy="12" r="12" fill="#25D366"/>
    <path d="M17.5 14.4c-.3-.1-1.7-.85-1.97-.95-.27-.1-.46-.1-.66.1-.19.21-.74.95-.9 1.14-.17.2-.33.22-.62.07-.29-.14-1.22-.45-2.33-1.43-.86-.77-1.44-1.72-1.61-2.01-.17-.29 0-.45.13-.59l.42-.49c.12-.14.17-.25.25-.42.08-.17.04-.32-.02-.46-.06-.14-.65-1.57-.9-2.15-.23-.55-.47-.48-.65-.48h-.57c-.19 0-.5.07-.76.37-.26.3-.99.97-.99 2.36 0 1.39.99 2.74 1.13 2.93.14.19 1.95 3 4.73 4.09 2.78 1.08 2.78.72 3.28.68.5-.04 1.61-.66 1.84-1.3.22-.64.22-1.19.16-1.3z" fill="#fff"/>
  </svg>
);

export const IconEmail = () => (
  <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true" style={{flexShrink:0}}>
    <rect width="24" height="24" rx="3" fill="#EA4335"/>
    <path d="M4 8l8 5 8-5" stroke="#fff" strokeWidth="1.5" fill="none" strokeLinecap="round"/>
    <rect x="3" y="7" width="18" height="12" rx="1.5" fill="none" stroke="#fff" strokeWidth="1.3"/>
  </svg>
);
