<script setup lang="ts">
import PortraitCircle, { type PortraitCircleItem } from '../components/PortraitCircle.vue'
import VectorAnchorDebug from './VectorAnchorDebug.vue'

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

const sampleCounts = [5, 7, 12]

function portraitsFor(count: number): PortraitCircleItem[] {
  return portraitUrls.slice(0, count).map((src, index) => ({
    id: `portrait-${count}-${index + 1}`,
    src,
    alt: `Demo portrait ${index + 1}`,
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
  </main>
</template>
