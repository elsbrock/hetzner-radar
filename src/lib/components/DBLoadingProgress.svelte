<script lang="ts">
    import { Progressbar } from "flowbite-svelte";
    import { dbInitProgress } from "../../stores/db";
</script>

<div class="flex flex-col flex-1 px-4 lg:p-48 bg-gray-50">
    <!-- Loader Container -->
    <div class="flex-grow flex items-center justify-center">
      <div class="w-full max-w-md p-6 bg-white rounded-lg shadow-md">
        <h2 class="text-xl font-semibold text-gray-700 mb-4">Hang tight</h2>
        <Progressbar
          progress={$dbInitProgress}
                  labelInside
                  animate={true}
                   size="h-4"
        />
        <p class="mt-5 text-sm text-gray-500">Please wait while we initialize our
        data. This should only take a couple of seconds.</p>
      </div>
    </div>
  </div>