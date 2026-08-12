<script setup lang="ts">
import { computed, ref } from 'vue'
import PortraitCircle, { type PortraitCircleItem } from '../components/PortraitCircle.vue'
import InteractiveVectorWheel from './InteractiveVectorWheel.vue'
import MultiWheelPrototype from './MultiWheelPrototype.vue'
import VectorAnchorDebug from './VectorAnchorDebug.vue'
import vector2Svg from '../vector-2.svg?raw'
import vector3Svg from '../vector-3.svg?raw'
import vector4Svg from '../vector-4.svg?raw'
import vector5Svg from '../vector-5.svg?raw'
import vector6Svg from '../vector-6.svg?raw'
import vector7Svg from '../vector-7.svg?raw'
import vector8Svg from '../vector-8.svg?raw'
import vector9Svg from '../vector-9.svg?raw'
import vector10Svg from '../vector-10.svg?raw'

type DemoPortraitItem = PortraitCircleItem & {
  label: string
}

const portraitUrls = [
  'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=600&q=80',
  'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=600&q=80',
  'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=600&q=80',
  'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=600&q=80',
  'https://images.unsplash.com/photo-1519345182560-3f2917c472ef?auto=format&fit=crop&w=600&q=80',
  'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=600&q=80',
  'https://images.unsplash.com/photo-1527980965255-d3b416303d12?auto=format&fit=crop&w=600&q=80',
  'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=600&q=80',
  'https://images.unsplash.com/photo-1531123897727-8f129e1688ce?auto=format&fit=crop&w=600&q=80',
  'https://images.unsplash.com/photo-1547425260-76bcadfb4f2c?auto=format&fit=crop&w=600&q=80',
  'https://images.unsplash.com/photo-1546961329-78bef0414d7c?auto=format&fit=crop&w=600&q=80',
  'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=600&q=80',
]
const portraitLabels = [
  'Antoine Defoort',
  'Julien Fournet',
  'Sebastien Vial',
  'Sofia Teillet',
  'Samuel Hackwill',
  'Louise Siffert',
  'Joaqim Fossi',
  'Camille Durand',
  'Nadia Benali',
  'Noam Martin',
  'Iris Laurent',
  'Malo Bernard',
]

const sampleCounts = [5, 7, 12]
const wheelCounts = [2, 3, 4, 5, 6, 7, 8, 9, 10]
const selectedPeopleCount = ref(7)
const vectorByCount: Record<number, string> = {
  2: vector2Svg,
  3: vector3Svg,
  4: vector4Svg,
  5: vector5Svg,
  6: vector6Svg,
  7: vector7Svg,
  8: vector8Svg,
  9: vector9Svg,
  10: vector10Svg,
}
const selectedWheelVector = computed(() => vectorByCount[selectedPeopleCount.value])
const selectedWheelPortraits = computed(() => portraitsFor(selectedPeopleCount.value))

function portraitsFor(count: number): DemoPortraitItem[] {
  return portraitUrls.slice(0, count).map((src, index) => ({
    id: `portrait-${count}-${index + 1}`,
    src,
    alt: portraitLabels[index],
    label: portraitLabels[index],
    focusY: index % 3 === 0 ? 0.36 : 0.42,
  }))
}
</script>

<template>
  <main class="demo-page">
    <header class="demo-header">
      <h1>Portrait Circle</h1>
      <p>Vue/Nuxt SVG module prototype for 5, 7, and 12 portraits.</p>
    </header>

    <MultiWheelPrototype :items="portraitsFor(12)" />

    <section class="live-wheel" aria-label="Interactive portrait wheel by people count">
      <div class="live-wheel__controls">
        <div class="live-wheel__meta">
          <h2>Interactive wheel</h2>
          <span>{{ selectedPeopleCount }} peeps</span>
        </div>

        <div class="count-toggle" role="group" aria-label="People count">
          <button
            v-for="count in wheelCounts"
            :key="count"
            class="count-toggle__button"
            :class="{ 'count-toggle__button--active': selectedPeopleCount === count }"
            type="button"
            :aria-pressed="selectedPeopleCount === count"
            @click="selectedPeopleCount = count"
          >
            {{ count }}
          </button>
        </div>
      </div>

      <InteractiveVectorWheel
        class="live-wheel__wheel"
        :items="selectedWheelPortraits"
        :vector-svg="selectedWheelVector"
      />
    </section>

    <section class="demo-grid" aria-label="Portrait circle examples">
      <article v-for="count in sampleCounts" :key="count" class="demo-panel">
        <div class="demo-panel__meta">
          <h2>{{ count }} portraits</h2>
          <span>{{ count === 5 ? 'pentagon' : count === 7 ? 'heptagon' : 'near circle' }}</span>
        </div>

        <PortraitCircle
          :items="portraitsFor(count)"
          :aria-label="`${count} demo portraits arranged around a circle`"
          ring-color="#6679ff"
        />
      </article>
    </section>

    <VectorAnchorDebug :items="portraitsFor(7)" />

    <InteractiveVectorWheel :items="portraitsFor(7)" />
  </main>
</template>
