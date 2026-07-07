import { Tools } from "../utils/index";
import {
  createTimeline,
  getTimeline,
  limitTimelineKeyframes,
  saveTimeline,
  validateTimelineDimension,
} from "./timelineService";
import { syncKeyframeMarkers } from "./keyframeMarkerService.js";
import { editKeyframe_UI } from "../ui/index";

export function createKeyframe(player) {
  return {
    name: "",
    position: getHeadPosition(player),
    rotation: getPlayerRotation(player),
    dimension: getDimension(player),
  };
}

export function addKeyframe(player, keyframe) {
  let timeline = getTimeline(player);

  if (!timeline) {
    timeline = createTimeline(player);
  }

  timeline.keyframes.push(keyframe);
  saveTimeline(player, timeline);
  syncKeyframeMarkers(player);

  Tools.playSuccess(player);
  player.sendMessage(Tools.t("sys.msg.success.keyframe_set"));
}

function getHeadPosition(player) {
  const head = player.getHeadLocation();
  return {
    x: Number(head.x.toFixed(2)),
    y: Number(head.y.toFixed(2)),
    z: Number(head.z.toFixed(2)),
  };
}

function getPlayerRotation(player) {
  const { x, y } = player.getRotation();
  return {
    pitch: Number(x.toFixed(2)), // Corrigido: Agora salva como Number
    yaw: Number(y.toFixed(2)), // Corrigido: Agora salva como Number
  };
}

function getPlayerName(player) {
  return player.name;
}

function getDimension(player) {
  return player.dimension.id;
}

export function redoKeyframe(player, keyframeIndex, value) {
  if (value) {
    Tools.setDynamicProperty(player, "editKeyframe", keyframeIndex);
    player.addTag("editKeyframe");
    return true;
  }
  return false;
}

/**
 * Valida se o player marcou mais de uma opção conflitante no modal de edição
 * (ex: "Regravar" + "Deletar" ao mesmo tempo). Não decide nada por conta
 * própria — só informa se está tudo certo (true) ou se há conflito (false).
 */
export function validateEditKeyframeForm(player, keyframeIndex, response) {
  const quantidade = response.filter((valor) => valor === true).length;
  return quantidade <= 1;
}

export function renameKeyframe(player, keyframeIndex, currentName, newName) {
  const timeline = getTimeline(player);
  if (!timeline?.keyframes[keyframeIndex]) return;

  if (newName === currentName || newName.trim() === "") {
    newName = "";
  }
  timeline.keyframes[keyframeIndex].name = newName;
  saveTimeline(player, timeline);
}

export function delKeyframe(player, keyframeIndex, value) {
  if (value) {
    const timeline = getTimeline(player);
    if (!timeline?.keyframes) return false;

    timeline.keyframes.splice(keyframeIndex, 1);
    saveTimeline(player, timeline);
    syncKeyframeMarkers(player);

    Tools.playSuccess(player);
    player.sendMessage(Tools.t("sys.msg.success.keyframe_deleted"));
    return true;
  }
  return false;
}

export function getKeyframe(player, keyframeIndex) {
  const timeline = getTimeline(player);

  if (!timeline) throw new Error("Timeline não encontrada");
  if (!timeline.keyframes) throw new Error("Timeline sem keyframes");
  if (!timeline.keyframes[keyframeIndex])
    throw new Error(`Keyframe ${keyframeIndex} não existe`);

  return timeline.keyframes[keyframeIndex];
}

export function getKeyframePos(player, keyframeIndex) {
  return getKeyframe(player, keyframeIndex).position;
}

export function getKeyframeRot(player, keyframeIndex) {
  return getKeyframe(player, keyframeIndex).rotation;
}

export function setKeyframePosition(player, index, text) {
  const timeline = getTimeline(player);
  const keyframe = timeline?.keyframes[index];
  if (!keyframe) return false;

  const pos = Tools.parseVector3(text);

  keyframe.position = {
    x: Number((pos.x ?? keyframe.position?.x ?? 0).toFixed(2)),
    y: Number((pos.y ?? keyframe.position?.y ?? 0).toFixed(2)),
    z: Number((pos.z ?? keyframe.position?.z ?? 0).toFixed(2)),
  };

  saveTimeline(player, timeline);
  syncKeyframeMarkers(player);
  return true;
}

export function setKeyframeRotation(player, index, text) {
  const timeline = getTimeline(player);
  const keyframe = timeline?.keyframes[index];
  if (!keyframe) return false;

  const rot = Tools.parseVector3(text); // Assume que parseVector3 retorne propriedades X e Y

  // Corrigido: Mapeando propriedades X e Y do vetor para Pitch e Yaw
  keyframe.rotation = {
    pitch: Number((rot.x ?? keyframe.rotation?.pitch ?? 0).toFixed(2)),
    yaw: Number((rot.y ?? keyframe.rotation?.yaw ?? 0).toFixed(2)),
  };

  saveTimeline(player, timeline);
  return true;
}

export function delLastKeyframe(player) {
  const timeline = getTimeline(player);
  if (timeline && timeline.keyframes.length > 0) {
    timeline.keyframes.pop();
    saveTimeline(player, timeline);
    syncKeyframeMarkers(player);
    Tools.playSuccess(player);
    player.sendMessage(Tools.t("sys.msg.success.frame_removed"));
  } else {
    Tools.playError(player);
    player.sendMessage(Tools.t("sys.error.no_keyframes"));
  }
}

export function setKeyframe(player) {
  let timeline = getTimeline(player);

  if (!timeline) {
    timeline = createTimeline(player);
    saveTimeline(player, timeline);
  }

  if (limitTimelineKeyframes(player)) return;
  if (!validateTimelineDimension(player, timeline)) return;

  const keyframe = createKeyframe(player);

  if (player.getTags().includes("editKeyframe")) {
    const keyframeIndex = Number(
      Tools.getDynamicProperty(player, "editKeyframe"),
    );

    if (isNaN(keyframeIndex) || !timeline.keyframes[keyframeIndex]) return;

    timeline.keyframes[keyframeIndex] = keyframe;
    saveTimeline(player, timeline);
    syncKeyframeMarkers(player);

    player.removeTag("editKeyframe");

    Tools.playSuccess(player);
    player.sendMessage(Tools.t("sys.msg.success.keyframe_updated"));

    return editKeyframe_UI(player, keyframeIndex);
  }

  addKeyframe(player, keyframe);
}
