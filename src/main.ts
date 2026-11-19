import "./style.css";
import { startApp } from "./ui/app";
import { requireElement } from "./ui/dom";
import { renderPartsFallback } from "./ui/partLists";

try {
  startApp();
} catch (error) {
  // WebGL を使えない環境などでは 3D を表示できない．
  // その旨を示し，部品の解説を文章で読めるようにしてから，原因を伝播させる．
  document.body.dataset.state = "error";
  requireElement("stage-error", HTMLElement).hidden = false;
  renderPartsFallback(requireElement("fallback-parts", HTMLElement));
  throw error;
}
