type ElementConstructor<T extends Element> = new () => T;

/** ID で要素を取得する．見つからないか型が違う場合は，原因を示して失敗する． */
export function requireElement<T extends Element>(
  id: string,
  type: ElementConstructor<T>,
): T {
  const element = document.getElementById(id);
  if (!(element instanceof type)) {
    throw new Error(`必要な要素が見つからない: #${id}`);
  }
  return element;
}

export function createElement<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className: string,
  text = "",
): HTMLElementTagNameMap[K] {
  const element = document.createElement(tag);
  element.className = className;
  element.textContent = text;
  return element;
}
