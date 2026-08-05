import { useEffect, useRef } from 'react';
import './auth.css';
import { startCairnAnimation } from './animateCairn';

/**
 * Left dark brand panel of the auth page: beta badge, "Set your stack in stone"
 * headline with lavender squiggle, the animated Cairn mascot, tagline, and
 * copyright line.
 *
 * The stacked-stones illustration is the authored self-animating mascot (a
 * spring-physics wobble with a reactive face — hover/click/tap to poke it). The
 * SVG markup is inlined here so it inherits the page and can whip outside its
 * own box (`overflow: visible`); the animation loop is started from a
 * `useEffect` and torn down on unmount by the cleanup `startCairnAnimation`
 * returns. If `requestAnimationFrame` is unavailable it stays in this static
 * authored pose.
 */
export function BrandPanel() {
  const cairnRef = useRef<SVGSVGElement>(null);
  useEffect(() => startCairnAnimation(cairnRef.current), []);

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

      <svg
        ref={cairnRef}
        width="150"
        height="190"
        viewBox="0 0 100 130"
        className="auth-brand__illustration auth-brand__cairn"
        role="img"
        aria-labelledby="cairn-title"
      >
        <title id="cairn-title">A mascot balancing on a wobbling stack of stones</title>

        {/* invisible hit area so hover/tap works across the whole badge */}
        <rect id="cairn-hit" x="-8" y="-6" width="116" height="142" fill="none" pointerEvents="all" />

        {/* Shadow (stays on the ground, reacts to the lean) */}
        <ellipse id="cairn-shadow" cx="50" cy="126" rx="34" ry="4" fill="#000000" opacity="0.25" />

        {/* Articulated chain: every stone pivots on its own base, so rotation
            accumulates up the stack and the top whips like a real cairn. */}
        <g id="cairn-seg1">
          <g id="cairn-stone1-sq">
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
            />
          </g>

          <g id="cairn-seg2">
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
            />

            <g id="cairn-seg3">
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
              />

              <g id="cairn-seg4">
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
                />

                {/* Head */}
                <g id="cairn-head">
                  <g id="cairn-head-sq">
                    <circle cx="50" cy="19" r="16" fill="#ffa946" stroke="#ffffeb" strokeWidth="4" />

                    {/* Sphere-style: flat black marks that slide across the surface.
                        Every feature is one path whose shape is rebuilt each frame. */}
                    <g id="cairn-features">
                      <circle id="cairn-blush-l" cx="42.3" cy="20.4" r="2" fill="#f0d7ff" opacity="0.7" />
                      <circle id="cairn-blush-r" cx="57.7" cy="20.4" r="2" fill="#f0d7ff" opacity="0.7" />

                      <g id="cairn-eyes">
                        <path
                          id="cairn-eye-l"
                          d="M44 16.2 Q46.3 13.9 48.6 16.2 Q46.3 15.2 44 16.2 Z"
                          fill="#1a1a1a"
                          stroke="#1a1a1a"
                          strokeWidth="0.9"
                          strokeLinejoin="round"
                        />
                        <path
                          id="cairn-eye-r"
                          d="M51.4 16.2 Q53.7 13.9 56 16.2 Q53.7 15.2 51.4 16.2 Z"
                          fill="#1a1a1a"
                          stroke="#1a1a1a"
                          strokeWidth="0.9"
                          strokeLinejoin="round"
                        />
                      </g>

                      <path
                        id="cairn-mouth"
                        d="M45.8 22.4 Q50 24.1 54.2 22.4 Q50 25.9 45.8 22.4 Z"
                        fill="#1a1a1a"
                        stroke="#1a1a1a"
                        strokeWidth="0.9"
                        strokeLinejoin="round"
                      />
                    </g>
                  </g>
                </g>
              </g>
            </g>
          </g>
        </g>
      </svg>

      <p className="auth-brand__tagline">Every project, every decision, one place that doesn't wobble.</p>

      <p className="auth-brand__copyright">© 2026 Cairn</p>
    </div>
  );
}
