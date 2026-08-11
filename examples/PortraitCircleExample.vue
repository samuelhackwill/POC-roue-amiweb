<script setup lang="ts">
import PortraitCircle from '../components/PortraitCircle.vue'

const portraits = [
  { id: 'person-1', src: '/portraits/person-1.jpg', alt: 'Person 1', focusY: 0.35 },
  { id: 'person-2', src: '/portraits/person-2.jpg', alt: 'Person 2', focusY: 0.35 },
  { id: 'person-3', src: '/portraits/person-3.jpg', alt: 'Person 3', focusY: 0.4 },
  { id: 'person-4', src: '/portraits/person-4.jpg', alt: 'Person 4', focusY: 0.38 },
  { id: 'person-5', src: '/portraits/person-5.jpg', alt: 'Person 5', focusY: 0.36 },
  { id: 'person-6', src: '/portraits/person-6.jpg', alt: 'Person 6', focusY: 0.42 },
  { id: 'person-7', src: '/portraits/person-7.jpg', alt: 'Person 7', focusY: 0.37 },
]
</script>

<template>
  <section class="portrait-circle-example">
    <PortraitCircle
      :items="portraits"
      aria-label="Portraits arranged around a cooperative circle"
      ring-color="#6679ff"
    />
  </section>
</template>

<style scoped>
.portrait-circle-example {
  width: min(100%, 760px);
  margin: 0 auto;
  padding: 32px;
}
</style>
