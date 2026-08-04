import type React from 'react';

/**
 * The six selectable onboarding avatars, verbatim from MOCKUP lines 170–186
 * (the `selectAvatar0..5` buttons' inner `<svg>` markup), JSX-cased.
 */
export const AVATARS: React.ReactElement[] = [
  // Avatar 0 — MOCKUP line 170
  (
    <svg width="40" height="40" viewBox="0 0 100 100" key="avatar-0">
      <path
        d="M50 6 C74 6 92 26 92 52 C92 76 72 94 50 94 C26 94 8 76 8 50 C8 26 28 6 50 6 Z"
        fill="#034f46"
      ></path>
      <circle cx="28" cy="30" r="3" fill="#0a6a5d"></circle>
      <circle cx="70" cy="66" r="4" fill="#0a6a5d"></circle>
      <path
        d="M37 44 Q 40 40, 43 44"
        fill="none"
        stroke="#ffffeb"
        strokeWidth="4"
        strokeLinecap="round"
      ></path>
      <path
        d="M57 44 Q 60 40, 63 44"
        fill="none"
        stroke="#ffffeb"
        strokeWidth="4"
        strokeLinecap="round"
      ></path>
      <path
        d="M40 60 Q 50 65, 60 60"
        fill="none"
        stroke="#ffffeb"
        strokeWidth="4"
        strokeLinecap="round"
      ></path>
    </svg>
  ),
  // Avatar 1 — MOCKUP line 173
  (
    <svg width="40" height="40" viewBox="0 0 100 100" key="avatar-1">
      <path
        d="M50 8 C72 4 94 24 90 48 C97 70 78 92 54 90 C30 96 6 78 10 54 C4 30 26 10 50 8 Z"
        fill="#ffa946"
      ></path>
      <circle cx="38" cy="44" r="5" fill="#1a1a1a"></circle>
      <path
        d="M56 40 Q 62 44, 56 48"
        fill="none"
        stroke="#1a1a1a"
        strokeWidth="4"
        strokeLinecap="round"
      ></path>
      <path
        d="M36 60 Q 50 70, 64 58"
        fill="none"
        stroke="#1a1a1a"
        strokeWidth="4"
        strokeLinecap="round"
      ></path>
    </svg>
  ),
  // Avatar 2 — MOCKUP line 176
  (
    <svg width="40" height="40" viewBox="0 0 100 100" key="avatar-2">
      <circle cx="50" cy="50" r="46" fill="#f0d7ff"></circle>
      <path d="M38 42 L34 34 M38 42 L42 33" stroke="#1a1a1a" strokeWidth="3" strokeLinecap="round"></path>
      <path d="M38 42 L34 50 M38 42 L42 51" stroke="#1a1a1a" strokeWidth="3" strokeLinecap="round"></path>
      <path d="M62 42 L58 34 M62 42 L66 33" stroke="#1a1a1a" strokeWidth="3" strokeLinecap="round"></path>
      <path d="M62 42 L58 50 M62 42 L66 51" stroke="#1a1a1a" strokeWidth="3" strokeLinecap="round"></path>
      <path
        d="M42 63 Q 50 70, 58 63"
        fill="none"
        stroke="#1a1a1a"
        strokeWidth="4"
        strokeLinecap="round"
      ></path>
    </svg>
  ),
  // Avatar 3 — MOCKUP line 179
  (
    <svg width="40" height="40" viewBox="0 0 100 100" key="avatar-3">
      <circle cx="50" cy="50" r="46" fill="#77776a"></circle>
      <rect x="30" y="40" width="16" height="10" rx="5" fill="#1a1a1a"></rect>
      <rect x="54" y="40" width="16" height="10" rx="5" fill="#1a1a1a"></rect>
      <path d="M46 45 L54 45" stroke="#1a1a1a" strokeWidth="3"></path>
      <path
        d="M42 62 Q 50 66, 58 62"
        fill="none"
        stroke="#ffffeb"
        strokeWidth="4"
        strokeLinecap="round"
      ></path>
    </svg>
  ),
  // Avatar 4 — MOCKUP line 182
  (
    <svg width="40" height="40" viewBox="0 0 100 100" key="avatar-4">
      <circle cx="50" cy="50" r="46" fill="#1a1a1a"></circle>
      <circle cx="30" cy="32" r="2" fill="#ffa946"></circle>
      <circle cx="70" cy="28" r="1.6" fill="#f0d7ff"></circle>
      <circle cx="66" cy="70" r="2" fill="#ffffeb" opacity="0.6"></circle>
      <path
        d="M38 45 Q 40 42, 42 45"
        fill="none"
        stroke="#ffa946"
        strokeWidth="4"
        strokeLinecap="round"
      ></path>
      <path
        d="M58 45 Q 60 42, 62 45"
        fill="none"
        stroke="#ffa946"
        strokeWidth="4"
        strokeLinecap="round"
      ></path>
      <path
        d="M39 58 Q 50 66, 61 58"
        fill="none"
        stroke="#ffa946"
        strokeWidth="4"
        strokeLinecap="round"
      ></path>
    </svg>
  ),
  // Avatar 5 — MOCKUP line 185
  (
    <svg width="40" height="40" viewBox="0 0 100 100" key="avatar-5">
      <defs>
        <clipPath id="cairn-avatar-5-clip">
          <circle cx="50" cy="50" r="46"></circle>
        </clipPath>
      </defs>
      <g clipPath="url(#cairn-avatar-5-clip)">
        <rect x="0" y="0" width="100" height="100" fill="#f0d7ff"></rect>
        <path d="M0 100 L100 0 V100 Z" fill="#034f46"></path>
      </g>
      <path
        d="M36 44 Q 40 40, 44 44"
        fill="none"
        stroke="#1a1a1a"
        strokeWidth="4"
        strokeLinecap="round"
      ></path>
      <path
        d="M56 44 Q 60 40, 64 44"
        fill="none"
        stroke="#ffffeb"
        strokeWidth="4"
        strokeLinecap="round"
      ></path>
      <path
        d="M40 60 Q 50 66, 60 60"
        fill="none"
        stroke="#1a1a1a"
        strokeWidth="4"
        strokeLinecap="round"
      ></path>
    </svg>
  ),
];
