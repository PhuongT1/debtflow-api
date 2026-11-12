<script setup lang="ts">
import { computed } from 'vue';
const props = defineProps<{ name?: string }>();
const icons: Record<string, string[]> = {
  start: ['M5 4h14v16H5z', 'M9 8h6M9 12h6M9 16h3'],
  database: [
    'M20 6c0 2.2-3.6 4-8 4S4 8.2 4 6s3.6-4 8-4 8 1.8 8 4Z',
    'M4 6v6c0 2.2 3.6 4 8 4s8-1.8 8-4V6',
    'M4 12v6c0 2.2 3.6 4 8 4s8-1.8 8-4v-6',
  ],
  code: ['m8 6-6 6 6 6m8-12 6 6-6 6', 'm14 4-4 16'],
  rules: ['m12 2 8 4v6c0 5-8 10-8 10S4 17 4 12V6Z', 'm8 12 3 3 5-6'],
  reference: [
    'M4 4h7a3 3 0 0 1 3 3v14a4 4 0 0 0-4-3H4Z',
    'M14 7a3 3 0 0 1 3-3h5v14h-4a4 4 0 0 0-4 3',
  ],
  decisions: ['M5 3v12a4 4 0 0 0 4 4h10', 'm15 15 4 4-4 4', 'M5 7h9a4 4 0 0 1 4 4'],
};
const paths = computed(() => icons[props.name ?? 'start'] ?? icons.start);
</script>

<template>
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="1.6"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
  >
    <path v-for="path in paths" :key="path" :d="path" />
  </svg>
</template>
