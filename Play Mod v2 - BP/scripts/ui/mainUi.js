import { ActionFormData, ModalFormData } from "@minecraft/server-ui";
import { system, world } from "@minecraft/server";
import {
  addKeyframe,
  createKeyframe,
  getKeyframe,
  delLastKeyframe,
  setKeyframe,
} from "../services/keyframeService.js";
import { startFlycam } from "../services/flycamService.js";
import { Tools } from "../utils/index.js";
import { listKeyframe_UI } from "./listKeyframeUi.js";
import { getCurrentTimeline } from "../services/index.js";
import { listTimelinesUi } from "./listTimelinesUi.js";
import { playOptionsUi } from "./playOptionsUi.js";
import { maybeConfirmFlycam } from "./flycamConfirmUi.js";
import { presetsUi } from "./presetsUi.js";

export function main_UI(player) {
  system.run(async () => {
    const actions = [
      {
        text: Tools.t("menu.main.button.set_keyframe"),
        icon: "textures/ui/play_mod/add_keyframe.png",
        action: () =>
          maybeConfirmFlycam(player, {
            onYes: () => startFlycam(player, { kind: "append" }),
            onNo: () => setKeyframe(player),
          }),
      },
      {
        text: Tools.t("menu.main.button.manage_keyframes"),
        icon: "textures/ui/play_mod/gerir_keyframes.png",
        action: () => listKeyframe_UI(player),
      },
      {
        text: Tools.t("menu.main.button.manage_timelines"),
        icon: "textures/ui/play_mod/gerir_timelines.png",
        action: () => listTimelinesUi(player),
      },
      {
        text: Tools.t("menu.main.button.delete_last"),
        icon: "textures/ui/play_mod/del_last_keyframe.png",
        action: () => delLastKeyframe(player),
      },
      {
        text: Tools.t("menu.main.button.start"),
        icon: "textures/ui/play_mod/play.png",
        action: () => playOptionsUi(player),
      },
      {
        text: Tools.t("menu.main.button.presets"),
        icon: "textures/ui/play_mod/presets.png",
        action: () => presetsUi(player),
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
