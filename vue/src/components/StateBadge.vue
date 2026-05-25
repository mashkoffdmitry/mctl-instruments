<script setup lang="ts">
import { computed } from 'vue';
import type { UiState } from '../types.ts';
import { STATE_TONE } from '../composables/state.ts';

const props = defineProps<{ state: UiState; label: string }>();
const tone = computed(() => STATE_TONE[props.state]);
</script>

<template>
  <span class="mi-badge" :class="`mi-badge--${tone}`" role="status">
    <span class="mi-badge__dot" aria-hidden="true"></span>
    {{ label }}
  </span>
</template>
