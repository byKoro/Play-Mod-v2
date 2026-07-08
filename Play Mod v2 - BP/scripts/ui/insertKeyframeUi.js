import { ActionFormData } from "@minecraft/server-ui";
import { Tools } from "../utils/index";
import { setKeyframe } from "../services/index";
import { getCurrentTimeline } from "../services/index";

export function insertKeyframeUi(player) {
  const form = new ActionFormData();
  form.title(Tools.t("menu.main.title", [getCurrentTimeline(player)]));
  form.button(Tools.t("ui.insert.keyframe.button"));
  form.button(Tools.t("ui.cancel.button"));
  form.show(player).then((response) => {
    if (response.canceled) return;

    if (response.selection == 0) {
      setKeyframe(player);
    }
    if (response.selection == 1) {
      player.removeTag("insertKeyframe");
    }
  });
}
