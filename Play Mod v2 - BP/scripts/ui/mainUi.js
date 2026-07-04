import { ActionFormData, ModalFormData } from "@minecraft/server-ui";
import { system, world } from "@minecraft/server";
import {
  addKeyframe,
  createKeyframe,
  getKeyframe,
} from "../services/keyframeService";
import { Tools } from "../utils/tools";
import { editKeyframe_UI } from "./editKeyframesUi";
import { listKeyframe_UI } from "./listKeyframeUi";

export function main_UI(player) {
  system.run(async () => {
    const actions = [
      { text: "Definir Keyframe", action: () => setKeyframe(player) },
      { text: "Gerenciar Keyframes", action: () => listKeyframe_UI(player) },
      { text: "Gerenciar Timelines", action: () => listTimelines(player) },
      { text: "Deletar Último Frame", action: () => delLastKeyframe(player) },
      { text: "Iniciar", action: () => iniciar(player) },
    ];

    const form = new ActionFormData().title("Título");

    actions.forEach(({ text }) => form.button(text));

    try {
      const response = await form.show(player);

      if (response.canceled) return;

      actions[response.selection]?.action();
    } catch (error) {
      console.error(error);
    }
  });
}

function setKeyframe(player) {
  const timeline = Tools.getDynamicProperty(player, "timeline");
  const dimensionPlayer = player.dimension;

  const keyframe = createKeyframe(player);

  if (player.getTags().includes("editKeyframe")) {
    const keyframeIndex = Number(
      Tools.getDynamicProperty(player, "editKeyframe"),
    );

    const timeline = Tools.getDynamicProperty(player, "timeline");
    timeline.keyframes[keyframeIndex] = keyframe;

    Tools.setDynamicProperty(player, "timeline", timeline);

    player.removeTag("editKeyframe");
    return editKeyframe_UI(player, keyframeIndex);
  } else {
    addKeyframe(player, keyframe);
  }
}

function delLastKeyframe(player) {
  const timeline = Tools.getDynamicProperty(player, "timeline");
  timeline.keyframes.pop();
  Tools.setDynamicProperty(player, "timeline", timeline);
}
