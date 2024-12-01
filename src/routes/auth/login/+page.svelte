<script lang="ts">
    import { enhance } from "$app/forms";
    import { goto } from "$app/navigation";
    import { session } from "$lib/stores/session";
    import { addToast } from "$lib/stores/toast.js";
    import {
        A,
        Alert,
        Button,
        Checkbox,
        Input,
        Label,
        Spinner,
        StepIndicator,
    } from "flowbite-svelte";
    import { tick } from "svelte";
    import type { ActionData } from "./$types";
    export let email: string;

    export let form: ActionData | undefined;
    let authForm: HTMLFormElement;

    let identifying = false;
    let code: string = "";

    const IDENTIFY = 1,
        AUTHENTICATE = 2;

    const stepValues = ["Identify", "Authenticate"];

    let currentStep = IDENTIFY;

    let codeInputs: HTMLInputElement[] = [];

    function preventNonDigits(event: KeyboardEvent) {
        const char = String.fromCharCode(event.keyCode);
        if (!/^\d$/.test(char)) {
            console.log("nope: prevent");
            event.preventDefault();
        }
    }

    function handleCodeInput(index: number) {
        return (event: Event) => {
            console.log("input", event.data);
            const input = event.target as HTMLInputElement;
            const value = input.value;

            if (/^\d$/.test(value)) {
                input.value = value;
                code = code.slice(0, index) + value + code.slice(index + 1);

                if (index < codeInputs.length - 1) {
                    codeInputs[index + 1].focus();
                }

                setTimeout(() => {
                    if (input.value === "") return;
                    input.value = "•"; // Unicode black dot
                }, 300);
            } else {
                input.value = "";
            }
        };
    }

    function handleCodeKeyDown(index: number) {
        return (event: KeyboardEvent) => {
            const input = event.target as HTMLInputElement;

            if (event.key === "Backspace") {
                if (input.value === "") {
                    // Move focus to previous input if exists
                    if (index > 0) {
                        codeInputs[index - 1].focus();
                        codeInputs[index - 1].value = ""; // Clear the previous input
                        code =
                            code.slice(0, index) + "" + code.slice(index + 1);
                        event.preventDefault(); // Prevent default backspace behavior
                    }
                } else {
                    // Clear the current input
                    input.value = "";
                    if (index > 0) {
                        codeInputs[index - 1].focus();
                    }
                    event.preventDefault(); // Prevent default backspace behavior
                }
            } else if (/** left key */ event.key === "ArrowLeft") {
                if (index > 0) {
                    codeInputs[index - 1].focus();
                }
            } else if (/** right key */ event.key === "ArrowRight") {
                if (index < codeInputs.length - 1) {
                    codeInputs[index + 1].focus();
                }
            } else if ((event.ctrlKey || event.metaKey) && event.key === "v") {
                event.preventDefault();
                console.log("paste");
                navigator.clipboard.readText().then((text) => {
                    if (text.length === 6) {
                        code = text;
                        codeInputs.forEach((input, i) => {
                            input.value = text[i];
                        });
                    }
                });
            } else {
                event.data = event.key;
                handleCodeInput(index)(event);
            }
        };
    }

    function clearCode() {
        code = "";
        codeInputs.forEach((input) => (input.value = ""));
        codeInputs[0].focus();
    }

    async function handleCodeSubmit(event: SubmitEvent) {
        // Let SvelteKit handle the form submission
    }

    // Define an action to register inputs
    function registerInput(node: HTMLInputElement, index: number) {
        codeInputs[index] = node;
    }

    $: if (code.length === 6) {
        console.log("Code is complete", code);
        tick().then(() => authForm.requestSubmit());
    }
</script>

<div class="flex items-center justify-center bg-gray-50 py-10 px-3">
    <div
        class="p-6 space-y-6 bg-white rounded-lg shadow-md dark:bg-gray w-[450px]"
    >
        <h2 class="text-2xl font-semibold text-gray-800 dark:text-white">
            Welcome Back!
        </h2>
        <StepIndicator {currentStep} steps={stepValues} size="h-1.5" />

        {#if currentStep === 1}
            <form
                id="email-form"
                method="POST"
                class="space-y-6"
                action="?/identify"
                use:enhance={({ data: formData }) => {
                    identifying = true;
                    return async ({ result }) => {
                        identifying = false;
                        if (result.data?.success === true) {
                            currentStep = AUTHENTICATE;
                            form = null;
                        } else {
                            form = {
                                success: false,
                                error: result.data.error,
                            };
                        }
                    };
                }}
            >
                <p>
                    Just enter your email, and we will send you a magic link to
                    sign in. <strong>No sign-up required!</strong>
                </p>

                <div class="mb-6">
                    <Label for="email" class="mb-2">Email address</Label>
                    <Input
                        type="email"
                        name="email"
                        placeholder="john.doe@example.com"
                        required
                        bind:value={email}
                    />
                    {#if form?.email}
                        <p class="text-red-500 text-sm mt-1">{form.email}</p>
                    {/if}
                </div>

                <div class="space-x-0">
                    <Checkbox
                        class="mb-3 space-x-1 rtl:space-x-reverse"
                        name="tosagree"
                        required
                    >
                        I agree with the <A
                            href="/terms"
                            class="text-primary-700 dark:text-primary-600 hover:underline"
                            >terms and conditions</A
                        >.
                    </Checkbox>

                    <Checkbox
                        class="rtl:space-x-reverse"
                        name="cookieconsent"
                        required
                    >
                        I acknowledge the use of a session cookie.
                    </Checkbox>
                </div>

                {#if form?.error}
                    <Alert color="red">
                        <span class="font-medium">Error:</span>
                        {form?.error}
                    </Alert>
                {/if}

                <Button class="w-full" type="submit" disabled={identifying}>
                    {#if identifying}
                        <Spinner size="4" class="ms-0 me-2" /> Requesting
                    {:else}
                        Request Code
                    {/if}
                </Button>
            </form>
        {:else}
            <form
                bind:this={authForm}
                method="POST"
                class="space-y-6"
                on:submit={handleCodeSubmit}
                action="?/authenticate"
                use:enhance={({ data: formData }) => {
                    form = undefined;
                    return async ({ result }) => {
                        if (result.data?.success === true) {
                            session.set(result.data?.session);
                            addToast({
                                color: "green",
                                message: "Signed in successfully.",
                                icon: "success",
                            });
                            await goto("/analyze");
                        } else {
                            form = {
                                success: false,
                                error: result.data.error,
                            };
                            clearCode();
                        }
                    };
                }}
            >
                <p>Please check your inbox and enter the received code.</p>
                {#if form?.error}
                    <Alert color="red">
                        <span class="font-medium">Error:</span>
                        {form?.error}
                    </Alert>
                {/if}
                <div class="flex gap-x-3 py-2 justify-center md:text-lg">
                    <input type="hidden" name="email" bind:value={email} />
                    <input type="hidden" name="code" bind:value={code} />
                    {#each Array(6) as _, index}
                        <input
                            use:registerInput={index}
                            class="block size-[40px] lg:size-[55px] shadow-inner text-center text-lg md:text-3xl border-gray-200 rounded-md
                                 [&::-webkit-outer-spin-button]:appearance-none
                                 [&::-webkit-inner-spin-button]:appearance-none
                                 focus:outline-none focus:ring-1 focus:ring-orange-500
                                 disabled:opacity-50 disabled:pointer-events-none
                                 caret-transparent dark:bg-neutral-900 dark:border-neutral-700
                                dark:text-neutral-400 dark:placeholder-neutral-500
                                dark:focus:ring-neutral-600 focus:border-0"
                            type="tel"
                            autocomplete="one-time-code"
                            maxlength="1"
                            on:input={handleCodeInput(index)}
                            on:keydown={handleCodeKeyDown(index)}
                            on:keypress={preventNonDigits}
                            required
                        />
                    {/each}
                </div>
                <div class="flex justify-between items-center w-full">
                    <Button
                        outline
                        type="button"
                        on:click={() => (currentStep = 1)}
                    >
                        Back
                    </Button>

                    <Button type="submit" disabled={code.length === 6}>
                        {#if code.length === 6}
                            <Spinner size="4" class="ms-0 me-2" /> Verifying
                        {:else}
                            Sign In
                        {/if}
                    </Button>
                </div>
            </form>
        {/if}
    </div>
</div>
