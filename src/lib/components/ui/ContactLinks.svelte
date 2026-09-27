<script lang="ts">
	import { asset } from '$app/paths';
	import { t } from '$lib/i18n';

	/**
	 * ЯК ЗВʼЯЗАТИСЯ З РОЗРОБНИКОМ — чотири месенджери значками (прохання автора 2026-09-27).
	 *
	 * Адреси й значки — ті самі, що в сусідньому проєкті автора
	 * (`AudioRemote/src/lib/components/settings/ContactCard.svelte`, а там — з
	 * `teatralo4ka.odesa.ua`): другий перелік, заведений тут наново, розійшовся б із першим.
	 * Автор сам показав на них.
	 *
	 * ## Значки — файлами, а не `lucide-svelte`
	 *
	 * Виняток із правила AGENTS.md свідомий: логотипів месенджерів у `lucide` немає (бренди
	 * звідти прибрано), а впізнають кнопку саме за логотипом. Файлами, а не вбудованим
	 * SVG: вони тягнуться лише тоді, коли збій уже стався й людина розгорнула контакти.
	 *
	 * Посилання — у новій вкладці: гра лишається на місці разом зі звітом, який щойно
	 * скопіювали. `noopener` обовʼязковий при `target="_blank"`: без нього відкрита сторінка
	 * дістає посилання на цю вкладку.
	 */
	let { scope }: { scope: string } = $props();

	const CONTACTS = [
		{ id: 'telegram', name: 'Telegram', url: 'https://t.me/alik532' },
		{ id: 'viber', name: 'Viber', url: 'viber://chat?number=%2B380937251208' },
		{ id: 'whatsapp', name: 'WhatsApp', url: 'https://wa.me/380937251208' },
		{ id: 'linkedin', name: 'LinkedIn', url: 'https://linkedin.com/in/alik-qa-engineer' }
	] as const;
</script>

<ul class="contacts" data-testid="{scope}-contacts-list">
	{#each CONTACTS as contact (contact.id)}
		<li>
			<!-- Назва мережі — у доступному імені: значок без підпису читалка інакше не назве. -->
			<a
				class="contacts__link"
				href={contact.url}
				target="_blank"
				rel="external noopener noreferrer"
				title={contact.name}
				aria-label={`${t('problem.writeVia')} ${contact.name}`}
				data-testid="{scope}-contact-{contact.id}-link"
			>
				<img src={asset(`/svg/social/${contact.id}.svg`)} alt="" width="28" height="28" />
			</a>
		</li>
	{/each}
</ul>

<style>
	.contacts {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-sm);
		margin: 0;
		padding: 0;
		list-style: none;
	}

	/* Ціль — 44×44, хоч значок і 28: у це тиснуть пальцем (ACCESSIBILITY-v9 § 8). */
	.contacts__link {
		display: grid;
		place-items: center;
		width: 44px;
		height: 44px;
		border: 1px solid var(--color-border);
		border-radius: var(--radius-sm);
		background: var(--color-bg-card);
	}

	@media (hover: hover) {
		.contacts__link:hover {
			border-color: var(--color-accent);
		}
	}

	.contacts__link:focus-visible {
		border-color: var(--color-accent);
	}
</style>
