<script lang="ts">
	import { goto } from '$app/navigation';

	let username = $state('');
	let password = $state('');
	let isSubmitting = $state(false);
	let errorMessage = $state('');

	async function login() {
		errorMessage = '';
		isSubmitting = true;

		try {
			const response = await fetch('/api/admin/auth/login', {
				method: 'POST',
				credentials: 'include',
				headers: {
					'content-type': 'application/json'
				},
				body: JSON.stringify({
					username,
					password
				})
			});
			const result = (await response.json().catch(() => null)) as
				| {
						success?: boolean;
						error?: string;
				  }
				| null;

			if (!response.ok) {
				errorMessage = result?.error ?? 'Login failed.';
				return;
			}

			const params = new URLSearchParams(window.location.search);
			const redirectTarget = params.get('redirect') || '/admin';

			await goto(redirectTarget, { invalidateAll: true });
		} catch (error) {
			errorMessage = error instanceof Error ? error.message : 'Login failed.';
		} finally {
			isSubmitting = false;
		}
	}
</script>

<svelte:head>
	<title>Admin Login</title>
</svelte:head>

<div class="page-shell">
	<section class="card">
		<p class="eyebrow">NextPOS Admin</p>
		<h1>Administrator sign in</h1>
		<p class="lead">This route issues an HTTP-only `admin_token` cookie from the Worker.</p>

		<form class="form" onsubmit={(event) => {
			event.preventDefault();
			void login();
		}}>
			<label>
				<span>Username</span>
				<input bind:value={username} autocomplete="username" placeholder="leosmitt" />
			</label>

			<label>
				<span>Password</span>
				<input
					bind:value={password}
					autocomplete="current-password"
					placeholder="••••••••••••"
					type="password"
				/>
			</label>

			{#if errorMessage}
				<p class="message error">{errorMessage}</p>
			{/if}

			<button disabled={isSubmitting} type="submit">
				{isSubmitting ? 'Signing in...' : 'Sign in'}
			</button>
		</form>
	</section>
</div>

<style>
	:global(body) {
		margin: 0;
		font-family: 'Segoe UI', system-ui, sans-serif;
		background:
			linear-gradient(145deg, rgba(14, 33, 74, 0.86), rgba(8, 13, 30, 0.94)),
			radial-gradient(circle at top, rgba(68, 202, 255, 0.28), transparent 35%);
		color: #f4f8ff;
	}

	.page-shell {
		min-height: 100vh;
		display: grid;
		place-items: center;
		padding: 1.5rem;
	}

	.card {
		width: min(100%, 30rem);
		background: rgba(6, 15, 34, 0.82);
		border: 1px solid rgba(133, 190, 255, 0.2);
		border-radius: 1.5rem;
		padding: 2rem;
		box-shadow: 0 24px 80px rgba(0, 0, 0, 0.3);
	}

	.eyebrow {
		margin: 0 0 0.5rem;
		font-size: 0.78rem;
		font-weight: 700;
		letter-spacing: 0.14em;
		text-transform: uppercase;
		color: #7ed3ff;
	}

	h1 {
		margin: 0;
		font-size: clamp(2rem, 4vw, 2.5rem);
	}

	.lead {
		margin: 0.8rem 0 1.5rem;
		line-height: 1.55;
		color: rgba(233, 242, 255, 0.78);
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
	button {
		font: inherit;
	}

	input {
		border-radius: 0.95rem;
		border: 1px solid rgba(154, 192, 255, 0.24);
		background: rgba(255, 255, 255, 0.06);
		color: #fff;
		padding: 0.9rem 1rem;
	}

	button {
		border: 0;
		border-radius: 999px;
		padding: 0.95rem 1.2rem;
		font-weight: 700;
		background: linear-gradient(135deg, #59d8ff, #2f7cff);
		color: #081229;
		cursor: pointer;
	}

	button:disabled {
		opacity: 0.7;
		cursor: wait;
	}

	.message {
		margin: 0;
		padding: 0.9rem 1rem;
		border-radius: 1rem;
		font-weight: 600;
	}

	.error {
		background: rgba(255, 102, 102, 0.14);
		color: #ffb2b2;
	}
</style>
