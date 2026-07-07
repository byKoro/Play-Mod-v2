import { world } from "@minecraft/server";
import { Tools } from "../utils/tools";
import { saveTimelineUi } from "../ui/saveTimelineUi";
import {
  syncKeyframeMarkers,
  resetKeyframeMarkersOnJoin,
} from "./keyframeMarkerService.js";

export function createTimeline(player) {
  return {
    name: "",
    tag: "play-mod",
    playerId: player.id,
    defaultTransition: 0,
    defaultMaxTime: 30,
    keyframes: [],
  };
}

export function getCurrentTimeline(player) {
  // Corrigido: Adicionado o return e fallback para string vazia
  return Tools.getDynamicProperty(player, "currentTimeline") ?? "";
}

export function getTimeline(player) {
  const current = getCurrentTimeline(player);
  if (current === "") {
    return Tools.getDynamicProperty(player, "timeline");
  } else {
    return Tools.getDynamicProperty(player, current);
  }
}

export function saveTimeline(player, timeline) {
  const currentTimeline = getCurrentTimeline(player);
  // Se a timeline atual for vazia, salva na chave padrão "timeline"
  const key = currentTimeline === "" ? "timeline" : currentTimeline;
  Tools.setDynamicProperty(player, key, timeline);
}

export function resetTimeline(player, value) {
  if (value) {
    saveTimeline(player, createTimeline(player));
    syncKeyframeMarkers(player);
    Tools.playSuccess(player);
    player.sendMessage(Tools.t("sys.msg.success.generic"));
  }
  return true;
}

export function registerTimelineEvents() {
  world.afterEvents.playerSpawn.subscribe(({ player, initialSpawn }) => {
    if (!initialSpawn) return;

    if (!getTimeline(player)) {
      Tools.setDynamicProperty(player, "currentTimeline", "timeline");
      Tools.setDynamicProperty(player, "dinamicText", "");
      saveTimeline(player, createTimeline(player));
    }

    resetKeyframeMarkersOnJoin(player);
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
      Tools.playError(player);
      player.sendMessage(Tools.t("sys.error.dimension", [i]));
      return false;
    }
  }
  return true;
}

export function exportTimeline(player, value) {
  const timeline = getTimeline(player);

  if (value === undefined || value.trim() === "") {
    Tools.playError(player);
    return saveTimelineUi(player);
  }

  // Corrigido para evitar erros se timeline.name for undefined
  if (timeline.name && timeline.name.includes(value)) {
    Tools.playError(player);
    return saveTimelineUi(player);
  }

  createNewTimeline(player, value);
}

export function limitTimelineKeyframes(player) {
  const timeline = getTimeline(player);
  if (timeline.keyframes.length > 20) {
    // Dica: Use player.sendMessage em vez de world.sendMessage
    // para que apenas o jogador que atingiu o limite veja o erro.
    Tools.playError(player);
    player.sendMessage(Tools.t("sys.error.limit"));
    return true;
  }
  return false;
}

function createNewTimeline(player, value) {
  const timeline = getTimeline(player);
  timeline.name = value;

  Tools.setDynamicProperty(player, value, timeline);
  Tools.setDynamicProperty(player, "currentTimeline", value); // Corrigido: 'currentTimeline'

  Tools.playSuccess(player);
  player.sendMessage(Tools.t("sys.msg.success.timeline_created"));
}

export function hasTimeline(player, value) {
  const propertiesId = player.getDynamicPropertyIds();
  if (propertiesId.includes(value)) {
    return true;
  }
  return false;
}

export function getTimelines(player) {
  const allIds = player.getDynamicPropertyIds();
  const validTimelines = [];

  for (const id of allIds) {
    if (id === "currentTimeline" || id === "editKeyframe") continue;

    try {
      const propertyData = Tools.getDynamicProperty(player, id);

      if (propertyData && propertyData.tag === "play-mod") {
        validTimelines.push(id);
      }
    } catch (error) {
      continue;
    }
  }

  return validTimelines;
}

export function setCurrentTimeline(player, timeline) {
  const timelines = getTimelines(player);

  if (!timelines.includes(timeline)) return false;

  Tools.setDynamicProperty(player, "currentTimeline", timeline);
  syncKeyframeMarkers(player);
  return true;
}

export function getTimelineIndex(player, timelineName) {
  const timelines = getTimelines(player);
  return timelines.indexOf(timelineName);
}

export function deleteTimeline(player, timelineName) {
  const timelines = getTimelines(player);

  if (!timelines.includes(timelineName)) {
    return false;
  }
  Tools.setDynamicProperty(player, timelineName, undefined);

  const atual = Tools.getDynamicProperty(player, "currentTimeline");
  if (atual === timelineName) {
    Tools.setDynamicProperty(player, "currentTimeline", "");
  }

  syncKeyframeMarkers(player);

  Tools.playSuccess(player);
  player.sendMessage(
    Tools.t("sys.msg.success.timeline_deleted", [timelineName]),
  );
  return true;
}
