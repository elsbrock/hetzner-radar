<script lang="ts">
  import { onMount } from 'svelte';
  import { toastQueue, removeToast } from '$lib/toastStore';
  import { Toast } from 'flowbite-svelte';
  import { CheckCircleSolid, CloseCircleSolid } from 'flowbite-svelte-icons';

  let toasts: { id: number; color: 'green' | 'red'; message: string; icon: 'success' | 'error' }[] = [];

  const unsubscribe = toastQueue.subscribe((queue) => {
    toasts = queue;
  });

  export let duration = 2000;

  function dismissToast(toastId: number) {
    setTimeout(() => {
      removeToast(toastId);
    }, duration);
  }

  onMount(() => {
    return () => unsubscribe();
  });
</script>

<div class="fixed bottom-5 right-0 z-50 w-96">
  {#each toasts as toast (toast.id)}
    <Toast color={toast.color} dismissable={false} class="flex items-center
    gap-2 mt-5">
      <svelte:fragment slot="icon">
        {#if toast.icon === 'success'}
          <CheckCircleSolid class="w-5 h-5" />
          <span class="sr-only">Success Icon</span>
        {:else if toast.icon === 'error'}
          <CloseCircleSolid class="w-5 h-5" />
          <span class="sr-only">Error Icon</span>
        {/if}
      </svelte:fragment>
      {toast.message}

      <!-- Run the dismiss function when the toast is rendered -->
      {#await new Promise((resolve) => onMount(() => {
          dismissToast(toast.id);
          resolve();
      }))} {/await}
    </Toast>
  {/each}
</div>
