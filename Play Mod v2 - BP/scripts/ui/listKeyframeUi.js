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
        text: "Salvar Nova Timeline",
        action: () => saveTimelineUi(player),
      },
      {
        text: "Alterar Todos",
        action: () => editAllKeyframes(player),
      },
    ];

    timeline.keyframes.forEach((keyframe, index) => {
      buttons.push({
        text: keyframe.name === "" ? `Keyframe ${index}` : keyframe.name,
        action: () => editKeyframe_UI(player, index),
      });
    });

    const form = new ActionFormData();
    form.title(`Timeline atual: ${getCurrentTimeline(player)}`);

    buttons.forEach(({ text }) => form.button(text));

    try {
      const response = await form.show(player);

      if (response.canceled) return main_UI(player);

      buttons[response.selection]?.action();
    } catch (error) {
      console.error(error);
    }
  });
}
