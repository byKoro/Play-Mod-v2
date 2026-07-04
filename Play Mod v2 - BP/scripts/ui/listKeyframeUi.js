import { Tools } from "../utils/tools";
import { system } from "@minecraft/server";
import { ActionFormData } from "@minecraft/server-ui";
import { main_UI } from "./mainUi";
import { editKeyframe_UI } from "./editKeyframesUi";
import { getTimeline } from "../services/timelineService";
import { editAllKeyframes } from "./editAllKeyframesUI";

export function listKeyframe_UI(player) {
  system.run(async () => {
    const timeline = getTimeline(player);

    const buttons = [
      {
        text: "Salvar Timeline",
        action: () => console.warn("fix"),
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

    const form = new ActionFormData().title("Título");

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
