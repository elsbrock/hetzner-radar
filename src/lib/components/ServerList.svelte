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

    export let loading = true;
    export let serverList: ServerConfiguration[];
    export let timeUnitPrice: "perHour" | "perMonth" = "perHour";

    let showDisclaimer = false;
    let acceptedDisclaimer = false;
</script>

<div
    class="grid grid-cols-[repeat(auto-fill,minmax(300px,auto))] justify-items-start
w-full gap-4 px-5 mb-5"
>
    {#each serverList.slice(0, 100) as config}
        <ServerCard {config} {loading} {timeUnitPrice} displayMarkupPercentage>
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
                    on:click={() => {
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
                    on:click={(e) => {
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
