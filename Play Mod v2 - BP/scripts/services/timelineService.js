import { world } from "@minecraft/server";
import { Tools } from "../utils/tools";

export function createTimeline(player) {
  return {
    playerId: player.id,
    defaultTransition: 0,
    defaulMaxTime: 30,
    keyframes: [],
  };
}

export function getTimeline(player) {
  return Tools.getDynamicProperty(player, "timeline");
}

export function saveTimeline(player, timeline) {
  Tools.setDynamicProperty(player, "timeline", timeline);
}

export function resetTimeline(player) {
  saveTimeline(player, createTimeline(player));
}

export function registerTimelineEvents() {
  world.afterEvents.playerSpawn.subscribe(({ player, initialSpawn }) => {
    if (!initialSpawn) return;

    if (!getTimeline(player)) {
      saveTimeline(player, createTimeline(player));
    }
  });
}

export function setDelayTimeline(player, newDelay) {
  const timeline = getTimeline(player);

  timeline.defaulMaxTime = newDelay;
  saveTimeline(player, timeline);
}

export function getMaxTime(player) {
  const timeline = getTimeline(player);
  return timeline.defaultMaxTime;
}
