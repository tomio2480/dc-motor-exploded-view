import type { PartInfo } from "../motor/parts";
import { createElement } from "./dom";

/** 部品 1 つぶんの番号・名前・読み・役割・解説を表示する欄． */
export interface PartView {
  show(part: PartInfo): void;
  hide(): void;
}

const CLOSE_ICON_PATH = "M3 3l10 10M13 3L3 13";
const SVG_NAMESPACE = "http://www.w3.org/2000/svg";

function createCloseButton(onClose: () => void): HTMLButtonElement {
  const button = createElement("button", "part-info__close");
  button.type = "button";
  button.setAttribute("aria-label", "解説を閉じる");

  const icon = document.createElementNS(SVG_NAMESPACE, "svg");
  icon.setAttribute("viewBox", "0 0 16 16");
  icon.setAttribute("aria-hidden", "true");
  const path = document.createElementNS(SVG_NAMESPACE, "path");
  path.setAttribute("d", CLOSE_ICON_PATH);
  icon.append(path);
  button.append(icon);

  button.addEventListener("click", onClose);
  return button;
}

/**
 * 解説の欄を container の中へ作る．
 * onClose を渡すと，閉じるボタンを付ける．
 */
export function createPartView(
  container: HTMLElement,
  onClose?: () => void,
): PartView {
  const number = createElement("span", "part-info__number");
  const name = createElement("p", "part-info__name");
  const kana = createElement("p", "part-info__kana");
  const role = createElement("p", "part-info__role");
  const description = createElement("p", "part-info__description");

  const title = createElement("div", "part-info__title");
  title.append(name, kana);
  const header = createElement("div", "part-info__header");
  header.append(number, title);
  if (onClose !== undefined) {
    header.append(createCloseButton(onClose));
  }
  container.append(header, role, description);

  return {
    show(part) {
      number.textContent = String(part.number);
      name.textContent = part.name;
      kana.textContent = part.kana;
      role.textContent = part.role;
      description.textContent = part.description;
      container.hidden = false;
    },
    hide() {
      container.hidden = true;
    },
  };
}
