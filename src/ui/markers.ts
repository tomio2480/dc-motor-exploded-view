import type { MarkerPosition } from "../view/scene";
import { createElement } from "./dom";

/** 3D 上の位置へ重ねる記号を，必要になった時点で作って配置する． */
export function createMarkerLayer(
  container: HTMLElement,
): (markers: readonly MarkerPosition[]) => void {
  const elements = new Map<string, HTMLElement>();

  function elementFor(id: string): HTMLElement {
    const existing = elements.get(id);
    if (existing !== undefined) {
      return existing;
    }
    const element = createElement("span", "marker");
    element.dataset.marker = id;
    container.append(element);
    elements.set(id, element);
    return element;
  }

  return (markers) => {
    container.hidden = markers.length === 0;
    for (const marker of markers) {
      const element = elementFor(marker.id);
      element.textContent = marker.text;
      element.dataset.tone = marker.tone;
      element.hidden = !marker.isVisible;
      element.style.transform = `translate(${marker.x}px, ${marker.y}px)`;
    }
  };
}
