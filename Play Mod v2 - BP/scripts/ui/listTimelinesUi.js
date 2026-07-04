import { ActionFormData } from "@minecraft/server-ui";
import { getTimelines, setCurrentTimeline } from "../services/index";
import { world } from "@minecraft/server";
import { main_UI } from "./mainUi";

export function listTimelinesUi(player) {
  const form = new ActionFormData().title("");
  const timelines = getTimelines(player);

  for (const timeline of timelines) {
    form.button(timeline);
  }
  form.show(player).then((response) => {
    const select = response.selection;

    setCurrentTimeline(player, timelines[select]);
    return main_UI(player);
  });
}
