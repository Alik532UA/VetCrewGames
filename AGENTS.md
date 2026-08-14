---
Назва: AGENTS.md — контекст проєкту VetCrewGames
Опис: Архітектурні вказівки та конвенції для будь-якого AI-асистента в цьому проєкті.
---

# Архітектура проєкту VetCrewGames

## Основний стек

- **Фреймворк:** SvelteKit (Svelte 5)
- **State Management:** Svelte 5 Runes (`$state`, `$derived`, `$effect`) через глобальні класи (напр. `settings.svelte.ts`).
- **Стилізація:** Vanilla CSS (кольорові змінні, теми через `data-theme`).
- **Деплой:** GitHub Pages (Static Adapter).

## Потік даних (Data Flow)

1. Локальний стан компонентів тримається через `$state()`.
2. Глобальні налаштування (тема, мова, шрифт, рахунок) інкапсульовані в класі `Settings` (`src/lib/settings.svelte.ts`), який експортує інстанс `settings`.
3. Збереження даних відбувається в `localStorage` з обов'язковим префіксом `vetcrewgames_` (згідно зі стандартами ізоляції браузерного сховища).
4. Логування відбувається виключно через `logService` (`src/lib/services/logService.svelte.ts`). Прямі виклики `console.log` заборонені.

## Стратегія `data-testid` у production

**B — зберігати.** Плагіна, який вирізав би атрибут на етапі збірки, у проєкті
немає, отже де-факто вибрано B — і це записано, а не вдається за A
(TESTID-AND-NAMING-v8 § 1.11). Наслідки, з якими це рішення живе: локатори видно
у продакшн-версії (+0,5–2 КБ gzip і видима внутрішня структура), зате
smoke-тести можна писати проти живого сайту без окремої staging-збірки.

Якщо колись з'явиться плагін видалення — атрибут прибирається **лише** при
`mode === 'production'`, а для `staging`/`preview` лишається, і цей розділ
оновлюється разом із кодом.

## Специфічні правила та конвенції

- **Сховище:** Завжди використовуй префікс `vetcrewgames_` для будь-яких ключів в `localStorage` та `sessionStorage`.
- **Локалізація:** Усі тексти в UI мають проходити через систему i18n (`src/lib/i18n/index.ts`). Не хардкодь рядки в `.svelte` файлах.
- **Теми:** Тема перемикається через `data-theme` на `documentElement`. Доступні теми: `dark`, `light-green`, `winter`, `orange-purple`. Зверни увагу, що ми блокуємо мобільний "Force Dark Mode" мета-тегом `<meta name="color-scheme" content="light dark" />`, який оновлюється динамічно (для темних тем він стає `dark`).
- **Іконки:** Використовувати тільки `lucide-svelte`. Системні емодзі (🌞, 🌙) заборонені в UI через неузгодженість між платформами.
- **Версіонування:** Проєкт використовує автоматичне підняття версії. Поточна версія експортується в `static/app-version.json`.
- **Збірка:** Жодних кастомних скриптів у корені проєкту, всі такі скрипти розміщуються у папці `scripts/`.

## 🚫 Жорсткі обмеження (Anti-patterns - НЕ РОБИ)

- **Svelte 4 APIs:** КАТЕГОРИЧНО заборонено використання старих API Svelte 4: `writable`, `readable`, `on:click`, `<slot>`, `export let`. Завжди використовуй `$state`, `$derived`, `$props`, `onclick`, `{@render ...}`.
- **Console.log:** Заборонено використання `console.log`, `console.warn`, `console.error` для бізнес-подій. Використовуй `logService`.
- **Локалізація:** Заборонено хардкодити тексти інтерфейсу в шаблонах, завжди використовуй i18n (`src/lib/i18n`).

## 💡 Приклади правильного коду (Svelte 5 Runes)

### 1. Компонент Svelte 5

```svelte
<script lang="ts">
	let { title, count = 0 }: { title: string; count?: number } = $props();
	let localState = $state(0);
	let doubled = $derived(localState * 2);

	function handleClick() {
		localState++;
	}
</script>

<button class="btn" onclick={handleClick}>
	{title}: {count} + {localState} (x2: {doubled})
</button>
```

### 2. Глобальний реактивний клас (Сервіс)

```typescript
class SettingsService {
	theme = $state<'dark' | 'light-green' | 'winter' | 'orange-purple'>('dark');
	private themes: Theme[] = ['dark', 'light-green', 'winter', 'orange-purple'];

	toggleTheme() {
		const currentIndex = this.themes.indexOf(this.theme);
		const nextIndex = (currentIndex + 1) % this.themes.length;
		this.theme = this.themes[nextIndex];
	}
}
export const settings = new SettingsService();
```
