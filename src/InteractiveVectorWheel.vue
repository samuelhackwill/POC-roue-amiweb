<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from 'vue'
import trialVectorSvg from '../trial vector.svg?raw'

type PortraitItem = {
  id: string | number
  src: string
  alt?: string
  focusX?: number
  focusY?: number
}

type Point = {
  x: number
  y: number
}

type CubicSegment = {
  start: Point
  c1: Point
  c2: Point
  end: Point
}

type AnchorPoint = Point & {
  id: number
}

type AnchoredPortrait = {
  id: number
  anchorX: number
  anchorY: number
  src: string
  alt: string
  clipId: string
  clipUrl: string
  blobPath: string
  width: number
  height: number
  imageX: number
  imageY: number
  preserveAspectRatio: string
}

type InteractiveVectorWheelProps = {
  items?: PortraitItem[]
}

const props = withDefaults(defineProps<InteractiveVectorWheelProps>(), {
  items: () => [],
})

const HANDLE_COLLAPSE_EPSILON = 0.01
const VIEWBOX_PADDING = 64
const PORTRAIT_HEIGHT = 70
const PORTRAIT_WIDTH = 56
const VELOCITY_SMOOTHING = 0.35
const INERTIA_FRICTION_PER_FRAME = 0.94
const INERTIA_STOP_VELOCITY = 0.006
const INERTIA_MAX_FRAME_MS = 32
const BLOB_PATHS = [
  'M .5 .01 C .72 .02 .9 .13 .97 .33 C 1 .5 .94 .74 .78 .88 C .62 1 .34 .99 .18 .87 C .03 .76 .01 .52 .06 .32 C .12 .12 .29 0 .5 .01 Z',
  'M .46 .02 C .7 0 .9 .11 .97 .31 C 1 .49 .94 .72 .8 .9 C .65 1 .37 .98 .19 .88 C .02 .77 0 .56 .05 .36 C .13 .16 .25 .04 .46 .02 Z',
  'M .53 .03 C .75 .04 .94 .18 .98 .39 C 1 .61 .88 .82 .69 .93 C .49 1 .23 .95 .1 .77 C 0 .61 .02 .34 .17 .18 C .29 .05 .39 .01 .53 .03 Z',
  'M .42 .02 C .64 0 .86 .08 .96 .27 C 1 .43 .98 .68 .84 .84 C .69 1 .42 1 .23 .9 C .07 .81 0 .62 .03 .42 C .06 .22 .21 .06 .42 .02 Z',
  'M .56 .01 C .78 .04 .93 .18 .98 .38 C 1 .56 .92 .78 .75 .91 C .58 1 .31 .99 .15 .85 C .01 .72 0 .47 .08 .29 C .18 .1 .35 0 .56 .01 Z',
  'M .48 .02 C .69 .02 .88 .1 .96 .29 C 1 .48 .95 .74 .78 .9 C .6 1 .35 .97 .18 .85 C .03 .74 .01 .53 .06 .35 C .12 .14 .28 .03 .48 .02 Z',
]

const svgElement = ref<SVGSVGElement | null>(null)
const rotation = ref(0)
const isDragging = ref(false)
const svgData = parseSvg(trialVectorSvg)
const paddedViewBox = expandViewBox(svgData.viewBox, VIEWBOX_PADDING)
const paddedViewBoxRect = viewBoxRect(paddedViewBox)
const center = centerFromViewBox(svgData.viewBox)
const cubicSegments = parseCubicPath(svgData.pathD)
const anchorPoints = findCollapsedHandleAnchors(cubicSegments)
const anchoredPortraits = computed(() => buildAnchoredPortraits(anchorPoints, props.items))
let lastPointerAngle = 0
let lastPointerTime = 0
let angularVelocity = 0
let inertiaFrameId: number | null = null
let lastInertiaFrameTime = 0

const wheelTransform = computed(() => {
  return `rotate(${rotation.value} ${center.x} ${center.y})`
})

const counterRotation = computed(() => {
  return `rotate(${-rotation.value})`
})

function onPointerDown(event: PointerEvent) {
  const svg = svgElement.value

  if (!svg) {
    return
  }

  cancelInertia()
  isDragging.value = true
  lastPointerAngle = angleFromPointer(event)
  lastPointerTime = performance.now()
  angularVelocity = 0
  svg.setPointerCapture(event.pointerId)
}

function onPointerMove(event: PointerEvent) {
  if (!isDragging.value) {
    return
  }

  const now = performance.now()
  const currentAngle = angleFromPointer(event)
  const delta = shortestAngleDelta(lastPointerAngle, currentAngle)
  const elapsed = Math.max(1, now - lastPointerTime)
  const currentVelocity = delta / elapsed

  rotation.value = normalizeRotation(rotation.value + delta)
  angularVelocity = angularVelocity * (1 - VELOCITY_SMOOTHING) + currentVelocity * VELOCITY_SMOOTHING
  lastPointerAngle = currentAngle
  lastPointerTime = now
}

function onPointerUp(event: PointerEvent) {
  const svg = svgElement.value

  if (!isDragging.value) {
    return
  }

  isDragging.value = false

  if (svg?.hasPointerCapture(event.pointerId)) {
    svg.releasePointerCapture(event.pointerId)
  }

  startInertia()
}

function angleFromPointer(event: PointerEvent) {
  const point = clientPointToSvgPoint(event)

  return (Math.atan2(point.y - center.y, point.x - center.x) * 180) / Math.PI
}

function clientPointToSvgPoint(event: PointerEvent) {
  const svg = svgElement.value

  if (svg) {
    const point = svg.createSVGPoint()
    const transform = svg.getScreenCTM()

    if (transform) {
      point.x = event.clientX
      point.y = event.clientY

      return point.matrixTransform(transform.inverse())
    }
  }

  return center
}

function startInertia() {
  if (Math.abs(angularVelocity) < INERTIA_STOP_VELOCITY) {
    angularVelocity = 0
    return
  }

  cancelInertia()
  lastInertiaFrameTime = performance.now()
  inertiaFrameId = requestAnimationFrame(stepInertia)
}

function stepInertia(timestamp: number) {
  const elapsed = Math.min(INERTIA_MAX_FRAME_MS, timestamp - lastInertiaFrameTime)

  lastInertiaFrameTime = timestamp
  rotation.value = normalizeRotation(rotation.value + angularVelocity * elapsed)
  angularVelocity *= Math.pow(INERTIA_FRICTION_PER_FRAME, elapsed / 16.67)

  if (Math.abs(angularVelocity) < INERTIA_STOP_VELOCITY) {
    angularVelocity = 0
    inertiaFrameId = null
    return
  }

  inertiaFrameId = requestAnimationFrame(stepInertia)
}

function cancelInertia() {
  if (inertiaFrameId !== null) {
    cancelAnimationFrame(inertiaFrameId)
    inertiaFrameId = null
  }
}

function shortestAngleDelta(from: number, to: number) {
  return ((to - from + 540) % 360) - 180
}

function normalizeRotation(value: number) {
  return ((value % 360) + 360) % 360
}

function parseSvg(svg: string) {
  const viewBox = svg.match(/\sviewBox="([^"]+)"/)?.[1] ?? '0 0 230 224'
  const pathD = svg.match(/<path[^>]*\sd="([^"]+)"/)?.[1] ?? ''
  const stroke = svg.match(/<path[^>]*\sstroke="([^"]+)"/)?.[1] ?? '#6983FF'
  const strokeWidth = Number(svg.match(/<path[^>]*\sstroke-width="([^"]+)"/)?.[1] ?? 10)

  return {
    viewBox,
    pathD,
    stroke,
    strokeWidth,
  }
}

function parseCubicPath(pathD: string) {
  const tokens = pathD.match(/[a-zA-Z]|-?\d*\.?\d+(?:e[-+]?\d+)?/gi) ?? []
  const segments: CubicSegment[] = []
  let index = 0
  let current: Point | null = null

  while (index < tokens.length) {
    const command = tokens[index++]

    if (command === 'M') {
      current = readPoint(tokens, index)
      index += 2
      continue
    }

    if (command === 'C' && current) {
      const c1 = readPoint(tokens, index)
      const c2 = readPoint(tokens, index + 2)
      const end = readPoint(tokens, index + 4)

      segments.push({
        start: current,
        c1,
        c2,
        end,
      })

      current = end
      index += 6
      continue
    }

    if (command === 'Z' || command === 'z') {
      break
    }
  }

  return segments
}

function findCollapsedHandleAnchors(segments: CubicSegment[]) {
  return segments.reduce<AnchorPoint[]>((anchors, segment, index) => {
    const nextSegment = segments[(index + 1) % segments.length]
    const incomingHandleLength = distance(segment.c2, segment.end)
    const outgoingHandleLength = distance(nextSegment.c1, segment.end)

    if (
      incomingHandleLength <= HANDLE_COLLAPSE_EPSILON &&
      outgoingHandleLength <= HANDLE_COLLAPSE_EPSILON
    ) {
      anchors.push({
        id: anchors.length + 1,
        x: segment.end.x,
        y: segment.end.y,
      })
    }

    return anchors
  }, [])
}

function buildAnchoredPortraits(anchors: AnchorPoint[], items: PortraitItem[]) {
  return anchors.map<AnchoredPortrait>((anchor, index) => {
    const item = items[index]
    const clipId = `interactive-vector-portrait-${anchor.id}`

    return {
      id: anchor.id,
      anchorX: anchor.x,
      anchorY: anchor.y,
      src: item?.src ?? '',
      alt: item?.alt ?? `Portrait ${anchor.id}`,
      clipId,
      clipUrl: `url(#${clipId})`,
      blobPath: BLOB_PATHS[index % BLOB_PATHS.length],
      width: PORTRAIT_WIDTH,
      height: PORTRAIT_HEIGHT,
      imageX: -PORTRAIT_WIDTH / 2,
      imageY: -PORTRAIT_HEIGHT / 2,
      preserveAspectRatio: preserveAspectRatioFor(item),
    }
  })
}

function expandViewBox(viewBox: string, padding: number) {
  const [x, y, width, height] = viewBox.split(/\s+/).map(Number)

  return `${x - padding} ${y - padding} ${width + padding * 2} ${height + padding * 2}`
}

function centerFromViewBox(viewBox: string) {
  const { x, y, width, height } = viewBoxRect(viewBox)

  return {
    x: x + width / 2,
    y: y + height / 2,
  }
}

function viewBoxRect(viewBox: string) {
  const [x, y, width, height] = viewBox.split(/\s+/).map(Number)

  return {
    x,
    y,
    width,
    height,
  }
}

function preserveAspectRatioFor(item?: PortraitItem) {
  const x = axisAlign(item?.focusX ?? 0.5, 'x')
  const y = axisAlign(item?.focusY ?? 0.4, 'y')

  return `${x}${y} slice`
}

function axisAlign(value: number, axis: 'x' | 'y') {
  if (value < 0.4) {
    return axis === 'x' ? 'xMin' : 'YMin'
  }

  if (value > 0.6) {
    return axis === 'x' ? 'xMax' : 'YMax'
  }

  return axis === 'x' ? 'xMid' : 'YMid'
}

function readPoint(tokens: string[], index: number) {
  return {
    x: Number(tokens[index]),
    y: Number(tokens[index + 1]),
  }
}

function distance(a: Point, b: Point) {
  return Math.hypot(a.x - b.x, a.y - b.y)
}

onBeforeUnmount(() => {
  cancelInertia()
})
</script>

<template>
  <section class="interactive-wheel">
    <div class="interactive-wheel__header">
      <h2>Grab wheel</h2>
      <span>{{ Math.round(rotation) }}deg</span>
    </div>

    <svg
      ref="svgElement"
      class="interactive-wheel__svg"
      :class="{ 'interactive-wheel__svg--dragging': isDragging }"
      :viewBox="paddedViewBox"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="Draggable hand-drawn vector wheel with upright portraits"
      @pointerdown="onPointerDown"
      @pointermove="onPointerMove"
      @pointerup="onPointerUp"
      @pointercancel="onPointerUp"
      @lostpointercapture="onPointerUp"
    >
      <defs>
        <clipPath
          v-for="portrait in anchoredPortraits"
          :id="portrait.clipId"
          :key="portrait.clipId"
          clipPathUnits="objectBoundingBox"
        >
          <path :d="portrait.blobPath" />
        </clipPath>
      </defs>

      <rect
        class="interactive-wheel__hit-area"
        :x="paddedViewBoxRect.x"
        :y="paddedViewBoxRect.y"
        :width="paddedViewBoxRect.width"
        :height="paddedViewBoxRect.height"
      />

      <g :transform="wheelTransform">
        <path
          :d="svgData.pathD"
          fill="none"
          :stroke="svgData.stroke"
          :stroke-width="svgData.strokeWidth"
          stroke-linecap="round"
          stroke-linejoin="round"
        />

        <g
          v-for="portrait in anchoredPortraits"
          :key="portrait.id"
          :transform="`translate(${portrait.anchorX} ${portrait.anchorY})`"
        >
          <g :transform="counterRotation">
            <image
              class="interactive-wheel__portrait"
              :href="portrait.src"
              :x="portrait.imageX"
              :y="portrait.imageY"
              :width="portrait.width"
              :height="portrait.height"
              :clip-path="portrait.clipUrl"
              :preserveAspectRatio="portrait.preserveAspectRatio"
              draggable="false"
            />
          </g>
        </g>
      </g>
    </svg>
  </section>
</template>

<style scoped>
.interactive-wheel {
  display: grid;
  gap: 12px;
  width: min(100%, 560px);
  margin-top: 40px;
}

.interactive-wheel__header {
  display: flex;
  gap: 12px;
  align-items: baseline;
  justify-content: space-between;
}

.interactive-wheel h2 {
  margin: 0;
  font-size: 1rem;
  line-height: 1.2;
}

.interactive-wheel span {
  color: #666;
  font-size: 0.85rem;
}

.interactive-wheel__svg {
  display: block;
  width: 100%;
  height: auto;
  overflow: visible;
  cursor: grab;
  touch-action: none;
}

.interactive-wheel__svg--dragging {
  cursor: grabbing;
}

.interactive-wheel__hit-area {
  fill: transparent;
}

.interactive-wheel__portrait {
  pointer-events: none;
  user-select: none;
}
</style>
