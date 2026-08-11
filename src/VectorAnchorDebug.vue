<script setup lang="ts">
import { computed } from 'vue'
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

type AnchoredPortrait = AnchorPoint & {
  src: string
  alt: string
  clipId: string
  clipUrl: string
  blobPath: string
  width: number
  height: number
  x: number
  y: number
  preserveAspectRatio: string
}

type VectorAnchorDebugProps = {
  items?: PortraitItem[]
}

const props = withDefaults(defineProps<VectorAnchorDebugProps>(), {
  items: () => [],
})

const HANDLE_COLLAPSE_EPSILON = 0.01
const VIEWBOX_PADDING = 36
const PORTRAIT_HEIGHT = 54
const PORTRAIT_WIDTH = 43
const BLOB_PATHS = [
  'M .5 .01 C .72 .02 .9 .13 .97 .33 C 1 .5 .94 .74 .78 .88 C .62 1 .34 .99 .18 .87 C .03 .76 .01 .52 .06 .32 C .12 .12 .29 0 .5 .01 Z',
  'M .46 .02 C .7 0 .9 .11 .97 .31 C 1 .49 .94 .72 .8 .9 C .65 1 .37 .98 .19 .88 C .02 .77 0 .56 .05 .36 C .13 .16 .25 .04 .46 .02 Z',
  'M .53 .03 C .75 .04 .94 .18 .98 .39 C 1 .61 .88 .82 .69 .93 C .49 1 .23 .95 .1 .77 C 0 .61 .02 .34 .17 .18 C .29 .05 .39 .01 .53 .03 Z',
  'M .42 .02 C .64 0 .86 .08 .96 .27 C 1 .43 .98 .68 .84 .84 C .69 1 .42 1 .23 .9 C .07 .81 0 .62 .03 .42 C .06 .22 .21 .06 .42 .02 Z',
  'M .56 .01 C .78 .04 .93 .18 .98 .38 C 1 .56 .92 .78 .75 .91 C .58 1 .31 .99 .15 .85 C .01 .72 0 .47 .08 .29 C .18 .1 .35 0 .56 .01 Z',
  'M .48 .02 C .69 .02 .88 .1 .96 .29 C 1 .48 .95 .74 .78 .9 C .6 1 .35 .97 .18 .85 C .03 .74 .01 .53 .06 .35 C .12 .14 .28 .03 .48 .02 Z',
]

const svgData = parseSvg(trialVectorSvg)
const paddedViewBox = expandViewBox(svgData.viewBox, VIEWBOX_PADDING)
const cubicSegments = parseCubicPath(svgData.pathD)
const anchorPoints = findCollapsedHandleAnchors(cubicSegments)
const anchoredPortraits = computed(() => buildAnchoredPortraits(anchorPoints, props.items))

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
    const clipId = `trial-vector-portrait-${anchor.id}`

    return {
      ...anchor,
      src: item?.src ?? '',
      alt: item?.alt ?? `Portrait ${anchor.id}`,
      clipId,
      clipUrl: `url(#${clipId})`,
      blobPath: BLOB_PATHS[index % BLOB_PATHS.length],
      width: PORTRAIT_WIDTH,
      height: PORTRAIT_HEIGHT,
      x: anchor.x - PORTRAIT_WIDTH / 2,
      y: anchor.y - PORTRAIT_HEIGHT / 2,
      preserveAspectRatio: preserveAspectRatioFor(item),
    }
  })
}

function expandViewBox(viewBox: string, padding: number) {
  const [x, y, width, height] = viewBox.split(/\s+/).map(Number)

  return `${x - padding} ${y - padding} ${width + padding * 2} ${height + padding * 2}`
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
</script>

<template>
  <section class="vector-debug">
    <article class="vector-debug__panel">
      <div class="vector-debug__header">
        <h2>Detected vector anchors</h2>
        <span>{{ anchorPoints.length }} points</span>
      </div>

      <svg
        class="vector-debug__svg"
        :viewBox="paddedViewBox"
        xmlns="http://www.w3.org/2000/svg"
        role="img"
        aria-label="Trial vector with detected anchor points marked in red"
      >
        <path
          :d="svgData.pathD"
          fill="none"
          :stroke="svgData.stroke"
          :stroke-width="svgData.strokeWidth"
          stroke-linecap="round"
          stroke-linejoin="round"
        />

        <g class="vector-debug__anchors">
          <circle
            v-for="anchor in anchorPoints"
            :key="anchor.id"
            :cx="anchor.x"
            :cy="anchor.y"
            r="3.2"
          />
        </g>
      </svg>
    </article>

    <article class="vector-debug__panel">
      <div class="vector-debug__header">
        <h2>Portraits on anchors</h2>
        <span>{{ anchoredPortraits.length }} portraits</span>
      </div>

      <svg
        class="vector-debug__svg"
        :viewBox="paddedViewBox"
        xmlns="http://www.w3.org/2000/svg"
        role="img"
        aria-label="Trial vector with portraits centered on detected anchor points"
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

        <path
          :d="svgData.pathD"
          fill="none"
          :stroke="svgData.stroke"
          :stroke-width="svgData.strokeWidth"
          stroke-linecap="round"
          stroke-linejoin="round"
        />

        <image
          v-for="portrait in anchoredPortraits"
          :key="portrait.id"
          class="vector-debug__portrait"
          :href="portrait.src"
          :x="portrait.x"
          :y="portrait.y"
          :width="portrait.width"
          :height="portrait.height"
          :clip-path="portrait.clipUrl"
          :preserveAspectRatio="portrait.preserveAspectRatio"
          draggable="false"
        />
      </svg>
    </article>
  </section>
</template>

<style scoped>
.vector-debug {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 360px), 1fr));
  gap: 28px;
  align-items: start;
}

.vector-debug__panel {
  display: grid;
  gap: 12px;
  min-width: 0;
}

.vector-debug__header {
  display: flex;
  gap: 12px;
  align-items: baseline;
  justify-content: space-between;
}

.vector-debug h2 {
  margin: 0;
  font-size: 1rem;
  line-height: 1.2;
}

.vector-debug span {
  color: #666;
  font-size: 0.85rem;
}

.vector-debug__svg {
  display: block;
  width: 100%;
  height: auto;
  overflow: visible;
}

.vector-debug__anchors circle {
  fill: #f01818;
  stroke: white;
  stroke-width: 1.2;
}

.vector-debug__portrait {
  pointer-events: none;
  user-select: none;
}
</style>
