import { PARTS, type PartId } from "../motor/parts";
import { createElement } from "./dom";

/** 3D の上へ重ねる番号ラベルのボタンを作り，部品 ID ごとに返す． */
export function createLabelButtons(
  container: HTMLElement,
): Map<PartId, HTMLButtonElement> {
  const buttons = new Map<PartId, HTMLButtonElement>();
  for (const part of PARTS) {
    const button = createElement("button", "label", String(part.number));
    button.type = "button";
    button.setAttribute("aria-label", `${part.number} ${part.name}`);
    button.setAttribute("aria-pressed", "false");
    const item = document.createElement("li");
    item.append(button);
    container.append(item);
    buttons.set(part.id, button);
  }
  return buttons;
}

/** 部品一覧のボタンを作り，部品 ID ごとに返す． */
export function createPartsList(
  container: HTMLElement,
): Map<PartId, HTMLButtonElement> {
  const buttons = new Map<PartId, HTMLButtonElement>();
  for (const part of PARTS) {
    const button = createElement("button", "parts-list__item");
    button.type = "button";
    button.append(
      createElement("span", "parts-list__number", String(part.number)),
      createElement("span", "parts-list__name", part.name),
      createElement("span", "parts-list__role", part.role),
    );
    const item = document.createElement("li");
    item.append(button);
    container.append(item);
    buttons.set(part.id, button);
  }
  return buttons;
}

/** 3D を表示できない環境向けに，全部品の解説を文章の一覧として作る． */
export function renderPartsFallback(container: HTMLElement): void {
  for (const part of PARTS) {
    const item = createElement("li", "fallback-parts__item");
    item.append(
      createElement(
        "p",
        "fallback-parts__name",
        `${part.number}. ${part.name}`,
      ),
      createElement("p", "fallback-parts__role", part.role),
      createElement("p", "fallback-parts__description", part.description),
    );
    container.append(item);
  }
  container.hidden = false;
}
