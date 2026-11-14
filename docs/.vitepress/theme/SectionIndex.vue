<script setup lang="ts">
import { computed } from 'vue';
import { useData, withBase } from 'vitepress';
import type { DocSection } from '../navigation.mts';
import DocIcon from './DocIcon.vue';
import TopicLinks from './TopicLinks.vue';

const props = defineProps<{ section?: string }>();
const { theme } = useData<{ docSections: DocSection[] }>();
const current = computed(() => theme.value.docSections.find((item) => item.link === props.section));
</script>

<template>
  <div v-if="current" class="docs-section-index">
    <section v-for="group in current.groups" :key="group.text">
      <h2>{{ group.text }}</h2>
      <TopicLinks :items="group.items" />
    </section>
  </div>
  <div v-else class="docs-section-grid">
    <a
      v-for="section in theme.docSections"
      :key="section.link"
      :href="withBase(section.link)"
      class="docs-section-card"
    >
      <span class="docs-card-icon"><DocIcon :name="section.icon" /></span>
      <span class="docs-card-title">{{ section.text }}<span aria-hidden="true">↗</span></span>
      <span class="docs-card-description">{{ section.description }}</span>
    </a>
  </div>
</template>
