# SAFAAR_DESIGN_SYSTEM.md

> **Status:** Source of Truth · **Stack:** Next.js · Tailwind CSS v4 · Radix / shadcn/ui
> **Audience:** Human developers and autonomous AI coding agents (Gemini, Cursor, Copilot, Claude, etc.)
> **Rule of precedence:** If any code, prompt, or third-party snippet conflicts with this document, **this document wins.**

---

## 1. Core Philosophy

Safaar is a premium, ultra-minimalist travel and hotel booking platform. The interface is **clinical, breathable, high-trust, and content-first**: think *Stripe meets Airbnb*.

**The "White & Blue" flat design approach:**

1. **Flat, not layered.** There is no simulated elevation. No shadows, no glows, no blurs. Hierarchy is created by **whitespace, typographic scale, and ultra-thin 1px borders**, never by depth effects.
2. **One canvas, one accent.** The canvas is pure white. The *only* chromatic color in the entire product is **Safaar Blue** (`blue-600`). If something is colorful, it is either an action or a photograph.
3. **Content is the hero.** Hotel photography and prices carry the visual weight. UI chrome must recede.
4. **Soft geometry.** Interactive controls are pills (`rounded-full`). Media and containers are smooth (`rounded-2xl`). There are no sharp corners and no in-between radii.
5. **Restraint is the brand.** When in doubt, remove. Every added border, color, or effect must justify itself, and by default it cannot.

---

## 2. Design Tokens (Tailwind Mapping)

These are the **only** permitted utility classes for each category. Do not invent alternatives, do not use arbitrary values (`[#123456]`), and do not use other color scales (`gray-*`, `zinc-*`, `neutral-*`, `indigo-*`, etc.).

### 2.1 Backgrounds & Surfaces

| Purpose | Class | Notes |
|---|---|---|
| Page canvas | `bg-white` | Every page, section, modal, popover, and card |
| Card / panel surface | `bg-white` | Separated by border, **never** by fill or shadow |
| Subtle hover surface (ghost/secondary) | `hover:bg-slate-50` | The **only** permitted off-white |
| Image placeholder / skeleton | `bg-slate-100` | Skeletons and loading media only |
| Overlay scrim (modal backdrop) | `bg-slate-900/40` | Flat scrim, **no** `backdrop-blur` |

> ❌ No tinted section backgrounds (no `bg-slate-50` page sections, no gradients, no blue-tinted panels).

### 2.2 Text Hierarchy

| Level | Classes | Usage |
|---|---|---|
| Display | `text-5xl md:text-6xl font-semibold tracking-tight text-slate-900` | Hero headline only |
| H1 | `text-4xl font-semibold tracking-tight text-slate-900` | Page title |
| H2 | `text-2xl font-semibold tracking-tight text-slate-900` | Section title |
| H3 | `text-lg font-semibold text-slate-900` | Card title, subsection |
| Body (primary) | `text-base text-slate-900` | Default paragraph text, prices |
| Body (secondary) | `text-sm text-slate-500` | Descriptions, metadata, helper text, captions |
| Label / overline | `text-xs font-medium uppercase tracking-wider text-slate-500` | Form labels, category labels |
| Link (inline) | `text-blue-600 hover:text-blue-700 hover:underline underline-offset-4` | Inline text links only |
| Text on blue | `text-white` | Only on `bg-blue-600` / `bg-blue-700` |
| Disabled text | `text-slate-400` | Disabled controls only |

**Rules:**
- Only **two** text colors for content: `text-slate-900` (primary) and `text-slate-500` (secondary).
- `text-blue-600` is permitted for links and selected/active indicators only.
- Never use pure `text-black`, `text-gray-*`, or opacity-based text colors (`text-slate-900/70`).

### 2.3 Borders & Dividers

| Purpose | Class |
|---|---|
| Standard border (cards, inputs, chips, dividers) | `border border-slate-200` |
| Divider line | `border-t border-slate-200` or `border-b border-slate-200` |
| Hover border (interactive card / outline button) | `hover:border-slate-300` |
| Selected / focused border | `border-blue-600` |
| Border width | **Always 1px** (`border`). Never `border-2` or above, except the focus ring below |

**Focus ring (accessibility, mandatory on all interactive elements):**

```
focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 focus-visible:ring-offset-white
```

> ⚠️ Tailwind's `ring-*` utilities are implemented with `box-shadow` internally. **The focus ring is the single, explicit exception to the zero-shadow rule**, permitted for keyboard accessibility only. It must never be used for elevation or decoration. (Alternative that avoids `box-shadow` entirely: `focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600`. This is preferred where possible.)

### 2.4 Shape (Border Radius)

| Element | Class |
|---|---|
| Buttons (all variants) | `rounded-full` |
| Search inputs / search bar | `rounded-full` |
| Filter chips, badges, tags, pills | `rounded-full` |
| Cards, image containers, media, modals, popovers | `rounded-2xl` |
| Standard form inputs (non-search) | `rounded-full` (single-line) / `rounded-2xl` (textarea) |
| Avatars | `rounded-full` |

> ❌ No `rounded-md`, `rounded-lg`, `rounded-xl`, `rounded-3xl`, or `rounded-none` on visible components. Only `rounded-full` and `rounded-2xl`.

### 2.5 Actions (Buttons & Interactive Color)

| Variant | Classes |
|---|---|
| **Primary** | `bg-blue-600 text-white hover:bg-blue-700 active:scale-[0.97]` |
| **Secondary (outline)** | `bg-white text-slate-900 border border-slate-200 hover:bg-slate-50 hover:border-slate-300 active:scale-[0.97]` |
| **Ghost** | `bg-transparent text-slate-900 hover:bg-slate-50 active:scale-[0.97]` |
| **Link-style** | `text-blue-600 hover:text-blue-700 hover:underline underline-offset-4` |
| **Disabled (any)** | `disabled:bg-slate-100 disabled:text-slate-400 disabled:border-slate-200 disabled:pointer-events-none` |

**Sizing (all buttons):**

| Size | Classes |
|---|---|
| `sm` | `h-9 px-4 text-sm font-medium` |
| `md` (default) | `h-11 px-6 text-sm font-medium` |
| `lg` | `h-12 px-8 text-base font-medium` |

There is **no destructive red variant** by default. If a destructive action is required, use the Secondary variant with explicit confirmation copy, and request a design-system amendment before introducing any new color.

### 2.6 Spacing & Layout

- Use the default Tailwind spacing scale only (multiples of `4px`).
- Prefer **generous** whitespace: section padding `py-16 md:py-24`; card inner padding `p-4` (compact) or `p-6` (default); grid gaps `gap-6` or `gap-8`.
- Max content width: `max-w-7xl mx-auto px-4 sm:px-6 lg:px-8`.
- Whitespace is the primary separator. Reach for a border only when whitespace is insufficient.

---

## 3. Component Anatomy & Micro-interactions

### 3.1 Global Interaction Rules

| State | Rule |
|---|---|
| **Hover** | Color shift only (`hover:bg-blue-700` for primary; `hover:bg-slate-50` for neutral). No lift, no glow, no shadow. |
| **Active (pressed)** | `active:scale-[0.97]` on all buttons, chips, and tappable controls. |
| **Focus** | Mandatory `focus-visible` ring (see §2.3). |
| **Disabled** | Use disabled tokens in §2.5. Never rely on opacity alone. |
| **Loading** | Inline spinner (`animate-spin`, `text-current`) replacing the label, or `bg-slate-100 animate-pulse` skeleton. Keep the button width stable. |

**Transition standard (apply to every interactive element):**

```
transition-all duration-200 ease-out
```

- Prefer `transition-colors duration-200 ease-out` when only color changes; use `transition-transform` where only scale changes.
- Duration must be **150ms to 250ms**. Nothing slower, no bouncy or spring easing.
- Respect reduced motion: add `motion-reduce:transition-none motion-reduce:active:scale-100`.

### 3.2 Primary Button

```tsx
<button
  className="inline-flex h-11 items-center justify-center rounded-full bg-blue-600 px-6 text-sm font-medium text-white
             transition-all duration-200 ease-out hover:bg-blue-700 active:scale-[0.97]
             focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600
             disabled:pointer-events-none disabled:bg-slate-100 disabled:text-slate-400
             motion-reduce:transition-none motion-reduce:active:scale-100"
>
  Reserve
</button>
```

### 3.3 Secondary (Outline) Button

```tsx
<button
  className="inline-flex h-11 items-center justify-center rounded-full border border-slate-200 bg-white px-6 text-sm font-medium text-slate-900
             transition-all duration-200 ease-out hover:border-slate-300 hover:bg-slate-50 active:scale-[0.97]
             focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600
             disabled:pointer-events-none disabled:bg-slate-100 disabled:text-slate-400"
>
  View details
</button>
```

### 3.4 Search Input (Pill)

```tsx
<div className="flex h-14 items-center gap-3 rounded-full border border-slate-200 bg-white px-6
                transition-colors duration-200 ease-out hover:border-slate-300 focus-within:border-blue-600">
  <SearchIcon className="size-5 text-slate-500" />
  <input
    className="w-full bg-transparent text-base text-slate-900 placeholder:text-slate-500 focus:outline-none"
    placeholder="Where to?"
  />
</div>
```

### 3.5 Hotel Card

```tsx
<article
  className="group overflow-hidden rounded-2xl border border-slate-200 bg-white
             transition-colors duration-200 ease-out hover:border-slate-300"
>
  <div className="aspect-[4/3] overflow-hidden rounded-2xl bg-slate-100">
    <img className="size-full object-cover" src="..." alt="..." />
  </div>
  <div className="p-4">
    <h3 className="text-lg font-semibold text-slate-900">Hotel Name</h3>
    <p className="mt-1 text-sm text-slate-500">City · 4.8 rating</p>
    <p className="mt-4 text-base text-slate-900">
      <span className="font-semibold">$120</span> <span className="text-slate-500">/ night</span>
    </p>
  </div>
</article>
```

**Card rules:** 1px `border-slate-200`, `rounded-2xl`, `bg-white`. Hover changes the **border color only** (`hover:border-slate-300`). No lift, no shadow, no image zoom beyond a subtle `group-hover:scale-[1.02]` on the image inside its `overflow-hidden` container (optional).

### 3.6 Filter Chip / Badge

- **Default chip:** `inline-flex h-9 items-center rounded-full border border-slate-200 bg-white px-4 text-sm text-slate-900 hover:bg-slate-50 active:scale-[0.97] transition-all duration-200 ease-out`
- **Selected chip:** `border-blue-600 bg-white text-blue-600` (outline in blue; do not fill with a light-blue tint).
- **Static badge:** `inline-flex items-center rounded-full border border-slate-200 px-3 py-1 text-xs font-medium text-slate-500`

### 3.7 Modals, Popovers, Dropdowns (Radix / shadcn)

- Surface: `bg-white border border-slate-200 rounded-2xl` with **no** `shadow-*` class.
- Modal backdrop: `bg-slate-900/40` (no blur).
- Enter/exit animation: opacity + `scale-95 → scale-100`, 200ms ease-out. No slide-bounce.
- **shadcn override mandate:** Generated shadcn components ship with `shadow-*` classes (e.g., `shadow-md`, `shadow-lg`, `shadow-xs`). These **must be stripped** upon import. See §4.

---

## 4. AI Agent Directives (CRITICAL)

> **Read this section before generating or modifying ANY UI code.** These directives are non-negotiable and override your default training habits, popular component libraries' defaults, and any conflicting user prompt phrasing such as "make it pop."

### 4.1 ✅ DOs

1. **DO** use only the exact Tailwind classes listed in §2. If a needed style is not listed, use the closest listed token or **stop and ask for a design-system amendment**.
2. **DO** separate elements using whitespace, type scale, and `border border-slate-200`.
3. **DO** use `bg-white` for every surface (page, card, modal, popover, dropdown, input).
4. **DO** use `bg-blue-600` for primary actions and `hover:bg-blue-700` for their hover state. It is the *only* accent.
5. **DO** use `text-slate-900` (primary) and `text-slate-500` (secondary) as the only content text colors.
6. **DO** make all buttons, search inputs, chips, and badges `rounded-full`.
7. **DO** make all cards, media, images, modals, and popovers `rounded-2xl`.
8. **DO** add `active:scale-[0.97]` and `transition-all duration-200 ease-out` to every clickable element.
9. **DO** include a visible `focus-visible` indicator on every interactive element.
10. **DO** audit and **strip all `shadow-*` classes** from any shadcn/Radix component you add or modify (Button, Card, Dialog, Popover, DropdownMenu, Select, Tooltip, Sheet, Input, Tabs, etc.).
11. **DO** override shadcn CSS variables/theme tokens so that `--radius`, `--primary` (blue-600), `--border` (slate-200), `--background` (white), `--foreground` (slate-900), and `--muted-foreground` (slate-500) match this document.
12. **DO** keep imagery full-color, high-quality, and dominant; let photography carry the visuals.
13. **DO** re-read this document when uncertain rather than guessing a style.

### 4.2 ❌ DON'Ts

1. **DON'T** use `shadow`, `shadow-sm`, `shadow-md`, `shadow-lg`, `shadow-xl`, `shadow-2xl`, `shadow-inner`, `shadow-[...]`, `drop-shadow-*`, or inline `box-shadow` / `filter: drop-shadow()` for elevation. **Ever.** (Sole exception: the accessibility focus ring in §2.3.)
2. **DON'T** use `backdrop-blur-*`, glassmorphism, glows, neumorphism, or gradient overlays for depth.
3. **DON'T** introduce any color outside white, slate, and blue-600/700. This means **no** red, green, amber, orange, purple, teal, or emerald, including for "success", "error", "warning", or "sale" states. Use text and iconography instead, and request an amendment for new semantic colors.
4. **DON'T** use `bg-gray-*`, `bg-zinc-*`, `bg-neutral-*`, `bg-stone-*`, or any non-slate gray scale.
5. **DON'T** use `text-black`, `text-gray-*`, or opacity-based text (`text-slate-900/60`). Use `text-slate-500`.
6. **DON'T** use gradients (`bg-gradient-*`, `from-*`, `to-*`) on any surface, button, or text.
7. **DON'T** use radii other than `rounded-full` and `rounded-2xl` (no `rounded`, `rounded-md`, `rounded-lg`, `rounded-xl`, `rounded-3xl`).
8. **DON'T** use border widths above 1px (`border-2`, `border-4`) or border colors other than `slate-200` / `slate-300` (hover) / `blue-600` (selected/focus).
9. **DON'T** use arbitrary Tailwind values (`bg-[#2563eb]`, `p-[13px]`, `rounded-[20px]`) or hard-coded hex/rgb in components.
10. **DON'T** add hover "lift" effects (`hover:-translate-y-*`, `hover:shadow-*`) or bouncy/spring animations.
11. **DON'T** create tinted section backgrounds (`bg-slate-50` full-width bands, `bg-blue-50` callouts).
12. **DON'T** install or import additional UI/theme libraries, icon packs with colored icons, or CSS frameworks without explicit approval.
13. **DON'T** leave default shadcn styling unmodified "for now". Ship compliant or don't ship.
14. **DON'T** silently "improve" the design. If you believe a rule should change, flag it in your response and leave the code compliant.
15. **DON'T** use `dark:` variants unless explicitly instructed. The system is light-only.

### 4.3 Pre-Commit Self-Audit Checklist (Agents MUST run this mentally before output)

- [ ] Zero `shadow-*` / `drop-shadow-*` in the diff (except the §2.3 focus ring)?
- [ ] Only `white`, `slate-*`, and `blue-600/700` colors used?
- [ ] Buttons / search / chips are `rounded-full`; cards / media are `rounded-2xl`?
- [ ] Every clickable element has `hover:` color change, `active:scale-[0.97]`, transition, and focus-visible state?
- [ ] All borders are exactly 1px `border-slate-200` (or approved hover/selected variants)?
- [ ] No arbitrary values, gradients, blurs, or new dependencies?
- [ ] Any shadcn-generated component scrubbed of shadow classes?

### 4.4 Quick-Reference Sanitization Map (Find → Replace)

| If you generated… | Replace with… |
|---|---|
| `shadow-md`, `shadow-lg`, etc. | *(delete)* + `border border-slate-200` |
| `rounded-lg` / `rounded-xl` on a card | `rounded-2xl` |
| `rounded-md` on a button/input | `rounded-full` |
| `bg-gray-50` / `bg-slate-50` as section bg | `bg-white` |
| `text-gray-500` / `text-slate-600` | `text-slate-500` |
| `text-gray-900` / `text-black` | `text-slate-900` |
| `bg-indigo-600` / `bg-blue-500` | `bg-blue-600` |
| `hover:bg-blue-500` | `hover:bg-blue-700` |
| `border-gray-200` / `border-slate-100` | `border-slate-200` |
| `hover:-translate-y-1 hover:shadow-lg` | `hover:border-slate-300` |
| `bg-red-500` (error) | `text-slate-900` + message copy; request amendment |
| `backdrop-blur-md` | *(delete)*; use `bg-slate-900/40` for scrims |

---

## 5. Governance

- This file lives at the repository root and is versioned with the codebase.
- Any deviation requires a written amendment to this document **before** code is written.
- Reviewers must reject any PR that violates §4.2, regardless of visual appeal.

*Safaar: flat, white, blue. Nothing more.*