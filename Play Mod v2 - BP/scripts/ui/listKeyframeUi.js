import { Tools } from "../utils/tools";
import { system } from "@minecraft/server";
import { ActionFormData } from "@minecraft/server-ui";
import { main_UI } from "./mainUi";
import { editKeyframe_UI } from "./editKeyframesUi";
import { getCurrentTimeline, getTimeline } from "../services/timelineService";
import { editAllKeyframes } from "./editAllKeyframesUI";
import { saveTimelineUi } from "./saveTimelineUi";

export function listKeyframe_UI(player) {
  system.run(async () => {
    const timeline = getTimeline(player);

    const buttons = [
      {
        text: Tools.t("menu.keyframes.button.save_new"),
        icon: "textures/ui/play_mod/save_timeline.png",
        action: () => saveTimelineUi(player),
      },
      {
        text: Tools.t("menu.keyframes.button.edit_all"),
        icon: "textures/ui/play_mod/edit_all.png",
        action: () => editAllKeyframes(player),
      },
    ];

    if (timeline && timeline.keyframes) {
      timeline.keyframes.forEach((keyframe, index) => {
        buttons.push({
          text:
            keyframe.name === ""
              ? Tools.t("menu.keyframes.default_name", [index + 1])
              : keyframe.name,
          action: () => editKeyframe_UI(player, index),
        });
      });
    }

    const currentName = getCurrentTimeline(player);
    const form = new ActionFormData();
    form.title(
      currentName
        ? Tools.t("menu.keyframes.title.active", [currentName])
        : Tools.t("menu.keyframes.title.none"),
    );

    buttons.forEach(({ text, icon }) => form.button(text, icon));

    try {
      const response = await form.show(player);

      if (response.canceled) return main_UI(player);

      buttons[response.selection]?.action();
    } catch (error) {
      console.error("Erro na UI de Keyframes: " + error);
      Tools.playError(player);
      player.sendMessage(Tools.t("sys.error.not_found"));
      main_UI(player);
    }
  });
}
