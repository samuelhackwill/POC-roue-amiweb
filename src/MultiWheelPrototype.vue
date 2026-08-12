<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import vectorCircleSvg from '../vector-circle.svg?raw'

type PersonItem = {
  id: string | number
  src: string
  alt?: string
  label?: string
  focusX?: number
  focusY?: number
}

type Point = {
  x: number
  y: number
}

type Wheel = Point & {
  id: number
  code: string
}

type SharedEdge = {
  leftWheel: number
  rightWheel: number
}

type SlotToken = number | null

type DisplaySlot = Point & {
  key: string
  occupied: boolean
}

type DisplayPortrait = Point & {
  key: string
  token: number
  src: string
  clipId: string
  clipUrl: string
}

type DisplayInitial = Point & {
  key: string
  text: string
  inside: boolean
}

type MultiWheelPrototypeProps = {
  items?: PersonItem[]
}

const props = withDefaults(defineProps<MultiWheelPrototypeProps>(), {
  items: () => [],
})

const MIN_PEOPLE = 1
const MAX_PEOPLE = 120
const WHEEL_SLOT_COUNT = 10
const DEFAULT_PEOPLE_COUNT = 24
const WHEEL_RADIUS = 96
const WHEEL_SPACING = WHEEL_RADIUS * 2
const WHEEL_MARGIN_X = 150
const VIEWBOX_HEIGHT = 360
const BASE_VIEWBOX_WIDTH = 900
const PORTRAIT_WIDTH = 44
const PORTRAIT_HEIGHT = 54
const OUTER_LABEL_RADIUS = WHEEL_RADIUS + 50
const INNER_LABEL_RADIUS = WHEEL_RADIUS - 42
const INNER_LABEL_OFFSET_X = -26
const LEFT_SHOULDER_LABEL_OFFSET_X = 24
const LEFT_SHOULDER_LABEL_OFFSET_Y = 18
const SNAP_DURATION_MS = 260
const RELEASE_INERTIA_MS = 420
const RELEASE_INERTIA_FACTOR = 170
const WHEEL_CODES = ['HG', 'AB', 'RM', 'MM', 'SB', 'SC', 'RL', 'GO', 'JD', 'SM']
const BLOB_PATHS = [
  'M .5 .01 C .72 .02 .9 .13 .97 .33 C 1 .5 .94 .74 .78 .88 C .62 1 .34 .99 .18 .87 C .03 .76 .01 .52 .06 .32 C .12 .12 .29 0 .5 .01 Z',
  'M .46 .02 C .7 0 .9 .11 .97 .31 C 1 .49 .94 .72 .8 .9 C .65 1 .37 .98 .19 .88 C .02 .77 0 .56 .05 .36 C .13 .16 .25 .04 .46 .02 Z',
  'M .53 .03 C .75 .04 .94 .18 .98 .39 C 1 .61 .88 .82 .69 .93 C .49 1 .23 .95 .1 .77 C 0 .61 .02 .34 .17 .18 C .29 .05 .39 .01 .53 .03 Z',
  'M .42 .02 C .64 0 .86 .08 .96 .27 C 1 .43 .98 .68 .84 .84 C .69 1 .42 1 .23 .9 C .07 .81 0 .62 .03 .42 C .06 .22 .21 .06 .42 .02 Z',
]

const svgElement = ref<SVGSVGElement | null>(null)
const activeWheelId = ref<number | null>(null)
const dragRotation = ref(0)
const isSnapping = ref(false)
const peopleCount = ref(DEFAULT_PEOPLE_COUNT)
const wheelVectorRotations = ref(Array(wheelCountForPeople(DEFAULT_PEOPLE_COUNT)).fill(0))
let lastPointerAngle = 0
let lastPointerTime = 0
let angularVelocity = 0
let snapFrameId: number | null = null

const circlePathData = parseSvgPath(vectorCircleSvg)
const circleViewBox = parseViewBox(vectorCircleSvg)
const circleScale = (WHEEL_RADIUS * 2) / circleViewBox.width
const wheelCount = computed(() => wheelCountForPeople(peopleCount.value))
const viewBoxWidth = computed(() => {
  return Math.max(BASE_VIEWBOX_WIDTH, WHEEL_MARGIN_X * 2 + (wheelCount.value - 1) * WHEEL_SPACING)
})
const viewBox = computed(() => `0 0 ${viewBoxWidth.value} ${VIEWBOX_HEIGHT}`)
const wheels = computed<Wheel[]>(() => {
  const chainWidth = (wheelCount.value - 1) * WHEEL_SPACING
  const firstWheelX = viewBoxWidth.value / 2 - chainWidth / 2

  return Array.from({ length: wheelCount.value }, (_, id) => ({
    id,
    code: WHEEL_CODES[id % WHEEL_CODES.length],
    x: firstWheelX + id * WHEEL_SPACING,
    y: VIEWBOX_HEIGHT / 2,
  }))
})
const renderWheels = computed(() => {
  if (activeWheelId.value === null) {
    return wheels.value
  }

  const activeWheel = wheels.value.find((wheel) => wheel.id === activeWheelId.value)

  if (!activeWheel) {
    return wheels.value
  }

  return [...wheels.value.filter((wheel) => wheel.id !== activeWheel.id), activeWheel]
})
const sharedEdges = computed<SharedEdge[]>(() => {
  return wheels.value.slice(0, -1).map((wheel) => ({
    leftWheel: wheel.id,
    rightWheel: wheel.id + 1,
  }))
})
const topBottomSlotCount = computed(() => (WHEEL_SLOT_COUNT - 2) / 2)
const slotCount = computed(() => WHEEL_SLOT_COUNT)
const slotStep = computed(() => 360 / slotCount.value)
const leftConnectorSlot = computed(() => slotCount.value / 2)
const totalSlotCapacity = computed(() => uniqueSlotCapacity(slotCount.value))
const emptySlotCount = computed(() => totalSlotCapacity.value - peopleCount.value)
const portraitScale = computed(() => Math.max(0.78, Math.min(1, 10 / slotCount.value)))
const portraitWidth = computed(() => PORTRAIT_WIDTH * portraitScale.value)
const portraitHeight = computed(() => PORTRAIT_HEIGHT * portraitScale.value)
const slots = ref(createSlotsForPeople(peopleCount.value, slotCount.value))

const peopleCountControl = computed({
  get() {
    return peopleCount.value
  },
  set(value: number) {
    setPeopleCount(value)
  },
})

const tokenIds = computed(() => {
  return [...new Set(slots.value.flat().filter((token): token is number => token !== null))]
})

function displaySlotsForWheel(wheel: Wheel) {
  return (slots.value[wheel.id] ?? []).flatMap<DisplaySlot>((token, slot) => {
    if (!shouldRenderSlot(wheel.id, slot)) {
      return []
    }

    return [
      {
        ...slotPosition(wheel, slot, portraitRotationForWheel(wheel.id)),
        key: `multi-wheel-slot-${wheel.id}-${slot}`,
        occupied: token !== null,
      },
    ]
  })
}

function displayPortraitsForWheel(wheel: Wheel) {
  return (slots.value[wheel.id] ?? []).flatMap<DisplayPortrait>((token, slot) => {
    if (token === null || !shouldRenderSlot(wheel.id, slot)) {
      return []
    }

    const rotation = portraitRotationForWheel(wheel.id)
    const position = slotPosition(wheel, slot, rotation)

    return [
      {
        ...position,
        key: `multi-wheel-token-${token}`,
        token,
        src: personForToken(token).src,
        clipId: `multi-wheel-clip-${token}`,
        clipUrl: `url(#multi-wheel-clip-${token})`,
      },
    ]
  })
}

function displayInitialsForWheel(wheel: Wheel) {
  return (slots.value[wheel.id] ?? []).flatMap<DisplayInitial>((token, slot) => {
    if (token === null || !shouldRenderSlot(wheel.id, slot)) {
      return []
    }

    const inside = isInsideLabelSlot(slot)

    return [
      {
        ...labelPosition(wheel, slot, inside),
        key: `multi-wheel-initial-${token}`,
        text: labelTextForToken(token, wheel.id, slot),
        inside,
      },
    ]
  })
}

watch(peopleCount, () => {
  cancelSnap()
  activeWheelId.value = null
  dragRotation.value = 0
  angularVelocity = 0
  wheelVectorRotations.value = resizeRotations(wheelVectorRotations.value, wheelCount.value)
  slots.value = createSlotsForPeople(peopleCount.value, slotCount.value)
})

function setPeopleCount(value: number) {
  const roundedValue = Math.round(Number(value))

  if (Number.isNaN(roundedValue)) {
    return
  }

  peopleCount.value = Math.min(MAX_PEOPLE, Math.max(MIN_PEOPLE, roundedValue))
}

function createSlotsForPeople(count: number, slotsPerWheel: number) {
  const wheelSlots = wheels.value.map(() => Array<SlotToken>(slotsPerWheel).fill(null))
  let token = 0

  sharedEdges.value.forEach((edge) => {
    if (token >= count) {
      return
    }

    wheelSlots[edge.leftWheel][0] = token
    wheelSlots[edge.rightWheel][slotsPerWheel / 2] = token
    token += 1
  })

  nonSharedSlotOrder(slotsPerWheel).forEach((slot) => {
    wheels.value.forEach((wheel) => {
      if (token >= count || sharedEdgeForSlot(wheel.id, slot)) {
        return
      }

      wheelSlots[wheel.id][slot] = token
      token += 1
    })
  })

  return wheelSlots
}

function uniqueSlotCapacity(slotsPerWheel: number) {
  return wheelCount.value * slotsPerWheel - Math.max(0, wheelCount.value - 1)
}

function wheelCountForPeople(count: number) {
  let wheelsNeeded = 1

  while (uniqueCapacityForWheelCount(wheelsNeeded) < count) {
    wheelsNeeded += 1
  }

  return wheelsNeeded
}

function uniqueCapacityForWheelCount(wheelsNeeded: number) {
  return wheelsNeeded * WHEEL_SLOT_COUNT - Math.max(0, wheelsNeeded - 1)
}

function nonSharedSlotOrder(slotsPerWheel: number) {
  const centerSlot = slotsPerWheel / 2
  const orderedSlots = [0, centerSlot]

  for (let offset = 1; offset <= centerSlot; offset += 1) {
    orderedSlots.push(offset)

    if (offset !== centerSlot) {
      orderedSlots.push(slotsPerWheel - offset)
    }
  }

  return [...new Set(orderedSlots)]
}

function resizeRotations(rotations: number[], nextLength: number) {
  return Array.from({ length: nextLength }, (_, index) => rotations[index] ?? 0)
}

function personForToken(token: number) {
  const fallback = {
    id: token,
    src: '',
    alt: `Portrait ${token + 1}`,
    label: `P${token + 1}`,
  }

  if (props.items.length === 0) {
    return fallback
  }

  return props.items[token % props.items.length] ?? fallback
}

function initialsForToken(token: number) {
  const item = personForToken(token)
  const rawName = item.label ?? item.alt ?? `P ${token + 1}`
  const [firstName, lastName] = nameParts(rawName)
  const initials = `${lastName.slice(0, 2)}${firstName.slice(0, 1)}`.toUpperCase()

  return initials || `P${token + 1}`
}

function labelTextForToken(token: number, wheelId: number, slot: number) {
  const arrow = arrowForLabelSlot(wheelId, slot)

  return `${initialsForToken(token)}${arrow ? ` ${arrow}` : ''}`
}

function arrowForLabelSlot(wheelId: number, slot: number) {
  if (slot === slotCount.value - 1) {
    return '\u2197'
  }

  if (slot === 0) {
    return '\u2192'
  }

  if (slot === 1) {
    return '\u2198'
  }

  if (wheelId > 0 && slot === leftConnectorSlot.value - 1) {
    return '\u2191'
  }

  if (wheelId > 0 && slot === leftConnectorSlot.value + 1) {
    return '\u2193'
  }

  return ''
}

function nameParts(rawName: string) {
  const trimmedName = rawName.trim()

  if (trimmedName.includes(',')) {
    const [lastName, firstName] = trimmedName.split(',').map((part) => normalizeNamePart(part))

    return [firstName ?? '', lastName ?? '']
  }

  const parts = trimmedName.split(/\s+/).map((part) => normalizeNamePart(part))
  const firstName = parts[0] ?? ''
  const lastName = parts[parts.length - 1] ?? firstName

  return [firstName, lastName]
}

function normalizeNamePart(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z]/gi, '')
}

function onPointerDown(wheelId: number, event: PointerEvent) {
  if (isSnapping.value) {
    return
  }

  const svg = svgElement.value

  if (!svg) {
    return
  }

  cancelSnap()
  activeWheelId.value = wheelId
  dragRotation.value = 0
  lastPointerAngle = angleFromPointer(wheelId, event)
  lastPointerTime = performance.now()
  angularVelocity = 0
  svg.setPointerCapture(event.pointerId)
}

function onPointerMove(event: PointerEvent) {
  if (activeWheelId.value === null) {
    return
  }

  const angle = angleFromPointer(activeWheelId.value, event)
  const delta = shortestAngleDelta(lastPointerAngle, angle)
  const now = performance.now()
  const elapsed = Math.max(1, now - lastPointerTime)
  const currentVelocity = delta / elapsed

  dragRotation.value += delta
  angularVelocity = angularVelocity * 0.65 + currentVelocity * 0.35
  lastPointerAngle = angle
  lastPointerTime = now
}

function onPointerUp(event: PointerEvent) {
  const svg = svgElement.value

  if (activeWheelId.value === null || isSnapping.value) {
    return
  }

  snapActiveWheel()

  if (svg?.hasPointerCapture(event.pointerId)) {
    svg.releasePointerCapture(event.pointerId)
  }
}

function snapActiveWheel() {
  const wheelId = activeWheelId.value

  if (wheelId === null || isSnapping.value) {
    return
  }

  const startRotation = dragRotation.value
  const inertialRotation = angularVelocity * RELEASE_INERTIA_FACTOR
  const overshootRotation = startRotation + inertialRotation
  const targetSteps = directionalSnapSteps(overshootRotation, movementDirection(inertialRotation, startRotation))
  const targetRotation = targetSteps * slotStep.value
  const startedAt = performance.now()

  isSnapping.value = true

  function animate(timestamp: number) {
    const progress = Math.min(1, (timestamp - startedAt) / (RELEASE_INERTIA_MS + SNAP_DURATION_MS))
    const inertiaDurationRatio = RELEASE_INERTIA_MS / (RELEASE_INERTIA_MS + SNAP_DURATION_MS)
    const snapDurationRatio = SNAP_DURATION_MS / (RELEASE_INERTIA_MS + SNAP_DURATION_MS)

    if (progress < inertiaDurationRatio) {
      const inertiaProgress = progress / inertiaDurationRatio
      const easedProgress = 1 - (1 - inertiaProgress) ** 2

      dragRotation.value = startRotation + (overshootRotation - startRotation) * easedProgress
    } else {
      const snapProgress = (progress - inertiaDurationRatio) / snapDurationRatio
      const easedProgress = 1 - (1 - snapProgress) ** 3

      dragRotation.value = overshootRotation + (targetRotation - overshootRotation) * easedProgress
    }

    if (progress < 1) {
      snapFrameId = requestAnimationFrame(animate)
      return
    }

    wheelVectorRotations.value = wheelVectorRotations.value.map((rotation, index) => {
      return index === wheelId ? rotation + targetRotation : rotation
    })
    dragRotation.value = 0
    angularVelocity = 0
    activeWheelId.value = null
    commitWheelRotation(wheelId, targetSteps)
    isSnapping.value = false
    snapFrameId = null
  }

  snapFrameId = requestAnimationFrame(animate)
}

function commitWheelRotation(wheelId: number, stepDelta: number) {
  const normalizedStep = ((stepDelta % slotCount.value) + slotCount.value) % slotCount.value

  if (normalizedStep === 0) {
    return
  }

  const nextSlots = slots.value.map((wheelSlots) => [...wheelSlots])
  const rotatedSlots = Array<SlotToken>(slotCount.value)

  nextSlots[wheelId].forEach((token, slot) => {
    rotatedSlots[(slot + normalizedStep) % slotCount.value] = token
  })

  nextSlots[wheelId] = rotatedSlots

  if (wheelId > 0) {
    nextSlots[wheelId - 1][0] = rotatedSlots[leftConnectorSlot.value]
  }

  if (wheelId < wheels.value.length - 1) {
    nextSlots[wheelId + 1][leftConnectorSlot.value] = rotatedSlots[0]
  }

  slots.value = nextSlots
}

function movementDirection(inertialRotation: number, startRotation: number) {
  if (Math.abs(inertialRotation) > 1) {
    return Math.sign(inertialRotation)
  }

  return Math.sign(startRotation)
}

function directionalSnapSteps(rotation: number, direction: number) {
  const stepFloat = rotation / slotStep.value
  const snapPrecision = 0.000001

  if (direction > 0) {
    return Math.ceil(stepFloat - snapPrecision)
  }

  if (direction < 0) {
    return Math.floor(stepFloat + snapPrecision)
  }

  return Math.round(stepFloat)
}

function cancelSnap() {
  if (snapFrameId !== null) {
    cancelAnimationFrame(snapFrameId)
    snapFrameId = null
  }
}

function portraitRotationForWheel(wheelId: number) {
  return activeWheelId.value === wheelId ? dragRotation.value : 0
}

function wheelVectorRotationForWheel(wheelId: number) {
  const dragOffset = activeWheelId.value === wheelId ? dragRotation.value : 0

  return (wheelVectorRotations.value[wheelId] ?? 0) + dragOffset
}

function slotPosition(wheel: Wheel, slot: number, rotation: number) {
  const angle = ((slot * slotStep.value + rotation) * Math.PI) / 180

  return {
    x: wheel.x + Math.cos(angle) * WHEEL_RADIUS,
    y: wheel.y + Math.sin(angle) * WHEEL_RADIUS,
  }
}

function labelPosition(wheel: Wheel, slot: number, inside: boolean) {
  const radius = inside ? INNER_LABEL_RADIUS : OUTER_LABEL_RADIUS
  const angle = (slot * slotStep.value * Math.PI) / 180
  const offset = labelOffsetForSlot(slot, inside)

  return {
    x: wheel.x + Math.cos(angle) * radius + offset.x,
    y: wheel.y + Math.sin(angle) * radius + offset.y,
  }
}

function labelOffsetForSlot(slot: number, inside: boolean) {
  if (inside) {
    return { x: INNER_LABEL_OFFSET_X, y: 0 }
  }

  if (slot === leftConnectorSlot.value + 1) {
    return {
      x: LEFT_SHOULDER_LABEL_OFFSET_X,
      y: -LEFT_SHOULDER_LABEL_OFFSET_Y,
    }
  }

  if (slot === leftConnectorSlot.value - 1) {
    return {
      x: LEFT_SHOULDER_LABEL_OFFSET_X,
      y: LEFT_SHOULDER_LABEL_OFFSET_Y,
    }
  }

  return { x: 0, y: 0 }
}

function isInsideLabelSlot(slot: number) {
  const rightmostSlots = [slotCount.value - 1, 0, 1]

  return rightmostSlots.includes(slot)
}

function sharedEdgeForSlot(wheelId: number, slot: number) {
  if (slot === 0 && wheelId < wheels.value.length - 1) {
    return sharedEdges.value[wheelId]
  }

  if (slot === leftConnectorSlot.value && wheelId > 0) {
    return sharedEdges.value[wheelId - 1]
  }

  return null
}

function shouldRenderSlot(wheelId: number, slot: number) {
  const edge = sharedEdgeForSlot(wheelId, slot)

  if (!edge) {
    return true
  }

  if (activeWheelId.value === edge.leftWheel) {
    return wheelId === edge.leftWheel && slot === 0
  }

  if (activeWheelId.value === edge.rightWheel) {
    return wheelId === edge.rightWheel && slot === leftConnectorSlot.value
  }

  return wheelId === edge.leftWheel && slot === 0
}

function angleFromPointer(wheelId: number, event: PointerEvent) {
  const point = clientPointToSvgPoint(event)
  const wheel = wheels.value[wheelId]

  if (!wheel) {
    return 0
  }

  return (Math.atan2(point.y - wheel.y, point.x - wheel.x) * 180) / Math.PI
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

  return {
    x: 0,
    y: 0,
  }
}

function shortestAngleDelta(from: number, to: number) {
  return ((to - from + 540) % 360) - 180
}

function parseSvgPath(svg: string) {
  return svg.match(/<path[^>]*\sd="([^"]+)"/)?.[1] ?? ''
}

function parseViewBox(svg: string) {
  const [x, y, width, height] = (svg.match(/\sviewBox="([^"]+)"/)?.[1] ?? '0 0 190 194')
    .split(/\s+/)
    .map(Number)

  return {
    x,
    y,
    width,
    height,
  }
}

function wheelVectorTransform(wheel: Wheel) {
  const x = wheel.x - circleViewBox.x * circleScale - (circleViewBox.width * circleScale) / 2
  const y = wheel.y - circleViewBox.y * circleScale - (circleViewBox.height * circleScale) / 2

  return `translate(${x} ${y}) scale(${circleScale})`
}

onBeforeUnmount(() => {
  cancelSnap()
})
</script>

<template>
  <section class="multi-wheel-prototype">
    <div class="multi-wheel-prototype__controls" aria-label="People count controls">
      <button
        class="multi-wheel-prototype__stepper"
        type="button"
        :disabled="isSnapping || peopleCount <= MIN_PEOPLE"
        aria-label="Remove one person"
        title="Remove one person"
        @click="setPeopleCount(peopleCount - 1)"
      >
        -
      </button>

      <label class="multi-wheel-prototype__range">
        <span>Peeps</span>
        <input
          v-model.number="peopleCountControl"
          type="range"
          :min="MIN_PEOPLE"
          :max="MAX_PEOPLE"
          :disabled="isSnapping"
        >
      </label>

      <input
        v-model.number="peopleCountControl"
        class="multi-wheel-prototype__count"
        type="number"
        :min="MIN_PEOPLE"
        :max="MAX_PEOPLE"
        aria-label="People count"
        :disabled="isSnapping"
      >

      <button
        class="multi-wheel-prototype__stepper"
        type="button"
        :disabled="isSnapping || peopleCount >= MAX_PEOPLE"
        aria-label="Add one person"
        title="Add one person"
        @click="setPeopleCount(peopleCount + 1)"
      >
        +
      </button>

      <div class="multi-wheel-prototype__metrics" aria-live="polite">
        <span>{{ wheelCount }} wheels</span>
        <span>{{ slotCount }} slots / wheel</span>
        <span>{{ topBottomSlotCount }} top + {{ topBottomSlotCount }} bottom</span>
        <span>{{ emptySlotCount }} empty</span>
      </div>
    </div>

    <div class="multi-wheel-prototype__stage">
      <svg
        ref="svgElement"
        class="multi-wheel-prototype__svg"
        :viewBox="viewBox"
        xmlns="http://www.w3.org/2000/svg"
        role="img"
        aria-label="Prototype de roues connectees avec portraits partages et rotation crantee"
        @pointermove="onPointerMove"
        @pointerup="onPointerUp"
        @pointercancel="onPointerUp"
        @lostpointercapture="onPointerUp"
      >
      <defs>
        <clipPath
          v-for="token in tokenIds"
          :id="`multi-wheel-clip-${token}`"
          :key="token"
          clipPathUnits="objectBoundingBox"
        >
          <path :d="BLOB_PATHS[token % BLOB_PATHS.length]" />
        </clipPath>
      </defs>

      <line
        class="multi-wheel-prototype__axis"
        :x1="wheels[0].x"
        :x2="wheels[wheels.length - 1].x"
        :y1="wheels[0].y"
        :y2="wheels[0].y"
      />

      <g class="multi-wheel-prototype__rings">
        <g
          v-for="wheel in wheels"
          :key="wheel.id"
          :transform="`rotate(${wheelVectorRotationForWheel(wheel.id)} ${wheel.x} ${wheel.y})`"
        >
          <g :transform="wheelVectorTransform(wheel)">
            <path
              class="multi-wheel-prototype__ring"
              :class="{ 'multi-wheel-prototype__ring--active': activeWheelId === wheel.id }"
              :d="circlePathData"
              fill="none"
              stroke="#6983ff"
              stroke-width="10"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          </g>
        </g>
      </g>

      <g
        v-for="wheel in renderWheels"
        :key="wheel.id"
        class="multi-wheel-prototype__wheel-layer"
        :class="{ 'multi-wheel-prototype__wheel-layer--active': activeWheelId === wheel.id }"
      >
        <g
          class="multi-wheel-prototype__wheel"
          :class="{ 'multi-wheel-prototype__wheel--active': activeWheelId === wheel.id }"
        >
          <g class="multi-wheel-prototype__slots">
            <circle
              v-for="slot in displaySlotsForWheel(wheel)"
              :key="slot.key"
              class="multi-wheel-prototype__slot"
              :class="{ 'multi-wheel-prototype__slot--occupied': slot.occupied }"
              :cx="slot.x"
              :cy="slot.y"
              r="4"
            />
          </g>

          <g class="multi-wheel-prototype__portraits">
            <g
              v-for="portrait in displayPortraitsForWheel(wheel)"
              :key="portrait.key"
              :transform="`translate(${portrait.x} ${portrait.y})`"
            >
              <g>
                <image
                  class="multi-wheel-prototype__portrait-image"
                  :href="portrait.src"
                  :x="-portraitWidth / 2"
                  :y="-portraitHeight / 2"
                  :width="portraitWidth"
                  :height="portraitHeight"
                  :clip-path="portrait.clipUrl"
                  preserveAspectRatio="xMidYMid slice"
                  draggable="false"
                />
              </g>
            </g>
          </g>

          <g class="multi-wheel-prototype__initials">
            <text
              v-for="initial in displayInitialsForWheel(wheel)"
              :key="initial.key"
              class="multi-wheel-prototype__initial"
              :class="{ 'multi-wheel-prototype__initial--inside': initial.inside }"
              :x="initial.x"
              :y="initial.y"
              text-anchor="middle"
              dominant-baseline="middle"
            >
              {{ initial.text }}
            </text>
          </g>

          <circle
            class="multi-wheel-prototype__hit-area"
            :cx="wheel.x"
            :cy="wheel.y"
            :r="WHEEL_RADIUS + 42"
            @pointerdown="onPointerDown(wheel.id, $event)"
          />
        </g>
      </g>
      </svg>
    </div>
  </section>
</template>

<style scoped>
.multi-wheel-prototype {
  display: grid;
  gap: 12px;
  margin-bottom: 48px;
}

.multi-wheel-prototype__controls {
  display: grid;
  grid-template-columns: 34px minmax(180px, 1fr) 64px 34px auto;
  gap: 10px;
  align-items: center;
  padding: 10px 0;
  border-top: 1px solid rgba(25, 25, 25, 0.12);
  border-bottom: 1px solid rgba(25, 25, 25, 0.12);
}

.multi-wheel-prototype__stepper {
  display: grid;
  width: 34px;
  height: 34px;
  place-items: center;
  border: 1px solid rgba(25, 25, 25, 0.22);
  border-radius: 6px;
  background: #fff;
  color: #191919;
  cursor: pointer;
  font-size: 20px;
  line-height: 1;
}

.multi-wheel-prototype__stepper:disabled {
  cursor: not-allowed;
  opacity: 0.4;
}

.multi-wheel-prototype__range {
  display: grid;
  grid-template-columns: auto minmax(120px, 1fr);
  gap: 10px;
  align-items: center;
  min-width: 0;
  color: #191919;
  font-size: 0.85rem;
}

.multi-wheel-prototype__range input {
  width: 100%;
  accent-color: #3c4b9d;
}

.multi-wheel-prototype__count {
  width: 64px;
  height: 34px;
  box-sizing: border-box;
  border: 1px solid rgba(25, 25, 25, 0.22);
  border-radius: 6px;
  color: #191919;
  font: inherit;
  text-align: center;
}

.multi-wheel-prototype__metrics {
  display: flex;
  gap: 10px;
  justify-content: flex-end;
  color: #5c5c5c;
  font-size: 0.78rem;
  white-space: nowrap;
}

.multi-wheel-prototype__stage {
  overflow: visible;
  overflow-y: visible;
}

.multi-wheel-prototype__svg {
  display: block;
  width: 100%;
  height: auto;
  overflow: visible;
  cursor: grab;
  touch-action: none;
}

.multi-wheel-prototype__axis {
  stroke: rgba(25, 25, 25, 0.2);
  stroke-dasharray: 6 8;
  stroke-width: 1;
}

.multi-wheel-prototype__ring {
  transition: opacity 160ms ease;
}

.multi-wheel-prototype__ring--active {
  opacity: 0.72;
}

.multi-wheel-prototype__slot {
  fill: #fff;
  opacity: 0.82;
  pointer-events: none;
  stroke: #3c4b9d;
  stroke-width: 1.4;
}

.multi-wheel-prototype__slot--occupied {
  fill: #3c4b9d;
  opacity: 0.48;
  stroke-width: 0;
}

.multi-wheel-prototype__hit-area {
  fill: transparent;
}

.multi-wheel-prototype__portrait-image {
  pointer-events: none;
  user-select: none;
}

.multi-wheel-prototype__initial {
  fill: #191919;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0;
  paint-order: stroke;
  pointer-events: none;
  stroke: rgba(255, 255, 255, 0.92);
  stroke-linejoin: round;
  stroke-width: 4px;
  user-select: none;
}

.multi-wheel-prototype__initial--inside {
  font-size: 13px;
}

@media (max-width: 760px) {
  .multi-wheel-prototype__controls {
    grid-template-columns: 34px minmax(0, 1fr) 64px 34px;
  }

  .multi-wheel-prototype__metrics {
    grid-column: 1 / -1;
    justify-content: flex-start;
    overflow-x: auto;
  }
}
</style>
