import { editKeyframe_UI } from "../ui/editKeyframesUi";
import { Tools } from "../utils/index";
import { createTimeline, getTimeline, saveTimeline } from "./timelineService";

export function createKeyframe(player) {
  return {
    name: undefined,
    position: getHeadPosition(player),
    rotation: getPlayerRotation(player),
    dimension: getDimension(player),
  };
}

export function addKeyframe(player, keyframe) {
  let timeline = getTimeline(player);

  if (timeline === undefined) {
    timeline = createTimeline(player);
  }

  timeline.keyframes.push(keyframe);

  saveTimeline(player, timeline);
}

function getHeadPosition(player) {
  const head = player.getHeadLocation();

  for (const key in head) {
    head[key] = Number(head[key].toFixed(2));
  }
  return head;
}

function getPlayerRotation(player) {
  const { x, y } = player.getRotation();

  return {
    pitch: Number(x).toFixed(2),
    yaw: Number(y).toFixed(2),
  };
}
function getPlayerName(player) {
  return player.name;
}

function getDimension(player) {
  return player.dimension;
}

export function redoKeyframe(player, keyframeIndex) {
  Tools.setDynamicProperty(player, "editKeyframe", keyframeIndex);
  player.addTag("editKeyframe");
}

export function validateEditKeyframeForm(player, keyframeIndex, response) {
  const quantidade = response.filter((valor) => valor === true).length;

  if (quantidade > 1) {
    console.warn("Favor marcar apenas uma opção.");
    return editKeyframe_UI(player, keyframeIndex);
  }
}

export function renameKeyframe(player, keyframeIndex, currentName, newName) {
  const timeline = getTimeline(player);

  if (newName === currentName || newName === "") {
    newName = undefined;
  }
  timeline.keyframes[keyframeIndex].name = newName;
  saveTimeline(player, timeline);
}

export function delKeyframe(player, keyframeIndex) {
  const timeline = getTimeline(player);
  console.warn(keyframeIndex);
  console.warn(timeline.keyframes.length);

  timeline.keyframes.splice(keyframeIndex, 1);
  saveTimeline(player, timeline);
}

export function getKeyframe(player, keyframeIndex) {
  const timeline = getTimeline(player);

  return timeline.keyframes[keyframeIndex];
}
