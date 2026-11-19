import "./style.css";
import { startApp } from "./ui/app";

try {
  startApp();
} catch (error) {
  // WebGL を使えない環境などでは 3D を表示できないため，その旨を画面へ示す．
  const message = document.getElementById("stage-error");
  if (message !== null) {
    message.hidden = false;
  }
  throw error;
}
