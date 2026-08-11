# Portrait Circle POC

Small Vue/Nuxt-oriented proof of concept for building a portrait circle like `laroutourne.png`.

The demo has two ideas:

- Generate a portrait circle procedurally from a list of images.
- Read a hand-drawn SVG path and place portraits on detected anchor points.

## Running The Demo

The local demo is served with Vite:

```sh
../amiweb-front/node_modules/.bin/vite --host 127.0.0.1
```

Then open:

```text
http://127.0.0.1:5173/
```

This POC folder does not contain its own `package.json`; `vite.config.mjs` reuses the sibling `../amiweb-front/node_modules` Vue/Vite install.

## Main Files

- `components/PortraitCircle.vue`: reusable Vue component for the generated portrait-circle layout.
- `src/VectorAnchorDebug.vue`: trial component that parses `trial vector.svg`, detects anchor points, and overlays portraits.
- `src/InteractiveVectorWheel.vue`: draggable version of the hand-drawn vector with portraits anchored to it.
- `src/App.vue`: demo page showing 5, 7, and 12 generated circles, plus the hand-drawn SVG anchor test.
- `trial vector.svg`: hand-drawn blue path used for anchor detection.
- `specifications.markdown`: earlier implementation notes and acceptance criteria.

## Generated Portrait Circle

`PortraitCircle.vue` receives an `items` array:

```ts
type PortraitCircleItem = {
  id: string | number
  src: string
  alt?: string
  focusX?: number
  focusY?: number
}
```

It expects 5 to 12 portraits.

The component:

1. Computes one position per portrait using polar geometry.
2. Draws a blue connector ring behind the portraits.
3. Clips each portrait with one of several irregular SVG blob masks.
4. Adds deterministic size, radius, and rotation variation so the result is not too mechanical.

The ring currently has a procedural hand-drawn attempt: several offset Bezier paths plus a subtle SVG displacement filter.

## SVG Anchor Detection

`VectorAnchorDebug.vue` imports `trial vector.svg` as raw text:

```ts
import trialVectorSvg from '../trial vector.svg?raw'
```

It extracts:

- the SVG `viewBox`
- the path `d`
- the stroke color and stroke width

Then it parses the path commands. The current trial SVG is one `M` command followed by cubic `C` segments.

The key rule is:

```text
an anchor is selected when the incoming Bezier handle and outgoing Bezier handle
are both collapsed onto the same point
```

In SVG path data, that means:

- previous segment control point 2 equals the segment end point
- next segment control point 1 equals that same point

Those detected points are shown as red dots in the left debug SVG.

## Portraits On Hand-Drawn Anchors

The right debug SVG uses the same detected anchor list.

For each anchor:

1. Take the next portrait image.
2. Center it on the anchor coordinate.
3. Clip it with the same organic blob masks used by `PortraitCircle.vue`.
4. Draw the original hand-drawn vector behind the portraits.

This proves that a manually drawn vector can drive portrait placement without adding extra marker metadata, as long as the intended portrait anchors are encoded by collapsed handles.

## Draggable Wheel

`InteractiveVectorWheel.vue` reuses the same hand-drawn vector and detected anchors.

The interaction works like this:

1. Pointer down stores the initial pointer angle around the SVG center.
2. Pointer move updates the wheel rotation from incremental angle deltas and tracks angular velocity.
3. The vector path and portrait anchor positions rotate together.
4. Each portrait applies the opposite rotation inside its own group, so the portraits travel around the wheel while staying upright, like ferris-wheel cabins.
5. Pointer release keeps a decaying inertial spin based on the last drag velocity.

## Current Limitation

The path parser is intentionally narrow for the trial:

- supports absolute `M`, `C`, and `Z`
- assumes a single path
- detects only collapsed-handle anchors

For production, either keep the SVG export format constrained, or add support for relative commands, multiple paths, and explicit fallback anchor metadata.
