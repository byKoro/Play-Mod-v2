import { ModalFormData } from "@minecraft/server-ui";
import { system } from "@minecraft/server";
import { exportTimeline, getTimeline } from "../services/index";
import { listKeyframe_UI } from "../ui/listKeyframeUi";

export function saveTimelineUi(player) {
  system.run(() => {
    const form = new ModalFormData().title("");
    form.textField("Salvar nome da timeline", "Escreva...");
    form.show(player).then((response) => {
      const timelineName = response.formValues;
      const timeline = getTimeline(player);

      if (response.canceled) return listKeyframe_UI(player);
      timeline.name = timelineName;

      exportTimeline(player, timelineName[0]);
    });
  });
}
