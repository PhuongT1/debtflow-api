<script setup lang="ts">
import { computed } from 'vue';
import { useData, useRoute, withBase } from 'vitepress';
import type { DocSection } from '../navigation.mts';
import DocIcon from './DocIcon.vue';
const route = useRoute();
const { theme } = useData<{ docSections: DocSection[] }>();
const current = computed(() =>
  theme.value.docSections.find((section) =>
    section.prefixes.some((prefix) => route.path.startsWith(prefix)),
  ),
);
</script>

<template>
  <div v-if="current" class="docs-page-header">
    <a :href="withBase(current.link)" class="docs-category">
      <span class="docs-category-icon"><DocIcon :name="current.icon" /></span>
      {{ current.text }}
    </a>
    <span class="docs-page-kind">DEVELOPER GUIDE</span>
  </div>
</template>
