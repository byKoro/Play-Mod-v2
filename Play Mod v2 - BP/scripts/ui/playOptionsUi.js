import { ActionFormData } from "@minecraft/server-ui";
import { system } from "@minecraft/server";
import {
  getPlayOptions,
  toggleLoop,
  toggleControlScheme,
  toggleLookAtPlayer,
  toggleHideDuringPlayback,
  iniciar,
  updateLiveOptions,
} from "../services/index.js";
import { Tools } from "../utils/index.js";
import { main_UI } from "./mainUi.js";
import { playControlUi } from "./playControlUi.js";

/**
 * `live: true` quando aberto durante uma reprodução em andamento (via
 * playControlUi → "Visualização") — nesse caso, cada mudança já é
 * aplicada na animação que está rodando (updateLiveOptions), o botão
 * "Iniciar" some (evitar reiniciar sem querer), e cancelar volta pro
 * menu de pausar/parar em vez do menu principal.
 */
export function playOptionsUi(player, { live = false } = {}) {
  system.run(async () => {
    const options = getPlayOptions(player);

    const actions = [
      {
        text: Tools.formatToggle("menu.play_options.button.loop", options.loop),
        icon: options.loop
          ? "textures/ui/play_mod/loop_on.png"
          : "textures/ui/play_mod/loop_off.png",
        action: () => {
          toggleLoop(player);
          if (live) updateLiveOptions(player);
          Tools.playSuccess(player);
          playOptionsUi(player, { live });
        },
      },
      {
        text: Tools.formatToggle(
          "menu.play_options.button.camera_relative",
          options.controlScheme === "camera_relative",
        ),
        icon:
          options.controlScheme === "camera_relative"
            ? "textures/ui/play_mod/camera_relative_on.png"
            : "textures/ui/play_mod/camera_relative_off.png",
        action: () => {
          toggleControlScheme(player, "camera_relative");
          if (live) updateLiveOptions(player);
          Tools.playSuccess(player);
          playOptionsUi(player, { live });
        },
      },
      {
        text: Tools.formatToggle(
          "menu.play_options.button.look_at_player",
          options.lookAtPlayer,
        ),
        icon: options.lookAtPlayer
          ? "textures/ui/play_mod/look_at_player_on.png"
          : "textures/ui/play_mod/look_at_player_off.png",
        action: () => {
          toggleLookAtPlayer(player);
          if (live) updateLiveOptions(player);
          Tools.playSuccess(player);
          playOptionsUi(player, { live });
        },
      },
      {
        text: Tools.formatToggle(
          "menu.play_options.button.hide_during_playback",
          options.hideDuringPlayback,
        ),
        icon: options.hideDuringPlayback
          ? "textures/ui/play_mod/hide_on.png"
          : "textures/ui/play_mod/hide_off.png",
        action: () => {
          toggleHideDuringPlayback(player);
          if (live) updateLiveOptions(player);
          Tools.playSuccess(player);
          playOptionsUi(player, { live });
        },
      },
    ];

    // Só faz sentido "Iniciar" quando NÃO estamos editando ao vivo uma
    // reprodução que já está rolando.
    if (!live) {
      actions.push({
        text: Tools.t("menu.play_options.button.start"),
        icon: "textures/ui/play_mod/play.png",
        action: () => iniciar(player),
      });
    }

    const form = new ActionFormData();
    form.title(Tools.t("menu.play_options.title"));

    actions.forEach(({ text, icon }) => form.button(text, icon));

    try {
      const response = await form.show(player);

      if (response.canceled) return live ? playControlUi(player) : main_UI(player);

      actions[response.selection]?.action();
    } catch (error) {
      console.error(error);
    }
  });
}
