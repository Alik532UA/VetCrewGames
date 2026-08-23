<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { t, formatFont } from '$lib/i18n';
	import { loadAccountText } from '$lib/i18n/account';
	import { langPath, languageFromParam } from '$lib/i18n/routing';
	import { settings } from '$lib/services/settings.svelte';
	import { Account } from '$lib/controllers/account.svelte';
	import Flag from '$lib/components/ui/Flag.svelte';
	import CountryPicker from '$lib/components/ui/CountryPicker.svelte';
	import SegmentedChoice from '$lib/components/ui/SegmentedChoice.svelte';

	/**
	 * АКАУНТ: вхід, профіль, пошук людей і підписки.
	 *
	 * ## Навіщо акаунт у грі, куди й так пускають анонімно
	 *
	 * Рівно для одного: щоб «друзі» стали можливими. Друг — це взаємна підписка, а
	 * підписатися можна лише на того, кого впізнаєш наступного дня. Анонімний `uid`
	 * живе доки живе сховище браузера, тож доти кімнати друзів були неможливі в
	 * принципі, і це записано в докблоці `RoomList`.
	 *
	 * Анонімний вхід ЛИШАЄТЬСЯ типовим, і акаунт до нього ПРИВʼЯЗУЄТЬСЯ: `uid` не
	 * міняється, тож ні кімнати, ні підписки не гинуть. Подробиці — у
	 * `net/account.ts`.
	 *
	 * ## Чому «створити» й «зайти» — сегментований вибір, а не дві форми
	 *
	 * Поля в них однакові (пошта й пароль), а наслідки протилежні: реєстрація
	 * ЗБЕРІГАЄ поточний `uid`, вхід у наявний акаунт його МІНЯЄ. Дві форми поруч
	 * читалися б як «те саме двома шляхами», і людина натискала б будь-яку. Один
	 * вибір над спільними полями змушує прочитати, що саме зараз станеться, — і
	 * попередження під ним стосується рівно вибраного.
	 */
	const lang = $derived(languageFromParam(page.params.lang));
	const account = new Account();

	let mode = $state<'register' | 'signin'>('register');
	let email = $state('');
	let password = $state('');
	let name = $state('');
	let handle = $state('');
	let country = $state('');
	let query = $state('');
	/** Псевдонім зайнятий — перевірено перед збереженням. */
	let taken = $state(false);

	/**
	 * Рядки цієї сторінки ДОВАНТАЖУЮТЬСЯ окремим чанком.
	 *
	 * Причина в `i18n/account/index.ts`: 28 рядків на кожну з чотирьох мов
	 * важили 2 КБ gzip у першому payload КОЖНОГО відвідувача, а відкриє цю
	 * сторінку далеко не кожен.
	 *
	 * До приїзду словника перекладач віддає сам ключ — тобто на екрані на мить
	 * видно «account.signInTitle». Це видимий стан, а не порожнеча: чанк
	 * локальний і приїжджає за один такт, а порожні підписи читалися б як
	 * зламана сторінка.
	 *
	 * У стані лежить СЛОВНИК, а перекладач похідний. Перша редакція тримала в
	 * `$state` саму функцію — і екран не оновлювався: словник приїжджав, а
	 * підписи лишалися ключами. Заміряно в браузері; той самий взірець
	 * (обʼєкт у стані, функція похідна) уже стоїть в іменах команди.
	 */
	let dict = $state<Record<string, string>>({});
	const text = $derived((key: string) => dict[key] ?? key);

	onMount(() => {
		const release = settings.claimHeader('account.title', () => goto(langPath(lang, '')));
		void loadAccountText(settings.locale).then((loaded) => (dict = loaded));
		void account.load().then(() => {
			// Поля форми заповнюються З ПРОФІЛЮ, а не лишаються порожніми: порожнє
			// поле поруч із наявним профілем читається як «профілю немає».
			name = account.profile?.name ?? '';
			handle = account.profile?.handle ?? '';
			country = account.profile?.country ?? '';
		});
		return release;
	});

	async function submitAuth() {
		const done =
			mode === 'register'
				? await account.register(email, password)
				: await account.signIn(email, password);
		if (!done) return;
		password = '';
		if (mode === 'signin') {
			name = account.profile?.name ?? '';
			handle = account.profile?.handle ?? '';
			country = account.profile?.country ?? '';
		}
	}

	async function submitProfile() {
		taken = false;
		if (!(await account.checkHandle(handle))) {
			taken = true;
			return;
		}
		await account.save(name, handle, country);
	}

	/**
	 * Код помилки — у ключ словника, а невідомий — у загальне повідомлення.
	 *
	 * Перекладаються рівно ті випадки, у яких людина може щось ЗРОБИТИ: зайнята
	 * пошта (зайти замість реєструватися), слабкий пароль (взяти довший), невірні
	 * дані (перевірити). Решта — «не вдалося»: вигадувати причину, якої ми не
	 * знаємо, гірше, ніж визнати незнання.
	 */
	const errorKey = $derived.by(() => {
		switch (account.error) {
			case '':
				return null;
			case 'auth/email-already-in-use':
			case 'auth/credential-already-in-use':
				return 'account.errorTaken';
			case 'auth/weak-password':
				return 'account.errorWeak';
			case 'auth/invalid-email':
				return 'account.errorEmail';
			case 'auth/invalid-credential':
			case 'auth/wrong-password':
			case 'auth/user-not-found':
				return 'account.errorWrong';
			default:
				return 'account.errorOther';
		}
	});

	const canAuth = $derived(email.trim().length > 3 && password.length >= 6 && !account.busy);
	const canSave = $derived(
		name.trim().length > 0 && /^[a-z0-9_]{3,20}$/.test(handle) && !account.busy
	);
</script>

<div class="account-page">
	{#if account.state === 'anonymous'}
		<!--
			ФОРМА ВХОДУ. Поля спільні, наслідки різні — тому вибір над ними.
		-->
		<section class="account__panel text-panel">
			<h2 class="account__title">{@html formatFont(text('account.signInTitle'))}</h2>
			<p class="account__hint">{@html formatFont(text('account.why'))}</p>

			<SegmentedChoice
				legend={text('account.mode')}
				scope="account-mode"
				value={mode}
				onchange={(id) => (mode = id as 'register' | 'signin')}
				options={[
					{ id: 'register', label: text('account.modeRegister') },
					{ id: 'signin', label: text('account.modeSignIn') }
				]}
			/>

			<p class="account__hint" data-testid="account-mode-hint">
				{@html formatFont(
					text(mode === 'register' ? 'account.registerHint' : 'account.signInHint')
				)}
			</p>

			<label class="account__label" for="account-email">
				<span>{@html formatFont(text('account.email'))}</span>
			</label>
			<input
				id="account-email"
				class="account__input"
				type="email"
				bind:value={email}
				autocomplete="email"
				inputmode="email"
				data-testid="account-email-input"
			/>

			<label class="account__label" for="account-password">
				<span>{@html formatFont(text('account.password'))}</span>
			</label>
			<!--
				`autocomplete` різний за режимом: браузер мусить знати, пропонувати
				новий пароль чи підставити збережений. Однакове значення робить одне з
				двох незручним.
			-->
			<input
				id="account-password"
				class="account__input"
				type="password"
				bind:value={password}
				autocomplete={mode === 'register' ? 'new-password' : 'current-password'}
				data-testid="account-password-input"
			/>

			<button
				type="button"
				class="btn-primary"
				onclick={submitAuth}
				aria-disabled={!canAuth}
				data-testid="account-submit-btn"
			>
				{@html formatFont(text(mode === 'register' ? 'account.modeRegister' : 'account.modeSignIn'))}
			</button>

			{#if errorKey}
				<p class="account__error" role="alert" data-testid="account-error-text">
					{@html formatFont(text(errorKey))}
				</p>
			{/if}
		</section>
	{:else}
		<!-- ПРОФІЛЬ: те, що бачать інші. -->
		<section class="account__panel text-panel">
			<h2 class="account__title">{@html formatFont(text('account.profileTitle'))}</h2>

			<label class="account__label" for="account-name">
				<span>{@html formatFont(t('pairs.nickname'))}</span>
			</label>
			<input
				id="account-name"
				class="account__input"
				type="text"
				bind:value={name}
				maxlength="48"
				data-testid="account-name-input"
			/>

			<label class="account__label" for="account-handle">
				<span>{@html formatFont(text('account.handle'))}</span>
			</label>
			<!--
				Псевдонім зводиться до дозволених символів ОДРАЗУ, у значенні.
				`pattern` лише малює помилку, а мережа однаково отримала б те, що ввели,
				— і правило бази відкинуло б запис уже після натиску.
			-->
			<input
				id="account-handle"
				class="account__input"
				type="text"
				value={handle}
				oninput={(event) =>
					(handle = event.currentTarget.value.toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, 20))}
				maxlength="20"
				autocapitalize="none"
				autocomplete="off"
				spellcheck="false"
				data-testid="account-handle-input"
			/>
			<p class="account__hint">{@html formatFont(text('account.handleHint'))}</p>

			<CountryPicker bind:value={country} scope="account-country" />

			<button
				type="button"
				class="btn-primary"
				onclick={submitProfile}
				aria-disabled={!canSave}
				data-testid="account-save-btn"
			>
				{@html formatFont(text('account.save'))}
			</button>

			{#if taken}
				<p class="account__error" role="alert" data-testid="account-handle-taken-text">
					{@html formatFont(text('account.handleTaken'))}
				</p>
			{/if}

			<button
				type="button"
				class="account__leave"
				onclick={() => account.leave()}
				data-testid="account-leave-btn"
			>
				{@html formatFont(text('account.signOut'))}
			</button>
		</section>

		<!-- ПОШУК ЛЮДЕЙ за псевдонімом. -->
		<section class="account__panel text-panel">
			<h2 class="account__title">{@html formatFont(text('account.findTitle'))}</h2>
			<label class="account__label" for="account-search">
				<span>{@html formatFont(text('account.handle'))}</span>
			</label>
			<input
				id="account-search"
				class="account__input"
				type="text"
				value={query}
				oninput={(event) => {
					query = event.currentTarget.value.toLowerCase().replace(/[^a-z0-9_]/g, '');
					void account.search(query);
				}}
				autocapitalize="none"
				autocomplete="off"
				spellcheck="false"
				data-testid="account-search-input"
			/>

			{#if query.length >= 2 && account.found.length === 0}
				<p class="account__hint" data-testid="account-nobody-hint">
					{@html formatFont(text('account.nobody'))}
				</p>
			{/if}

			<ul class="account__list" data-testid="account-found-list">
				{#each account.found as person (person.uid)}
					{#if person.uid !== account.uid}
						<li class="account__row" data-testid="account-found-{person.uid}-item">
							<span class="account__who">
								<Flag code={person.country} />
								{person.name}
								<span class="account__handle">@{person.handle}</span>
							</span>
							{#if account.follows(person.uid)}
								<button
									type="button"
									class="account__chip"
									onclick={() => account.remove(person.uid)}
									data-testid="account-unfollow-{person.uid}-btn"
								>
									{@html formatFont(text('account.unfollow'))}
								</button>
							{:else}
								<button
									type="button"
									class="account__chip account__chip--on"
									onclick={() => account.add(person.uid)}
									data-testid="account-follow-{person.uid}-btn"
								>
									{@html formatFont(text('account.follow'))}
								</button>
							{/if}
						</li>
					{/if}
				{/each}
			</ul>
		</section>

		<!-- ПІДПИСКИ. Взаємні позначені: саме вони й є друзі. -->
		<section class="account__panel text-panel">
			<h2 class="account__title">{@html formatFont(text('account.followingTitle'))}</h2>
			{#if account.following.length === 0}
				<p class="account__hint" data-testid="account-none-hint">
					{@html formatFont(text('account.noFollowing'))}
				</p>
			{/if}
			<ul class="account__list" data-testid="account-following-list">
				{#each account.following as friend (friend.profile.uid)}
					<li class="account__row" data-testid="account-following-{friend.profile.uid}-item">
						<span class="account__who">
							<Flag code={friend.profile.country} />
							{friend.profile.name}
							<span class="account__handle">@{friend.profile.handle}</span>
						</span>
						<!--
							ВЗАЄМНІСТЬ ПОЗНАЧЕНА СЛОВОМ, а не лише кольором: саме вона робить
							підписку дружбою, і саме за нею кімнати друзів стають угорі списку.
						-->
						{#if friend.mutual}
							<span class="account__badge" data-testid="account-mutual-{friend.profile.uid}-badge">
								{@html formatFont(text('account.mutual'))}
							</span>
						{/if}
						<button
							type="button"
							class="account__chip"
							onclick={() => account.remove(friend.profile.uid)}
							data-testid="account-drop-{friend.profile.uid}-btn"
						>
							{@html formatFont(text('account.unfollow'))}
						</button>
					</li>
				{/each}
			</ul>
		</section>
	{/if}
</div>

<style>
	.account-page {
		display: flex;
		flex-direction: column;
		align-items: center;
		flex: 1;
		width: 95%;
		max-width: 32rem;
		padding: 3svh 0 var(--space-lg);
		gap: var(--space-md);
		margin: 0 auto;
		box-sizing: border-box;
	}

	.account__panel {
		display: flex;
		flex-direction: column;
		gap: var(--space-xs);
		width: 100%;
	}

	.account__title {
		margin: 0 0 var(--space-xs);
		font-size: var(--font-size-md);
	}

	.account__label {
		font-size: var(--font-size-sm);
		color: var(--color-text-on-panel);
	}

	/*
	 * Підказки — КЕГЛЕМ, а не прозорістю: `opacity` на тексті цієї панелі опускає
	 * пару під 4.5:1, і жодне значення прозорості її не рятує. Те саме міркування
	 * записане в `RoomList` і `OnlineGate`.
	 */
	.account__hint {
		margin: 0;
		font-size: var(--font-size-xs);
		color: var(--color-text-on-panel);
	}

	/*
	 * Помилка — АКЦЕНТОМ, а не власним червоним.
	 *
	 * Свого токена для помилки в проєкті немає, і вигадувати колір тут
	 * означало б завести пару, якої гейт контрасту не бачив, — у чотирьох темах
	 * одразу. Акцент у кожній темі вже підібраний під текст на панелі, а те, що
	 * це саме помилка, каже `role="alert"` і сам текст.
	 */
	.account__error {
		margin: 0;
		font-size: var(--font-size-sm);
		color: var(--color-accent);
		font-weight: var(--font-weight-bold);
	}

	.account__input {
		/* 44px — власний стандарт сенсорної цілі (ACCESSIBILITY-v8 § 8). */
		min-height: 44px;
		padding: 0 var(--space-sm);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-sm);
		background: var(--color-bg-card);
		color: var(--color-text);
		font: inherit;
	}

	.account__list {
		display: flex;
		flex-direction: column;
		gap: var(--space-xs);
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.account__row {
		display: flex;
		align-items: center;
		gap: var(--space-sm);
		min-height: 44px;
		padding: var(--space-xs) var(--space-sm);
		border-radius: var(--radius-sm);
		background: var(--color-bg-card);
	}

	.account__who {
		display: flex;
		align-items: center;
		gap: 6px;
		flex: 1;
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		font-size: var(--font-size-sm);
	}

	.account__handle {
		font-size: var(--font-size-xs);
	}

	.account__badge {
		flex-shrink: 0;
		font-size: var(--font-size-xs);
		color: var(--color-accent);
		font-weight: var(--font-weight-bold);
	}

	.account__chip,
	.account__leave {
		flex-shrink: 0;
		min-height: 36px;
		padding: 0 var(--space-md);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-sm);
		background: color-mix(in srgb, var(--color-text), transparent 90%);
		color: var(--color-text);
		font: inherit;
		font-size: var(--font-size-sm);
		cursor: pointer;
	}

	.account__chip--on {
		border-color: var(--color-accent);
		background: var(--color-accent);
		color: var(--color-text-on-accent);
	}

	.account__leave {
		align-self: flex-start;
		min-height: 44px;
		margin-top: var(--space-sm);
	}
</style>
