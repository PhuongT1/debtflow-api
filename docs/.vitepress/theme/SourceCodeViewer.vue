<script setup lang="ts">
import { ref } from 'vue';

defineProps<{ title: string }>();
const dialog = ref<HTMLDialogElement>();
</script>

<template>
  <button class="source-open" type="button" @click="dialog?.showModal()">Xem {{ title }}</button>
  <dialog ref="dialog" class="source-dialog" :aria-label="title" @click="($event.target === dialog) && dialog?.close()">
    <header>
      <strong>{{ title }}</strong>
      <button type="button" aria-label="Đóng mã nguồn" @click="dialog?.close()">Đóng ✕</button>
    </header>
    <div class="source-content"><slot /></div>
  </dialog>
</template>

<style scoped>
.source-open, header button {
  padding: 8px 14px;
  border: 1px solid var(--vp-c-divider);
  border-radius: 8px;
  color: var(--vp-c-brand-1);
  background: var(--vp-c-bg-soft);
  cursor: pointer;
}
.source-open:hover, header button:hover { background: var(--vp-c-default-soft); }
.source-open:focus-visible, header button:focus-visible { outline: 2px solid var(--vp-c-brand-1); outline-offset: 3px; }
.source-dialog {
  position: fixed;
  margin: auto;
  width: min(1100px, 94vw);
  max-width: 94vw;
  max-height: 90dvh;
  padding: 0;
  border: 1px solid var(--vp-c-divider);
  border-radius: 12px;
  color: var(--vp-c-text-1);
  background: var(--vp-c-bg);
}
.source-dialog::backdrop { background: rgb(0 0 0 / 55%); }
header { display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: 16px; }
header strong { overflow-wrap: anywhere; }
.source-content { max-height: calc(90dvh - 78px); overflow: auto; padding: 0 20px 20px; }
.source-content :deep(div[class*='language-']) { margin: 0; }
</style>
