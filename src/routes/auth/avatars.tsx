import type React from 'react';

/**
 * The six selectable onboarding avatars.
 * Styled to feel hand-drawn, imperfect, and incredibly happy/joyful!
 */
export const AVATARS: React.ReactElement[] = [
  // Avatar 0 — Wobbly dark green blob with a big warm smile and cute blush
  (
    <svg width="40" height="40" viewBox="0 0 100 100" key="avatar-0">
      <path
        d="M48 5 C75 8 93 25 90 52 C87 79 70 95 45 93 C20 91 7 73 10 48 C13 23 22 2 48 5 Z"
        fill="#034f46"
      />
      {/* Hand-drawn blush under the eyes */}
      <path d="M24 54 Q 28 52 32 55" fill="none" stroke="#0a6a5d" strokeWidth="4" strokeLinecap="round" />
      <path d="M68 54 Q 72 52 76 55" fill="none" stroke="#0a6a5d" strokeWidth="4" strokeLinecap="round" />
      {/* Happy arched eyes ^ ^ */}
      <path
        d="M32 44 Q 38 35 44 44"
        fill="none"
        stroke="#ffffeb"
        strokeWidth="4"
        strokeLinecap="round"
      />
      <path
        d="M56 44 Q 62 35 68 44"
        fill="none"
        stroke="#ffffeb"
        strokeWidth="4"
        strokeLinecap="round"
      />
      {/* Deep, happy U-shaped smile */}
      <path
        d="M36 60 Q 50 75 64 60"
        fill="none"
        stroke="#ffffeb"
        strokeWidth="4.5"
        strokeLinecap="round"
      />
    </svg>
  ),

  // Avatar 1 — Orange bean with a joyful wink and wide smile
  (
    <svg width="40" height="40" viewBox="0 0 100 100" key="avatar-1">
      <path
        d="M52 7 C78 5 96 28 92 55 C88 82 65 96 40 92 C14 88 5 65 9 40 C13 14 25 9 52 7 Z"
        fill="#ffa946"
      />
      {/* Scribbled happy eye */}
      <path 
        d="M36 42 C 38 35, 46 35, 44 44 C 42 50, 34 46, 36 42 Z" 
        fill="none" 
        stroke="#1a1a1a" 
        strokeWidth="3.5" 
        strokeLinecap="round" 
        strokeLinejoin="round" 
      />
      {/* Winking happy eye ^ */}
      <path
        d="M56 44 Q 62 36 68 44"
        fill="none"
        stroke="#1a1a1a"
        strokeWidth="4"
        strokeLinecap="round"
      />
      {/* Playful, deep asymmetrical smile */}
      <path
        d="M36 60 Q 50 78 66 58"
        fill="none"
        stroke="#1a1a1a"
        strokeWidth="4.5"
        strokeLinecap="round"
      />
      {/* Little happy sparkle */}
      <path d="M78 25 L82 30 M82 25 L78 30" stroke="#1a1a1a" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  ),

  // Avatar 2 — Wobbly purple canvas with big cheerful eyes
  (
    <svg width="40" height="40" viewBox="0 0 100 100" key="avatar-2">
      <path
        d="M50 4 C75 2 94 22 96 48 C98 75 76 96 48 95 C22 94 3 75 5 50 C7 24 25 6 50 4 Z"
        fill="#f0d7ff"
      />
      {/* Happy hand-drawn arched eyes ^ ^ */}
      <path d="M34 44 Q 39 34 44 44" fill="none" stroke="#1a1a1a" strokeWidth="4.5" strokeLinecap="round" />
      <path d="M56 44 Q 61 34 66 44" fill="none" stroke="#1a1a1a" strokeWidth="4.5" strokeLinecap="round" />
      {/* Wide, relaxed happy smile */}
      <path
        d="M38 62 Q 50 74 62 62"
        fill="none"
        stroke="#1a1a1a"
        strokeWidth="4.5"
        strokeLinecap="round"
      />
      {/* Cute little cheek lines */}
      <path d="M28 50 L32 54" stroke="#1a1a1a" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M72 50 L68 54" stroke="#1a1a1a" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  ),

  // Avatar 3 — Grey wobbly head with clunky sunglasses and a cool grin
  (
    <svg width="40" height="40" viewBox="0 0 100 100" key="avatar-3">
      <path
        d="M48 6 C76 8 96 26 93 52 C90 79 72 94 45 93 C18 92 6 72 9 46 C12 20 20 4 48 6 Z"
        fill="#77776a"
      />
      {/* Left lens (slightly tilted) */}
      <path d="M28 40 L46 38 L44 52 L30 50 Z" fill="#1a1a1a" stroke="#1a1a1a" strokeLinejoin="round" />
      {/* Right lens (slightly different shape) */}
      <path d="M54 39 L74 41 L70 54 L52 51 Z" fill="#1a1a1a" stroke="#1a1a1a" strokeLinejoin="round" />
      {/* Wonky bridge connecting them */}
      <path d="M45 42 Q 50 38 54 43" fill="none" stroke="#1a1a1a" strokeWidth="3" strokeLinecap="round" />
      {/* Glasses reflections */}
      <path d="M32 42 L38 48 M58 43 L64 49" stroke="#ffffeb" strokeWidth="2" strokeLinecap="round" />
      {/* Confident, big happy grin */}
      <path
        d="M38 62 Q 50 75 62 60"
        fill="none"
        stroke="#ffffeb"
        strokeWidth="4.5"
        strokeLinecap="round"
      />
    </svg>
  ),

  // Avatar 4 — Deep black wobbly shape with neon sketched stars and a laughing mouth
  (
    <svg width="40" height="40" viewBox="0 0 100 100" key="avatar-4">
      <path
        d="M45 5 C75 2 95 24 94 50 C93 78 78 95 50 95 C22 95 5 78 5 50 C5 22 15 8 45 5 Z"
        fill="#1a1a1a"
      />
      {/* Hand-drawn star sparkles */}
      <path d="M26 26 L34 34 M34 26 L26 34" stroke="#ffa946" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M70 24 L76 30 M76 24 L70 30" stroke="#f0d7ff" strokeWidth="2" strokeLinecap="round" />
      <path d="M64 68 L70 74 M70 68 L64 74" stroke="#ffffeb" strokeWidth="2" strokeLinecap="round" opacity="0.6" />
      
      {/* Super happy eyes ^ ^ */}
      <path
        d="M34 45 Q 40 35 46 45"
        fill="none"
        stroke="#ffa946"
        strokeWidth="4.5"
        strokeLinecap="round"
      />
      <path
        d="M54 45 Q 60 35 66 45"
        fill="none"
        stroke="#ffa946"
        strokeWidth="4.5"
        strokeLinecap="round"
      />
      {/* Open, laughing mouth (filled in) */}
      <path
        d="M38 60 Q 50 78 62 60 Z"
        fill="#ffa946"
        stroke="#ffa946"
        strokeWidth="2"
        strokeLinejoin="round"
      />
    </svg>
  ),

  // Avatar 5 — Imperfect split colors with a joyous expression
  (
    <svg width="40" height="40" viewBox="0 0 100 100" key="avatar-5">
      <defs>
        <clipPath id="cairn-avatar-5-clip-organic">
          <path d="M50 4 C75 6 95 24 94 50 C93 78 72 96 46 95 C20 94 4 75 6 48 C8 22 22 2 50 4 Z" />
        </clipPath>
      </defs>
      <g clipPath="url(#cairn-avatar-5-clip-organic)">
        <rect x="0" y="0" width="100" height="100" fill="#f0d7ff"></rect>
        {/* Hand-drawn jagged diagonal split */}
        <path d="M-10 110 L20 60 L45 70 L70 20 L110 -10 V110 Z" fill="#034f46"></path>
      </g>
      
      {/* Cheerful arched eyes spanning both colors */}
      <path
        d="M34 44 Q 40 34 46 44"
        fill="none"
        stroke="#1a1a1a"
        strokeWidth="4.5"
        strokeLinecap="round"
      />
      <path
        d="M54 44 Q 60 34 66 44"
        fill="none"
        stroke="#ffffeb"
        strokeWidth="4.5"
        strokeLinecap="round"
      />
      
      {/* Very happy smile with a little cheek dimple */}
      <path
        d="M38 62 Q 50 76 62 60"
        fill="none"
        stroke="#1a1a1a"
        strokeWidth="4.5"
        strokeLinecap="round"
      />
      <path d="M62 60 Q 65 58 66 62" fill="none" stroke="#1a1a1a" strokeWidth="3" strokeLinecap="round" />
    </svg>
  ),
];