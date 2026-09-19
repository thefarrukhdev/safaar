# Safaar Design System

> **Version** 1.0 · **Status** Light Mode is the source of truth. Dark Mode (§10) is a draft for later.
> **Audience** Frontend engineers and AI coding agents. This file is normative: if a request or an existing component conflicts with it, follow this file and flag the conflict.
> **Stack** Tailwind CSS ≥ 3.4 or 4.x (uses `size-*`, `line-clamp-*`, `aria-pressed:`), Inter, Lucide icons.

---

## 0. How to Read This File

- **MUST / NEVER** are non-negotiable. **SHOULD** is the default; deviate only with a written reason in the PR.
- All classes shown are copy-paste ready. Do not "improve" them with extra shadows, gradients, or grays.
- When unsure, choose the **flatter, quieter, fewer-colors** option.

---

## 1. Design Principles

1. **Content is the color.** Photos of stays are the most colorful thing on screen. UI chrome stays neutral.
2. **Depth from alpha, not from gray.** One ink color (`slate-900`) at different opacities builds every fill, border, and hover state. No gray hex codes.
3. **Two shapes only.** Containers are `12px`. Actions are pills.
4. **Quiet physics.** Motion decelerates and never bounces. Scale changes stay within 3%.
5. **Tactile actions, calm surfaces.** Buttons feel pressable. Cards never shout.
6. **Brand is rare.** Blue means "do this" (primary action, link, focus). Amber means "look here" (deals, ratings). Together they should cover well under 10% of any screen.

---

## 2. Color

### 2.1 Brand

| Role | Tailwind | Hex | Use | Hover | Tint |
|---|---|---|---|---|---|
| **Safaar Blue** | `blue-600` | `#2563eb` | Primary action, links, focus ring, selected indicators | `blue-700` | `bg-blue-600/[0.10]` |
| **Safaar Amber** | `amber-500` | `#f59e0b` | Rating stars, deal/price-drop badges, urgency accents | `amber-600` | `bg-amber-500/[0.15]` |

Contrast rules (on white):

- White text on `blue-600` ≈ 5.2:1. Approved.
- `blue-600` as text or link ≈ 5.2:1. Approved.
- `amber-500` as text ≈ 2.1:1. **NEVER use amber as text or icon-only signal on white.** Text placed *on* amber is `text-slate-900`. Amber-colored text, if unavoidable, is `text-amber-700` (≈ 5:1).
- Amber is not a second primary. A screen has **one** blue primary CTA and at most **one** amber accent element in the viewport.

### 2.2 Ink (text and icons)

The only neutral hue in Light Mode is `slate-900` on `white`, varied by opacity.

| Token | Tailwind | Contrast on white | Use |
|---|---|---|---|
| Ink 100 | `text-slate-900` | ≈ 17:1 | Titles, prices, primary labels |
| Ink 70 | `text-slate-900/70` | ≈ 6.6:1 | Body secondary, metadata, icons |
| Ink 60 | `text-slate-900/60` | ≈ 4.7:1 | Tertiary, placeholders. **Floor for readable text.** |
| Ink 40 | `text-slate-900/40` | decorative | Disabled only |

NEVER go below `/60` for readable text. On tinted surfaces (`bg-slate-900/[0.05]` and up) use `/70` minimum.

### 2.3 Alpha Overlays: the surface-depth scale

Every fill, hover, and divider comes from this four-step scale. No other opacities on `slate-900` for surfaces.

| Step | Tailwind (fill) | Tailwind (border) | Use |
|---|---|---|---|
| **A3** | `bg-slate-900/[0.03]` | n/a | Hover on **transparent** surfaces: list rows, menu items, table rows |
| **A5** | `bg-slate-900/[0.05]` | `border-slate-900/[0.05]` | Resting fill: secondary button, chip, image placeholder, skeleton. Hover on ghost/icon buttons |
| **A8** | `bg-slate-900/[0.08]` | `border-slate-900/[0.08]` | Hover on A5 fills. **Default hairline border and divider** |
| **A12** | `bg-slate-900/[0.12]` | `border-slate-900/[0.12]` | Pressed state. Strong hairline |

**State ladder rule:** interaction steps up the scale one level at a time.
`transparent → A3` (rows) · `transparent → A5 → A8` (ghost/icon buttons) · `A5 → A8 → A12` (filled controls).

Brand tints follow the same idea: `blue-600/[0.10]` for selected/highlighted backgrounds, `amber-500/[0.15]` for deal highlights.

### 2.4 Status

| Status | Solid | Tint background | Text on tint |
|---|---|---|---|
| Success | `emerald-600` | `bg-emerald-600/[0.10]` | `text-emerald-800` |
| Error | `red-600` | `bg-red-600/[0.10]` | `text-red-700` |
| Warning | `amber-500` | `bg-amber-500/[0.15]` | `text-amber-800` |
| Info | `blue-600` | `bg-blue-600/[0.10]` | `text-blue-700` |

Status is never communicated by color alone: pair it with an icon or text.

### 2.5 Elevation and Separation

Use the **lightest** technique that works, in this order:

1. Whitespace
2. Alpha fill (A3 to A12)
3. Hairline border (`border-slate-900/[0.08]`)
4. Shadow (**floating layers only**)

| Layer | Treatment |
|---|---|
| Page | `bg-white` |
| Card at rest | **No border, no shadow.** The rounded media carries the shape |
| Bordered row / panel | `rounded-xl border border-slate-900/[0.08]` |
| Popover, menu, modal, sheet | `rounded-xl border border-slate-900/[0.08] bg-white shadow-float` |
| Scrim | `bg-slate-900/50` |
| Divider | `h-px bg-slate-900/[0.08]` |

### 2.6 Tailwind Setup

Only shadows and the font need configuration. Colors, radii, and easing use stock Tailwind classes so nothing depends on custom tokens.

**Tailwind v3 (`tailwind.config.js`)**

```js
module.exports = {
  darkMode: 'class',
  future: { hoverOnlyWhenSupported: true }, // hover styles never stick on touch
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        // Embossed pill: top highlight + bottom shade + hairline drop
        'emboss-primary':
          'inset 0 1px 0 0 rgb(255 255 255 / 0.25), inset 0 -1px 0 0 rgb(15 23 42 / 0.18), 0 1px 2px 0 rgb(15 23 42 / 0.10)',
        'emboss-alpha':
          'inset 0 1px 0 0 rgb(255 255 255 / 0.70), inset 0 -1px 0 0 rgb(15 23 42 / 0.06), 0 1px 1px 0 rgb(15 23 42 / 0.04)',
        'emboss-accent':
          'inset 0 1px 0 0 rgb(255 255 255 / 0.35), inset 0 -1px 0 0 rgb(180 83 9 / 0.30), 0 1px 2px 0 rgb(15 23 42 / 0.10)',
        'emboss-pressed': 'inset 0 1px 2px 0 rgb(15 23 42 / 0.20)',
        // Floating layers only
        float:
          '0 8px 24px -4px rgb(15 23 42 / 0.12), 0 2px 6px -2px rgb(15 23 42 / 0.08)',
      },
    },
  },
};
```

**Tailwind v4 (`app.css`)**

```css
@import "tailwindcss";
@custom-variant dark (&:where(.dark, .dark *));

@theme {
  --font-sans: "Inter", ui-sans-serif, system-ui, sans-serif;
  --shadow-float: 0 8px 24px -4px rgb(15 23 42 / 0.12), 0 2px 6px -2px rgb(15 23 42 / 0.08);
}
```

---

## 3. Geometry

Two shapes. No third option.

| Family | Elements | Radius | Tailwind |
|---|---|---|---|
| **Container** | Cards, thumbnails, images, modals, sheets, popovers, menus, tooltips, panels, banners, text fields | **12px** | `rounded-xl` |
| **Action** | Buttons, icon buttons, search pills, filter chips, badges, toggles, avatars | **9999px** | `rounded-full` |

**Closed list of exceptions** (nothing else):

- Checkbox box: `rounded-[4px]`
- Slider / progress tracks: `rounded-full`
- Skeletons: match the element they stand in for

**Nesting:** Do not nest two padded 12px containers. A bordered wrapper around media (e.g., a search-result row) uses `p-2` at most, with both wrapper and media at `rounded-xl`.

**NEVER** use `rounded-sm`, `rounded-md`, `rounded-lg`, `rounded-2xl`, `rounded-3xl`, or arbitrary `rounded-[Npx]` values (other than the checkbox).

---

## 4. Motion, Hover, and Physics

### 4.1 Tokens

| Token | Value | Use |
|---|---|---|
| **Easing** | `ease-[cubic-bezier(0.2,0,0,1)]` | **Every** transition. No other curve |
| Micro | `duration-150` | Row hovers, opacity swaps |
| Standard | `duration-200` | Buttons, chips, inputs, press feedback |
| Media | `duration-300` | Image zoom, panel slide |
| Overlay | 250ms in / 150ms out | Modals, popovers, menus |

Max duration is 300ms (400ms only for full-screen sheets).

### 4.2 Interaction Transforms

| Element | Hover | Active (pressed) |
|---|---|---|
| Button, icon button, chip | Fill changes one step (§2.3). **No transform** | `active:scale-[0.97]` |
| Card / thumbnail | **The image inside** zooms: `group-hover:scale-[1.02]` | None |
| Card container | **Never** translates, scales, or grows a shadow | None |
| Modal / popover enter | `opacity-0 scale-[0.98]` to `opacity-100 scale-100` | n/a |

**Zoom the media, not the card.** The `<img>` scales inside an `overflow-hidden rounded-xl` wrapper, so the 12px corner stays exact and neighbors never overlap.

### 4.3 Rules

- **Name transition properties.** Use `transition-[background-color,box-shadow,transform]`, never `transition-all`.
- Every animated element carries `motion-reduce:transition-none`, and every transform carries `motion-reduce:` neutralization (e.g., `motion-reduce:active:scale-100`).
- **NEVER** use bounce, spring, overshoot curves, `hover:-translate-y-*`, or `hover:scale-105+`.
- `animate-pulse` is allowed only on skeletons. `animate-spin` is allowed only on loading spinners.

---

## 5. Typography, Spacing, Icons

**Font:** Inter (`font-sans`). Weights **400 / 500 / 600 only**. Never `font-bold`.

| Role | Classes |
|---|---|
| Display | `text-4xl md:text-5xl font-semibold tracking-tight text-slate-900` |
| H1 | `text-3xl font-semibold tracking-tight text-slate-900` |
| H2 | `text-xl font-semibold text-slate-900` |
| Card title | `text-base font-medium leading-snug text-slate-900` |
| UI text | `text-sm text-slate-900` |
| Long-form (descriptions, policies) | `text-base leading-7 text-slate-900/70` |
| Caption / metadata | `text-xs text-slate-900/70` |
| Price | `font-semibold tabular-nums text-slate-900` |

Sentence case everywhere. No ALL-CAPS labels.

**Spacing:** Tailwind scale on a 4px grid.

- Page container: `mx-auto w-full max-w-[1440px] px-4 sm:px-6 lg:px-10`
- Card grid: `grid grid-cols-1 gap-x-4 gap-y-8 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5`
- Chip row gap: `gap-3`

**Icons:** Lucide, `currentColor`, stroke width 1.75. `size-5` default, `size-4` inside badges and small buttons. Icon-only controls MUST have `aria-label`.

---

## 6. Component Archetypes

Shared focus ring (referenced below as **FOCUS**):

```
focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2
```

Shared motion (referenced as **MOTION**):

```
transition-[background-color,box-shadow,transform] duration-200 ease-[cubic-bezier(0.2,0,0,1)] motion-reduce:transition-none motion-reduce:active:scale-100
```

### 6.1 Primary Button

Blue, embossed pill. One per view region.

```html
<button
  type="button"
  class="inline-flex h-10 max-md:h-11 items-center justify-center gap-2 rounded-full
         border border-blue-700/50 bg-blue-600 px-5
         text-sm font-medium text-white
         transition-[background-color,box-shadow,transform] duration-200 ease-[cubic-bezier(0.2,0,0,1)]
         hover:bg-blue-700
         focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2
         disabled:pointer-events-none disabled:opacity-40 disabled:shadow-none
         motion-reduce:transition-none motion-reduce:active:scale-100"
>
  Book now
</button>
```

**How the emboss works:** a translucent white 1px inset line on top, a translucent dark 1px inset line on the bottom, a hairline drop shadow, and a slightly darker translucent border. On press the shadow flattens to `emboss-pressed`, so the button visibly "sinks" as it scales down.

**Sizes** (swap only these classes):

| Size | Classes | Use |
|---|---|---|
| sm | `h-8 px-4 text-sm` | Dense desktop toolbars only |
| md (default) | `h-10 max-md:h-11 px-5 text-sm` | Most actions. 44px on touch |
| lg | `h-12 px-6 text-base` | Hero and booking CTAs |

**Variants:**

| Variant | Swap in |
|---|---|
| Ghost | `bg-transparent text-slate-900 shadow-none border-transparent hover:bg-slate-900/[0.05] active:bg-slate-900/[0.08]` |
| Icon (circle) | `size-10 max-md:size-11 p-0 rounded-full` + Ghost fills |
| Loading | Replace the label with `<svg class="size-4 animate-spin">`, keep width fixed, add `aria-busy="true"` and `disabled` |

### 6.2 Secondary Alpha Button

The YouTube "Share" button: a translucent ink fill with a whisper of emboss. Use for every non-primary action.

```html
<button
  type="button"
  class="inline-flex h-10 max-md:h-11 items-center justify-center gap-2 rounded-full
         border border-slate-900/[0.06] bg-slate-900/[0.05] px-5
         text-sm font-medium text-slate-900
         transition-[background-color,box-shadow,transform] duration-200 ease-[cubic-bezier(0.2,0,0,1)]
         hover:bg-slate-900/[0.08]
         focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2
         disabled:pointer-events-none disabled:opacity-40 disabled:shadow-none
         motion-reduce:transition-none motion-reduce:active:scale-100"
>
  <ShareIcon class="size-5" aria-hidden="true" />
  Share
</button>
```

Fill ladder: `A5 → A8 → A12` (§2.3). Sizes match §6.1.

### 6.3 Accommodation Card

Media-first, no wrapper chrome. The 12px rounded image *is* the card.

```html
<article class="group relative">
  <a
    href="/stay/{id}"
    class="block rounded-xl
           focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-4"
  >
    <!-- Media: overflow-hidden clips the zoom so the 12px corner stays exact -->
    <div class="relative aspect-[4/3] overflow-hidden rounded-xl bg-slate-900/[0.05]">
      <img
        src="{image}"
        alt="{name}, {city}"
        loading="lazy"
        class="size-full object-cover
               transition-transform duration-300 ease-[cubic-bezier(0.2,0,0,1)]
               group-hover:scale-[1.02]
               motion-reduce:transition-none motion-reduce:group-hover:scale-100"
      />
      <!-- Optional deal badge (top-left). One amber element per card, max -->
      <span
        class="absolute left-3 top-3 inline-flex h-6 items-center rounded-full
               bg-amber-500 px-2.5 text-xs font-semibold text-slate-900"
      >
        -20% today
      </span>
    </div>

    <!-- Meta -->
    <div class="mt-3 space-y-1 px-0.5">
      <div class="flex items-start justify-between gap-3">
        <h3 class="line-clamp-1 text-base font-medium leading-snug text-slate-900">{name}</h3>
        <span class="inline-flex shrink-0 items-center gap-1 text-sm font-medium text-slate-900">
          <StarIcon class="size-4 fill-amber-500 text-amber-500" aria-hidden="true" />
          4.8
          <span class="font-normal text-slate-900/70">(312)</span>
        </span>
      </div>
      <p class="line-clamp-1 text-sm text-slate-900/70">{district}, {city} · {distance}</p>
      <p class="pt-1 text-sm text-slate-900/70">
        <span class="text-base font-semibold tabular-nums text-slate-900">{price}</span> / night
      </p>
    </div>
  </a>

  <!-- Wishlist: sibling of the link (never nested inside <a>), overlaid on the media -->
  <button
    type="button"
    aria-label="Save to wishlist"
    aria-pressed="false"
    class="absolute right-3 top-3 inline-flex size-9 items-center justify-center rounded-full
           transition-[background-color,box-shadow,transform] duration-200 ease-[cubic-bezier(0.2,0,0,1)]
           hover:bg-white hover:text-slate-900
           focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2
           motion-reduce:transition-none motion-reduce:active:scale-100"
  >
    <!-- Saved state: <HeartIcon class="size-5 fill-blue-600 text-blue-600" /> -->
    <HeartIcon class="size-5" aria-hidden="true" />
  </button>
</article>
```

**Rules**

- **Hover:** only the image zooms (`1.02`). No lift, no shadow growth, no border change.
- **Ratio:** `aspect-[4/3]` in grids. Detail heroes use `aspect-[16/9]`.
- **Text over images:** only via a scrim (`bg-gradient-to-t from-slate-900/60 to-transparent`). No other gradients.
- **Loading:** same wrapper, `animate-pulse bg-slate-900/[0.05]`, plus two skeleton text lines (`h-4 rounded-full`).
- **Unavailable:** `opacity-60` on the image and a neutral "Sold out" badge (§6.5).
- **Horizontal list variant** (search results): wrapper `flex gap-4 rounded-xl border border-slate-900/[0.08] p-2 transition-colors duration-150 ease-[cubic-bezier(0.2,0,0,1)] hover:bg-slate-900/[0.03]`, media `w-64 shrink-0`, price right-aligned. Zoom rule unchanged.

### 6.4 Category Filter Chips

Horizontal scroller under the header. Flat pills (no emboss) so they read as filters, not actions.

```html
<div class="sticky top-16 z-20 bg-white/[0.92] backdrop-blur">
  <ul
    role="list"
    class="flex gap-3 overflow-x-auto px-4 py-3 sm:px-6 lg:px-10
           [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
  >
    <li>
      <button
        type="button"
        aria-pressed="false"
        class="inline-flex h-9 shrink-0 items-center gap-2 rounded-full
               bg-slate-900/[0.05] px-4 text-sm font-medium text-slate-900
               transition-[background-color,color,transform] duration-200 ease-[cubic-bezier(0.2,0,0,1)]
               hover:bg-slate-900/[0.08]
               active:scale-[0.97]
               aria-pressed:bg-slate-900 aria-pressed:text-white aria-pressed:hover:bg-slate-900/90
               focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2
               motion-reduce:transition-none motion-reduce:active:scale-100"
      >
        <BuildingIcon class="size-5" aria-hidden="true" />
        Hotels
      </button>
    </li>
    <!-- repeat -->
  </ul>
</div>
```

**Rules**

- **Rest** A5, **hover** A8, **selected** solid `slate-900` with white text (the YouTube inversion). Selected state is driven by `aria-pressed`, never by class toggling alone.
- **Single-select groups** ("All", "Hotels", "Apartments") keep exactly one chip selected. Multi-select filters are the same chip with independent `aria-pressed` state.
- Chips hold a label plus an optional leading `size-5` icon. No counts inside chips.
- The row scrolls horizontally with no visible scrollbar. Arrow buttons at the edges (Icon variant, §6.1) are optional on desktop.

### 6.5 Supporting Archetypes

**Search pill**

```html
<form
  role="search"
  class="flex h-12 items-center gap-2 rounded-full border border-slate-900/[0.12] bg-white pl-5 pr-1.5
         transition-[border-color,box-shadow] duration-200 ease-[cubic-bezier(0.2,0,0,1)]
         focus-within:border-blue-600 focus-within:ring-1 focus-within:ring-blue-600
         motion-reduce:transition-none"
>
  <SearchIcon class="size-5 shrink-0 text-slate-900/70" aria-hidden="true" />
  <input
    type="search"
    placeholder="Where to?"
    class="min-w-0 flex-1 bg-transparent text-base text-slate-900 placeholder:text-slate-900/60 focus:outline-none"
  />
  <!-- Primary Button, size sm, gives the control its visible affordance -->
  <button type="submit" class="…primary sm…">Search</button>
</form>
```

Multi-segment search (destination | dates | guests): keep one outer pill, separate segments with `<span class="h-6 w-px bg-slate-900/[0.12]">`.

**Text field** (container family, so `rounded-xl`, not a pill)

```html
<input
  class="h-12 w-full rounded-xl border border-slate-900/50 bg-white px-4 text-base text-slate-900
         placeholder:text-slate-900/60
         transition-[border-color,box-shadow] duration-200 ease-[cubic-bezier(0.2,0,0,1)]
         hover:border-slate-900/70
         focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600
         aria-[invalid=true]:border-red-600 aria-[invalid=true]:focus:ring-red-600
         disabled:opacity-40 motion-reduce:transition-none"
/>
```

Field borders use `/50` (≈ 3.4:1) because the border is the only thing identifying the control. Input text is `text-base` (16px) to prevent mobile zoom-on-focus.

**Badge** (`inline-flex h-6 items-center gap-1 rounded-full px-2.5 text-xs font-medium`)

| Variant | Add |
|---|---|
| Neutral | `bg-slate-900/[0.05] text-slate-900/70` |
| Brand | `bg-blue-600/[0.10] text-blue-700` |
| Deal | `bg-amber-500 text-slate-900 font-semibold` |
| Success | `bg-emerald-600/[0.10] text-emerald-800` |
| Danger | `bg-red-600/[0.10] text-red-700` |

**Modal / sheet surface**

```html
<div class="fixed inset-0 z-50 bg-slate-900/50"></div>
<div
  role="dialog" aria-modal="true"
  class="fixed left-1/2 top-1/2 w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2
         rounded-xl border border-slate-900/[0.08] bg-white p-6 shadow-float"
>
  …
</div>
```

Enter animation: `opacity-0 scale-[0.98]` to `opacity-100 scale-100`, 250ms, standard easing. Actions sit bottom-right: Secondary Alpha, then Primary.

---

## 7. Ambient Layer (optional)

The "Ambient" idea from YouTube: the hero image softly tints the space around it. Use **only** on accommodation detail heroes, never in lists.

```html
<div class="relative">
  <img
    src="{hero}" alt="" aria-hidden="true"
    class="pointer-events-none absolute inset-0 -z-10 size-full scale-110 rounded-xl object-cover opacity-30 blur-3xl saturate-150"
  />
  <img
    src="{hero}" alt="{name}"
    class="relative aspect-[16/9] w-full rounded-xl object-cover"
  />
</div>
```

The glow is a blurred copy of the same image. It carries no information and stays `aria-hidden`.

---

## 8. Accessibility Non-Negotiables

1. Text contrast ≥ 4.5:1 (§2.2). UI boundaries that identify a control ≥ 3:1.
2. Every interactive element shows the FOCUS ring on `:focus-visible`. Never remove it without replacing it.
3. Touch targets ≥ 44px below `md` (`max-md:h-11` / `max-md:size-11`).
4. Respect `prefers-reduced-motion` (§4.3).
5. Toggle-like controls (chips, wishlist, switches) expose state via `aria-pressed` / `aria-checked`.
6. Images have meaningful `alt`. Decorative ones use `alt=""` and `aria-hidden`.
7. Color is never the only signal (pair with icon or text).

---

## 9. Forbidden Patterns (search the diff for these)

| Category | NEVER appear |
|---|---|
| **Radius** | `rounded-sm` `rounded-md` `rounded-lg` `rounded-2xl` `rounded-3xl` `rounded-[…]` (except checkbox `4px`) |
| **Neutral colors** | `gray-*` `zinc-*` `neutral-*` `stone-*` `bg-black` `text-black`, any `slate-50…slate-800`, any hex/rgb literal in class names |
| **Motion** | `animate-bounce` `animate-ping` `ease-in` `ease-out` `ease-in-out` `ease-linear` `transition-all` `duration-500+` `hover:-translate-y-*` `hover:scale-105+` |
| **Surfaces** | Gradients (other than image scrims and §7), `border-2`+ on containers, `font-bold`, ALL-CAPS labels |
| **Brand** | Amber as text on white, more than one Primary Button per region, blue used decoratively |

### Pre-merge checklist

- [ ] Containers `rounded-xl`, actions `rounded-full`. Nothing else.
- [ ] All surface depth comes from `slate-900` alpha steps (A3/A5/A8/A12).
- [ ] Buttons: embossed, `active:scale-[0.97]`, FOCUS ring, disabled state.
- [ ] Card: only the image zooms (`scale-[1.02]`), no translate, no shadow.
- [ ] Every transition uses `ease-[cubic-bezier(0.2,0,0,1)]`, named properties, and `motion-reduce`.
- [ ] Text ≥ `/60` (≥ `/70` on tinted fills). Touch targets ≥ 44px on mobile.

---

## 10. Dark Mode (DRAFT, not in current scope)

> Light Mode ships first. Do not implement `dark:` classes until this section is promoted out of draft. The mapping below exists so Light Mode components are written in a way that inverts cleanly.

The principle is unchanged: **one ink color at different alpha steps.** In dark mode the ink flips to `white`.

| Concept | Light | Dark |
|---|---|---|
| Page | `bg-white` | `dark:bg-slate-950` |
| Text primary / secondary / tertiary | `text-slate-900` / `/70` / `/60` | `dark:text-white` / `/70` / `/60` |
| Hover on transparent (A3) | `hover:bg-slate-900/[0.03]` | `dark:hover:bg-white/[0.05]` |
| Resting fill (A5) | `bg-slate-900/[0.05]` | `dark:bg-white/[0.08]` |
| Hover fill (A8) | `hover:bg-slate-900/[0.08]` | `dark:hover:bg-white/[0.12]` |
| Pressed (A12) | `active:bg-slate-900/[0.12]` | `dark:active:bg-white/[0.16]` |
| Hairline border / divider | `border-slate-900/[0.08]` | `dark:border-white/[0.10]` |
| Field border | `border-slate-900/50` | `dark:border-white/40` |
| Floating surface | `bg-white` | `dark:bg-slate-900` |
| Scrim | `bg-slate-900/50` | `dark:bg-black/60` |
| Focus ring offset | `ring-offset-2` (white) | `dark:ring-offset-slate-950` |
| Links / blue text | `text-blue-600` | `dark:text-blue-400` |
| Selected chip | `bg-slate-900 text-white` | `dark:aria-pressed:bg-white dark:aria-pressed:text-slate-900` |
| Primary Button | `bg-blue-600` | unchanged (keep emboss) |
| Amber accents | `amber-500` | unchanged |

Shadows lose meaning on dark surfaces: rely on the border and the alpha fill; keep `shadow-float` for menus and modals only.
