// Tiny DOM builders for screens (built once per screen or per revision, never per frame).

export function h<K extends keyof HTMLElementTagNameMap>(
  doc: Document,
  tag: K,
  className?: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const el = doc.createElement(tag);
  if (className !== undefined && className !== '') el.className = className;
  if (text !== undefined) el.textContent = text;
  return el;
}

/** Append children and return the parent. */
export function put<T extends HTMLElement>(parent: T, ...children: (HTMLElement | null)[]): T {
  for (const c of children) if (c !== null) parent.appendChild(c);
  return parent;
}

/** A native button with a stable data-ui id for Playwright (ui-spec 3). */
export function button(
  doc: Document,
  dataUi: string,
  label: string,
  className = '',
): HTMLButtonElement {
  const b = h(doc, 'button', `btn ${className}`.trim());
  b.type = 'button';
  b.dataset['ui'] = dataUi;
  const span = h(doc, 'span', 'btn-label', label);
  b.appendChild(span);
  return b;
}

/** Key hint "[R]" appended to a button (ui-spec 6.2). Empty label adds nothing. */
export function withHint(doc: Document, el: HTMLElement, keyText: string): HTMLElement {
  if (keyText !== '') el.appendChild(h(doc, 'span', 'key-hint', `[${keyText}]`));
  return el;
}

/** Write text only when it changed (HUD diffing, coding-standards 5.7). */
export function setText(el: HTMLElement, text: string): void {
  if (el.textContent !== text) el.textContent = text;
}
