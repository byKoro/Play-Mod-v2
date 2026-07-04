import { ModalFormData } from "@minecraft/server-ui";
import { system } from "@minecraft/server";
import { getMaxTime, resetTimeline, setMaxTimeline } from "../services/index";

const min = 1;
const max = 60;

export function editAllKeyframes(player) {
  system.run(() => {
    const form = new ModalFormData();
    form.title("");
    form.slider("Tempo total em segundos", min, max, {
      defaultValue: getMaxTime(player),
    });
    form.toggle("Deletar todos");

    form.show(player).then((response) => {
      if (response.canceled) return;

      const values = response.formValues;
      const currentMaxTime = values[0];
      const delAllKeyframes = values[1];

      resetTimeline(player, delAllKeyframes);
      setMaxTimeline(player, currentMaxTime);
      return editAllKeyframes(player);
    });
  });
}
