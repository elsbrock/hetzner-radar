<script lang="ts">
    import type { ServerConfiguration } from "$lib/api/frontend/filter";
    import {
        convertServerConfigurationToFilter,
        getHetznerLink,
        isIdenticalFilter,
    } from "$lib/filter";
    import { filter } from "$lib/stores/filter";
    import { faMagnifyingGlass } from "@fortawesome/free-solid-svg-icons";
    import { FontAwesomeIcon } from "@fortawesome/svelte-fontawesome";
    import { Button, ButtonGroup } from "flowbite-svelte";
    import { LinkOutline } from "flowbite-svelte-icons";
    import HetznerModal from "./HetznerModal.svelte";
    import ServerCard from "./ServerCard.svelte";

    interface $$Props {
        loading?: boolean;
        serverList: ServerConfiguration[];
        timeUnitPrice?: "perHour" | "perMonth";
    }
    let { loading = true, serverList, timeUnitPrice = "perHour" } = $props(); // <-- Remove type argument
    
    let showDisclaimer = $state(false); // Use $state for local reactive state
    let acceptedDisclaimer = false;
</script>

<div
    class="grid grid-cols-[repeat(auto-fill,minmax(300px,auto))] justify-items-start
w-full gap-4 px-5 mb-5"
>
    {#each serverList.slice(0, 100) as config}
        <ServerCard {config} {loading} {timeUnitPrice} displayStoragePrice={undefined} displayRamPrice={undefined}>
            <ButtonGroup
                slot="buttons"
                size="xs"
                class="
                    opacity-100
                    sm:opacity-0
                    group-hover:opacity-100
                    transition-opacity
                    duration-300
                    absolute bottom-4 right-4
                    bg-white
                    bg-opacity-75
                    rounded-md
                    flex
                "
            >
                <Button
                    onclick={() => { // <-- Use onclick
                        const newFilter =
                            convertServerConfigurationToFilter(config);
                        if (!isIdenticalFilter(newFilter, $filter)) {
                            console.log("Setting filter to", newFilter);
                            filter.set(newFilter);
                        }
                    }}
                >
                    <FontAwesomeIcon icon={faMagnifyingGlass} class="w-4 h-4" />
                </Button>
                <Button
                    onclick={(e: MouseEvent) => { // <-- Use onclick and type event
                        if (!acceptedDisclaimer) {
                            showDisclaimer = true;
                            e.preventDefault();
                        }
                        e.stopPropagation();
                    }}
                    href={getHetznerLink(config)}
                >
                    <LinkOutline class="w-5 h-5" />
                </Button>
                {#if showDisclaimer}
                    <HetznerModal bind:open={showDisclaimer} {config} />
                {/if}
            </ButtonGroup>
        </ServerCard>
    {/each}
</div>
