<script setup lang="ts">
import { withBase } from 'vitepress';
import type { PageLink } from '../navigation.mts';
defineProps<{ items: PageLink[] }>();
</script>

<template>
  <ul class="docs-topic-tree">
    <li v-for="item in items" :key="item.link ?? item.text">
      <a v-if="item.link" :href="withBase(item.link)" class="docs-topic-link">
        <span>{{ item.text }}</span
        ><span class="docs-topic-arrow" aria-hidden="true">→</span>
      </a>
      <p v-else class="docs-topic-group">{{ item.text }}</p>
      <TopicLinks v-if="item.items?.length" :items="item.items" />
    </li>
  </ul>
</template>
