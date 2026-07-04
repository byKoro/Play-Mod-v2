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

export function resetTimeline(player, value) {
  if (value) {
    saveTimeline(player, createTimeline(player));
  }
}

export function registerTimelineEvents() {
  world.afterEvents.playerSpawn.subscribe(({ player, initialSpawn }) => {
    if (!initialSpawn) return;

    if (!getTimeline(player)) {
      saveTimeline(player, createTimeline(player));
    }
  });
}

export function setMaxTimeline(player, newDelay) {
  const timeline = getTimeline(player);

  timeline.defaultMaxTime = newDelay;
  saveTimeline(player, timeline);
}

export function getMaxTime(player) {
  const timeline = getTimeline(player);
  return timeline.defaultMaxTime;
}

export function validateTimelineDimension(player, timeline) {
  const playerDim = player.dimension.id;

  for (let i = 0; i < timeline.keyframes.length; i++) {
    const keyframe = timeline.keyframes[i];

    if (!keyframe) continue;

    if (keyframe.dimension !== playerDim) {
      player.sendMessage(`§cErro: Keyframe ${i} está em outra dimensão!`);

      return false;
    }
  }

  return true;
}

export function exportTimeline(player) {
  const timeline = getTimeline(player);
}
