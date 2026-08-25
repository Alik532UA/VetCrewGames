<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { formatFont } from '$lib/i18n';
	import { loadAccountText } from '$lib/i18n/account';
	import { langPath, languageFromParam } from '$lib/i18n/routing';
	import { settings } from '$lib/services/settings.svelte';
	import { Account } from '$lib/controllers/account.svelte';
	import Flag from '$lib/components/ui/Flag.svelte';
	import Avatar from '$lib/components/ui/Avatar.svelte';
	import AuthForm from '$lib/components/auth/AuthForm.svelte';
	import ProfileForm from '$lib/components/account/ProfileForm.svelte';
	import PrivacyPanel from '$lib/components/account/PrivacyPanel.svelte';
	import LeaderBoard from '$lib/components/account/LeaderBoard.svelte';
	import AccountSecurity from '$lib/components/account/AccountSecurity.svelte';
	import { formatAvatar, parseAvatar } from '$lib/config/avatars';
	import { COUNTRY_KEY, NAME_KEY } from '$lib/config/playerName';
	import { defaultIdentity } from '$lib/config/accountDefaults';
	import { crewTranslate, loadCrewNames } from '$lib/i18n/crew';
	import { storage } from '$lib/services/storage';
	import { playerAvatar } from '$lib/services/playerAvatar.svelte';

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
	 * ## Форма входу живе в компоненті, а не тут
	 *
	 * `components/auth/AuthForm.svelte` — і там же записано, чому в ній ДВІ
	 * КНОПКИ й жодного вибору режиму. Сторінці лишається проводка: «Увійти»
	 * перечитує профіль (бо `uid` став іншим), «Зареєструватись» — ні (`uid` той
	 * самий).
	 */
	const lang = $derived(languageFromParam(page.params.lang));
	const account = new Account();

	let name = $state('');
	let handle = $state('');
	let country = $state('');
	/**
	 * Аватар — рядок `значок:колір`.
	 *
	 * Початкове значення з `playerAvatar` — спільного джерела, яке читає та сама
	 * шапка. Доти воно читалося зі сховища ТУТ, окремим `parseAvatar`, і це було
	 * третє місце, що робило те саме.
	 *
	 * Через `parseAvatar` однаково: сервіс віддає порожньо, поки вибору не було, а
	 * вибір у формі мусить бути позначений — інакше перше збереження записало б у
	 * базу порожній рядок, який правило відкине.
	 */
	const saved = parseAvatar(playerAvatar.value);
	let avatar = $state(formatAvatar(saved.icon, saved.color));
	let query = $state('');
	/**
	 * ЧОМУ САМЕ не вдалося зберегти — ключ словника, а не прапорець «зайнято».
	 *
	 * Доти тут стояв `taken`, і будь-яка невдача підпису показувалася як «Цей
	 * псевдонім уже зайнятий». На порожньому полі це була чиста вигадка, та ще й
	 * найгіршого роду: `handleFree('')` читає КОРІНЬ реєстру (`handles/`), правило
	 * такого читання не дає, а невдалий запит у тому коді означав «зайнятий».
	 * Тобто перший користувач бази чув, що його псевдонім у когось є.
	 *
	 * Тепер причина називається та, що справді спрацювала, і перевіряється до
	 * мережі — у тому ж порядку, у якому людина заповнює форму.
	 */
	let problem = $state<string | null>(null);

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
		// Імена команди — для підстановки в порожній профіль. Приїде після профілю —
		// підстановка просто не спрацює, і поля лишаться порожніми, а не зіпсованими.
		void loadCrewNames(settings.locale).then((loaded) => (crew = loaded));
		void account.load().then(() => {
			fillFromProfile();
			// Таблиця читається ПІСЛЯ профілю й підписок: вкладка «друзі» будується з
			// взаємних підписок, а без них вона показала б порожньо на повній базі.
			void account.loadBoard();
		});
		return release;
	});

	/**
	 * Поля форми заповнюються З ПРОФІЛЮ, а не лишаються порожніми: порожнє поле
	 * поруч із наявним профілем читається як «профілю немає».
	 */
	/**
	 * Словник імен команди — окремим чанком, і лише коли він тут потрібен.
	 *
	 * Потрібен він для ПІДСТАНОВКИ в порожній профіль: імʼя в грі («Мудра Сова») і
	 * @нік (`owl_482`) виводяться з одного ключа тварини. Ключі латинські за
	 * побудовою, тож нік не потребує ні транслітерації, ні пошти — див.
	 * `config/accountDefaults.ts`, там же й причина, чому саме не пошти.
	 */
	let crew = $state<Record<string, string>>({});

	function fillFromProfile() {
		name = account.profile?.name ?? '';
		handle = account.profile?.handle ?? '';
		country = account.profile?.country ?? '';

		/*
		 * ПОРОЖНІ ПОЛЯ ЗАПОВНЮЮТЬСЯ САМІ — але лише порожні.
		 *
		 * Профіль без імені буває рівно раз: одразу після реєстрації. Порожня форма
		 * там означала б «вигадай собі два різні імені, одне з них латиницею» — на
		 * екрані, куди людина зайшла подивитися на акаунт.
		 *
		 * Заповнене НЕ ЧІПАЄТЬСЯ: підстановка поверх вибору людини — це стирання
		 * вибору, а не допомога.
		 */
		if (name !== '' || handle !== '') return;
		const suggested = defaultIdentity(crewTranslate(crew), Math.random);
		name = suggested.name;
		handle = suggested.handle;
		/*
		 * Аватар — ЛИШЕ якщо профіль його має.
		 *
		 * Інакше, ніж решта полів: у профілі його може не бути (він
		 * необовʼязковий), а у сховищі вже лежить вибір, з яким людина ходить у
		 * кімнати. Скинути її вибір на типовий через відсутність поля в базі
		 * означало б стерти те, чого база не знає.
		 */
		if (account.profile?.avatar) {
			avatar = account.profile.avatar;
			/*
			 * КЕШ НАЗДОГАНЯЄ АКАУНТ, і саме тут.
			 *
			 * Профіль — джерело правди, сховище — кеш для екранів, які не мають права
			 * ходити в мережу. На НОВОМУ пристрої кеш порожній, тобто до цієї правки
			 * свій аватар людина бачила в профілі, а в шапці й у кімнаті — типовий,
			 * аж поки не натисне «Зберегти» те, що й так уже збережено.
			 */
			playerAvatar.set(account.profile.avatar);
		}
	}

	/** Вхід МІНЯЄ `uid`, тож профіль на екрані стосувався б чужого акаунта. */
	async function signIn(email: string, password: string) {
		if (await account.signIn(email, password)) fillFromProfile();
	}

	/**
	 * Google перечитує профіль із тієї самої причини, що й вхід поштою.
	 *
	 * Обидва шляхи ведуть у два різні наслідки: привʼязка до анонімного
	 * користувача (`uid` той самий) або вхід у вже наявний акаунт (`uid` інший).
	 * Який саме спрацював, знає контролер, а сторінці дешевше перечитати, ніж
	 * угадувати.
	 */
	async function signInGoogle() {
		if (await account.google()) fillFromProfile();
	}

	/**
	 * Лист відновлення надіслано.
	 *
	 * Прапорець ЖИВЕ ТУТ, а не у формі: `account.resetPassword()` віддає `true`
	 * і для пошти, якої в базі немає (інакше різна відповідь дозволяла б
	 * перебирати акаунти), і саме тому підтвердження — стан сторінки, а не
	 * висновок форми з того, що не сталося помилки.
	 */
	let resetSent = $state(false);

	async function forgotPassword(email: string) {
		resetSent = await account.resetPassword(email);
	}

	async function submitProfile() {
		problem = null;
		/*
		 * Порядок той самий, у якому стоять поля: людина читає повідомлення й
		 * дивиться вгору, а не шукає, до чого воно.
		 *
		 * Кнопка каже `aria-disabled`, але лишається натискною навмисно: відключена
		 * кнопка не пояснює нічого, і саме тому натиск мусить назвати причину
		 * (ACCESSIBILITY-v8 § 6).
		 */
		if (!name.trim()) {
			problem = 'account.errorNameEmpty';
			return;
		}
		if (!handleOk) {
			problem = 'account.errorHandleShape';
			return;
		}
		if (!(await account.checkHandle(handle))) {
			problem = 'account.handleTaken';
			return;
		}
		if (!(await account.save(name, handle, country, avatar))) return;
		/*
		 * Аватар пишеться У СХОВИЩЕ ТЕЖ, і саме тут — після вдалого запису.
		 *
		 * Причина не в кеші: у кімнату аватар їде зі сховища
		 * (`controllers/playerIdentity`), бо форма входу в кімнату читати профіль
		 * не мусить — це був би мережевий запит на екрані, який має відкритися з
		 * першого дотику. Ті самі дві половини, що в прапора: він теж лежить і в
		 * профілі, і у сховищі.
		 *
		 * Порядок обовʼязковий: запис у сховище ПІСЛЯ бази. У зворотному невдалий
		 * запис профілю лишав би у кімнатах аватар, якого в профілі немає.
		 */
		playerAvatar.set(avatar);
		/*
		 * ІМʼЯ Й ПРАПОР — ТЕЖ У СХОВИЩЕ, і це «одне імʼя», про яке просив автор.
		 *
		 * У кімнату підпис і прапор їдуть зі сховища (`controllers/playerIdentity`):
		 * форма входу в кімнату не читає профіль, бо це був би мережевий запит на
		 * екрані, який мусить відкритися з першого дотику. Доти профіль і підпис у
		 * кімнаті жили окремо — тобто імен було ТРИ: імʼя профілю, @нік і підпис у
		 * кімнаті. Тепер профіль — джерело, а сховище лишається кешем, який читає
		 * кімната.
		 *
		 * Порядок той самий, що в аватара: запис у сховище ПІСЛЯ бази. У зворотному
		 * невдалий запис профілю лишав би в кімнатах імʼя, якого в профілі немає.
		 */
		storage.set(NAME_KEY, name);
		if (country) storage.set(COUNTRY_KEY, country);
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
			/*
			 * Відмова БАЗИ, а не автентифікації. Найчастіший випадок один: людина
			 * закрила підписки на себе перемикачем приватності, і правило не дало
			 * створити запис. Загальне «не вдалося» тут читалося б як поломка.
			 */
			case 'PERMISSION_DENIED':
				return 'account.errorNotAllowed';
			// Видалення без пароля на акаунті з паролем: підтвердити нічим.
			case 'auth/missing-password':
				return 'account.errorPasswordNeeded';
			default:
				return 'account.errorOther';
		}
	});

	/** Пароль щойно змінено. Гасне при наступній дії, яка може не вийти. */
	let passwordChanged = $state(false);

	async function changePassword(current: string, next: string) {
		passwordChanged = await account.changePassword(current, next);
	}

	/**
	 * Псевдонім у допустимому вигляді — той самий взірець, що в правилі бази
	 * (`database.rules.json`, `users/$uid/profile/handle`). Закріплений дослівно
	 * у `src/rtdb-keys.test.ts`: ключем стає те, що набрала людина.
	 */
	const handleOk = $derived(/^[a-z0-9_]{3,20}$/.test(handle));

	const canSave = $derived(name.trim().length > 0 && handleOk && !account.busy);
</script>

<div class="account-page">
	{#if account.state === 'anonymous'}
		<AuthForm
			{text}
			{errorKey}
			busy={account.busy}
			{resetSent}
			onlogin={(email, password) => void signIn(email, password)}
			onregister={(email, password) => void account.register(email, password)}
			ongoogle={() => void signInGoogle()}
			onforgot={(email) => void forgotPassword(email)}
		/>
	{:else}
		<!--
			ПРОФІЛЬ — компонентом, як і решта панелей цієї сторінки.

			Стан лишається тут: сторінка знає, коли профіль приїхав із бази, і саме
			вона підставляє порожні поля. Форма ж знає, як вони називаються й що з
			ними можна робити.
		-->
		<ProfileForm
			{text}
			bind:name
			bind:handle
			bind:country
			bind:avatar
			{canSave}
			{problem}
			onsave={submitProfile}
			onsignout={() => account.leave()}
		/>

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
								<Avatar avatar={person.avatar} />
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

		<!--
			ПРИВАТНІСТЬ. Кожен перемикач тримає правило бази — див. `net/privacy.ts`.

			Стоїть ПЕРЕД пошуком і підписками навмисно: рішення «чи хочу я, щоб мене
			знаходили» логічно передує самому пошуку, а не ховається за ним.
		-->
		<PrivacyPanel
			privacy={account.privacy}
			{text}
			busy={account.busy}
			onchange={(next) => void account.setPrivacy(next)}
		/>

		<!--
			ПОМИЛКА ДІЙ ПРОФІЛЮ — один рядок на всю нижню частину сторінки.
			Доти відмова базою (закриті підписки, зайнятий псевдонім у чужих руках)
			не показувалася ніде: `errorKey` віддавався лише формі входу, а вона на
			цьому екрані вже не показана.
		-->
		{#if errorKey}
			<!--
				`text-panel` обов'язковий: текст просто на тлі сторінки не проходить
				гейт підкладки (`src/backdrop.test.ts`), і не з формальності — на
				світлих темах фон сторінки й акцент дають пару нижче 4.5:1.
			-->
			<section class="account__panel text-panel">
				<p class="account__error" role="alert" data-testid="account-action-error-text">
					{@html formatFont(text(errorKey))}
				</p>
			</section>
		{/if}

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
							<Avatar avatar={friend.profile.avatar} />
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

		<!-- ТАБЛИЦЯ ЛІДЕРІВ: усі й друзі. Поріг і згоду тримає правило бази. -->
		<LeaderBoard
			leaders={account.leaders}
			friends={account.friendLeaders}
			{text}
			me={account.uid}
		/>

		<!--
			ПАРОЛЬ І ВИДАЛЕННЯ — останньою панеллю, і це не про верстку.

			Незворотні дії не мусять стояти на тій самій відстані, що «відписатися»:
			до них треба доїхати. Саме видалення при цьому має ще й другий крок —
			підтвердження з паролем (`AccountSecurity`).
		-->
		<AccountSecurity
			{text}
			hasPassword={account.hasPassword}
			busy={account.busy}
			{passwordChanged}
			onchangePassword={(current, next) => void changePassword(current, next)}
			ondelete={(password) => void account.delete(password)}
		/>
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
	 * Помилка — АКЦЕНТОМ, а не власним червоним: свого токена для помилки в проєкті
	 * немає, і вигадувати колір означало б завести пару, якої гейт контрасту не
	 * бачив, — у чотирьох темах одразу.
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

	.account__chip {
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
</style>
