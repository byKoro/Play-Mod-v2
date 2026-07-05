import { ModalFormData } from "@minecraft/server-ui";
import { system } from "@minecraft/server";
import {
  exportTimeline,
  getTimeline,
  hasTimeline,
  getCurrentTimeline,
} from "../services/index";
import { listKeyframe_UI } from "../ui/listKeyframeUi";
import { Tools } from "../utils/tools";

export function saveTimelineUi(player) {
  system.run(() => {
    const form = new ModalFormData();
    form.title(Tools.t("ui.save.title"));
    form.textField(
      Tools.t("ui.save.field.label"),
      Tools.t("ui.save.field.placeholder"),
    );

    form.show(player).then((response) => {
      if (response.canceled) return listKeyframe_UI(player);

      const timelineNameString = response.formValues[0]?.trim();

      if (!timelineNameString) {
        Tools.playError(player);
        player.sendMessage(Tools.t("sys.error.empty_name"));
        return saveTimelineUi(player);
      }

      if (hasTimeline(player, timelineNameString)) {
        Tools.playError(player);
        player.sendMessage(Tools.t("sys.error.exists"));
        return saveTimelineUi(player);
      }

      const timeline = getTimeline(player);
      timeline.name = timelineNameString;

      exportTimeline(player, timelineNameString);
    });
  });
}
