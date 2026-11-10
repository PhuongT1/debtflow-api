<script setup lang="ts">
import { nextTick, onMounted, onUnmounted, ref, watch } from 'vue';
import { useRoute } from 'vitepress';

const route = useRoute();
const dialog = ref<HTMLDialogElement>();
const viewport = ref<HTMLDivElement>();
const canvas = ref<HTMLDivElement>();
const percent = ref(100);
let width = 1;
let height = 1;
let scale = 1;
let x = 0;
let y = 0;
let drag: { id: number; x: number; y: number } | undefined;
let observer: MutationObserver;
let opener: HTMLButtonElement | undefined;

function paint() {
  if (!canvas.value) return;
  canvas.value.style.transform = `translate(${x}px, ${y}px) scale(${scale})`;
  percent.value = Math.round(scale * 100);
}

function fit() {
  if (!viewport.value || !dialog.value?.open) return;
  const { clientWidth, clientHeight } = viewport.value;
  scale = Math.max(0.05, Math.min((clientWidth - 48) / width, (clientHeight - 48) / height, 1));
  x = (clientWidth - width * scale) / 2;
  y = (clientHeight - height * scale) / 2;
  paint();
}

// Keep the diagram coordinate under the cursor fixed while scaling.
function zoom(factor: number, anchorX?: number, anchorY?: number) {
  if (!viewport.value) return;
  const px = anchorX ?? viewport.value.clientWidth / 2;
  const py = anchorY ?? viewport.value.clientHeight / 2;
  const next = Math.min(8, Math.max(0.05, scale * factor));
  const ratio = next / scale;
  x = px - (px - x) * ratio;
  y = py - (py - y) * ratio;
  scale = next;
  paint();
}

function wheel(event: WheelEvent) {
  event.preventDefault();
  const bounds = viewport.value!.getBoundingClientRect();
  const delta =
    event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? bounds.height : 1);
  zoom(
    Math.exp(-Math.max(-100, Math.min(100, delta)) * 0.01),
    event.clientX - bounds.left,
    event.clientY - bounds.top,
  );
}

function startDrag(event: PointerEvent) {
  if (event.button !== 0 || drag) return;
  drag = { id: event.pointerId, x: event.clientX, y: event.clientY };
  viewport.value!.setPointerCapture(event.pointerId);
  viewport.value!.classList.add('is-dragging');
}
function moveDrag(event: PointerEvent) {
  if (drag?.id !== event.pointerId) return;
  x += event.clientX - drag.x;
  y += event.clientY - drag.y;
  drag.x = event.clientX;
  drag.y = event.clientY;
  paint();
}
function endDrag() {
  drag = undefined;
  viewport.value?.classList.remove('is-dragging');
}

function closed() {
  endDrag();
  canvas.value?.replaceChildren();
  if (opener?.isConnected) opener.focus();
}

async function openDiagram(button: HTMLButtonElement) {
  const source = button.parentElement?.querySelector('svg');
  if (!source || !canvas.value || dialog.value?.open) return;
  opener = button;
  const svg = source.cloneNode(true) as SVGSVGElement;
  const box = source.viewBox.baseVal;
  width = box.width || source.getBoundingClientRect().width;
  height = box.height || source.getBoundingClientRect().height;
  svg.setAttribute('width', String(width));
  svg.setAttribute('height', String(height));
  svg.style.maxWidth = 'none';
  svg.style.width = `${width}px`;
  svg.style.height = `${height}px`;
  // Avoid duplicate SVG marker/label IDs while retaining Mermaid's scoped styles.
  const ids = [svg, ...svg.querySelectorAll('[id]')].map((node) => node.id).filter(Boolean);
  const pattern = ids
    .sort((a, b) => b.length - a.length)
    .map((id) => id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    .join('|');
  canvas.value.innerHTML = pattern
    ? svg.outerHTML.replace(new RegExp(pattern, 'g'), (id) => `expanded-${id}`)
    : svg.outerHTML;
  dialog.value!.showModal();
  await nextTick();
  fit();
}

function attachButtons() {
  document.querySelectorAll<HTMLElement>('.vp-doc .mermaid').forEach((block) => {
    if (!block.querySelector('svg') || block.querySelector('.diagram-expand')) return;
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'diagram-expand';
    button.setAttribute('aria-label', 'Mở lớn sơ đồ');
    button.title = 'Mở lớn sơ đồ';
    button.innerHTML =
      '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M9 3H3v6m12-6h6v6M3 15v6h6m12-6v6h-6"/></svg>';
    block.append(button);
  });
}
function handleClick(event: MouseEvent) {
  const button = (event.target as Element).closest<HTMLButtonElement>('.diagram-expand');
  if (button) void openDiagram(button);
}
watch(
  () => route.path,
  () => dialog.value?.close(),
);
onMounted(() => {
  // Mermaid renders asynchronously and re-renders when the theme changes.
  observer = new MutationObserver(attachButtons);
  observer.observe(document.querySelector('.VPContent') ?? document.body, {
    childList: true,
    subtree: true,
  });
  attachButtons();
  document.addEventListener('click', handleClick);
  window.addEventListener('resize', fit);
});
onUnmounted(() => {
  observer?.disconnect();
  document.removeEventListener('click', handleClick);
  window.removeEventListener('resize', fit);
  dialog.value?.close();
});
</script>

<template>
  <dialog
    ref="dialog"
    class="diagram-dialog"
    aria-labelledby="diagram-title"
    aria-describedby="diagram-help"
    @close="closed"
  >
    <header class="diagram-toolbar">
      <div>
        <strong id="diagram-title">Xem sơ đồ</strong>
        <p id="diagram-help">Cuộn để zoom tại con trỏ · Kéo để di chuyển · Esc để đóng</p>
      </div>
      <div class="diagram-actions">
        <button aria-label="Thu nhỏ sơ đồ" @click="zoom(1 / 1.25)">−</button>
        <output aria-live="polite">{{ percent }}%</output>
        <button aria-label="Phóng to sơ đồ" @click="zoom(1.25)">+</button>
        <button @click="fit">Vừa khung</button>
        <button aria-label="Đóng sơ đồ" autofocus @click="dialog?.close()">Đóng ×</button>
      </div>
    </header>
    <div
      ref="viewport"
      class="diagram-viewport"
      @wheel="wheel"
      @pointerdown="startDrag"
      @pointermove="moveDrag"
      @pointerup="endDrag"
      @pointercancel="endDrag"
      @lostpointercapture="endDrag"
    >
      <div ref="canvas" class="diagram-canvas" />
    </div>
  </dialog>
</template>
