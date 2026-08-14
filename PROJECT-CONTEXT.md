# Контекст проєкту: VetCrewGames

Персональний шар над пакетом v8 (`sveltekit-canon/selection_criteria/v8`).

## Базові параметри

| Параметр | Значення |
|---|---|
| Профіль | **static** |
| Adapter | `@sveltejs/adapter-static` |
| Хостинг | GitHub Pages, project page акаунта `Alik532UA` |
| Origin | `https://alik532ua.github.io` |
| base path | `/VetCrewGames` у production, `''` у dev |
| Спільний origin з іншими застосунками? | **так** |
| PROJECT_PREFIX | `vetcrewgames_` |

## Реєстр префіксів на спільному origin

| Застосунок | Префікс |
|---|---|
| VetCrewGames | `vetcrewgames_` |
| CV | `cv-svelte_` |
| DigitalWorkshop | `digitalworkshop_` |
| as5.odesa.ua | `as5.odesa.ua_` |
| MindStep | `mindstep_` |
| Slovko | `slovko_` |

## Прийняті рішення

| Питання | Обрано | Причина | Дата |
|---|---|---|---|
| Бібліотека i18n | **власна** (`lib/i18n/index.ts` + словники `.ts`) | дві мови, `uk` і `en`; паритет тримає інваріант `translations.test.ts` | до 2026-08 |
| Теми | чотири: `dark`, `light-green`, `orange-purple`, `winter` | — | до 2026-08 |
| Словник токенів | `--color-*` (`--color-bg-surface`, `--color-text`, `--color-border`, `--color-text-muted`, `--color-warning`) | **не** `--bg-surface` / `--text-primary`, як у CV. Це різні словники, і саме через змішування три елементи інтерфейсу ігнорували тему до 2026-08-16 | 2026-08-16 |
| Sentry | `@sentry/sveltekit` у devDependencies | — | до 2026-08 |
| E2E | **немає** | Playwright не стоїть | 2026-08-16 |
| Компонентні тести | `@testing-library/svelte` + jsdom | пакет типовим робить браузерний режим Vitest (CODE-QUALITY § 4.1); тут лишається jsdom, бо тестуються чисті сервіси й конфіги, а не layout | 2026-08-16 |

## Обрані optional-файли пакету

`I18N`, `ANALYTICS`, `DEPENDENCIES`, `VERSIONING`.
Не застосовуються: `AUTH-FORM` (немає входу), `SCROLLBAR`, `AI-PROVIDERS`,
`NOTIFICATIONS` (немає тимчасових сповіщень і контактного email).

## Що не перевіряється автоматично

| Правило | Чому перевірки немає | План |
|---|---|---|
| E2E, axe-аудит | Playwright не стоїть | — |
| Перевірка зібраного `build/` | скрипта немає | перенести `check-build.mjs` із as5 |
| Контраст чотирьох тем | статично не перевіряється | перенести `contrast.test.ts` із teatralo4ka |
| `$props.id()` замість `Math.random()` | звернень нуль | окремий прохід |
| Три попередження eslint (`no-unused-vars`) | рівень `warn`, `--max-warnings` не стоїть | прибрати поштучно |

## Перевірки, які тут є

| Гейт | Де | Що ловить |
|---|---|---|
| `npm run lint` | CI | eslint |
| `npm run check` | CI | `svelte-check`, 0 помилок |
| `npm test` | CI | 7 файлів: testid, словники, `logService`, конфіги ігор, `RoundIndicator`, CSS-змінні |
| `npm audit --audit-level=high` | CI | вразливості прод-залежностей |

## Історія рішень, які легко скасувати помилково

- **2026-08-16, `--color-warning` доданий у чотири теми.** Його не було, хоча
  `--color-success` і `--color-error` були, і `RoundIndicator` тримав жовтий
  літералом у фолбеку. У двох світлих темах значення темніше (`#b8860b`), бо
  `#facc15` на світлому тлі не читається.
- **2026-08-16, фолбеки в `var()` прибрані.** `var(--bg-surface, #333)` виглядав
  як страховка, а насправді БУВ значенням: змінної з таким іменем у проєкті
  немає. Фолбек у `var()` для змінної, якої не оголошує жодна тема, — це спосіб
  сховати помилку, а не захиститися від неї (UI-UX § 4).
