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
import { validateTimelineDimension } from "../services/index";

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
