# Design System
## Wendo Coffee Bistro — Restaurant Management System (RMS)
**Version:** 1.0  
**Status:** Draft  
**Date:** 2026-02-22  

---

## Table of Contents

1. [Aesthetic Direction](#1-aesthetic-direction)
2. [Brand Foundation](#2-brand-foundation)
3. [Colour System](#3-colour-system)
4. [Typography](#4-typography)
5. [Spacing & Layout](#5-spacing--layout)
6. [Elevation & Shadow](#6-elevation--shadow)
7. [Border Radius](#7-border-radius)
8. [Component Specifications](#8-component-specifications)
9. [Status System](#9-status-system)
10. [Iconography](#10-iconography)
11. [Motion & Interaction](#11-motion--interaction)
12. [Interface-Specific Patterns](#12-interface-specific-patterns)
13. [Tailwind Configuration](#13-tailwind-configuration)
14. [Data Surfaces — Office Mode](#14-data-surfaces--office-mode)

---

## 1. Aesthetic Direction

### The Philosophy

Wendo is not a fast food chain. It is a premium coffee bistro where the experience of the space — the warmth, the scandanavian aesthetic, the quiet craft of a well-made espresso — is central to the brand. The internal management system must feel like it belongs to that same world. It is the digital extension of the physical space.

This means the system should feel like it was designed by someone who drinks good coffee and pays attention to details. Every margin, every colour choice, every transition is a deliberate act. Nothing is accidental. Nothing is generic.

**The single most important principle:** Restraint is a premium signal. The system earns trust through what it does not do — no loud colours, no aggressive shadows, no unnecessary animations, no cluttered layouts. Confidence expressed through calm.

---

### The Feeling

Think of the best coffee shop you have ever sat in. The light was good. The menu was simple and well-considered. Everything was in its place. You felt no friction. You did not have to think — you just experienced it.

That is what every screen in this system should feel like. A waiter picking up an order should feel no friction. A chef seeing a new ticket should read it in one glance. A manager reviewing the day's numbers should feel clarity, not noise.

**Calm. Considered. Unhurried — even under the pressure of a busy service.**

---

### What This System Is Not

This is a list of things this system must never feel like:

- A generic SaaS dashboard with blue buttons and grey sidebars
- A startup product template downloaded from a UI kit
- An app that shouts with colour to compensate for weak design
- Cluttered — no element should feel like it arrived without an invitation
- Cold — clinical white, hard shadows, and zero personality are the enemy
- Playful — this is a working tool used by professionals under pressure. It respects their time.

---

### Visual Moodboard in Words

- The logo: deep espresso brown, warm gold badge treatment, coffee beans as texture
- The physical space: natural light, lush greenery, warm wood tones, white ceramic cups
- The reference UIs: off-white backgrounds, rich brown action elements, generous breathing room, clean card designs with soft shadows
- The website: warm photography, confident typography, community warmth without being casual

---

### Design Pillars

**1. Warmth over sterility.** Every colour decision leans warm. White has a cream undertone. Greys pull amber, not blue. The system feels like it runs on the same energy as a freshly pulled espresso — not a spreadsheet.

**2. Typography carries personality.** Headings use a refined serif — this is where Wendo's brand character lives. Operational text uses a clean geometric sans-serif — legible, efficient, never fussy.

**3. Colour is used with intention.** The primary espresso brown appears only where action is required. It does not decorate — it directs. Overusing it dilutes its authority.

**4. Space is not emptiness — it is clarity.** Generous padding signals confidence. Dense, cramped interfaces signal anxiety. Every screen should have room to breathe.

**5. Every component earns its place.** Before adding any UI element, the question is: does this help the user do their job faster? If the answer is no, it does not belong on the screen.

---

## 2. Brand Foundation

### Logo Treatment

The Wendo logo mark is a circular badge in deep espresso brown with warm gold lettering and border. When used in the system:
- Minimum size: 32px height
- Always on a light background — never placed on dark or busy backgrounds in the app interface
- Clear space: minimum 16px on all sides
- Do not recolour, distort, or add effects

### Brand Voice in UI Copy

UI copy should reflect the same warmth as the brand — direct, clear, never robotic.

| Context | Generic (Never use) | Wendo voice |
|---|---|---|
| Empty order list | "No records found" | "No orders yet today" |
| Successful order | "Operation successful" | "Order #7 sent to the kitchen" |
| Clock-in error | "Location validation failed" | "You need to be at the branch to clock in" |
| Loading state | "Loading..." | "Getting things ready..." |
| Offline state | "Connection error" | "You're offline — check your connection" |

---

## 3. Colour System

### Design Rationale

The palette is built from two anchors: the Wendo logo (deep espresso brown + warm gold) and the physical space (warm whites, natural light, greenery). Every colour either comes from those anchors or supports them without competing.

There is one exception to the warm rule: the "Ready" status uses a muted sage green. This is intentional — green universally signals completion and go. Warming it (making it olive or amber) would create confusion. It is the only cool note in the palette and it earns its place by serving a critical functional purpose.

---

### Primary Palette

```
Espresso       #2C1810    — Primary action colour. Deep, rich, authoritative.
                            Buttons, active nav, key interactive elements.
                            The darkest, most intentional colour in the system.

Espresso Light #4A2C1A    — Hover state for Espresso. Slightly lifted.

Crema          #F5F0E8    — Primary background. Warm white with a cream undertone.
                            Never a cold #FFFFFF. This is the canvas everything lives on.

Parchment      #EDE7DC    — Secondary background. Cards, input fields, modals.
                            Slightly deeper than Crema — creates gentle layering.
```

---

### Accent Palette

```
Amber          #C4862A    — Secondary accent. Warm gold pulled from the logo badge.
                            Used for highlights, selected states, premium indicators,
                            star ratings, featured items. Never overused.

Amber Light    #F0C97A    — Light amber for backgrounds behind amber text/icons.
                            Badges, tag backgrounds.
```

---

### Neutral Palette

```
Stone 900      #1C1917    — Primary text. Near-black with a warm undertone.
                            Never pure #000000.

Stone 700      #44403C    — Secondary text. Subheadings, descriptions, labels.

Stone 500      #78716C    — Muted text. Placeholders, hints, timestamps, captions.

Stone 300      #D6D3D1    — Dividers, borders, subtle separators.

Stone 200      #E8E5E1    — Light borders, input outlines in default state.

Stone 100      #F4F2EF    — Hover backgrounds, table row hover, subtle fills.
```

---

### Semantic Palette

These colours communicate system states. Each is warm-toned to stay cohesive with the palette — except Ready (see rationale above).

```
// Pending — soft warm sand. Waiting, not urgent.
Pending BG     #FDF3DC
Pending Text   #92650A
Pending Border #F0D080

// In-Progress — warm caramel. Active, moving.
InProgress BG  #FEF0E0
InProgress Text #A04F0A
InProgress Border #F5B87A

// Ready — muted sage. Done, collect now.
Ready BG       #EDFAF1
Ready Text     #1A6B3C
Ready Border   #86EFAC

// Closed — cool grey. Neutral, complete, archived.
Closed BG      #F4F4F5
Closed Text    #71717A
Closed Border  #D4D4D8

// Cancelled — muted terracotta. Soft alert, not alarming.
Cancelled BG   #FDF2F0
Cancelled Text #9B3A2A
Cancelled Border #F5A898

// Error — warm red, not alarming
Error BG       #FEF2F2
Error Text     #991B1B
Error Border   #FCA5A5

// Success — same as Ready
Success BG     #EDFAF1
Success Text   #1A6B3C
Success Border #86EFAC

// Warning — warm amber
Warning BG     #FFFBEB
Warning Text   #92400E
Warning Border #FCD34D
```

---

### Colour Usage Rules

- **Espresso** is used for primary buttons, active navigation states, and critical action elements only. It is never used as a background for large areas.
- **Amber** is used sparingly — one or two touches per screen maximum. It is a highlight, not a theme colour.
- **Stone neutrals** do the heavy lifting for text hierarchy and structural separation.
- **Semantic colours** are used only in their designated status contexts. A Pending badge is never styled with Espresso because the design "looks better". Semantic colours communicate meaning.
- **Never** use pure `#FFFFFF` white or pure `#000000` black anywhere in the interface.

---

## 4. Typography

### Typeface Selection

**Display & Headings: Cormorant Garamond**
An elegant, high-contrast serif with exceptional refinement at large sizes. Pulls from the editorial and artisanal quality of premium coffee culture. Has warmth and personality without being decorative or ornate. Used for display text, page headings, and section titles.

Google Fonts: `Cormorant Garamond` — weights 400, 500, 600

**Body & UI: Inter**
*(Revised 2026-07-06 — replaced Inter.)* A humanist neo-grotesque designed specifically for user interfaces at screen sizes: tall x-height, open apertures, disambiguated characters (Il1, 0O), and proper tabular figures. It is the de facto standard for enterprise product UI (Linear, GitHub, Figma) because it stays effortlessly legible at the 12–14px sizes where operational software lives. The previous choice, Inter, was a Futura-style geometric — beautiful in brand contexts but measurably harder to read as dense UI text; it was replaced after the first real-world review.

Google Fonts: `Inter` — variable font, one request

**Why these two together:**
Cormorant is the personality — the serif that signals craft, history, and premium intention, reserved for titles and brand moments. Inter is the workhorse — invisible, precise, and legible under pressure. The brand lives in the hero type and the espresso/amber accents; the daily work happens in a font engineered for exactly that.

---

### Type Scale

All sizes in rem. Base: 16px = 1rem.

```
// Display — Cormorant Garamond, used for hero moments and page titles
display-2xl   3.5rem  / 56px   weight 500   line-height 1.1   tracking -0.02em
display-xl    3rem    / 48px   weight 500   line-height 1.15  tracking -0.02em
display-lg    2.25rem / 36px   weight 500   line-height 1.2   tracking -0.01em

// Headings — Inter
heading-xl    1.875rem / 30px  weight 600   line-height 1.25  tracking -0.01em
heading-lg    1.5rem   / 24px  weight 600   line-height 1.3   tracking -0.01em
heading-md    1.25rem  / 20px  weight 600   line-height 1.35  tracking 0
heading-sm    1.125rem / 18px  weight 600   line-height 1.4   tracking 0

// Body — Inter
body-lg       1rem     / 16px  weight 400   line-height 1.6   tracking 0
body-md       0.9375rem/ 15px  weight 400   line-height 1.6   tracking 0
body-sm       0.875rem / 14px  weight 400   line-height 1.5   tracking 0

// Labels & UI — Inter
label-lg      0.875rem / 14px  weight 500   line-height 1.4   tracking 0.01em
label-md      0.8125rem/ 13px  weight 500   line-height 1.4   tracking 0.01em
label-sm      0.75rem  / 12px  weight 500   line-height 1.3   tracking 0.02em

// Caption — Inter
caption       0.75rem  / 12px  weight 400   line-height 1.4   tracking 0.01em
```

---

### Typography Rules

- **Cormorant Garamond is used only for display text and top-level page headings.** Not for buttons, labels, nav items, or body copy. Its job is to give personality to hero moments — not to do operational work.
- **Inter does all operational work.** Every button, label, navigation item, form field, table cell, and body paragraph uses Inter.
- **Never use font weights below 400 in UI.** Light weights (300) are reserved for large display text only.
- **Never exceed two typefaces in general UI.** These two and nothing else. (Single scoped exception: Excel-style data surfaces use the Calibri sheet stack — see §14.)
- **Fonts follow function.** Serif = titles and brand moments. Sans = controls, labels, body. Numbers = sans, semibold, `tabular-nums` — always, everywhere. If an element conveys data, it is never set in the serif.
- **Heading hierarchy must be strict.** Every page has one `heading-xl` maximum. Skipping levels (h1 to h3) is not permitted.
- **Line length for body text:** Maximum 65 characters per line on desktop. Mobile is constrained by viewport naturally.

---

## 5. Spacing & Layout

### Spacing Scale

Built on a base unit of 4px. All spacing values are multiples of this base.

```
space-0    0px
space-1    4px     — tight internal padding, icon gaps
space-2    8px     — compact element spacing
space-3    12px    — small gaps within components
space-4    16px    — standard component padding
space-5    20px    — medium spacing
space-6    24px    — comfortable component padding
space-8    32px    — section spacing within a view
space-10   40px    — generous component separation
space-12   48px    — section separation on desktop
space-16   64px    — major section breaks
space-20   80px    — page-level vertical rhythm
```

### Layout Principles

**Mobile (Waiter & Staff phones):** Single column. Minimum touch target size: 44px × 44px. Critical actions (Submit Order, Clock In) are thumb-reachable — positioned in the lower 60% of the screen. Bottom navigation bar. Content padded 16px horizontally.

**Tablet (KDS & BDS):** Three-column layout for the order queue. Column width is equal thirds of viewport minus gaps. Minimum card height: 160px. Content padded 24px horizontally. No bottom navigation — full-screen, immersive display mode.

**Desktop (Manager & Director):** Sidebar navigation, 240px wide. Main content area with maximum width 1280px, centred. Content padded 32px horizontally. Dashboard uses a 12-column grid.

### Breakpoints

```
sm     640px    — large phones landscape
md     768px    — tablets portrait (KDS/BDS)
lg     1024px   — tablets landscape, small laptops
xl     1280px   — desktop (manager/director dashboard)
2xl    1536px   — large desktop
```

---

## 6. Elevation & Shadow

Shadows use warm undertones — never pure grey or blue-tinted box shadows.

```
// Elevation 0 — no shadow. Flat, blends into background.
shadow-none    none

// Elevation 1 — subtle lift. Cards on Crema background.
shadow-sm      0 1px 3px rgba(44, 24, 16, 0.06),
               0 1px 2px rgba(44, 24, 16, 0.04)

// Elevation 2 — standard card. Default for most cards.
shadow-md      0 4px 6px rgba(44, 24, 16, 0.07),
               0 2px 4px rgba(44, 24, 16, 0.04)

// Elevation 3 — raised element. Dropdowns, popovers.
shadow-lg      0 10px 15px rgba(44, 24, 16, 0.08),
               0 4px 6px rgba(44, 24, 16, 0.04)

// Elevation 4 — floating element. Modals, bottom sheets.
shadow-xl      0 20px 25px rgba(44, 24, 16, 0.10),
               0 10px 10px rgba(44, 24, 16, 0.04)

// Focus ring — used for keyboard and touch focus states
focus-ring     0 0 0 3px rgba(196, 134, 42, 0.35)
               (warm amber ring, not blue)
```

**Rules:**
- Never stack shadows (a card inside a modal does not also have a shadow)
- Hover states increase elevation by one level
- Focus ring uses Amber, never blue

---

## 7. Border Radius

```
radius-none    0px       — data tables, full-bleed images
radius-sm      4px       — subtle rounding. Input fields, small badges.
radius-md      8px       — standard rounding. Cards, buttons, dropdowns.
radius-lg      12px      — comfortable rounding. Modal corners, larger cards.
radius-xl      16px      — generous rounding. Bottom sheets, feature cards.
radius-2xl     24px      — prominent rounding. Hero cards on mobile.
radius-full    9999px    — pill shapes. Status chips, tags, toggle buttons.
```

**Rules:**
- Buttons use `radius-md` (8px) — confident, not aggressive
- Status badges and chips use `radius-full` — pill shape signals "label", not "action"
- Modals use `radius-lg` (12px) on desktop; `radius-xl` on mobile (feels native)
- Input fields use `radius-sm` (4px) — structured and form-like
- KDS/BDS order cards use `radius-md` (8px)

---

## 8. Component Specifications

### 8.1 Buttons

Buttons communicate importance through visual weight. The hierarchy is strict — only one Primary button per view section.

#### Primary Button
```
Background:   Espresso (#2C1810)
Text:         Crema (#F5F0E8)
Font:         Inter, label-lg, weight 500
Height:       44px (mobile), 40px (desktop)
Padding:      0 24px
Border Radius: radius-md (8px)
Border:       none

Hover:        Background → Espresso Light (#4A2C1A)
              Transition: 150ms ease
Active:       Scale 0.98, same background
Disabled:     Background → Stone 200, Text → Stone 500, cursor: not-allowed
Loading:      Background stays Espresso, text replaced by subtle spinner
              Spinner: Crema coloured, 16px
```

#### Secondary Button
```
Background:   transparent
Text:         Espresso (#2C1810)
Border:       1.5px solid Espresso (#2C1810)
Font:         Inter, label-lg, weight 500
Height:       44px (mobile), 40px (desktop)
Padding:      0 24px
Border Radius: radius-md

Hover:        Background → Stone 100
Active:       Scale 0.98
Disabled:     Border → Stone 300, Text → Stone 400
```

#### Ghost Button
```
Background:   transparent
Text:         Stone 700 (#44403C)
Border:       none
Font:         Inter, label-md, weight 500
Height:       36px
Padding:      0 16px
Border Radius: radius-md

Hover:        Background → Stone 100
Active:       Background → Stone 200
```

#### Destructive Button
```
Background:   transparent
Text:         #991B1B (Error Text)
Border:       1.5px solid #FCA5A5 (Error Border)
Font:         Inter, label-lg, weight 500

Hover:        Background → Error BG (#FEF2F2)
```

#### Button Sizes
```
Large (lg):   Height 48px, padding 0 28px, label-lg — primary CTAs on mobile
Default (md): Height 44px, padding 0 24px, label-lg — standard use
Small (sm):   Height 36px, padding 0 16px, label-md — compact contexts
```

---

### 8.2 Form Inputs

#### Text Input
```
Background:   Parchment (#EDE7DC)
Border:       1.5px solid Stone 200 (#E8E5E1)
Border Radius: radius-sm (4px)
Height:       44px (mobile), 40px (desktop)
Padding:      0 16px
Font:         Inter, body-md
Text colour:  Stone 900

Label:        Inter, label-sm, Stone 700, 8px above input
Placeholder:  Stone 500

Focus:        Border → Espresso (#2C1810), shadow-focus-ring (amber)
Error:        Border → Error Border, helper text in Error Text colour below
Disabled:     Background → Stone 100, text → Stone 400, cursor: not-allowed
```

#### Select / Dropdown
```
Same base as Text Input
Right-side chevron icon: Stone 500
On open: border → Espresso, dropdown appears with shadow-lg
Dropdown background: white (#FFFFFF)
Option hover: Stone 100 background
Option selected: Espresso text, amber left border 2px
```

#### Toggle / Switch
```
Track (off):  Stone 300, width 44px, height 24px, radius-full
Track (on):   Espresso (#2C1810)
Thumb:        White, 20px diameter, shadow-sm
Transition:   200ms ease
Focus ring:   Amber, 3px
```

#### Textarea
```
Same as Text Input but:
Min height: 96px
Resize: vertical only
Padding: 12px 16px
```

---

### 8.3 Cards

Cards are the primary container for content throughout the system. They must feel solid and intentional — not like floating boxes.

#### Standard Card
```
Background:   White (#FFFFFF)
Border:       1px solid Stone 200
Border Radius: radius-md (8px)
Shadow:       shadow-md
Padding:      24px (desktop), 16px (mobile)

Hover (if interactive): shadow-lg, transition 150ms
```

#### Order Card (Waiter active orders)
```
Background:   White
Border-left:  3px solid — colour matches order status (see Status System)
Border:       1px solid Stone 200 (other sides)
Border Radius: radius-md
Shadow:       shadow-sm
Padding:      16px

Header:       Order number (heading-sm, Espresso) + type badge + time elapsed
Body:         Item list (body-sm, Stone 700)
Footer:       Status chip + waiter name (caption, Stone 500)
```

#### KDS Order Card (Kitchen Display)
```
Background:   White
Border-left:  4px solid — colour matches prep ticket status
Border Radius: radius-md
Shadow:       shadow-md
Padding:      20px
Min height:   160px

Order number: heading-md, Espresso, prominent
Order type + table: label-md, Stone 700
Items list:   body-md, Stone 900, 1.6 line height
              Quantity bold (weight 600), item name regular
Instructions: label-sm, Stone 500, italic, top-bordered with Stone 200
Timer:        label-sm, Stone 500 → Amber after 10 min → Error after 20 min
Claim button: Full-width, Primary style, bottom of card
Ready button: Full-width, Espresso background, "Mark Ready" — only shown In-Progress
```

#### Stat Card (Dashboard)
```
Background:   White
Border:       1px solid Stone 200
Border Radius: radius-lg (12px)
Shadow:       shadow-sm
Padding:      24px

Label:        label-sm, Stone 500, uppercase, tracking 0.08em
Value:        display-lg (Cormorant), Stone 900
Subtext:      caption, Stone 500
Icon:         24px, Stone 400, top-right corner
```

#### Menu Item Card (Waiter order-taking)
```
Background:   White
Border:       1px solid Stone 200
Border Radius: radius-md
Shadow:       shadow-sm
Padding:      16px

Name:         heading-sm, Stone 900
Description:  body-sm, Stone 500, 2 lines max then truncate
Price:        label-lg, Espresso, weight 600
Add button:   32px circle, Espresso background, white + icon
              Position: bottom-right of card

Unavailable:  Opacity 0.45, Add button hidden, "Unavailable" label-sm Stone 500
```

---

### 8.4 Navigation

#### Mobile Bottom Navigation (Waiter / Chef / Barista phones)
```
Background:   White
Border-top:   1px solid Stone 200
Height:       64px + safe area inset
Padding:      0 8px

Tab item:
  Icon:       24px
  Label:      label-sm
  Inactive:   Stone 400 (icon + text)
  Active:     Espresso (icon + text), amber 2px top indicator line
  Tap target: minimum 44px × 44px
```

#### Tablet Sidebar (KDS / BDS — minimal, mostly hidden)
```
The KDS/BDS is a fullscreen display. Navigation is minimal.
Top bar only: branch name (heading-sm), clock (label-md), connection indicator
No sidebar — the display is the entire interface
```

#### Desktop Sidebar (Manager / Director)
```
Background:   White
Border-right: 1px solid Stone 200
Width:        240px
Padding:      24px 16px

Logo:         Top, 32px height, 24px margin-bottom
Section label: label-sm, Stone 400, uppercase, tracking 0.1em, margin-top 24px

Nav item:
  Height:     44px
  Padding:    0 16px
  Border Radius: radius-md
  Icon:       20px, left, 12px gap to label
  Label:      label-md, Inter
  Inactive:   Stone 600 (icon + text), transparent background
  Hover:      Stone 100 background, Stone 900 text
  Active:     Stone 100 background, Espresso text and icon,
              2px Espresso left border on the item
```

---

### 8.5 Modals & Bottom Sheets

#### Modal (Desktop)
```
Overlay:      rgba(28, 25, 23, 0.5) — warm dark, not pure black
Background:   White
Border Radius: radius-lg (12px)
Shadow:       shadow-xl
Max width:    560px (standard), 720px (wide)
Padding:      32px

Header:       heading-md + optional close button (ghost, top-right)
Body:         body-md, 24px top margin from header
Footer:       32px top margin, flex row, actions right-aligned
              Primary action right, secondary left
```

#### Bottom Sheet (Mobile)
```
Overlay:      rgba(28, 25, 23, 0.5)
Background:   White
Border Radius: radius-2xl top corners only (24px)
Shadow:       shadow-xl
Padding:      24px 20px
              Safe area bottom padding

Drag handle:  4px × 32px, Stone 300, radius-full, centred, 12px from top
Max height:   90vh
Scroll:       internal scroll when content overflows
```

---

### 8.6 Toast Notifications

Appear at the top-right on desktop, top-centre on mobile. Never stacked more than 3.

```
Background:   White
Border:       1px solid Stone 200
Border-left:  4px solid — semantic colour (success/error/warning/info)
Border Radius: radius-md
Shadow:       shadow-lg
Padding:      16px
Width:        360px (desktop), calc(100vw - 32px) (mobile)

Icon:         20px, semantic colour, left
Title:        label-lg, Stone 900
Message:      body-sm, Stone 600, optional
Close:        Ghost icon button, top-right

Auto-dismiss: 4 seconds (success/info), 6 seconds (warning), manual (error)
Enter:        Slide in from right (desktop), slide down from top (mobile)
Exit:         Fade out + slide
```

---

### 8.7 Badges & Status Chips

Status chips communicate order state. They are the most frequently read element in the operational interface — readability and instant recognition take priority.

```
Base:         radius-full, padding 4px 12px, label-sm weight 500
              Colour system: see Status System section

// Example: Pending
Background:   #FDF3DC
Text:         #92650A
Border:       1px solid #F0D080

// Size variant for KDS cards (larger, more readable at distance)
KDS chip:     padding 6px 16px, label-md weight 600
```

---

### 8.8 Empty States

Empty states should feel encouraging, not apologetic.

```
Container:    Centred, padding 48px 24px
Illustration: Simple line illustration, 120px, Stone 300 colour
              (No stock art. Simple geometric or icon-based.)
Heading:      heading-sm, Stone 700
Body:         body-sm, Stone 500, max-width 320px, centred
Action:       Primary button, 24px top margin (only when relevant)
```

Examples:
- No orders today: "Nothing yet — the day is just getting started"
- No staff on shift: "No one scheduled for this shift"
- Offline: "You're offline" + reconnect guidance

---

### 8.9 Loading States

#### Skeleton Screen
Used when content is loading for the first time. Preferred over spinners for content areas.

```
Background:   Stone 200
Border Radius: matches the element being replaced
Animation:    Shimmer — gradient sweep left to right
              Background: linear-gradient(90deg,
                Stone 200 25%, Stone 100 50%, Stone 200 75%)
              Background-size: 200% 100%
              Animation: shimmer 1.5s infinite
```

#### Inline Spinner
Used for button loading states and small inline contexts.

```
Size:         16px (button), 24px (inline), 40px (overlay)
Colour:       Crema (on Espresso button), Espresso (on light background)
Animation:    Rotate 360deg, 0.7s linear infinite
Border:       2px, transparent except 2px on one arc (current colour)
```

---

## 9. Status System

The status system is one of the most critical parts of the design. Operational staff read status dozens of times per minute under pressure. Every status must be instantly distinguishable by both colour and label — never rely on colour alone.

### Order Status

| Status | Label | Background | Text | Border | Usage |
|---|---|---|---|---|---|
| PENDING | Pending | `#FDF3DC` | `#92650A` | `#F0D080` | Order submitted, no prep started |
| IN_PROGRESS | In Progress | `#FEF0E0` | `#A04F0A` | `#F5B87A` | At least one station claimed |
| READY | Ready | `#EDFAF1` | `#1A6B3C` | `#86EFAC` | All stations complete |
| CLOSED | Closed | `#F4F4F5` | `#71717A` | `#D4D4D8` | Paid and done |
| CANCELLED | Cancelled | `#FDF2F0` | `#9B3A2A` | `#F5A898` | Cancelled before prep |

### Prep Ticket Status (KDS/BDS)

| Status | Label | Card Left Border | Meaning |
|---|---|---|---|
| PENDING | Waiting | `#F0D080` (warm sand) | Unclaimed, in the queue |
| IN_PROGRESS | In Progress | `#F5B87A` (caramel) | Claimed, being prepared |
| READY | Ready | `#86EFAC` (sage) | Done, awaiting collection |

The left border on KDS cards is the fastest visual cue — visible at a glance from across the kitchen. The colour must be thick enough to read at distance: 4px minimum.

### KDS Timer Colour Progression

Order cards on the KDS show a time elapsed counter since the order arrived. The timer colour changes to indicate urgency:

```
0–10 minutes:    Stone 500 (neutral, normal)
10–20 minutes:   Amber #C4862A (attention needed)
20+ minutes:     Error Text #991B1B (urgent)
```

This passive urgency signal means the chef does not need a manager to tell them an order is late — the display communicates it automatically.

---

## 10. Iconography

### Icon Library: Lucide Icons

Lucide is clean, geometric, and consistent. It is already part of the tech stack (`lucide-react`). The line weight and visual language are a natural fit for the Inter/Cormorant pairing — not too heavy, not too light.

### Sizing Standards

```
16px (size-4)    — inline icons within text, small labels
20px (size-5)    — navigation icons (sidebar), form field icons
24px (size-6)    — standard UI icons, button icons, card icons
32px (size-8)    — feature icons in empty states, stat card icons
48px (size-12)   — illustration-level icons in empty states
```

### Icon + Label Spacing

```
Icon left of label:   8px gap (12px for navigation items)
Icon right of label:  8px gap
Icon only (button):   padding 10px, no label gap needed
```

### Icon Colour Rules

- Icons inherit the colour of the text they accompany
- Standalone icons (stat cards, nav) use Stone 400–500 when inactive, Espresso when active
- Never use colourful icons decoratively — icons communicate function, not decoration
- Status icons follow the semantic colour system

### Key Icon Assignments

```
Orders / Menu:       ShoppingCart, UtensilsCrossed
Kitchen:             ChefHat
Barista:             Coffee
Dashboard:           LayoutDashboard
Staff:               Users
Shifts:              Calendar
Clock In/Out:        Clock
Reports:             BarChart2
Settings:            Settings2
Delivery:            Bike
Payment:             CreditCard
Notification:        Bell
Profile:             UserCircle
Online/Offline:      Wifi, WifiOff
Ready:               CheckCircle2
Pending:             Clock
In Progress:         Loader2
Cancelled:           XCircle
```

---

## 11. Motion & Interaction

### Timing Scale

```
duration-fast      150ms    — hover states, focus rings, colour transitions
duration-normal    250ms    — element transitions, small movements
duration-slow      400ms    — modals, bottom sheets, page transitions
duration-slower    600ms    — complex orchestrated sequences
```

### Easing Curves

```
ease-standard      cubic-bezier(0.4, 0.0, 0.2, 1)    — most transitions
ease-decelerate    cubic-bezier(0.0, 0.0, 0.2, 1)    — elements entering the screen
ease-accelerate    cubic-bezier(0.4, 0.0, 1, 1)       — elements leaving the screen
ease-spring        cubic-bezier(0.34, 1.56, 0.64, 1)  — playful but controlled
                                                          Used only for: adding item to cart,
                                                          successful clock-in confirmation
```

### Specific Interaction Patterns

**Adding an item to cart:**
The cart icon in the navigation nudges up by 4px and returns with `ease-spring` (250ms). A small count badge fades in. This is the one moment of warmth and delight in the waiter interface.

**New order arriving on KDS/BDS:**
The order card slides in from the top of the Pending column (translateY: -20px → 0, opacity: 0 → 1, 300ms, ease-decelerate). A subtle pulse animation runs once on the card border for 600ms — drawing the eye without being aggressive. Audio plays simultaneously.

**Claiming an order:**
Card moves from Pending to In-Progress column. The move is animated — the card fades out of Pending (200ms) and fades into In-Progress (200ms, 100ms delay). Not a jarring jump — a considered movement.

**Marking an order Ready:**
Card border colour transitions from caramel to sage green (400ms). A subtle checkmark icon appears. The waiter receives a notification.

**Modal enter/exit:**
Enter: overlay fades in (200ms) + modal scales from 0.96 to 1.0 and fades in (300ms, ease-decelerate).
Exit: overlay fades out + modal scales to 0.96 and fades out (200ms, ease-accelerate).

**Bottom sheet enter/exit:**
Enter: slides up from bottom (400ms, ease-decelerate).
Exit: slides back down (300ms, ease-accelerate).

**Page transitions:**
Subtle fade + slight upward movement (translateY: 8px → 0, opacity: 0 → 1, 300ms, ease-decelerate). Consistent across all route changes.

### Motion Principles

- **Motion communicates state changes.** If something changes state, motion helps the eye track it.
- **Never animate for decoration.** Every animation has a functional reason.
- **Duration should match distance.** Small movements are fast. Large movements take longer.
- **Respect reduced motion preferences.** All animations must check `prefers-reduced-motion` and disable or simplify when set.

```css
@media (prefers-reduced-motion: reduce) {
  * {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```

---

## 12. Interface-Specific Design Patterns

### 12.1 Waiter Mobile App

**Context:** A waiter is on their feet, moving between tables, likely one-handed. The environment is noisy. There may be time pressure. The interface must work without the user thinking about it.

**Design decisions:**
- Bottom navigation — thumb-reachable at all times
- Add to cart button on menu item cards is large (44px minimum) and in the bottom-right corner — natural thumb position
- The cart modal is a bottom sheet — pulls up from where the thumb is
- The Submit Order button is full-width, large (48px), at the bottom of the screen
- Order status updates appear as a banner at the top — never interrupts the waiter's current action
- The active orders list uses large, scannable cards — order number is the largest text element
- Colour-coded left borders on order cards for instant status recognition

**Typography in this interface:** Mostly Inter. Cormorant is used only for the page title on the Dashboard (e.g., "Good morning, James").

---

### 12.2 Kitchen Display System (KDS) & Barista Display System (BDS)

**Context:** A tablet mounted in the kitchen or at the barista station. Viewed from standing distance — potentially 60–90cm away. Hands are occupied or wet. Interaction must be minimal and deliberate. Visibility in varying lighting (kitchen heat, steam) must be high.

**Design decisions:**
- Full-screen three-column layout — Pending, In-Progress, Ready. No navigation, no distractions.
- Order cards are large and high-contrast — order number at 24px bold minimum
- Text sizes are one step larger than the mobile interface equivalents
- The Claim button is large and full-width at the bottom of each card — one deliberate tap
- The timer on each card is always visible — drives urgency naturally without a manager
- Colour-coded left borders are 4px thick — visible from across the station
- No animation on the claim/ready actions themselves — instant, decisive
- New order arrival: audio notification + card animation is the only interruption
- Dark mode option for the KDS/BDS only — kitchen environments sometimes benefit from lower screen brightness and higher contrast. Offer as a setting.

**KDS Dark Mode Colours:**
```
Background:     #1C1917 (Stone 900)
Card background: #292524
Card border:    #44403C
Primary text:   #F5F0E8 (Crema)
Secondary text: #A8A29E
Status borders: Same semantic colours — they work on dark
```

---

### 12.3 Manager & Director Web Dashboard

**Context:** Used at a desk or on a laptop, remotely or at the branch. Not time-pressured in the same way as operational staff, but needs to scan large amounts of information quickly. Reports must be clear at a glance.

**Design decisions:**
- Sidebar navigation — persistent, always visible on desktop
- Dashboard uses a card grid — 4 stat cards across the top, charts and tables below
- Stat card numbers use Inter semibold with `tabular-nums` — numbers are data and must be instantly comparable at a glance. (Revised 2026-07-06: the original serif-number rule failed in practice — Cormorant's thin numerals read as decoration, not information.)
- Tables are clean with no vertical borders — only horizontal dividers between rows
- Charts use the brand colour palette — Espresso as the primary series, Amber as secondary, Stone for tertiary
- Report exports are triggered by a button with a dropdown (PDF / CSV) — not a separate page
- The live orders feed on the manager dashboard uses the same card design as the waiter app — consistency across interfaces

---

### 12.4 Universal Patterns

**Page structure — every page:**
```
Page header:    Page title (heading-xl, Inter) + optional action button (top-right)
                Subtitle or breadcrumb below (body-sm, Stone 500)
                Border-bottom: 1px Stone 200, 24px margin-bottom
Content area:   Padded by layout system (16px mobile, 24px tablet, 32px desktop)
```

**Data tables:**
```
Header row:     label-sm, Stone 500, uppercase, tracking 0.08em
                Border-bottom: 2px Stone 200
Body rows:      body-sm, Stone 900
                Border-bottom: 1px Stone 100
                Height: 52px (comfortable tap target on all devices)
Row hover:      Stone 100 background
Sorted column:  Amber text on header, subtle amber tint on cells
```

**Form layout:**
```
All forms use single-column layout on mobile
Two-column grid available on desktop for related short fields (e.g., start time / end time)
Label always above input — never floating or placeholder-only
Helper text below input, 4px gap, label-sm Stone 500
Error text replaces helper text, same position, Error Text colour
Submit button: right-aligned on desktop, full-width on mobile
32px gap between field groups, 16px between label and next field
```

---

## 13. Tailwind Configuration

The complete Tailwind `theme.extend` configuration. Add this to `tailwind.config.ts`:

```typescript
import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Primary
        espresso: {
          DEFAULT: '#2C1810',
          light: '#4A2C1A',
        },
        crema: '#F5F0E8',
        parchment: '#EDE7DC',

        // Accent
        amber: {
          DEFAULT: '#C4862A',
          light: '#F0C97A',
        },

        // Neutrals (warm stone)
        stone: {
          100: '#F4F2EF',
          200: '#E8E5E1',
          300: '#D6D3D1',
          400: '#A8A29E',
          500: '#78716C',
          600: '#57534E',
          700: '#44403C',
          900: '#1C1917',
        },

        // Semantic
        status: {
          pending: {
            bg: '#FDF3DC',
            text: '#92650A',
            border: '#F0D080',
          },
          inprogress: {
            bg: '#FEF0E0',
            text: '#A04F0A',
            border: '#F5B87A',
          },
          ready: {
            bg: '#EDFAF1',
            text: '#1A6B3C',
            border: '#86EFAC',
          },
          closed: {
            bg: '#F4F4F5',
            text: '#71717A',
            border: '#D4D4D8',
          },
          cancelled: {
            bg: '#FDF2F0',
            text: '#9B3A2A',
            border: '#F5A898',
          },
        },
      },

      fontFamily: {
        display: ['Cormorant Garamond', 'Palatino Linotype', 'Book Antiqua', 'serif'],
        sans: ['Inter', 'Futura', 'Century Gothic', 'sans-serif'],
      },

      fontSize: {
        'display-2xl': ['3.5rem', { lineHeight: '1.1', letterSpacing: '-0.02em' }],
        'display-xl': ['3rem', { lineHeight: '1.15', letterSpacing: '-0.02em' }],
        'display-lg': ['2.25rem', { lineHeight: '1.2', letterSpacing: '-0.01em' }],
        'heading-xl': ['1.875rem', { lineHeight: '1.25', letterSpacing: '-0.01em' }],
        'heading-lg': ['1.5rem', { lineHeight: '1.3', letterSpacing: '-0.01em' }],
        'heading-md': ['1.25rem', { lineHeight: '1.35' }],
        'heading-sm': ['1.125rem', { lineHeight: '1.4' }],
        'body-lg': ['1rem', { lineHeight: '1.6' }],
        'body-md': ['0.9375rem', { lineHeight: '1.6' }],
        'body-sm': ['0.875rem', { lineHeight: '1.5' }],
        'label-lg': ['0.875rem', { lineHeight: '1.4', letterSpacing: '0.01em' }],
        'label-md': ['0.8125rem', { lineHeight: '1.4', letterSpacing: '0.01em' }],
        'label-sm': ['0.75rem', { lineHeight: '1.3', letterSpacing: '0.02em' }],
        caption: ['0.75rem', { lineHeight: '1.4', letterSpacing: '0.01em' }],
      },

      spacing: {
        '18': '4.5rem',
        '22': '5.5rem',
      },

      borderRadius: {
        sm: '4px',
        md: '8px',
        lg: '12px',
        xl: '16px',
        '2xl': '24px',
      },

      boxShadow: {
        sm: '0 1px 3px rgba(44, 24, 16, 0.06), 0 1px 2px rgba(44, 24, 16, 0.04)',
        md: '0 4px 6px rgba(44, 24, 16, 0.07), 0 2px 4px rgba(44, 24, 16, 0.04)',
        lg: '0 10px 15px rgba(44, 24, 16, 0.08), 0 4px 6px rgba(44, 24, 16, 0.04)',
        xl: '0 20px 25px rgba(44, 24, 16, 0.10), 0 10px 10px rgba(44, 24, 16, 0.04)',
        focus: '0 0 0 3px rgba(196, 134, 42, 0.35)',
      },

      transitionDuration: {
        fast: '150ms',
        normal: '250ms',
        slow: '400ms',
        slower: '600ms',
      },

      transitionTimingFunction: {
        standard: 'cubic-bezier(0.4, 0.0, 0.2, 1)',
        decelerate: 'cubic-bezier(0.0, 0.0, 0.2, 1)',
        accelerate: 'cubic-bezier(0.4, 0.0, 1, 1)',
        spring: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
      },

      keyframes: {
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        'fade-up': {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'slide-in-top': {
          '0%': { opacity: '0', transform: 'translateY(-20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'slide-up': {
          '0%': { transform: 'translateY(100%)' },
          '100%': { transform: 'translateY(0)' },
        },
        pulse: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.5' },
        },
      },

      animation: {
        shimmer: 'shimmer 1.5s infinite linear',
        'fade-up': 'fade-up 300ms cubic-bezier(0.0, 0.0, 0.2, 1)',
        'slide-in-top': 'slide-in-top 300ms cubic-bezier(0.0, 0.0, 0.2, 1)',
        'slide-up': 'slide-up 400ms cubic-bezier(0.0, 0.0, 0.2, 1)',
      },
    },
  },
  plugins: [],
}

export default config
```

---

*This Design System is the single source of truth for every visual decision in the Wendo RMS. No component should be built without referencing it. Any deviation requires a deliberate decision and a document update — not an ad-hoc choice made under time pressure.*

## 14. Data Surfaces — Office Mode

*Added 2026-07-06. Decision: hybrid design direction.*

### The Hybrid Decision

*Revised 2026-07-06: the owner reversed the page-canvas part of this decision after seeing it live — the warm crema canvas (`#F5F0E8`) is the primary page background on **all** pages, including back-office ones. `office.canvas` (`#FAFAFA`) must not be used as a page background.*

The office idiom lives in the **data surfaces themselves**, not the canvas. Payroll, reconciliation, reports and analytics render their data through Excel-style components — gridlines, colored header bands, high density, tabular numerals — as white cards sitting on the crema canvas.

- **All pages**: warm crema canvas.
- **Office data surfaces** (payroll, reports, reconciliation, analytics): Excel-style tables and sheets inside white cards.
- Wendo **espresso** remains the primary action color and **amber** the highlight color everywhere — the brand lives in the accents and typography, not the canvas.

### Typeface for Sheets

Excel-style surfaces use the `font-sheet` stack: `Calibri, Segoe UI, Arial, sans-serif`. This is a deliberate exception to the two-typeface rule — it exists **only** inside `Sheet` and `ExcelTable` components, where the spreadsheet idiom is the point. It must never leak into general UI.

### Sheet Tokens

All Excel-surface colors live under `sheet.*` in `tailwind.config.ts`: gridlines (`sheet.grid`, `sheet.grid-dense`), header bands (`sheet.band.{navy,green,red,purple,teal,gray}`), cell washes (`sheet.tint.*`), selection visuals (`sheet.selection`, `sheet.active`), zebra/hover/totals/locked rows, and the Excel-green status bar (`sheet.statusbar`). Never hardcode these hex values in a page.

### Which Table Component to Use

| Component | Use for | Look |
|---|---|---|
| `Table` (`components/ui/Table.tsx`) | Browsing lists — staff, orders, incidents | Soft: horizontal dividers only, generous rows |
| `ExcelTable` (`components/ui/ExcelTable.tsx`) | Read-only corporate data — registers, liabilities, report tables | Gridlines, navy header band, zebra rows, totals band, expandable child rows, sortable headers (per-column `sort` config) |
| `Sheet` (`components/ui/sheet/`) | Editable grids — payroll entry | Full spreadsheet: colored group bands, frozen columns, cell selection, copy/paste, drag-fill, keyboard navigation |

Pages must not hand-roll `<table>` markup for data surfaces. If one of these components is missing a capability, extend the component — do not fork its styling into a page.

The reference implementation is the HR Payroll page (`app/app/hr/payroll/`): `page.tsx` holds data and persistence logic only; `sheet-config.tsx` declares the column groups; all visual decisions live in the primitives and tokens.

### Font Loading Rule (Bug Fixed 2026-07-06)

Brand fonts are loaded via `next/font` in `app/layout.tsx`, which registers them under hashed family names exposed as CSS variables. The Tailwind `fontFamily` config **must** reference `var(--font-sans)` / `var(--font-display)` — never the literal names "Inter" or "Cormorant Garamond", which are not registered as document fonts and silently fall back to system fonts.
