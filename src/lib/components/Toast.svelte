<script lang="ts">
  import { onMount } from 'svelte';
  import { toastQueue, removeToast } from '$lib/stores/toast';
  import { Toast } from 'flowbite-svelte';
  import { CheckCircleSolid, CloseCircleSolid } from 'flowbite-svelte-icons';

  // Local state to hold toasts
  let toasts: { id: number; color: 'green' | 'red'; message: string; icon: 'success' | 'error' }[] = [];
  export let duration: number = 2000; // Export duration as a prop with a default value

  // Manage store subscription explicitly
  onMount(() => {
    const unsubscribe = toastQueue.subscribe((queue) => {
      toasts = queue;

      // Automatically dismiss toasts
      toasts.forEach((toast) => {
        dismissToast(toast.id);
      });
    });

    // Cleanup on unmount
    return () => unsubscribe();
  });

  function dismissToast(toastId: number) {
    setTimeout(() => {
      removeToast(toastId);
    }, duration);
  }
</script>

<div class="fixed bottom-5 right-0 z-50 w-96" data-testid="toast">
  {#each toasts as toast (toast.id)}
    <Toast color={toast.color} dismissable={false} class="flex items-center gap-2 mt-5">
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
    </Toast>
  {/each}
</div>
