import { ActionFormData } from "@minecraft/server-ui";
import { system } from "@minecraft/server";
import {
  getPlayOptions,
  toggleLoop,
  toggleControlScheme,
  iniciar,
} from "../services/index.js";
import { Tools } from "../utils/index.js";
import { main_UI } from "./mainUi.js";

export function playOptionsUi(player) {
  system.run(async () => {
    const options = getPlayOptions(player);

    const actions = [
      {
        text: Tools.formatToggle("menu.play_options.button.loop", options.loop),
        icon: "textures/ui/play_mod/loop.png",
        action: () => {
          toggleLoop(player);
          Tools.playSuccess(player);
          playOptionsUi(player);
        },
      },
      {
        text: Tools.formatToggle(
          "menu.play_options.button.camera_relative",
          options.controlScheme === "camera_relative",
        ),
        icon: "textures/ui/play_mod/camera_relative.png",
        action: () => {
          toggleControlScheme(player, "camera_relative");
          Tools.playSuccess(player);
          playOptionsUi(player);
        },
      },
      {
        text: Tools.formatToggle(
          "menu.play_options.button.camera_relative_strafe",
          options.controlScheme === "camera_relative_strafe",
        ),
        icon: "textures/ui/play_mod/camera_relative_strafe.png",
        action: () => {
          toggleControlScheme(player, "camera_relative_strafe");
          Tools.playSuccess(player);
          playOptionsUi(player);
        },
      },
      {
        text: Tools.t("menu.play_options.button.start"),
        icon: "textures/ui/play_mod/play.png",
        action: () => iniciar(player),
      },
    ];

    const form = new ActionFormData();
    form.title(Tools.t("menu.play_options.title"));

    actions.forEach(({ text, icon }) => form.button(text, icon));

    try {
      const response = await form.show(player);

      if (response.canceled) return main_UI(player);

      actions[response.selection]?.action();
    } catch (error) {
      console.error(error);
    }
  });
}
