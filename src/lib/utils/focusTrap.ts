const FOCUSABLE = [
	'a[href]',
	'button:not([disabled])',
	'input:not([disabled])',
	'select:not([disabled])',
	'textarea:not([disabled])',
	'[tabindex]:not([tabindex="-1"])'
].join(',');

export function focusableWithin(node: HTMLElement): HTMLElement[] {
	return Array.from(node.querySelectorAll<HTMLElement>(FOCUSABLE));
}

export function focusTrap(node: HTMLElement) {
	const returnTo = document.activeElement as HTMLElement | null;

	const first = focusableWithin(node)[0];
	(first ?? node).focus();

	function handleKeydown(event: KeyboardEvent) {
		if (event.key !== 'Tab') return;

		const items = focusableWithin(node);
		if (items.length === 0) {
			event.preventDefault();
			return;
		}

		const firstItem = items[0];
		const lastItem = items[items.length - 1];
		if (!firstItem || !lastItem) {
			event.preventDefault();
			return;
		}

		const active = document.activeElement;

		if (event.shiftKey && (active === firstItem || active === node)) {
			event.preventDefault();
			lastItem.focus();
		} else if (!event.shiftKey && active === lastItem) {
			event.preventDefault();
			firstItem.focus();
		}
	}

	node.addEventListener('keydown', handleKeydown);

	return {
		destroy() {
			node.removeEventListener('keydown', handleKeydown);
			if (returnTo?.isConnected) returnTo.focus();
		}
	};
}
