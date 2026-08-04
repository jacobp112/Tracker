import './auth.css';

/**
 * Left dark brand panel of the auth page, verbatim from MOCKUP lines 42–64:
 * beta badge, "Set your stack in stone" headline with lavender squiggle,
 * the stacked-stones illustration, tagline, and copyright line.
 */
export function BrandPanel() {
  return (
    <div className="auth-brand">
      <div className="auth-brand__badge">Now in beta</div>

      <h1 className="auth-brand__headline">
        Set your stack in{' '}
        <span className="auth-brand__headline-stone">
          stone
          <svg
            width="100%"
            height="14"
            viewBox="0 0 160 14"
            preserveAspectRatio="none"
            className="auth-brand__squiggle"
          >
            <path
              d="M2 9 Q 20 2, 40 8 T 80 6 Q 100 2, 120 9 T 158 5"
              fill="none"
              stroke="#f0d7ff"
              strokeWidth="4"
              strokeLinecap="round"
            ></path>
          </svg>
        </span>
        .
      </h1>

      <svg width="150" height="190" viewBox="0 0 100 130" className="auth-brand__illustration">
        <ellipse cx="50" cy="126" rx="34" ry="4" fill="#000000" opacity="0.25"></ellipse>
        <rect
          x="10"
          y="104"
          width="80"
          height="24"
          rx="12"
          fill="#034f46"
          stroke="#ffffeb"
          strokeWidth="4"
          transform="rotate(-3 50 116)"
        ></rect>
        <rect
          x="18"
          y="80"
          width="64"
          height="22"
          rx="11"
          fill="#77776a"
          stroke="#ffffeb"
          strokeWidth="4"
          transform="rotate(4 50 91)"
        ></rect>
        <rect
          x="24"
          y="58"
          width="52"
          height="20"
          rx="10"
          fill="#f0d7ff"
          stroke="#ffffeb"
          strokeWidth="4"
          transform="rotate(-4 50 68)"
        ></rect>
        <rect
          x="30"
          y="38"
          width="40"
          height="18"
          rx="9"
          fill="#034f46"
          stroke="#ffffeb"
          strokeWidth="4"
          transform="rotate(3 50 47)"
        ></rect>
        <circle cx="50" cy="19" r="16" fill="#ffa946" stroke="#ffffeb" strokeWidth="4"></circle>
        <path
          d="M45 16 Q 46.5 14, 48 16"
          fill="none"
          stroke="#1a1a1a"
          strokeWidth="1.8"
          strokeLinecap="round"
        ></path>
        <path
          d="M52 16 Q 53.5 14, 55 16"
          fill="none"
          stroke="#1a1a1a"
          strokeWidth="1.8"
          strokeLinecap="round"
        ></path>
        <path
          d="M46.5 21 Q 50 23.5, 53.5 21"
          fill="none"
          stroke="#1a1a1a"
          strokeWidth="1.8"
          strokeLinecap="round"
        ></path>
        <circle cx="42.5" cy="20" r="2" fill="#f0d7ff" opacity="0.7"></circle>
        <circle cx="57.5" cy="20" r="2" fill="#f0d7ff" opacity="0.7"></circle>
      </svg>

      <p className="auth-brand__tagline">Every project, every decision, one place that doesn't wobble.</p>

      <p className="auth-brand__copyright">© 2026 Cairn</p>
    </div>
  );
}
