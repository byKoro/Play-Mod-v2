import { ModalFormData } from "@minecraft/server-ui";
import { system } from "@minecraft/server";
import { getMaxTime, resetTimeline, setDelayTimeline } from "../services/index";

const min = 1;
const max = 60;

export function editAllKeyframes(player) {
  system.run(() => {
    const form = new ModalFormData();
    form.title("");
    form.slider("Delay em segundos", min, max, {
      defaultValue: getDelayTimeline(player),
    });
    form.slider("Tempo total", min, max, { defaultValue: getMaxTime() });
    form.toggle("Deletar todos");

    form.show(player).then((response) => {
      const values = response.formValues;
      const currenteMaxTime = values[0];
      const currentMaxTime = values[1];
      if (response.canceled) return;

      if (values[2]) return resetTimeline(player);

      setDelayTimeline(player, currentDelay);
    });
  });
}
