<script setup lang="ts">
import { ref } from 'vue';

const props = defineProps<{ tabs: { id: string; label: string }[]; modelValue: string }>();
const emit = defineEmits<{ (e: 'update:modelValue', id: string): void }>();

const btns = ref<HTMLButtonElement[]>([]);

function activeIndex(): number {
  return Math.max(0, props.tabs.findIndex((t) => t.id === props.modelValue));
}
function focusTab(i: number): void {
  const tab = props.tabs[i];
  if (!tab) return;
  emit('update:modelValue', tab.id);
  btns.value[i]?.focus();
}
function onKey(e: KeyboardEvent): void {
  const n = props.tabs.length;
  const i = activeIndex();
  if (e.key === 'ArrowRight') { e.preventDefault(); focusTab((i + 1) % n); }
  else if (e.key === 'ArrowLeft') { e.preventDefault(); focusTab((i - 1 + n) % n); }
  else if (e.key === 'Home') { e.preventDefault(); focusTab(0); }
  else if (e.key === 'End') { e.preventDefault(); focusTab(n - 1); }
}
</script>

<template>
  <div class="mi-tabs" role="tablist" @keydown="onKey">
    <button
      v-for="(t, i) in tabs"
      :key="t.id"
      ref="btns"
      type="button"
      role="tab"
      class="mi-tab"
      :class="{ 'mi-tab--active': t.id === modelValue }"
      :aria-selected="t.id === modelValue"
      :tabindex="t.id === modelValue ? 0 : -1"
      @click="emit('update:modelValue', t.id)"
    >
      {{ t.label }}
    </button>
  </div>
</template>
