---
name: Gaslands Manager
description: Registre d'atelier post-apocalyptique pour construire des équipes Gaslands et suivre leurs campagnes.
colors:
  convoy-amber: "#D29E22"
  rust-signal: "#A23A1C"
  rust-signal-light: "#E6A088"
  desert-sand: "#C98A47"
  scorched-bitumen: "#14100C"
  bitume-void: "#0C0907"
  bitume-deep: "#1B140E"
  bitume-raised: "#221A13"
  bitume-hover: "#2A2018"
  sunbleached-bone: "#E7DDC6"
  gunmetal: "#2E261D"
  toxic-green: "#A8BC4A"
  coolant-blue: "#8FBCC9"
  warn-gold: "#E6B41C"
typography:
  display:
    fontFamily: "'Stick No Bills', 'Anton', 'Oswald', Impact, sans-serif"
    fontSize: "clamp(1.8rem, 4vw, 2.2rem)"
    fontWeight: 400
    lineHeight: 1
    letterSpacing: "0.04em"
  headline:
    fontFamily: "'Alumni Sans', 'Oswald', 'Arial Narrow', sans-serif"
    fontSize: "1.2rem"
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "0.04em"
  body:
    fontFamily: "'Alumni Sans', 'Oswald', 'Arial Narrow', sans-serif"
    fontSize: "1rem"
    fontWeight: 300
    lineHeight: 1.6
    letterSpacing: "normal"
  label:
    fontFamily: "'Alumni Sans', 'Space Mono', ui-monospace, 'Courier New', monospace"
    fontSize: "0.75rem"
    fontWeight: 400
    lineHeight: 1.2
    letterSpacing: "0.12em"
  button:
    fontFamily: "'Alumni Sans', 'Oswald', 'Arial Narrow', sans-serif"
    fontSize: "0.95rem"
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "0.06em"
rounded:
  none: "0"
  sm: "2px"
  md: "4px"
spacing:
  sp-1: "4px"
  sp-2: "8px"
  sp-3: "12px"
  sp-4: "16px"
  sp-5: "24px"
  sp-6: "32px"
  sp-7: "48px"
  sp-8: "64px"
components:
  button-primary:
    backgroundColor: "{colors.convoy-amber}"
    textColor: "{colors.scorched-bitumen}"
    typography: "{typography.button}"
    rounded: "{rounded.sm}"
    padding: "12px"
  button-secondary:
    backgroundColor: "transparent"
    textColor: "{colors.sunbleached-bone}"
    typography: "{typography.button}"
    rounded: "{rounded.sm}"
    padding: "12px"
  button-secondary-hover:
    backgroundColor: "{colors.bitume-hover}"
    textColor: "{colors.sunbleached-bone}"
    typography: "{typography.button}"
    rounded: "{rounded.sm}"
    padding: "12px"
  card-team:
    backgroundColor: "{colors.bitume-raised}"
    textColor: "{colors.sunbleached-bone}"
    typography: "{typography.body}"
    rounded: "{rounded.sm}"
    padding: "20px"
  input-field:
    backgroundColor: "{colors.scorched-bitumen}"
    textColor: "{colors.sunbleached-bone}"
    typography: "{typography.body}"
    rounded: "{rounded.sm}"
    padding: "10px 14px"
---

# Design System: Gaslands Manager

## 1. Overview

**Creative North Star: "The Burnt Ledger"**

Gaslands Manager reads as a field ledger stamped and re-stamped in a garage that also
happens to build war machines — every screen is a record kept under bad light with a
metal pen, not a polished dashboard. The system is dark by design and by doctrine: one
theme, no light mode to accommodate, built around scorched bitumen black, sun-bleached
bone text, and a single convoy-amber signal color that means "act here." Rust-orange
carries the danger register; sand and metal carry texture and secondary structure.
Everything sits on hard square corners (2-4px at most) and thick rust-colored borders,
stamped rather than floated — flat "stamp" shadows with zero blur, not soft Material
elevation. Grain texture and diagonal hazard stripes appear where the interface wants
to feel handled, not printed.

This system explicitly rejects the generic SaaS dashboard (pastel cards, hairline gray
icons, quiet gradients, interchangeable startup polish) and the cartoon game-UI look
(saturated candy colors, rounded-everything, cute). Both would erase the point: this is
a tool for tracking a post-apocalyptic war-rig budget down to the jerrican, not a toy and
not a spreadsheet-in-disguise.

**Key Characteristics:**
- Single dark theme, no light/dark toggle to design for.
- Square corners everywhere (max 4px radius) — the visual opposite of a rounded SaaS card.
- Hard-edge "stamp" shadows (vertical offset, zero blur) at rest; soft colored glow only as a hover/danger response.
- One accent (convoy amber) carries all primary calls-to-action; rust orange is reserved for danger/secondary signal, never interchangeable with amber.
- Mono, uppercase, wide-tracked labels for anything data-shaped (nav, form labels, badges, stats) — a garage clipboard voice distinct from the display headline voice.

## 2. Colors

The palette reads as scorched earth and rusted steel: a near-black bitumen base, bone-colored text, one warning-amber accent, and a rust-orange secondary that never gets promoted to primary.

### Primary
- **Convoy Amber** (`#D29E22`): the one accent that means "primary action." Buttons, focus rings, active nav underline, section headings that need to command attention (auth title, doc H1). Used sparingly — this is the single loudest color in the system, so it stays rare.

### Secondary
- **Rust Signal** (`#A23A1C`): borders (`--border-rust`, 1-3px, used almost everywhere a card or input needs an edge), the danger action color, and inline documentation links (a quieter register than amber so prose links don't read as warnings).
- **Rust Signal Light** (`#E6A088`): the readable-on-dark variant of Rust Signal — danger-tint badge text, "over budget" states. Deliberately pushed to ~7:1 contrast (was `#C2522E` → `#D67252` → this value across three tuning rounds) because the AA-strict version proved too dim on small mono/uppercase text.

### Tertiary
- **Desert Sand** (`#C98A47`): warmer, less saturated than amber — used in decorative gradients (the auth-screen "sun flare") and as the base of the sand/metal texture family. Never a call-to-action color.

### Neutral
- **Scorched Bitumen** (`#14100C`): the page background — the darkest surface everything else sits on top of.
- **Bitume Void** (`#0C0907`): navbar background and "sunk" surfaces — one step darker than the page itself.
- **Bitume Deep** (`#1B140E`): modal and auth-card background.
- **Bitume Raised** (`#221A13`): the default card surface (team cards, panels) — one step up from the page.
- **Bitume Hover** (`#2A2018`): hover state for raised surfaces and secondary buttons.
- **Gunmetal** (`#2E261D`): item-row and inline-code background — the metal family's darkest step.
- **Sunbleached Bone** (`#E7DDC6`): primary text color and the one light surface (used inverted, e.g. `--surface-invert`).

### Status (semantic, used only for state — never decorative)
- **Toxic Green** (`#A8BC4A`): success.
- **Coolant Blue** (`#8FBCC9`): informational.
- **Warn Gold** (`#E6B41C`): warning, distinct from Convoy Amber so a warning badge never gets mistaken for the primary CTA color.

### Named Rules
**The One Voice Rule.** Convoy Amber is the only color that means "press this." If a secondary or ghost button, a link, or a badge starts competing with it for attention, it's the wrong color — reach for Rust Signal or a neutral instead.

**The Closed Tint Set Rule.** Translucent badge/status backgrounds are never composed ad hoc (`rgba(x, y, z, 0.15)` invented on the spot). They come from one closed set (`--tint-accent-*`, `--tint-danger-*`, `--tint-success-*`, `--tint-info-*`), each already validated at ≥4.5:1 against the least favorable surface. Past a certain alpha, a tint's contrast against text *drops* rather than rises (the background converges toward the text color) — a new step needs a relative-luminance calculation, never an improvised value.

**The Living Palette Rule.** AA (4.5:1) is the floor everywhere, not the ceiling. Several tokens (Rust Signal Light, Toxic Green, Coolant Blue, body-dim text) were pushed toward ~7:1 across multiple tuning rounds after AA-strict values proved too dim in practice on small mono/uppercase text — treat a documented AA ratio as a starting point to verify, not a guarantee of real-world legibility.

## 3. Typography

**Display Font:** Stick No Bills (with Anton, Oswald, Impact fallback)
**Body Font:** Alumni Sans (with Oswald, Arial Narrow fallback)
**Label/Mono Font:** Alumni Sans, Space Mono (with ui-monospace, Courier New fallback)

**Character:** A heavy, condensed display face for anything that needs to shout (page titles, watermark numbers) against a narrow, slightly stretched body/label voice that reads like stenciled equipment labeling — the pairing is contrast-of-weight (heavy display vs. light/narrow body), not two similar sans-serifs competing.

> **Status note:** Stick No Bills / Alumni Sans / Alumni Sans Pinstripe are the currently-wired production fonts, explicitly flagged in the source as a "test" pairing still being evaluated against the originally-named reference trio (Anton / Oswald / Space Mono). Treat the current pairing as live but not yet locked — re-run this scan after the team settles on one.

### Hierarchy
- **Display** (400, `clamp(1.8rem, 4vw, 2.2rem)`, line-height 1): Page-level headings — auth screen title, documentation H1. Uppercase, `0.04em` tracking, stamped text-shadow (`--shadow-stamp-lg`).
- **Headline** (600, `1.2rem`, line-height 1.2): Card titles and section headers (team card name, doc H2). Uppercase, `0.04-0.06em` tracking, often paired with a rust-colored bottom border as a section divider.
- **Body** (300, `1rem`, line-height 1.6-1.7): Paragraph text and descriptions. Long-form prose (documentation) runs at 1.7 line-height; UI copy (card descriptions) at ~1.5. Cap prose measure at 65-75ch.
- **Label** (400, `0.68-0.78rem`, letter-spacing `0.08-0.18em`, uppercase): The dominant voice for anything data-shaped — nav links, form labels, badges, stat rows, timestamps. Always mono, always uppercase, always wide-tracked.
- **Button** (600, `0.95rem`, letter-spacing `0.06em`, uppercase): A distinct fifth role, closer to Label's wide tracking than to Body, but on the body typeface — reserved for interactive controls.

### Named Rules
**The Stencil Label Rule.** Any text under ~13px, or any all-caps run, is Label typography (mono, wide-tracked) — never the body font shrunk down. Body font at small sizes is what caused the original AA-insufficient contrast problem (see Colors → Living Palette Rule); Label's mono face reads cleaner at that size regardless of color.

## 4. Elevation

This system does not use Material-style soft ambient elevation. At rest, raised surfaces (cards, the navbar, the auth card) carry a **stamped** shadow: a hard vertical offset with zero blur radius, like a plate pressed into the surface below it rather than floating above it. Depth is communicated by surface color steps (Scorched Bitumen → Bitume Raised → Bitume Hover) more than by shadow. Soft, blurred glow shows up only as an interaction *response* — hover states and danger emphasis — never as a resting-state effect.

### Shadow Vocabulary
- **Stamp** (`box-shadow: 0 3px 0 rgba(0,0,0,0.45)`): the default resting shadow for cards, buttons, the navbar. Hard edge, no blur — reads as a physically pressed plate, not a hovering panel.
- **Stamp Large** (`box-shadow: 0 6px 0 rgba(36,14,4,0.45)`): the same treatment at higher emphasis (auth card, display headings' text-shadow).
- **Danger Glow** (`box-shadow: 0 0 40px rgba(230,180,28,0.35)`): a soft, blurred amber glow — hover state on cards, active/alert emphasis. The one place real blur appears.
- **Rust Glow** (`box-shadow: 0 0 40px rgba(162,58,28,0.4)`): the danger/over-budget variant of the glow above.
- **Focus Ring Glow** (`box-shadow: 0 0 0 2px rgba(230,180,28,0.15)`): a soft ring on focused inputs — the one blurred-adjacent effect that isn't hover-only.

### Named Rules
**The Stamped-Not-Floating Rule.** No soft ambient drop-shadow at rest, ever. If a component needs to read as "raised," lighten its background one step (Bitume Raised, Bitume Hover) and/or add the hard-edge Stamp shadow — never a blurred `box-shadow` used for generic depth. Blur is reserved for the Danger/Focus glows, which are explicitly interaction feedback, not resting elevation.

## 5. Components

Every interactive surface has the weight of stamped sheet metal — square corners, thick rust borders, mono uppercase labeling — never the lightness of a mobile-first SaaS control.

### Buttons
- **Shape:** Square corners (`border-radius: 2px`, `--r-sm`) — never fully rounded, never fully sharp (0px), that 2px is the system's signature "almost-square" edge.
- **Primary:** Convoy Amber background, Scorched Bitumen text, uppercase Button typography, full-width by default in forms, `--shadow-stamp` at rest.
- **Hover / Focus:** Primary drops opacity to 0.88 and lifts 1px on hover (`transform: translateY(-1px)`) — a physical "press" cue rather than a color shift. Disabled state drops opacity to 0.4 with `cursor: not-allowed`.
- **Secondary / Ghost:** Transparent background, 2px Rust Signal border, Sunbleached Bone text. Hover fills with Bitume Hover and strengthens the border to `--border-strong`. No amber ever appears on a secondary button — that would break the One Voice Rule.

### Chips / Badges
- **Style:** Translucent tint background from the Closed Tint Set (never an ad hoc rgba), 1px matching-tint border, 2px radius, mono Label typography, uppercase.
- **State:** Accent tint for neutral status badges (sponsor name), danger tint for over-budget/critical states, success/info tints for the corresponding semantic states. A budget-exceeded card gets a permanent Rust Signal border, not just a badge.

### Cards / Containers
- **Corner Style:** 2px radius (`--r-sm`) system-wide — the same near-square language as buttons and inputs.
- **Background:** Bitume Raised at rest; hover strengthens the border to Convoy Amber and adds the Danger Glow (soft blur) rather than changing the background.
- **Shadow Strategy:** Stamp at rest (see Elevation); Danger/Rust Glow on hover or in a permanent over-limit state.
- **Border:** 2px Rust Signal by default (`--border-rust`), switching to Rust Signal outright (not just the border token) for a permanently "over" state.
- **Internal Padding:** `20px` (between `sp-4` and `sp-5`) is the card standard; large watermark numbers (giant Display-font digits at 6% opacity) sit behind content as a decorative background layer on list-style cards.

### Inputs / Fields
- **Style:** Scorched Bitumen background (darker than the card it sits in), 1px Rust Signal border, 2px radius, Body typography at 1rem.
- **Focus:** Border shifts to Convoy Amber plus the Focus Ring Glow (a soft 2px amber halo) — the one place a soft glow appears outside of hover/danger states.
- **Error / Disabled:** Error banners use the danger tint block (background/border/text from the Closed Tint Set), not a red border on the field itself.

### Navigation
- **Style:** Bitume Void background, sticky top, 2px Rust Signal bottom border, Stamp shadow. Links are Label typography (mono, uppercase, `0.12em` tracking) with a 2px bottom border that's transparent at rest and Convoy Amber on hover/active — never a background pill, always an underline-style indicator.
- **Mobile:** Height goes fluid (`auto`) and links wrap into a second row rather than collapsing into a hamburger menu — the nav stays fully visible, just re-flows.

### Signature Component: The Watermark Number
Team/vehicle cards carry a giant Display-font number in the top-right corner at 6% opacity, color Sunbleached Bone, behind all other content, `pointer-events: none`. It reads as a stenciled ID stamped onto a crate — a recurring device worth reusing on any new card-style list rather than reinventing a different decorative treatment.

## 6. Do's and Don'ts

### Do:
- **Do** keep every corner at 2px or less (`--r-sm` / `--r-0`) — square, stamped, industrial.
- **Do** use Convoy Amber (`#D29E22`) as the only color that means "primary action" — one accent, rare and deliberate.
- **Do** use hard-edge Stamp shadows (zero blur) for resting elevation, reserving blurred glow for hover/danger feedback only.
- **Do** set any small or uppercase text in Label typography (mono, wide-tracked) rather than shrinking the body font — this is what the AA→AAA contrast tuning rounds were fixing.
- **Do** compose translucent badges only from the Closed Tint Set (`--tint-*`) — never an ad hoc `rgba()`.

### Don't:
- **Don't** build a generic SaaS dashboard: no pastel cards, no hairline gray icons, no quiet gradients, no interchangeable startup polish. That aesthetic is explicitly rejected in this project's brand personality.
- **Don't** go cartoon/cute: no oversaturated candy colors, no fully-rounded corners, no childish illustration style. Also explicitly rejected — this is a post-apocalyptic war-rig tool, not a toy.
- **Don't** let Rust Signal double as a call-to-action color. It's the secondary/danger register; promoting it to primary muddies the One Voice Rule.
- **Don't** invent a new rgba() for a badge or tint background. If the Closed Tint Set doesn't cover the case, that's a signal a new step needs a real luminance calculation, not an improvised value.
- **Don't** use a soft ambient drop-shadow at rest on any card or button — that's Material-style elevation language this system explicitly does not speak.
