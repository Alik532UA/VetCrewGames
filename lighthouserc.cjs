module.exports = {
	ci: {
		collect: {
			staticDistDir: './build',

			/*
			 * Адреса вказана ЯВНО, і це не уточнення, а виправлення.
			 *
			 * Без неї LHCI сам шукає HTML у `staticDistDir`, а в `build/` лежить
			 * і `404.html` — SPA-фолбек без пререндереного вмісту, який до того ж
			 * не вміє завантажитися з кореня сервера, коли застосунок живе за
			 * префіксом base. Разом із `maxAutodiscoverIsolate: 1` вибір падав
			 * саме на нього: Chrome не малював жодного кадру, Lighthouse падав із
			 * `NO_FCP`, а крок стоїть ПЕРЕД викладенням артефакту — тобто гейт,
			 * який жодного разу не проходив, блокував увесь деплой.
			 *
			 * Хост тут фіктивний: LHCI піднімає власний сервер на випадковому
			 * порті й підставляє його origin, беручи з цього рядка лише шлях.
			 */
			url: ['http://localhost/index.html'],
			numberOfRuns: 1
		},
		assert: {
			assertions: {
				'categories:performance': ['warn', { minScore: 0.8 }],
				'categories:accessibility': ['error', { minScore: 0.95 }],
				'categories:best-practices': ['error', { minScore: 0.9 }],
				'categories:seo': ['error', { minScore: 0.9 }]
			}
		},
		upload: {
			target: 'temporary-public-storage'
		}
	}
};
