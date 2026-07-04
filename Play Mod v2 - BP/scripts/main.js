import { world } from "@minecraft/server";
import { registerTimelineEvents } from "./services/timelineService.js";
import { main_UI } from "./ui/mainUi";
import { getTimeline } from "./services/timelineService";

world.afterEvents.itemUse.subscribe((ev) => {
  const player = ev.source;
  //console.warn(JSON.stringify(getTimeline(player)));
  main_UI(player);
});

registerTimelineEvents();
