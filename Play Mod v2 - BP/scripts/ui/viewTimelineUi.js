import { system } from "@minecraft/server";
import { ActionFormData } from "@minecraft/server-ui";
import {
  getCurrentTimeline,
  setCurrentTimeline,
  deleteTimeline,
} from "../services/index";
import { listTimelinesUi } from "./listTimelinesUi";
import { main_UI } from "./mainUi";

export function viewTimelineUi(player, select) {
  const form = new ActionFormData();

  form.title(`Timeline: ${select}`);
  //form.body(`Quantidade de frames: ${frames}`);
  form.button("Deletar");
  form.button("Carregar");
  form.show(player).then((response) => {
    if (response.canceled) listTimelinesUi(player);

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
