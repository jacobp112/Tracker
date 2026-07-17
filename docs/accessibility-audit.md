# Accessibility Audit — E8-S3

Pass against **Document 3 §6** (the accessibility floor) across every shipped screen. This is the documented checklist E8-S3 requires. Automated coverage lives in `tests/a11y/accessibility.test.tsx`; this file records the full manual pass and the reasoning behind each item.

Audited build: all epics E1–E8. Method: static review of every screen + component, jsdom render/interaction tests, and the route-level smoke suite (`tests/integration/app-smoke.test.tsx`). Browser-based visual/AT verification was **not** run — no browser driver is installed in this environment (see "Not yet verified" below).

## §6 checklist

| Requirement | Status | Evidence / notes |
|---|---|---|
| Responsive to 360px | ✅ | Fluid layouts; `hero-row`/`props-card` collapse at 920px, sidebar→bottom-tabs at 768px, content padding tightens at 720px. No fixed widths below 360px. |
| Sidebar → bottom-tab transform < 768px | ✅ | `shell.css` — sidebar `display:none`, `.tabbar` shown. Both navs are in the DOM; CSS decides which shows. |
| Interactive targets ≥ 44×44px | ✅ (fixed) | The mockup's controls are 34–37px for the desktop pointer look. Added a `@media (pointer: coarse)` block bumping icon buttons to 44×44 and buttons/segments/row-actions/cmdk to the floor — the iOS 44px standard is about **touch**, so it's applied where the pointer is coarse. Data rows are already ≥44px (13px padding + content). |
| Visible keyboard focus on every interactive element | ✅ | Global `:focus-visible` ring (`global.css`); never `outline:none` without a replacement. Retention rows use `:focus-within` + an inset accent bar so the stretched-title control reads as the whole row focusing. |
| Colour is never the only signal | ✅ | Retention = bar colour **+** dot **+** always-present `%` in text (`RetentionRow` renders `.pct` unconditionally; a test pins it). Status = chip colour **+** label. Exam effect = colour **+** "boosted/flagged weak" text. Activity cells expose date + count via `aria-label`. |
| WCAG AA contrast, both themes | ✅ (fixed) | `--ink`/`--ink-secondary` pass AA on `--surface` in both themes. `--ink-muted` inherited from the mockup (#a1a1a6) was ~2.6:1 and **failed**; darkened to `#767980` (light, ~4.6:1) and lifted to `#9296a0` (dark). Retention traffic-light inks are saturated and sit on soft fills; the number carries the value regardless. |
| `prefers-reduced-motion` respected | ✅ | Global reduce block zeroes transitions/animations and forces `.reveal` visible + bars to final width (`tokens.css`). Count-up, sparkline/curve draw-on, and the live-pulse all gate on it via `useReducedMotion`; reduced motion never leaves content hidden (§6). A test pins the count-up jumping to its final value. |
| Empty / loading / error states exist and guide (§7) | ✅ | Every list/screen has an empty state naming the next action ("No courses yet. Add one to start tracking retention."). Validation errors are plain-English and instruct. Storage/load failures surface a message, never a silent console error (DoD §9). |
| Dialogs manage focus | ✅ | `Sheet` is `role="dialog" aria-modal="true"` with an accessible name, moves focus in on open, **traps** Tab/Shift-Tab, closes on Escape, and restores focus to the opener on close. |
| Forms are labelled | ✅ | The paste textarea has a real `<label>`, `aria-invalid` on failure, and `aria-describedby` pointing at the error list. Error-resolve checkboxes carry `sr-only` labels naming the specific error. |
| Live regions | ✅ | Toasts render in a `role="status" aria-live="polite"` viewport, so confirmations are announced. |
| Icon-only controls are labelled | ✅ | `IconButton` requires a `label` → `aria-label` + `title`. Theme toggle announces its target state ("Switch to dark mode"). Decorative SVGs are `aria-hidden`. |
| Charts have text alternatives | ✅ | Sparkline, retention curve and fitness `LineChart` each carry an `aria-label` summarising the current value and trend; activity cells are individually labelled. |

## Notes on deliberate deviations

- **Touch-target sizing is pointer-conditional.** Meeting 44px unconditionally would inflate the desktop chrome away from the approved mockup. The standard is a *touch* standard, so 44px applies on `pointer: coarse`; fine-pointer (mouse) users keep the mockup's tighter 34px icon buttons. This satisfies §6's intent without regressing the visual design.
- **`--ink-muted` overrides the mockup.** Document 3 §0.1 states the mockup re-base left the §6 floor "unaffected", and §6 outranks visual fidelity where they conflict. The muted grey was the one inherited token that failed AA; it was darkened the minimum needed to pass and is reserved for genuinely secondary text.

## Not yet verified (requires a browser + AT, not available in this environment)

These need a real browser and are the recommended next step before release:

1. **Screen-reader pass** (VoiceOver / NVGA) over each screen — reading order, that the retention matrix and topic detail announce sensibly, and that the sheet's focus trap feels right with a real AT.
2. **Actual contrast measurement** of the retention traffic-light inks on their soft fills (computed to pass, not instrument-measured), and of both themes on real displays.
3. **Keyboard-only walkthrough** of each end-to-end flow (add course → log session → resolve error → export) in a browser.
4. **360px device check** on a real viewport, not just CSS review.

To enable these, install a browser driver (`npm i -D @playwright/test && npx playwright install chromium`) and drive the dev server; the route smoke suite is the natural place to bolt on `axe-core` assertions.
