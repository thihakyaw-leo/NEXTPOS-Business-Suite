<script lang="ts">
  import { page } from '$app/state';
  import PosSidebar from '$lib/components/PosSidebar.svelte';

  let { children } = $props();
</script>

{#if page.url.pathname === '/pos/terminal'}
  <!-- Terminal gets full screen without Sidebar -->
  {@render children()}
{:else}
  <!-- POS Hub Pages get the Sidebar Layout -->
  <div class="min-h-screen ink-grid">
    <div class="grid min-h-screen lg:grid-cols-[18rem,1fr] xl:grid-cols-[20rem,1fr]">
      <PosSidebar />
      <main class="overflow-y-auto w-full">
        {@render children()}
      </main>
    </div>
  </div>
{/if}
