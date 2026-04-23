<script lang="ts">
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';
	import { auth } from '$lib/stores/auth.svelte';

	let companyName = $state('');
	let email = $state('');
	let deviceFingerprint = $state('');
	let isLoadingFingerprint = $state(true);
	let isSubmitting = $state(false);
	let errorMessage = $state('');
	let successMessage = $state('');

	onMount(async () => {
		try {
			await auth.initialize();
			companyName = auth.activation.companyName;
			email = auth.activation.email;
			deviceFingerprint = auth.hardwareId;
			errorMessage = auth.validationMessage ?? '';
		} finally {
			isLoadingFingerprint = false;
		}
	});

	async function submitRegistration() {
		errorMessage = '';
		successMessage = '';

		if (!companyName.trim() || !email.trim() || !deviceFingerprint) {
			errorMessage = 'Company name, email, and device fingerprint are required.';
			return;
		}

		isSubmitting = true;

		try {
			await auth.registerTenant({
				companyName,
				email
			});

			successMessage = auth.activation.expiresAt
				? `Trial activated until ${new Date(auth.activation.expiresAt).toLocaleString()}.`
				: 'Tenant activated successfully.';

			const redirectTarget =
				new URLSearchParams(window.location.search).get('redirect') || '/pos/dashboard';
			await goto(redirectTarget, { invalidateAll: true, replaceState: true });
		} catch (error) {
			errorMessage = error instanceof Error ? error.message : 'Registration failed.';
		} finally {
			isSubmitting = false;
		}
	}
</script>

<svelte:head>
	<title>NextPOS Registration</title>
</svelte:head>

<div class="page-shell">
	<section class="card">
		<p class="eyebrow">NextPOS Trial</p>
		<h1>Register this device</h1>
		<p class="lead">
			Create a tenant, bind this device fingerprint, and receive a 7-day POS-only JWT license.
		</p>

		<form class="form" onsubmit={(event) => {
			event.preventDefault();
			void submitRegistration();
		}}>
			<label>
				<span>Company name</span>
				<input bind:value={companyName} autocomplete="organization" placeholder="Aye Chan Mart" />
			</label>

			<label>
				<span>Email</span>
				<input bind:value={email} autocomplete="email" placeholder="owner@example.com" type="email" />
			</label>

			<label>
				<span>Device fingerprint</span>
				<textarea bind:value={deviceFingerprint} readonly rows="4"></textarea>
			</label>

			{#if errorMessage}
				<p class="message error">{errorMessage}</p>
			{/if}

			{#if successMessage}
				<p class="message success">{successMessage}</p>
			{/if}

			<button disabled={isSubmitting || isLoadingFingerprint} type="submit">
				{isSubmitting ? 'Registering...' : isLoadingFingerprint ? 'Reading device...' : 'Register device'}
			</button>
		</form>
	</section>
</div>

<style>
	:global(body) {
		margin: 0;
		font-family: 'Segoe UI', system-ui, sans-serif;
		background:
			radial-gradient(circle at top, rgba(53, 94, 252, 0.18), transparent 40%),
			linear-gradient(180deg, #f4f7fb 0%, #e8eef8 100%);
		color: #10213a;
	}

	.page-shell {
		min-height: 100vh;
		display: grid;
		place-items: center;
		padding: 1.5rem;
	}

	.card {
		width: min(100%, 40rem);
		background: rgba(255, 255, 255, 0.92);
		backdrop-filter: blur(14px);
		border: 1px solid rgba(16, 33, 58, 0.08);
		border-radius: 1.5rem;
		padding: 2rem;
		box-shadow: 0 24px 80px rgba(36, 55, 99, 0.12);
	}

	.eyebrow {
		margin: 0 0 0.5rem;
		font-size: 0.78rem;
		font-weight: 700;
		letter-spacing: 0.14em;
		text-transform: uppercase;
		color: #355efc;
	}

	h1 {
		margin: 0;
		font-size: clamp(2rem, 4vw, 2.8rem);
	}

	.lead {
		margin: 0.75rem 0 1.5rem;
		line-height: 1.6;
		color: #425674;
	}

	.form {
		display: grid;
		gap: 1rem;
	}

	label {
		display: grid;
		gap: 0.45rem;
		font-weight: 600;
	}

	input,
	textarea,
	button {
		font: inherit;
	}

	input,
	textarea {
		width: 100%;
		box-sizing: border-box;
		border-radius: 0.95rem;
		border: 1px solid #c7d4ea;
		background: #fff;
		padding: 0.9rem 1rem;
		color: #10213a;
	}

	textarea {
		resize: vertical;
		min-height: 7rem;
	}

	button {
		border: 0;
		border-radius: 999px;
		padding: 0.95rem 1.2rem;
		font-weight: 700;
		background: linear-gradient(135deg, #355efc, #1734a7);
		color: #fff;
		cursor: pointer;
	}

	button:disabled {
		opacity: 0.65;
		cursor: wait;
	}

	.message {
		margin: 0;
		padding: 0.9rem 1rem;
		border-radius: 1rem;
		font-weight: 600;
	}

	.error {
		background: #fff0f0;
		color: #a11d1d;
	}

	.success {
		background: #ebfff1;
		color: #106634;
	}
	
	@media (max-width: 640px) {
		.card {
			padding: 1.35rem;
		}
	}
</style>
