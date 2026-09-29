import {
	AppWindow,
	Dock,
	EllipsisVertical,
	ExternalLink,
	Grid2X2Plus,
	Menu,
	MonitorDown,
	Share,
	Smartphone,
	SquarePlus
} from 'lucide-svelte';
import type { StepIcon } from './installGuide';

/**
 * ЗНАЧКИ КРОКІВ ІНСТРУКЦІЇ ВСТАНОВЛЕННЯ — окремо від `installGuide.ts`.
 *
 * Той модуль лишається чистим (назви значків, а не компоненти), тож тестується без DOM;
 * компоненти `lucide` — тут. Імпортує цей файл лише вікно (`FullscreenOffer`), тобто
 * лінивий чанк, а не кореневий layout. Малюються значки через `ui/DynamicIcon.svelte`:
 * компонент вибирається змінною.
 */
export const STEP_ICONS: Record<StepIcon, typeof Share> = {
	share: Share,
	add: SquarePlus,
	dots: EllipsisVertical,
	menu: Menu,
	install: MonitorDown,
	installEdge: Grid2X2Plus,
	dock: Dock,
	browser: ExternalLink,
	phone: Smartphone,
	app: AppWindow
};
