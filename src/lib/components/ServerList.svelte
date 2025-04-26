<script lang="ts">
    import ServerCard from "./ServerCard.svelte";
    let { loading = true, serverList, timeUnitPrice = "perHour" } = $props();
</script>

<div
    class="grid grid-cols-[repeat(auto-fill,minmax(300px,auto))] justify-items-start
w-full gap-4 px-5 mb-5"
>
    {#each serverList.slice(0, 100) as config}
        <ServerCard {config} {loading} {timeUnitPrice} displayStoragePrice={undefined} displayRamPrice={undefined}/>
    {/each}
</div>
