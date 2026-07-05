import { ModalFormData } from "@minecraft/server-ui";
import { system } from "@minecraft/server";
import {
  exportTimeline,
  getTimeline,
  hasTimeline,
  getCurrentTimeline,
} from "../services/index";
import { listKeyframe_UI } from "../ui/listKeyframeUi";

export function saveTimelineUi(player, erroMsg = "") {
  system.run(() => {
    const form = new ModalFormData();
    form.title(`Timeline atual: ${getCurrentTimeline(player)}`);
    form.textField("Salvar nome da timeline", "Escreva...");

    form.show(player).then((response) => {
      if (response.canceled) return listKeyframe_UI(player);

      const timelineNameString = response.formValues[0]?.trim();

      if (!timelineNameString) {
        player.dimension.playSound("note.bass", player.location);
        return saveTimelineUi(player, "§cO nome não pode ser vazio!");
      }

      if (hasTimeline(player, timelineNameString)) {
        player.dimension.playSound("note.bass", player.location);

        return saveTimelineUi(player, "§cEssa timeline já existe!");
      }

      const timeline = getTimeline(player);
      timeline.name = timelineNameString;

      exportTimeline(player, timelineNameString);
    });
  });
}
