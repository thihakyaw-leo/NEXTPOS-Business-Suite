<script lang="ts">
  import { ui, type ThemeMode } from '$lib/stores/ui.svelte';

  const options: Array<{ value: ThemeMode; label: string }> = [
    { value: 'light', label: 'Light' },
    { value: 'dark', label: 'Dark' },
  ];
</script>

<div class="theme-switcher" role="group" aria-label="Theme switcher">
  {#each options as option}
    <button
      type="button"
      class={`theme-switcher__button ${ui.theme === option.value ? 'is-active' : ''}`}
      aria-pressed={ui.theme === option.value}
      onclick={() => ui.setTheme(option.value)}
    >
      {option.label}
    </button>
  {/each}
</div>
