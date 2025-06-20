<script lang="ts">
	import { enhance } from '$app/forms';
	import { goto } from '$app/navigation';
	import { session } from '$lib/stores/session';
	import { addToast } from '$lib/stores/toast.js';
	import {
		A,
		Alert,
		Button,
		Checkbox,
		Input,
		Label,
		Spinner,
		StepIndicator
	} from 'flowbite-svelte';
	import { tick } from 'svelte';
	import type { ActionData } from './$types';
	export let email: string;

	export let form: ActionData | undefined;
	let authForm: HTMLFormElement;

	let identifying = false;
	let code: string = '';

	const IDENTIFY = 1,
		AUTHENTICATE = 2;

	const stepValues = ['Identify', 'Authenticate'];

	let currentStep = IDENTIFY;

	let codeInputs: HTMLInputElement[] = [];

	// Handles input events on the code fields
	async function handleCodeInput(index: number, event: Event) {
		const input = event.target as HTMLInputElement;
		const value = input.value;

		// Allow only single digits
		if (/^\d$/.test(value)) {
			input.value = value; // Keep the entered digit
			code = code.slice(0, index) + value + code.slice(index + 1);

			// Auto-advance focus to the next input if available
			if (index < codeInputs.length - 1) {
				await tick(); // Wait for DOM update
				codeInputs[index + 1].focus();
			}
		} else {
			// Clear the input if it's not a single digit (e.g., paste, non-numeric)
			input.value = '';
			// Update code state if the input was cleared
			if (code.length > index) {
				code = code.slice(0, index) + code.slice(index + 1);
			}
		}
	}

	// Handles keydown events for navigation (Backspace, Arrows)
	async function handleCodeKeyDown(index: number, event: KeyboardEvent) {
		const input = event.target as HTMLInputElement;

		if (event.key === 'Backspace') {
			// If the current input is empty and we press backspace,
			// move focus to the previous input field if it exists.
			if (input.value === '' && index > 0) {
				event.preventDefault(); // Prevent default backspace behavior (like browser back navigation)
				await tick(); // Wait for DOM update
				codeInputs[index - 1].focus();
				// No need to clear previous input here, let user do it or type over
			} else if (input.value !== '') {
				// If current input is not empty, allow backspace to clear it.
				// The 'input' event will handle the state update.
				// We still might want to prevent default if focus management is complex elsewhere
				// event.preventDefault(); // Optional: uncomment if needed
				code = code.slice(0, index) + code.slice(index + 1); // Update code state immediately
			}
		} else if (event.key === 'ArrowLeft') {
			if (index > 0) {
				event.preventDefault();
				await tick();
				codeInputs[index - 1].focus();
			}
		} else if (event.key === 'ArrowRight') {
			if (index < codeInputs.length - 1) {
				event.preventDefault();
				await tick();
				codeInputs[index + 1].focus();
			}
		}
		// Non-digit keys are ignored here, handled by the 'input' event filtering
	}

	// Handle paste events on any of the code inputs
	async function handleCodePaste(event: ClipboardEvent) {
		event.preventDefault();
		try {
			const text = event.clipboardData?.getData('text') || '';
			const digits = text.replace(/\D/g, ''); // Remove non-digits

			if (digits.length > 0) {
				// Clear all inputs first
				clearCode();

				// Fill inputs with pasted digits (up to 6)
				const maxDigits = Math.min(digits.length, codeInputs.length);
				for (let i = 0; i < maxDigits; i++) {
					codeInputs[i].value = digits[i];
				}

				// Update the code state
				code = digits.slice(0, codeInputs.length);

				// Focus the next empty input or the last filled input
				const focusIndex = Math.min(maxDigits, codeInputs.length - 1);
				await tick();
				codeInputs[focusIndex].focus();

				// Auto-submit if we have a complete code
				if (code.length === codeInputs.length) {
					console.log('Code complete after paste, submitting', code);
					await tick();
					authForm.requestSubmit();
				}
			}
		} catch (err) {
			console.error('Failed to handle paste: ', err);
		}
	}

	function clearCode() {
		code = '';
		codeInputs.forEach((input) => (input.value = ''));
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
		console.log('Code is complete', code);
		tick().then(() => authForm.requestSubmit());
	}
</script>

<div class="flex items-center justify-center px-3 py-10">
	<div class="w-[450px] space-y-6 rounded-lg bg-white p-6 shadow-md dark:bg-gray-800">
		<h2 class="text-2xl font-semibold text-gray-800 dark:text-white">Welcome Back!</h2>
		<StepIndicator
			{currentStep}
			steps={stepValues}
			size="h-1.5"
			class="[&>li>div]:dark:bg-gray-700"
		/>

		{#if currentStep === 1}
			<form
				id="email-form"
				method="POST"
				class="space-y-6"
				action="?/identify"
				use:enhance={({ formData }) => {
					// Correctly access formData
					identifying = true;
					return async ({ result }) => {
						identifying = false;
						// Check result type before accessing data
						if (result.type === 'success' && result.data?.success === true) {
							currentStep = AUTHENTICATE;
							form = undefined; // Clear form on success
						} else if (result.type === 'failure') {
							// Assign the data returned on failure to the form variable
							// Construct ActionData for failure case
							form = {
								success: false,
								error: (result.data?.error as string) ?? 'An unknown error occurred.'
							};
						} else {
							// Handle unexpected results (e.g., redirect, error)
							form = { success: false, error: 'An unexpected server response.' };
						}
					};
				}}
			>
				<p class="text-gray-600 dark:text-gray-400">
					Just enter your email, and we will send you a magic link to sign in. <strong
						>No sign-up required!</strong
					>
				</p>

				<div class="mb-6">
					<Label for="email" class="mb-2 dark:text-gray-100">Email address</Label>
					<Input
						type="email"
						name="email"
						placeholder="john.doe@example.com"
						required
						bind:value={email}
						class="dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:placeholder-gray-400 dark:focus:border-blue-500 dark:focus:ring-blue-500"
					/>
				</div>
				<!-- Removed inconsistent form.email check -->
				<div class="space-x-0">
					<Checkbox class="mb-3 space-x-1 rtl:space-x-reverse" name="tosagree" required>
						I agree with the <A
							href="/terms"
							class="text-primary-700 dark:text-primary-600 hover:underline">terms and conditions</A
						>.
					</Checkbox>

					<Checkbox class="rtl:space-x-reverse" name="cookieconsent" required>
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
				use:enhance={({ formData }) => {
					// Correctly access formData
					form = undefined; // Clear form state before submission attempt
					return async ({ result }) => {
						// Check result type before accessing data
						if (result.type === 'success' && result.data?.success === true) {
							// Assuming result.data.session is of type Session | null
							session.set(result.data?.session as any); // Cast to 'any' for now, refine if Session type is available
							addToast({
								color: 'green',
								message: 'Signed in successfully.',
								icon: 'success'
							});
							await goto('/analyze');
						} else if (result.type === 'failure') {
							// Construct ActionData for failure case
							form = {
								success: false,
								error: (result.data?.error as string) ?? 'Authentication failed.'
							};
							clearCode();
						} else {
							// Handle unexpected results
							form = {
								success: false,
								error: 'An unexpected server response during authentication.'
							};
							clearCode();
						}
					};
				}}
			>
				<p class="text-gray-600 dark:text-gray-400">
					Please check your inbox and enter the received code.
				</p>
				{#if form?.error}
					<Alert color="red">
						<span class="font-medium">Error:</span>
						{form?.error}
					</Alert>
				{/if}
				<div class="flex justify-center gap-x-3 py-2 md:text-lg">
					<input type="hidden" name="email" bind:value={email} />
					<input type="hidden" name="code" bind:value={code} />
					{#each Array(6) as _, index}
						<input
							use:registerInput={index}
							class="block size-[40px] rounded-md border-gray-200 text-center text-lg caret-transparent shadow-inner focus:border-0
                                 focus:ring-1
                                 focus:ring-orange-500
                                 focus:outline-none disabled:pointer-events-none disabled:opacity-50 md:text-3xl
                                 lg:size-[55px] dark:border-gray-600
                                 dark:bg-gray-700 dark:text-neutral-400 dark:placeholder-neutral-500
                                dark:focus:ring-neutral-600 dark:focus:ring-orange-400
                                [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
							type="tel"
							inputmode="numeric"
							autocomplete="one-time-code"
							maxlength="1"
							on:input={(e) => handleCodeInput(index, e)}
							on:keydown={(e) => handleCodeKeyDown(index, e)}
							on:paste={handleCodePaste}
							required
						/>
					{/each}
				</div>
				<div class="flex w-full items-center justify-between">
					<Button outline color="alternative" type="button" on:click={() => (currentStep = 1)}>
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
