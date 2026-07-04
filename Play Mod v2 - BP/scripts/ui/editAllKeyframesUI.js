import { ModalFormData } from "@minecraft/server-ui";
import { system } from "@minecraft/server";
import {
  getCurrentTimeline,
  getMaxTime,
  resetTimeline,
  setMaxTimeline,
} from "../services/index";
import { listKeyframe_UI } from "./listKeyframeUi";

const min = 1;
const max = 60;

let del = "§cDeletar todos ?";

export function editAllKeyframes(player) {
  system.run(() => {
    const form = new ModalFormData();
    form.title(`Timeline atual: ${getCurrentTimeline(player)}`);
    form.slider("Tempo total em segundos", min, max, {
      defaultValue: getMaxTime(player),
    });
    form.toggle(del);

    form.show(player).then((response) => {
      if (response.canceled) return listKeyframe_UI(player);

      const values = response.formValues;
      const currentMaxTime = values[0];
      const delAllKeyframes = values[1];

      if (resetTimeline(player, delAllKeyframes)) del = "§cTodos deletados!";
      setMaxTimeline(player, currentMaxTime);
      return editAllKeyframes(player);
    });
  });
}
