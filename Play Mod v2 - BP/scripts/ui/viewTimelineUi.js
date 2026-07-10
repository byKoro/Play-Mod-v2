import { system } from "@minecraft/server";
import { ActionFormData } from "@minecraft/server-ui";
import {
  getCurrentTimeline,
  setCurrentTimeline,
  deleteTimeline,
} from "../services/index";
import { listTimelinesUi } from "./listTimelinesUi";
import { main_UI } from "./mainUi";
import { Tools } from "../utils/tools";

export function viewTimelineUi(player, select) {
  const form = new ActionFormData();

  form.title(Tools.t("ui.view.title", [select]));
  form.button(
    Tools.t("ui.view.button.delete"),
    "textures/ui/play_mod/delete_timeline.png",
  );
  form.button(
    Tools.t("ui.view.button.load"),
    "textures/ui/play_mod/load_timeline.png",
  );
  form.show(player).then((response) => {
    if (response.canceled) return listTimelinesUi(player);

    const selection = response.selection;

    if (selection == 0) {
      deleteTimeline(player, select);
      return main_UI(player);
    }
    if (selection == 1) {
      setCurrentTimeline(player, select);
      return main_UI(player);
    }
  });
}
