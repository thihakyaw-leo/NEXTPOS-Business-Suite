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
  let activationToken = $state('');
  let isRegistered = $state(false);

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

      activationToken = auth.activation.token;
      isRegistered = true;
      successMessage = 'Business instance deployed successfully. Please save your activation code.';
    } catch (error) {
      errorMessage = error instanceof Error ? error.message : 'Registration failed.';
    } finally {
      isSubmitting = false;
    }
  }

  async function proceedToDashboard() {
    const redirectTarget = new URLSearchParams(window.location.search).get('redirect') || '/pos/dashboard';
    await goto(redirectTarget, { invalidateAll: true, replaceState: true });
  }
</script>

<svelte:head>
	<title>Registration | KT POS</title>
</svelte:head>

<div class="page-shell bg-grid">
	<section class="card panel-surface">
		<div class="card-header border-b border-[var(--panel-border)] pb-6 mb-8">
			<p class="section-kicker">{isRegistered ? 'Deployment Complete' : 'Device Activation'}</p>
			<h1 class="page-title !text-[2.2rem] mt-2">{isRegistered ? 'System Online' : 'Activate Business Suite'}</h1>
			<p class="section-description mt-3">
				{isRegistered ? 'Your business instance is ready. Use the code below if you need to reactive the system manually.' : 'Bind this device fingerprint to a new tenant and unlock your POS workspace.'}
			</p>
		</div>

		{#if !isRegistered}
			<form class="form" onsubmit={(event) => {
				event.preventDefault();
				void submitRegistration();
			}}>
				<div class="field-stack">
					<label for="company" class="field-label">Company Name</label>
					<input id="company" bind:value={companyName} autocomplete="organization" placeholder="e.g. Aye Chan Mart" class="field-input" required />
				</div>

				<div class="field-stack mt-2">
					<label for="email" class="field-label">Email Address</label>
					<input id="email" bind:value={email} autocomplete="email" placeholder="owner@example.com" type="email" class="field-input" required />
				</div>

				<div class="field-stack mt-2">
					<label for="fingerprint" class="field-label">Hardware Identifier</label>
					<textarea id="fingerprint" bind:value={deviceFingerprint} readonly rows="3" class="field-input !bg-[var(--bg-main)] !font-mono !text-xs !text-[var(--text-tertiary)]"></textarea>
				</div>

				{#if errorMessage}
					<div class="status-pill --danger w-full !justify-start !px-4 mt-2">
						{errorMessage}
					</div>
				{/if}

				<button disabled={isSubmitting || isLoadingFingerprint} type="submit" class="action-button action-button--primary w-full mt-6 !h-[3.2rem]">
					{isSubmitting ? 'Activating...' : isLoadingFingerprint ? 'Scanning Device...' : 'Activate Device'}
				</button>

				<div class="mt-8 pt-6 border-t border-[var(--panel-border)] flex flex-col items-center gap-3">
					<p class="text-[0.7rem] uppercase font-bold tracking-widest text-[var(--text-tertiary)]">Already have a tenant?</p>
					<a href="/auth/login" class="text-sm font-bold text-[var(--accent)] hover:underline">Sign in with email or code</a>
				</div>
			</form>
		{:else}
			<div class="space-y-6">
				<div class="field-stack">
					<label for="token" class="field-label text-emerald-500">Manual Activation Code</label>
					<div class="relative">
						<textarea id="token" readonly rows="5" class="field-input !bg-emerald-50/10 !border-emerald-500/20 !font-mono !text-[10px] !text-emerald-300 w-full resize-none p-4">{activationToken}</textarea>
						<p class="text-[9px] text-emerald-500/60 mt-2 italic">* This code is bound to your hardware fingerprint.</p>
					</div>
				</div>

				<div class="status-pill --success w-full !justify-start !px-4">
					{successMessage}
				</div>

				<button onclick={proceedToDashboard} class="action-button action-button--primary w-full !h-[3.5rem] !bg-emerald-600 hover:!bg-emerald-500 shadow-xl shadow-emerald-900/40">
					Enter Dashboard
				</button>
			</div>
		{/if}
	</section>
</div>

<style lang="postcss">
    @reference "tailwindcss";
	.page-shell {
		min-height: 100vh;
		display: grid;
		place-items: center;
		padding: 1.5rem;
		background: var(--bg-main);
	}

	.bg-grid {
		background-image: 
			linear-gradient(var(--grid-color) 1px, transparent 1px),
			linear-gradient(90deg, var(--grid-color) 1px, transparent 1px);
		background-size: 40px 40px;
	}

	.card {
		width: min(100%, 36rem);
		padding: clamp(2rem, 5vw, 3.5rem);
		border-radius: 0.5rem;
	}

	.form {
		display: grid;
		gap: 1rem;
	}

	.status-pill {
		min-height: 2.8rem;
		border-radius: 0.4rem;
	}
</style>
