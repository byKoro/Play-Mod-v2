import { ModalFormData } from "@minecraft/server-ui";
import { system } from "@minecraft/server";
import {
  getCurrentTimeline,
  getMaxTime,
  resetTimeline,
  setMaxTimeline,
  areMarkersVisible,
  setKeyframeMarkersVisible,
} from "../services/index";
import { listKeyframe_UI } from "./listKeyframeUi";
import { Tools } from "../utils/tools";

const min = 1;
const max = 60;

export function editAllKeyframes(player) {
  system.run(() => {
    const form = new ModalFormData();
    form.title(Tools.t("ui.edit_all.title", [getCurrentTimeline(player)]));
    form.slider(Tools.t("ui.edit_all.transition.label"), min, max, {
      defaultValue: getMaxTime(player),
    });
    form.toggle(Tools.t("ui.edit_all.markers.label"), {
      defaultValue: areMarkersVisible(player),
    });
    form.toggle(Tools.t("ui.edit_all.reset.label"));

    form.show(player).then((response) => {
      if (response.canceled) return listKeyframe_UI(player);

      const values = response.formValues;
      const currentMaxTime = values[0];
      const showMarkers = values[1];
      const delAllKeyframes = values[2];

      setKeyframeMarkersVisible(player, showMarkers);

      if (resetTimeline(player, delAllKeyframes));
      setMaxTimeline(player, currentMaxTime);
      return editAllKeyframes(player);
    });
  });
}
