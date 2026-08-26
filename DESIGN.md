---
name: Finance OS
description: A personal financial optimisation platform — see what your money should do next, with the reasoning shown.
colors:
  # Semantic token names are the project's own (they map 1:1 to the Tailwind utilities
  # bg-bg / text-fg / bg-surface / text-pos …). Each scheme-flipping token is a light-dark()
  # pair — its true, single source of truth — so it is preserved here verbatim, not split.
  # Descriptive character names ("Signal Orange", "Deep Gold") live in the prose + sidecar.
  primary: "#fc3d12"                          # Signal Orange — vivid brand: logo mark + large/non-text fills (both schemes)
  primary-fg: "#ffffff"
  primary-strong: "#cc300c"                   # deep orange for BUTTONS — white text clears AA (≥4.5:1) in both schemes
  primary-ink: "light-dark(#cc300c, #fc3d12)" # orange TEXT & links — deep on light, vivid on dark; AA either way
  bg: "light-dark(#f4f7ce, #03051e)"          # Pale Sunlight canvas / Deep Navy canvas
  surface: "light-dark(#ffffff, #0b0e2b)"     # cards
  surface-2: "light-dark(#ecf1af, #141834)"   # tracks, hover, default chips
  fg: "light-dark(#03051e, #ecf1c4)"          # Deep Navy Ink / Pale Sunlight Ink
  muted: "light-dark(#575c74, #9b9fb4)"
  border: "light-dark(#d9d69c, #23274c)"      # Khaki-Gold hairline / Navy hairline
  pos: "light-dark(#8a6800, #e7d07b)"         # Deep Gold — gains, on-track, value (light arm deepened for AA text)
  neg: "light-dark(#d62f0e, #ff6046)"         # Sunset Red — loss, debt, negative (already AA)
  warn: "light-dark(#9e590c, #fba35c)"        # Kindled Orange — caution, attention (light arm deepened for AA text)
  accent: "light-dark(#8f6400, #f2c078)"      # Amber — secondary highlight (light arm deepened for AA text)
typography:
  display:
    fontFamily: "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif"
    fontSize: "2.25rem"
    fontWeight: 600
    lineHeight: 1.1
    letterSpacing: "-0.021em"
  headline:
    fontFamily: "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif"
    fontSize: "1.5rem"
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "-0.021em"
  title:
    fontFamily: "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif"
    fontSize: "1.25rem"
    fontWeight: 600
    lineHeight: 1.3
    letterSpacing: "normal"
  body:
    fontFamily: "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: "normal"
  label:
    fontFamily: "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 500
    lineHeight: 1.4
    letterSpacing: "0.025em"
rounded:
  sm: "4px"
  md: "6px"
  lg: "8px"
  xl: "12px"
  2xl: "16px"
  full: "9999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "20px"
  2xl: "24px"
  section: "40px"
components:
  button-primary:
    backgroundColor: "{colors.primary-strong}"
    textColor: "{colors.primary-fg}"
    rounded: "{rounded.lg}"
    padding: "8px 16px"
    typography: "{typography.body}"
  button-secondary:
    backgroundColor: "transparent"
    textColor: "{colors.fg}"
    rounded: "{rounded.lg}"
    padding: "6px 12px"
    typography: "{typography.body}"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.muted}"
    rounded: "{rounded.lg}"
    padding: "6px 12px"
    typography: "{typography.body}"
  button-solid:
    backgroundColor: "{colors.fg}"
    textColor: "{colors.bg}"
    rounded: "{rounded.lg}"
    padding: "8px 16px"
    typography: "{typography.body}"
  input:
    backgroundColor: "{colors.bg}"
    textColor: "{colors.fg}"
    rounded: "{rounded.lg}"
    padding: "8px 12px"
    typography: "{typography.body}"
  card:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.fg}"
    rounded: "{rounded.xl}"
    padding: "20px"
  badge:
    backgroundColor: "{colors.surface-2}"
    textColor: "{colors.muted}"
    rounded: "{rounded.full}"
    padding: "2px 8px"
    typography: "{typography.label}"
  nav-link-active:
    backgroundColor: "{colors.surface-2}"
    textColor: "{colors.fg}"
    rounded: "{rounded.lg}"
    padding: "8px 12px"
    typography: "{typography.body}"
---

# Design System: Finance OS

## Overview

**Creative North Star: "The Glass Cockpit"**

Finance OS is a warm glass cockpit for a person's money: instrument-grade clarity delivered in the voice of a well-set financial column. Every figure is legible at a glance, every figure traces back to source, and the interface is forever answering the same four questions — *what do I have, what's happening this month, what should I do, am I on track* — without ever hiding the arithmetic behind a black-box score. The chrome recedes; the numbers lead.

The palette is "sunset and ink" — a pale-sunlight canvas (or deep-navy at night) with deep-navy ink, warmed by a family of golds and oranges that each *mean* something. This is not decoration: gold reads as value earned, orange as caution, a hot Signal Orange as the one thing you should act on. The surfaces are flat and quiet, bordered by a soft khaki-gold hairline; depth comes from tonal layering, not drop shadows. Motion is Apple-fluid and single-purpose — controls dip toward the finger, overlays grow from the point they were summoned, and the one authored flourish is a recommendation's reasoning physically *unfolding* when you ask "Why this?".

The register is warm and editorial, never clinical and never loud. It should feel like a trusted adviser who shows their working: calm, exact, readable, and confident enough to leave most of the screen still. Anti-reference: the neon fintech dashboard, the black-box "credit score" dial, the gamified confetti-and-streak app. Finance OS earns trust by being explicable, not exciting.

**Key Characteristics:**
- Warm sunset-and-ink palette where every hue carries semantic meaning (gold = value, orange = caution, Signal Orange = action).
- Flat, bordered surfaces; depth by tonal layering (`bg` → `surface` → `surface-2`), never by resting shadow.
- Tabular, sans-serif numerals that lead every screen — money is the typography.
- Reasoning is always one disclosure away; the product's POV is "no black box".
- Restraint: generous quiet, the accent used sparingly, a single authored motion moment.
- First-class light **and** dark, resolved with `light-dark()` and honoured before first paint.

## Colors

A warm, semantically-loaded palette: a sunlit (or midnight) neutral ground, one reserved action red, and a warm gold/orange family where hue encodes financial meaning. Every scheme-aware token is a `light-dark()` pair — the frontmatter preserves the pair as the single source of truth; the values quoted below name the light arm first, dark arm second.

### Primary
- **Signal Orange** (`#fc3d12`, both schemes): The vivid brand orange. Reserved for the "F" logo mark and large / non-text fills (progress bars, `::selection`), where its 3:1 against white is enough. Identical in light and dark by design — the one fixed point in a palette that otherwise flips.
- **Signal Orange — Strong** (`primary-strong`, `#cc300c`, both schemes): The deep, AA-passing orange used behind white **button** text (white clears 4.5:1 at ≈5.3:1). This is what every solid primary button uses; the vivid `#fc3d12` is too light to carry white body-size text.
- **Signal Orange — Ink** (`primary-ink`, `#cc300c` / `#fc3d12`): Orange used as **text** and links ("Why this?", "All recommendations →"). Deep on the light canvas, vivid on the dark — so orange text clears AA in either scheme. Foreground on the strong/vivid fills is pure white (`#ffffff`).

### Secondary — the semantic value family
These are never chosen for looks; they are chosen for what a number *means*.
- **Deep Gold** (`pos`, `#8a6800` / `#e7d07b`): Gains, positive balances, "on track", value earned. The colour of a good outcome. The light arm is deepened so gold figures clear AA as text.
- **Kindled Orange** (`warn`, `#9e590c` / `#fba35c`): Caution and attention — a goal slipping behind, a debt that won't clear, a figure worth a second look.
- **Sunset Red** (`neg`, `#d62f0e` / `#ff6046`): Loss, debt, and negative movement. Distinct from Signal Orange — this red *describes*, Signal Orange *commands*. Already ≥4.5:1 as text.
- **Amber** (`accent`, `#8f6400` / `#f2c078`): The quieter secondary highlight — move-cash and goal-contribution chips, decorative sparkline fills.

### Neutral
- **Pale Sunlight / Deep Navy canvas** (`bg`, `#f4f7ce` / `#03051e`): The page ground. Warm daylight or deep night.
- **Surface** (`surface`, `#ffffff` / `#0b0e2b`): Cards pop pure-white on the sunlit canvas, near-black on the navy one.
- **Surface-2** (`surface-2`, `#ecf1af` / `#141834`): Recessed fills — progress tracks, hover states, default chips, the segmented-control ground.
- **Ink** (`fg`, `#03051e` / `#ecf1c4`): Body text. Deep-navy ink by day, soft pale-yellow ink by night.
- **Muted** (`muted`, `#575c74` / `#9b9fb4`): Secondary text — labels, hints, metadata.
- **Hairline** (`border`, `#d9d69c` / `#23274c`): The soft khaki-gold (or navy) 1px border that does nearly all the structural work.

### Named Rules
**The One Voice Rule.** Signal Orange is action-only. It appears on the logo mark and the primary button, and it is never used to decorate, fill, or highlight. If a screen has Signal Orange in two places, one of them is wrong — its scarcity is exactly what makes "do this" legible.

**The Hue-Means-Something Rule.** A warm colour is never decorative. Gold means value/gains, Kindled Orange means caution, Sunset Red means loss. A positive number rendered in orange, or a caution rendered in gold, is a bug — reach for the semantic token (`text-pos` / `text-warn` / `text-neg`), never a raw colour.

**The Sunlit-or-Midnight Rule.** Both schemes are first-class. Never hardcode a hex where a semantic token exists; every colour must survive the `light-dark()` flip, and the theme is applied before first paint (no flash).

**The AA-Orange Rule.** Every action and semantic colour clears WCAG AA (≥4.5:1) at body size: white on `primary-strong`, and `primary-ink` / `pos` / `warn` / `neg` / `accent` as text. Vivid `#fc3d12` is kept only where 3:1 suffices — the logo mark and large / non-text fills. If a colour is used as normal-size text or behind white button text, it must be one of the AA-cleared tokens, never raw `#fc3d12`.

## Typography

**Primary Font:** System sans-serif stack — `ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif`.
**Mono Font:** `ui-monospace, "SF Mono", Menlo, Consolas, monospace` — reserved for literal machine tokens (demo credentials), never for prose or money.

**Character:** One typeface, doing everything, with optical sizing on and size-aware tracking. The personality is in the restraint and the numerals: figures are always tabular so money columns align to the digit. Large headings tighten (`-0.021em`); body sits at a natural, readable 0.

### Hierarchy
- **Display** (600, 2.25rem / `text-4xl`, line-height 1.1): The single hero figure per screen — "Total across accounts". Used once, sparingly; its size *is* the emphasis.
- **Headline** (600, 1.5rem / `text-2xl`, tracking −0.021em): Page titles (`PageHeader`) and the primary value in a section (monthly surplus, income/spend flows).
- **Title** (600, 1.25rem / `text-xl`, up to `text-lg`): Card figures and sub-heads — account tiles, in-card totals.
- **Body** (400, 0.875rem / `text-sm`): The workhorse. Nearly all UI text, table cells, descriptions. Keep prose measures readable (~65–75ch).
- **Label** (500, 0.75rem / `text-xs`): Hints, metadata, badges, and the uppercase section eyebrows (`uppercase tracking-wide text-muted`) that title each dashboard block.

### Named Rules
**The Tabular-Money Rule.** Every monetary figure uses tabular numerals (`.tnum` / `font-variant-numeric: tabular-nums`) and never wraps. Money is set in the sans stack, *not* mono — the tabular figures do the alignment, the mono font is only for literal credentials.

**The Numbers-Lead Rule.** The biggest thing on any screen is a figure, not a heading. Section eyebrows are small, muted, and uppercase precisely so the value beneath them can be large and bare.

## Layout

A single centred column, `max-width: 72rem` (`max-w-6xl`), with `16px` gutters that open to `24px` at ≥640px. The app shell is a sticky `64px` header, a `max-w-6xl` main padded `32px`→`40px` vertically, and a quiet muted footer carrying the "not regulated advice / no money is moved" disclaimer.

The spatial model is **card-on-canvas**: flat bordered cards float on the ground, grouped into labelled sections. Rhythm is generous — dashboard sections stack at `40px` (`space-y-10`), card grids gap at `24px` (`gap-6`), in-card content at `16px`. Cards pad to `20px` (`p-5`); forms to `24px` (`p-6`).

Responsive behaviour is content-first: metric grids collapse `4→2→1` columns down the breakpoints; the horizontal nav appears only at `lg` (≥1024px) where there's room to breathe, and below that folds into a right-side drawer. Data tables never reflow — they scroll horizontally *inside their card* so the surrounding layout stays intact. Base spacing unit is `4px` (the Tailwind scale).

## Elevation & Depth

**Flat by default.** Cards, sections, and inputs carry no resting shadow — structure comes from the 1px hairline border and tonal layering (`bg` is darkest-warm, `surface` lifts, `surface-2` recesses). Shadow is not a decoration here; it is a signal that an element has *left the page plane*.

### Shadow Vocabulary
- **Floating overlay** (`shadow-lg shadow-black/5` on the "More" popover; `shadow-xl` on the drawer): the element is temporarily above everything and will dismiss.
- **Scroll-edge chrome** (`shadow-sm shadow-black/5`, appears only once the page scrolls): the header has detached from the top and content is now sliding beneath it.
- **Segmented thumb** (`shadow-sm` on the active theme-toggle segment): the selected pill sits proud of its recessed track.

### Named Rules
**The Flat-By-Default Rule.** Surfaces are flat at rest. A shadow appears only to say "this is floating above the page" (a popover, a drawer) or "this is now stuck to the top" (the scrolled header) — never to add depth to a static card. If a resting card has a shadow, remove it.

## Shapes

Soft, consistent, never pill-happy. The form language is a two-tier radius: interactive controls and small containers round to `8px` (`rounded-lg` — buttons, inputs, nav links, in-list rows), while cards, popovers, and menus round to `12px` (`rounded-xl`). Fully-round (`rounded-full`) is reserved for genuinely pill-shaped things: badges, progress tracks, status dots. Everything is bounded by the same 1px hairline (`border-border`) rather than by fills. The one element that rounds softer is the **chat bubble** (`rounded-2xl`, 16px — the top of the 12–16px card range), for a conversational feel set apart from the data cards.

One signature silhouette: the **reasoning trace** is set off by a `2px` left border (`border-l-2 border-border`) with left padding — a margin rule that visually says "this is the working-out", echoing an editor's annotation.

## Components

Each component leads with its character, then its spec. Radii, colours, and padding are the frontmatter tokens above.

### Buttons
- **Shape:** Gently rounded (`rounded-lg`, 8px), all variants.
- **Primary:** Solid deep orange (`primary-strong`, `#cc300c`) with white text — white clears AA at ≈5.3:1 — `8px 16px` padding, `text-sm font-medium`. Fades to `opacity-50/60` when disabled. No hover colour shift — the feedback is physical, not chromatic. (The vivid `#fc3d12` is reserved for the logo, not buttons.)
- **Secondary:** Transparent with a hairline border, ink text, `6px 12px`. Hover fills to `surface-2`. For neutral actions (Sign out, Snooze).
- **Ghost / tertiary:** Transparent, muted text, no border; hover lifts text to full ink. For low-stakes actions (Dismiss).
- **Solid neutral (ink):** Solid `fg` (ink) fill with `bg` (canvas) text, `8px 16px`, `text-sm font-medium`. A high-emphasis action held in a neutral key — used where a form's main action would otherwise put a *second* Signal Orange on the screen (the transactions **Filter**, the import step's confirm). It carries a primary's weight without breaking the One Voice Rule.
- **Press feedback (all buttons):** dip to `scale(0.97)` on `:active` over `0.16s cubic-bezier(0.2,0,0,1)`, settling back on release. Disabled when reduced-motion is set.

### Chips / Badges
- **Style:** Fully-round (`rounded-full`), `2px 8px`, `text-xs font-medium`.
- **Tones:** `default` = `surface-2` fill + muted text; semantic tones (`pos`/`neg`/`warn`/`accent`) use a 10%-opacity tint of the colour (`bg-pos/10 text-pos`). The tint keeps them quiet enough to sit inline without shouting.

### Cards / Containers
- **Corner Style:** `rounded-xl` (12px).
- **Background:** `surface`, on the `bg` canvas.
- **Shadow Strategy:** None at rest (see The Flat-By-Default Rule).
- **Border:** 1px `border-border` hairline — the primary structural device.
- **Internal Padding:** `20px` (`p-5`); forms `24px` (`p-6`). Colour transitions run `300ms` so cards ease through the theme flip.

### Inputs / Fields
- **Style:** `rounded-lg`, 1px hairline, `8px 12px`, `text-sm`.
- **Background:** `bg` — the *canvas* colour, not `surface`. A field is a well cut into the card, so it reads as recessed rather than raised.
- **Focus:** on focus the border shifts to Signal Orange (`focus:border-primary`); keyboard focus additionally shows the global focus ring (see **Focus** under Components). No soft glow.
- **Placeholder:** the AA-passing `muted` token at full opacity (`::placeholder`) — a supplementary hint, since every field also carries a real `<label>`.
- **Error:** message in a `neg/10` tinted panel with `neg` text; the field itself is not re-coloured.

### Navigation
- **Style:** A sticky, `backdrop-blur` header, transparent at the top (`bg-surface/60`) and resolving to `bg-surface/85` with a hairline and soft shadow once the page scrolls past 4px.
- **Links:** `rounded-lg px-3 py-2 text-sm`. Active = `surface-2` fill + `font-medium` ink; idle = muted, hover to ink.
- **Structure:** primary items inline at `lg`; the rest under a "More" popover (desktop) and a right-side slide-in drawer (mobile). The logo is a 28px `rounded-lg` Signal-Orange "F" mark plus the "Finance OS" wordmark.
- **Command reach:** at `lg` and up, a **Search ⌘K** chip in the header opens the command palette (see below); the same route list feeds both.
- **Reduced transparency:** the blur is dropped for an opaque `surface` header.

### Progress Bar
- **Style:** `8px` tall, `rounded-full`, recessed `surface-2` track. Fill tone is semantic — `primary`, `pos`, or `warn`.
- **Behaviour:** the fill *grows* from its left edge to its value on mount (`grow-x`, `0.6s` exponential ease-out), so the bar reads as "how far", not a static stripe. With no animation it simply shows full.

### Recommendation Card (signature component)
The component that embodies the whole product POV. A flat card holding: a type badge + confidence label, a one-line *what* and a muted *why*, and — when there's a quantified upside — a `pos/10` benefit chip ("≈ £84/yr interest avoided"). Beneath sits a **"Why this?"** disclosure: a native `<details class="reveal">` whose content *animates its own height open* (the one authored motion moment in the app), revealing the reasoning trace inside a `2px` left border — why this account, what happens if ignored, the reason-code badges, the constraints checked, and the from → to accounts. It is the visual argument that no suggestion is a black box.

### Confirm control + Undo toast
A destructive, hard-to-reverse action (Close account, Delete goal, Delete transaction) is wrapped in `ConfirmButton` — **prevention and recovery together**. The first click *arms* an inline **Confirm / Cancel** in place (Confirm is a bordered `neg` control; Cancel takes focus on arm and `Esc` dismisses). Confirming runs the action and raises an **Undo toast**: a `surface` card at the bottom of the screen ("Deleted …" · **Undo**), auto-dismissing after 9s, stacking (max 3), announced as a polite live region. Undo reverses it — reactivate the account, or recreate the goal / transaction from the captured record. No native dialog, no modal; nothing irreversible fires on a single stray click, and even a confirmed action has a way back.

### Focus
Every interactive element shares one keyboard-focus indicator: a **2px Signal-Orange ring** (`--primary-ink`) at `2px` offset, applied on `:focus-visible` only — so keyboard and assistive users always see a clear, consistent focus while pointer clicks stay ringless. It follows each control's own radius, clears AA in both schemes, and thickens to `3px` under `prefers-contrast`. Minimum touch target is `24px` (WCAG 2.5.8); interactive text like the "Why this?" disclosure is padded to reach it.

### Route states (loading, error, not-found)
Every route resolves to a calm fallback rather than a blank frame or a browser default — and the in-app ones render **inside the shell**, so the nav never disappears.
- **Loading** — an instant skeleton that echoes the page's own chrome (a header block, a hero card, stacked detail cards) in pulsing `surface-2` blocks, shown while the next segment's data streams in. It collapses to a static shape under reduced-motion and announces itself as a `role="status"` region. Placed at the `(app)` level, so every in-app navigation gets it for free.
- **Error** — a centred `surface` card in the **caution** register (`warn`, *not* `neg` — a recoverable hiccup is not a loss): a triangle mark, "This view didn't load", the reassurance that *nothing was changed*, a **Try again** primary button (`retry()`), and a quiet support reference (the error `digest`). The raw error message is never shown to the client.
- **Not found** — a **neutral** card (a missing page is navigation, not caution): a compass mark, "We couldn't find that page", and the routes back. The in-app `not-found` keeps the shell for a `notFound()` thrown inside the app (e.g. a stale account/goal id); a second, standalone `not-found` at the root catches wholly-unmatched URLs with just the wordmark and a way home.
- **Global error** — the last-resort boundary for a root-layout crash: its own document, themed to the OS scheme via `light-dark()`, carrying the same reassurance and a reload.

A route param is untrusted input: an id that can't resolve (bad format, or simply gone) is turned into a **404, not a 500**, at the data boundary — so the calm not-found state is what a stale link actually reaches.

### Defined terms (Explainer)
Finance vocabulary is explained where it's used, not in a glossary the reader has to go find — the "no black box" POV turned on the product's own language. A jargon term (*effective savings rate*, *cash runway*, *ISA allowance*) is set with a **dotted underline** — an editorial "there's a definition here" cue — and reveals a one-sentence, plain-language gloss on hover, keyboard focus, or tap. The gloss is a floating `surface` card (the sanctioned overlay shadow) that materialises with `pop-in`. The affordance is a real `<button>`, so keyboard and touch reach it; `role="tooltip"` + `aria-describedby` hand the gloss to screen readers; the global focus ring still shows on keyboard focus; and `Esc` dismisses it without moving focus (WCAG 1.4.13). Every definition lives in **one glossary module**, so a term reads identically everywhere it appears. In forms, the same meaning is given as persistent helper text under the field, not a hover tooltip — a form should state what it needs before you submit.

### Command palette (⌘K)
Keyboard-first reach across a 12-page app, in one overlay. **⌘K / Ctrl-K** (or the header **Search ⌘K** chip) opens a centred `surface` panel — the sanctioned floating pattern (`border-border`, `shadow-xl`, `pop-in`) over the drawer's scrim — listing every page and the core actions (add transaction, import CSV, new account / goal / category, toggle theme, sign out), each filterable by name or keyword. It is a **combobox + listbox**: the field keeps focus and drives an `aria-activedescendant` cursor, so `↑`/`↓` move, `↵` runs, and `Esc` closes and returns focus to where it was; a footer spells those keys out. The design system holds — **One Voice** keeps the only accent the focus ring, and the active row is a neutral `surface-2` fill, never orange. The 12 routes come from the **same shared list the nav renders**, so palette and nav can't drift. The chip is a `lg`-and-up affordance; below that, the drawer is the way around.

### Bulk actions (multi-select)
The transactions ledger doubles as a triage surface: tick rows and act on them together. A checkbox column and a "select page" checkbox (a dash when the page is only partly ticked) drive a bar that replaces the toolbar hint the moment anything is selected — "N selected", then the verbs: recategorise, make a rule, export CSV, delete. When the whole page is ticked and more matches exist, a banner offers **"Select all N matching this filter"**, so a search-then-act (*"Tesco" → all 213 → recategorise*) spans every page — applied server-side by the same filter the list already uses, not a list of ids. The register stays **One Voice**: ticked rows take a neutral `surface-2` tint (never orange), the verbs are bordered neutral controls, and only destructive **Delete** borrows the `neg` register — through the very same two-step `ConfirmButton` + Undo toast the single-row delete uses. Delete removes only user-entered rows and says what it kept (*"Deleted 12 · kept 18 imported"*); recategorise skips transfers; **make a rule** turns the selection's merchants into KEYWORD auto-categorise rules for future imports and files the current rows too. The one-off inline controls (per-row category, per-row delete) stay for single edits.

## Do's and Don'ts

### Do:
- **Do** lead every screen with a large, bare, tabular figure and a small muted eyebrow above it.
- **Do** reach for a semantic colour token by meaning — `text-pos` for gains, `text-neg` for loss, `text-warn` for caution — never a raw hex.
- **Do** keep every action and semantic colour at ≥4.5:1 as text: `bg-primary-strong` for buttons, `text-primary-ink` for orange text/links; reserve vivid `bg-primary` (`#fc3d12`) for the logo mark and large / non-text fills.
- **Do** guard a destructive, hard-to-reverse action (close account, delete goal, delete transaction) behind the two-step `ConfirmButton` — which also raises an **Undo** toast — so nothing fires on a single click and every confirmed action has a way back.
- **Do** let the global `:focus-visible` ring show on every interactive element, and pad interactive text (links, disclosures) to a ≥24px touch target.
- **Do** give every route a calm fallback — a shell-preserving loading skeleton, an error boundary with **Try again** (`retry()`), and a not-found — and turn an untrusted route param that can't resolve (a bad id) into a **404, not a 500**.
- **Do** keep surfaces flat; build structure from the `border-border` hairline and the `bg`→`surface`→`surface-2` tonal ladder.
- **Do** set money in the sans stack with tabular numerals (`.tnum`) and `whitespace-nowrap`.
- **Do** make reasoning reachable — put the "why" one disclosure away, and let it unfold.
- **Do** explain finance jargon at its point of use — a dotted-underline `Explainer` term with a one-line plain-language gloss (or persistent helper text in a form), drawn from the single glossary so the wording stays consistent everywhere.
- **Do** give power users a keyboard path — the **⌘K command palette** reaches every page and core action from one overlay, driven from the shared nav list so it never drifts, with the only accent its focus ring.
- **Do** make a high-volume list triage-able — multi-select with a bulk bar (recategorise, rule, export, delete), "select all N matching" for cross-page reach applied by filter, a neutral `surface-2` tint for ticked rows, and destructive bulk delete behind the same `ConfirmButton` + Undo as a single row.
- **Do** support both schemes through `light-dark()` tokens, and keep motion to transform/opacity so it degrades cleanly under reduced-motion.

### Don't:
- **Don't** use Signal Orange for anything but the brand mark and the primary action. No orange fills, dividers, or highlights.
- **Don't** give a resting card a drop shadow — shadow means "floating" or "scroll-detached", nothing else.
- **Don't** strip the `:focus-visible` ring (a bare `outline-none` with nothing in its place) — it's the keyboard user's only cue. A soft glow is still out; the focus indicator is a crisp 2px Signal-Orange line.
- **Don't** set money or figures in the mono font — mono is only for literal credentials.
- **Don't** show a black-box score or an unexplained number; if a figure can't be traced to accounts and transactions, it doesn't belong.
- **Don't** let data tables reflow the page — scroll them horizontally inside their card.
