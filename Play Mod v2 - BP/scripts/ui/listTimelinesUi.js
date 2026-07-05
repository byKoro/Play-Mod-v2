import { ActionFormData } from "@minecraft/server-ui";
import { getTimelines, setCurrentTimeline } from "../services/index";
import { world } from "@minecraft/server";
import { main_UI } from "./mainUi";
import { viewTimelineUi } from "./viewTimelineUi";
import { Tools } from "../utils/tools";

export function listTimelinesUi(player) {
  const timelines = getTimelines(player);

  // Antes disso a UI abria um form sem nenhum botão quando não havia
  // timelines salvas. Agora avisa o player e volta pro menu principal.
  if (timelines.length === 0) {
    Tools.playError(player);
    player.sendMessage(Tools.t("sys.error.no_timelines"));
    return main_UI(player);
  }

  const form = new ActionFormData().title(Tools.t("menu.timelines.title"));

  for (const timeline of timelines) {
    form.button(timeline);
  }
  form.show(player).then((response) => {
    if (response.canceled) return main_UI(player);
    const select = response.selection;

    viewTimelineUi(player, timelines[select]);
  });
}
