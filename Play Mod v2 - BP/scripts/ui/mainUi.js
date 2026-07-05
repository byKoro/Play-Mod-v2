import { ActionFormData, ModalFormData } from "@minecraft/server-ui";
import { system, world } from "@minecraft/server";
import {
  addKeyframe,
  createKeyframe,
  getKeyframe,
  delLastKeyframe,
  setKeyframe,
} from "../services/keyframeService";
import { Tools } from "../utils/index";
import { listKeyframe_UI } from "./listKeyframeUi";
import {
  getCurrentTimeline,
  validateTimelineDimension,
} from "../services/index";
import { listTimelinesUi } from "./listTimelinesUi";

export function main_UI(player) {
  system.run(async () => {
    const actions = [
      {
        text: Tools.t("menu.main.button.set_keyframe"),
        icon: "textures/ui/play_mod/add_keyframe.png",
        action: () => setKeyframe(player),
      },
      {
        text: Tools.t("menu.main.button.manage_keyframes"),
        icon: "textures/ui/play_mod/conf_keyframe.png",
        action: () => listKeyframe_UI(player),
      },
      {
        text: Tools.t("menu.main.button.manage_timelines"),
        action: () => listTimelinesUi(player),
      },
      {
        text: Tools.t("menu.main.button.delete_last"),
        action: () => delLastKeyframe(player),
      },
      // "Iniciar" ainda será implementado depois — mantido como está por enquanto.
      {
        text: Tools.t("menu.main.button.start"),
        action: () => iniciar(player),
      },
    ];

    const form = new ActionFormData();
    form.title(Tools.t("menu.main.title", [getCurrentTimeline(player)]));

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
