<script setup lang="ts">
import { ref, useId } from 'vue';

const props = withDefaults(defineProps<{ title: string; defaultOpen?: boolean }>(), {
  defaultOpen: false,
});
const open = ref(props.defaultOpen);
const panelId = useId();
</script>

<template>
  <section class="mi-acc">
    <h3 class="mi-acc__h">
      <button
        type="button"
        class="mi-acc__btn"
        :aria-expanded="open"
        :aria-controls="panelId"
        @click="open = !open"
      >
        <span class="mi-acc__chev" :class="{ 'mi-acc__chev--open': open }" aria-hidden="true">▸</span>
        {{ title }}
      </button>
    </h3>
    <div v-show="open" :id="panelId" class="mi-acc__panel">
      <slot />
    </div>
  </section>
</template>
