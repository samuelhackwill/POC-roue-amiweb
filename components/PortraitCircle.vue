<script lang="ts">
export type PortraitCircleItem = {
  id: string | number
  src: string
  alt?: string
  focusX?: number
  focusY?: number
}

export type PortraitCircleRingShape = 'polygon' | 'circle'
</script>

<script setup lang="ts">
import { computed, getCurrentInstance, watchEffect } from 'vue'

defineOptions({
  name: 'PortraitCircle',
})

type PortraitCircleProps = {
  items: PortraitCircleItem[]
  size?: number | string
  ringColor?: string
  ringWidth?: number
  portraitSize?: number
  ariaLabel?: string
  idPrefix?: string
  ringShape?: PortraitCircleRingShape
  startAngle?: number
}

type LayoutItem = PortraitCircleItem & {
  index: number
  width: number
  height: number
  transform: string
  clipId: string
  clipUrl: string
  blobPath: string
  preserveAspectRatio: string
}

type RingPathPass = {
  id: string
  d: string
  opacity: number
  strokeWidth: number
  transform: string
}

type RingPoint = {
  x: number
  y: number
}

const props = withDefaults(defineProps<PortraitCircleProps>(), {
  size: '100%',
  ringColor: '#6679ff',
  ringWidth: 54,
  ariaLabel: '',
  idPrefix: '',
  ringShape: 'polygon',
  startAngle: -90,
})

const MIN_ITEMS = 5
const MAX_ITEMS = 12
const VIEWBOX_SIZE = 1000
const CENTER = VIEWBOX_SIZE / 2

const RADIUS_JITTER = [-14, 10, -8, 14, -12, 8, -6, 12]
const ROTATION_JITTER = [-4, 3, -2, 5, -5, 2, 4, -3]
const HEIGHT_MULTIPLIER = [1, 0.94, 1.04, 0.98, 1.03, 0.96, 1.01, 0.95]
const WIDTH_MULTIPLIER = [0.84, 0.8, 0.86, 0.82, 0.85, 0.81, 0.83, 0.87]
const RING_ANCHOR_JITTER = [0, 7, -5, 9, -8, 5, -4, 8, -6, 4, -3, 6]
const RING_CURVE_JITTER = [15, -9, 11, -14, 8, -12, 13, -7, 10, -11, 6, -8]
const RING_PASS_CONFIG = [
  { id: 'main', opacity: 0.95, radiusOffset: 0, strokeWidth: 1, transform: '' },
  { id: 'offset-a', opacity: 0.38, radiusOffset: 7, strokeWidth: 0.7, transform: 'translate(2 -1)' },
  { id: 'offset-b', opacity: 0.24, radiusOffset: -5, strokeWidth: 0.5, transform: 'translate(-2 2)' },
]

const BLOB_PATHS = [
  'M .5 .01 C .72 .02 .9 .13 .97 .33 C 1 .5 .94 .74 .78 .88 C .62 1 .34 .99 .18 .87 C .03 .76 .01 .52 .06 .32 C .12 .12 .29 0 .5 .01 Z',
  'M .46 .02 C .7 0 .9 .11 .97 .31 C 1 .49 .94 .72 .8 .9 C .65 1 .37 .98 .19 .88 C .02 .77 0 .56 .05 .36 C .13 .16 .25 .04 .46 .02 Z',
  'M .53 .03 C .75 .04 .94 .18 .98 .39 C 1 .61 .88 .82 .69 .93 C .49 1 .23 .95 .1 .77 C 0 .61 .02 .34 .17 .18 C .29 .05 .39 .01 .53 .03 Z',
  'M .42 .02 C .64 0 .86 .08 .96 .27 C 1 .43 .98 .68 .84 .84 C .69 1 .42 1 .23 .9 C .07 .81 0 .62 .03 .42 C .06 .22 .21 .06 .42 .02 Z',
  'M .56 .01 C .78 .04 .93 .18 .98 .38 C 1 .56 .92 .78 .75 .91 C .58 1 .31 .99 .15 .85 C .01 .72 0 .47 .08 .29 C .18 .1 .35 0 .56 .01 Z',
  'M .48 .02 C .69 .02 .88 .1 .96 .29 C 1 .48 .95 .74 .78 .9 C .6 1 .35 .97 .18 .85 C .03 .74 .01 .53 .06 .35 C .12 .14 .28 .03 .48 .02 Z',
]

const instance = getCurrentInstance()

const isSupportedCount = computed(() => {
  return props.items.length >= MIN_ITEMS && props.items.length <= MAX_ITEMS
})

watchEffect(() => {
  const count = props.items.length

  if (count > 0 && !isSupportedCount.value) {
    console.warn(`[PortraitCircle] Expected ${MIN_ITEMS}-${MAX_ITEMS} items, received ${count}.`)
  }
})

const normalizedCount = computed(() => {
  return Math.min(MAX_ITEMS, Math.max(MIN_ITEMS, props.items.length || MIN_ITEMS))
})

const rootStyle = computed(() => ({
  width: toCssSize(props.size),
  maxWidth: '100%',
}))

const clipPrefix = computed(() => {
  const explicitPrefix = props.idPrefix.trim()

  if (explicitPrefix) {
    return sanitizeId(explicitPrefix)
  }

  return `portrait-circle-${instance?.uid ?? 0}`
})

const basePortraitHeight = computed(() => {
  if (props.portraitSize) {
    return props.portraitSize
  }

  if (normalizedCount.value <= 5) {
    return 260
  }

  if (normalizedCount.value <= 8) {
    return 228
  }

  return 184
})

const baseLayoutRadius = computed(() => {
  if (normalizedCount.value <= 5) {
    return 342
  }

  if (normalizedCount.value <= 8) {
    return 356
  }

  return 374
})

const ringRadius = computed(() => {
  return Math.min(baseLayoutRadius.value, CENTER - props.ringWidth / 2 - 24)
})

const ringFilterId = computed(() => {
  return `${clipPrefix.value}-ring-roughen`
})

const ringFilterUrl = computed(() => {
  return `url(#${ringFilterId.value})`
})

const ringPathPasses = computed<RingPathPass[]>(() => {
  const count = normalizedCount.value

  return RING_PASS_CONFIG.map((pass, passIndex) => ({
    id: pass.id,
    d: buildHandDrawnRingPath(count, passIndex, pass.radiusOffset),
    opacity: pass.opacity,
    strokeWidth: round(props.ringWidth * pass.strokeWidth),
    transform: pass.transform,
  }))
})

const portraits = computed<LayoutItem[]>(() => {
  const count = normalizedCount.value
  const maxRadius = CENTER - basePortraitHeight.value / 2 - 20

  return props.items.map((item, index) => {
    const height = round(basePortraitHeight.value * HEIGHT_MULTIPLIER[index % HEIGHT_MULTIPLIER.length])
    const width = round(height * WIDTH_MULTIPLIER[index % WIDTH_MULTIPLIER.length])
    const angle = angleForIndex(index, count)
    const radius = Math.min(
      maxRadius,
      baseLayoutRadius.value + RADIUS_JITTER[index % RADIUS_JITTER.length],
    )
    const centerX = CENTER + Math.cos(angle) * radius
    const centerY = CENTER + Math.sin(angle) * radius
    const x = centerX - width / 2
    const y = centerY - height / 2
    const rotation = ROTATION_JITTER[index % ROTATION_JITTER.length]
    const clipId = `${clipPrefix.value}-clip-${index}-${sanitizeId(item.id)}`

    return {
      ...item,
      index,
      width,
      height,
      transform: `translate(${round(x)} ${round(y)}) rotate(${rotation} ${round(width / 2)} ${round(height / 2)})`,
      clipId,
      clipUrl: `url(#${clipId})`,
      blobPath: BLOB_PATHS[index % BLOB_PATHS.length],
      preserveAspectRatio: preserveAspectRatioFor(item),
    }
  })
})

const hasAccessibleLabel = computed(() => props.ariaLabel.trim().length > 0)

function angleForIndex(index: number, count: number) {
  return ((props.startAngle + (360 / count) * index) * Math.PI) / 180
}

function buildHandDrawnRingPath(count: number, passIndex: number, radiusOffset: number) {
  const points = Array.from({ length: count }, (_, index) => {
    return ringPointForIndex(index, count, passIndex, radiusOffset)
  })
  const [firstPoint] = points
  const commands = [`M ${round(firstPoint.x)} ${round(firstPoint.y)}`]

  for (let index = 0; index < count; index += 1) {
    const start = points[index]
    const end = points[(index + 1) % count]
    const [controlA, controlB] = ringControlPoints(start, end, count, index, passIndex)

    commands.push(
      `C ${round(controlA.x)} ${round(controlA.y)} ${round(controlB.x)} ${round(controlB.y)} ${round(end.x)} ${round(end.y)}`,
    )
  }

  return commands.join(' ')
}

function ringPointForIndex(index: number, count: number, passIndex: number, radiusOffset: number) {
  const angle = angleForIndex(index, count)
  const anchorJitter = RING_ANCHOR_JITTER[(index + passIndex * 3) % RING_ANCHOR_JITTER.length]
  const passJitter = passIndex === 0 ? 0 : (passIndex % 2 === 0 ? -3 : 3)
  const radius = ringRadius.value + radiusOffset + anchorJitter + passJitter

  return {
    x: CENTER + Math.cos(angle) * radius,
    y: CENTER + Math.sin(angle) * radius,
  }
}

function ringControlPoints(
  start: RingPoint,
  end: RingPoint,
  count: number,
  index: number,
  passIndex: number,
): [RingPoint, RingPoint] {
  const dx = end.x - start.x
  const dy = end.y - start.y
  const length = Math.hypot(dx, dy) || 1
  const normal = outwardNormal(start, end, length)
  const bend = bendForCount(count)
  const wobbleA = RING_CURVE_JITTER[(index + passIndex * 2) % RING_CURVE_JITTER.length]
  const wobbleB = RING_CURVE_JITTER[(index + 4 + passIndex * 3) % RING_CURVE_JITTER.length]
  const passWobble = passIndex * 2.5

  return [
    {
      x: start.x + dx * 0.34 + normal.x * (bend + wobbleA + passWobble),
      y: start.y + dy * 0.34 + normal.y * (bend + wobbleA + passWobble),
    },
    {
      x: start.x + dx * 0.68 + normal.x * (bend * 0.8 + wobbleB - passWobble),
      y: start.y + dy * 0.68 + normal.y * (bend * 0.8 + wobbleB - passWobble),
    },
  ]
}

function outwardNormal(start: RingPoint, end: RingPoint, length: number) {
  const dx = end.x - start.x
  const dy = end.y - start.y
  const midpoint = {
    x: start.x + dx / 2,
    y: start.y + dy / 2,
  }
  const radial = {
    x: midpoint.x - CENTER,
    y: midpoint.y - CENTER,
  }
  let normal = {
    x: -dy / length,
    y: dx / length,
  }

  if (normal.x * radial.x + normal.y * radial.y < 0) {
    normal = {
      x: -normal.x,
      y: -normal.y,
    }
  }

  return normal
}

function bendForCount(count: number) {
  if (count <= 5) {
    return 38
  }

  if (count <= 8) {
    return 28
  }

  return 18
}

function preserveAspectRatioFor(item: PortraitCircleItem) {
  const x = axisAlign(item.focusX ?? 0.5, 'x')
  const y = axisAlign(item.focusY ?? 0.45, 'y')

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

function toCssSize(value: number | string) {
  return typeof value === 'number' ? `${value}px` : value
}

function sanitizeId(value: string | number) {
  return String(value).trim().replace(/[^a-zA-Z0-9_-]/g, '-')
}

function round(value: number) {
  return Math.round(value * 100) / 100
}
</script>

<template>
  <div class="portrait-circle" :style="rootStyle">
    <svg
      v-if="isSupportedCount"
      class="portrait-circle__svg"
      viewBox="0 0 1000 1000"
      xmlns="http://www.w3.org/2000/svg"
      :role="hasAccessibleLabel ? 'img' : undefined"
      :aria-label="hasAccessibleLabel ? props.ariaLabel : undefined"
      :aria-hidden="hasAccessibleLabel ? undefined : true"
    >
      <title v-if="hasAccessibleLabel">{{ props.ariaLabel }}</title>

      <defs>
        <filter
          :id="ringFilterId"
          x="0"
          y="0"
          width="1000"
          height="1000"
          filterUnits="userSpaceOnUse"
        >
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.018 0.028"
            numOctaves="2"
            seed="8"
            result="noise"
          />
          <feDisplacementMap
            in="SourceGraphic"
            in2="noise"
            scale="3.2"
            xChannelSelector="R"
            yChannelSelector="G"
          />
        </filter>

        <clipPath
          v-for="portrait in portraits"
          :id="portrait.clipId"
          :key="portrait.clipId"
          clipPathUnits="objectBoundingBox"
        >
          <path :d="portrait.blobPath" />
        </clipPath>
      </defs>

      <circle
        v-if="props.ringShape === 'circle'"
        class="portrait-circle__ring"
        cx="500"
        cy="500"
        :r="ringRadius"
        fill="none"
        :stroke="props.ringColor"
        :stroke-width="props.ringWidth"
        :filter="ringFilterUrl"
      />

      <g
        v-else
        class="portrait-circle__ring-group"
        :filter="ringFilterUrl"
      >
        <path
          v-for="pass in ringPathPasses"
          :key="pass.id"
          class="portrait-circle__ring"
          :d="pass.d"
          fill="none"
          :opacity="pass.opacity"
          :stroke="props.ringColor"
          :stroke-width="pass.strokeWidth"
          :transform="pass.transform"
        />
      </g>

      <g
        v-for="portrait in portraits"
        :key="portrait.id"
        class="portrait-circle__portrait"
        :transform="portrait.transform"
      >
        <image
          class="portrait-circle__image"
          :href="portrait.src"
          x="0"
          y="0"
          :width="portrait.width"
          :height="portrait.height"
          :clip-path="portrait.clipUrl"
          :preserveAspectRatio="portrait.preserveAspectRatio"
          draggable="false"
        />
      </g>
    </svg>

    <div v-else class="portrait-circle__invalid" aria-hidden="true" />
  </div>
</template>

<style scoped>
.portrait-circle {
  display: block;
  aspect-ratio: 1 / 1;
}

.portrait-circle__svg {
  display: block;
  width: 100%;
  height: 100%;
  overflow: visible;
}

.portrait-circle__ring {
  stroke-linecap: round;
  stroke-linejoin: round;
}

.portrait-circle__portrait {
  transform-box: fill-box;
  transform-origin: center;
}

.portrait-circle__image {
  pointer-events: none;
  user-select: none;
}

.portrait-circle__invalid {
  width: 100%;
  height: 100%;
}
</style>
