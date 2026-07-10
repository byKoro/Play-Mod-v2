import { ActionFormData } from "@minecraft/server-ui";
import { system } from "@minecraft/server";
import {
  isPaused,
  pauseAnimation,
  resumeAnimation,
  stopAnimation,
} from "../services/playCamera.js";
import { Tools } from "../utils/index.js";
import { playOptionsUi } from "./playOptionsUi.js";

export function playControlUi(player) {
  system.run(async () => {
    const paused = isPaused(player);

    const playPauseAction = paused
      ? {
          text: Tools.t("menu.play_control.button.resume"),
          icon: "textures/ui/play_mod/play.png",
          action: () => {
            resumeAnimation(player);
            Tools.playSuccess(player);
          },
        }
      : {
          text: Tools.t("menu.play_control.button.pause"),
          icon: "textures/ui/play_mod/pause.png",
          action: () => {
            pauseAnimation(player);
            Tools.playSuccess(player);
          },
        };

    const actions = [
      playPauseAction,
      {
        text: Tools.t("menu.play_control.button.stop"),
        icon: "textures/ui/play_mod/stop.png",
        action: () => {
          stopAnimation(player);
          Tools.playSuccess(player);
        },
      },
      {
        // Opções (loop, câmera relativa, olhar pro jogador, sumir na
        // câmera) aplicadas na hora, sem precisar parar a animação.
        text: Tools.t("menu.play_control.button.view"),
        icon: "textures/ui/play_mod/view_options.png",
        action: () => playOptionsUi(player, { live: true }),
      },
    ];

    const form = new ActionFormData();
    form.title(Tools.t("menu.play_control.title"));

    actions.forEach(({ text, icon }) => form.button(text, icon));

    try {
      const response = await form.show(player);

      if (response.canceled) return;

      actions[response.selection]?.action();
    } catch (error) {
      console.error(error);
    }
  });
}
