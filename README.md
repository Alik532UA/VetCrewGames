# Vet Crew Games

Набір розвиваючих ігор про тварин.

## Проекти

- **Кого більше?** (Population game) — гра, де потрібно розставити тварин за чисельністю їхньої популяції.

## Технології

- Svelte 5
- SvelteKit
- TypeScript
- Lucide Icons
- GitHub Pages

## Розробка

```bash
npm install
npm run dev
```

## Деплой і адреса

Автоматично через GitHub Actions при пуші в гілку `main`.

🌐 **https://alik532ua.github.io/VetCrewGames/** — спільний домен із рештою проєктів, власного тут немає. Звідси дві наслідки, які легко забути:

- `paths.base` дорівнює `/VetCrewGames` у продакшені й `''` у dev, тож шлях, зашитий вручну, зламається на одному з двох;
- `localStorage` спільний із сусідніми проєктами, тому всі ключі обов'язково мають префікс `vetcrewgames_`.

Якщо колись з'явиться власний домен — не міняй `base` наосліп: набір граблів зібраний у [CUSTOM-DOMAIN-v8.md](../sveltekit-canon/selection_criteria/v8/ops/CUSTOM-DOMAIN-v8.md).
