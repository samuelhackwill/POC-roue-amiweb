# Portrait Circle Module Specification

## Goal

Build a Vue/Nuxt-compatible web module that renders a set of 5 to 16 portrait photographs as an irregular quasi-circle. Each portrait is clipped with a soft organic SVG mask, then positioned around a central ring so the final composition resembles `laroutourne.png`.

The module should render in the browser and be usable as a normal Vue component. It does not need to support arbitrary polygon counts outside the 5-12 portrait range.

## Visual Target

The reference image is a transparent PNG, 1266 x 1298, showing:

- A thick blue circular/segmented connector ring behind the portraits.
- Seven portrait photos distributed around the ring.
- Portrait crops shaped by irregular rounded blob masks, not perfect circles.
- Portraits layered above the ring, with the ring partly hidden behind them.
- A transparent outer background, allowing the composition to sit on any page color.

## Recommended Implementation

Use one self-contained Vue component backed by SVG:

`PortraitCircle.vue`

The component renders a responsive `<svg viewBox="0 0 1000 1000">` and places each portrait using calculated polar coordinates.

Main layers:

1. Connector ring: draw a thick SVG path or polyline behind the portraits.
2. Mask definitions: generate one `<clipPath>` per portrait from a small set of reusable organic blob paths.
3. Portrait images: render each photo as an SVG `<image>` clipped by its assigned blob.

SVG is preferred over canvas because it keeps masks, layering, responsiveness, image loading, and DOM integration straightforward in Vue/Nuxt. It also leaves the result inspectable and styleable with CSS.

## Component API

```ts
type PortraitCircleItem = {
  id: string
  src: string
  alt?: string
  focusX?: number // 0-1, default 0.5
  focusY?: number // 0-1, default 0.45
}
```

Props:

```ts
items: PortraitCircleItem[] // required, expected length 5-12
size?: number | string      // optional CSS size, default "100%"
ringColor?: string          // default "#6679ff"
ringWidth?: number          // default 54 in viewBox units
portraitSize?: number       // default auto by item count
```

If `items.length` is outside 5-12, the component should fail visibly in development with a console warning and render nothing or clamp only if the product explicitly wants that behavior.

## Layout Rules

For `n` portraits:

- Place portraits around a circle using angle step `360 / n`.
- Start around `-90deg` so the first item appears near the top.
- Use center point `(500, 500)`.
- Use a layout radius around `360` viewBox units.
- Use portrait size based on count:
  - 5 portraits: about `245`
  - 6-8 portraits: about `215`
  - 9-12 portraits: about `175`
- Add deterministic variation from the item index:
  - Radius jitter: `[-18, 12, -8, 16, -14, 10]`
  - Rotation jitter: `[-5, 4, -3, 6, -4, 3]`
  - Blob path selection: cycle through 5-6 predefined blob shapes.

This avoids random layout shifts between renders while preserving the irregular visual effect.

## Ring Construction

The ring should sit behind the portraits. Two acceptable SVG approaches:

1. Draw a full circle:
   ```html
   <circle cx="500" cy="500" r="340" fill="none" stroke="..." stroke-width="54" />
   ```
   This is simplest and matches the reference once portraits cover parts of the ring.

2. Draw a polygonal loop through the portrait centers, smoothed with Bezier curves and deterministic jitter.
   This gives stronger pentagon/hexagon/etc. character and lets the connector feel hand-drawn.

The current prototype uses the second approach by default: several slightly offset Bezier strokes plus a subtle SVG displacement filter. The result remains vector-based while avoiding a perfectly mechanical outline.

## Mask Strategy

Define a small internal library of organic blob paths normalized to a `0 0 100 100` box. For each portrait:

- Create a `<clipPath clipPathUnits="objectBoundingBox">` or transform a normalized path into the portrait group.
- Apply the clip path to the `<image>`.
- Use `preserveAspectRatio="xMidYMid slice"` so portraits fill their mask.
- Adjust image positioning with optional `focusX` and `focusY` if needed.

The masks should be rounded, asymmetric, and close to portrait-oval proportions. They should not contain jagged edges.

## Nuxt/Vue Integration Notes

- The component should be client-safe and SSR-safe: no direct `window`/`document` access is needed.
- Generate clip path IDs with `useId()` when available, or a deterministic component-local prefix prop/fallback, to avoid duplicate IDs when multiple instances are rendered.
- Accept normal image URLs from `/public`, CMS media, or remote image services.
- Add `role="img"` and an accessible label on the root SVG when meaningful. Individual SVG `<image>` elements do not reliably expose `alt`, so the component should accept an overall `ariaLabel`.

## Deliverables

- `components/PortraitCircle.vue`
- Optional demo page or Storybook story showing 5, 7, and 15 portraits.
- Unit or visual tests covering item counts 5-15.
- A browser screenshot comparison against `laroutourne.png` for the seven-item case.

## Acceptance Criteria

- Renders 5-15 portraits without overlap severe enough to hide faces.
- Maintains a circular/quasi-polygonal composition at mobile and desktop sizes.
- Portraits are clipped with irregular SVG shapes.
- The blue connector ring appears behind the portraits.
- Output has no fixed bitmap dependency except the input portraits.
- Works in a Nuxt/Vue app without client-only rendering.
