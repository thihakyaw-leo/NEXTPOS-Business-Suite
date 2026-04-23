<svelte:head>
	<title>NextPOS Admin</title>
</svelte:head>

<div class="page-shell">
	<section class="card">
		<p class="eyebrow">Protected Area</p>
		<h1>Admin session is active</h1>
		<p>
			The `hooks.server.ts` guard has validated your `admin_token` cookie and allowed this
			request through.
		</p>
	</section>
</div>

<style>
	:global(body) {
		margin: 0;
		font-family: 'Segoe UI', system-ui, sans-serif;
		background: linear-gradient(180deg, #f5f7fb, #eaf0fb);
		color: #13213a;
	}

	.page-shell {
		min-height: 100vh;
		display: grid;
		place-items: center;
		padding: 1.5rem;
	}

	.card {
		width: min(100%, 34rem);
		padding: 2rem;
		border-radius: 1.4rem;
		background: white;
		box-shadow: 0 24px 60px rgba(40, 63, 112, 0.12);
	}

	.eyebrow {
		margin: 0 0 0.5rem;
		font-size: 0.78rem;
		font-weight: 700;
		letter-spacing: 0.14em;
		text-transform: uppercase;
		color: #2f6cf2;
	}

	h1 {
		margin: 0 0 0.8rem;
	}

	p {
		margin: 0;
		line-height: 1.6;
		color: #4a5d7d;
	}
</style>
