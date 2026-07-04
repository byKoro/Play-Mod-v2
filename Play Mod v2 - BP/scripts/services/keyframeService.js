import { listKeyframe_UI } from "../ui/listKeyframeUi";
import { Tools } from "../utils/index";
import {
  createTimeline,
  getTimeline,
  saveTimeline,
  validateTimelineDimension,
} from "./timelineService";
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
  return player.dimension.id;
}

export function redoKeyframe(player, keyframeIndex, value) {
  if (value) {
    Tools.setDynamicProperty(player, "editKeyframe", keyframeIndex);
    player.addTag("editKeyframe");
    return true;
  }
}

export function validateEditKeyframeForm(player, keyframeIndex, response) {
  const quantidade = response.filter((valor) => valor === true).length;

  if (quantidade > 1) {
    return editKeyframe_UI(player, keyframeIndex);
  }
}

export function renameKeyframe(player, keyframeIndex, currentName, newName) {
  const timeline = getTimeline(player);

  if (newName === currentName || newName === "") {
    newName = "";
  }
  timeline.keyframes[keyframeIndex].name = newName;
  saveTimeline(player, timeline);
}

export function delKeyframe(player, keyframeIndex, value) {
  if (value) {
    const timeline = getTimeline(player);

    timeline.keyframes.splice(keyframeIndex, 1);
    saveTimeline(player, timeline);

    return true;
  }
}

export function getKeyframe(player, keyframeIndex) {
  const timeline = getTimeline(player);

  if (!timeline) {
    throw new Error("Timeline não encontrada");
  }

  if (!timeline.keyframes) {
    throw new Error("Timeline sem keyframes");
  }

  if (!timeline.keyframes[keyframeIndex]) {
    throw new Error(`Keyframe ${keyframeIndex} não existe`);
  }

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
  const keyframe = timeline.keyframes[index];

  if (!keyframe) return false;

  const pos = Tools.parseVector3(text);

  // garante base segura
  keyframe.position = {
    x: keyframe.position?.x ?? 0,
    y: keyframe.position?.y ?? 0,
    z: keyframe.position?.z ?? 0,
    ...pos,
  };

  saveTimeline(player, timeline);
  return true;
}

export function setKeyframeRotation(player, index, text) {
  const timeline = getTimeline(player);
  const keyframe = timeline.keyframes[index];

  if (!keyframe) return false;

  const rot = Tools.parseVector3(text);

  // base segura
  keyframe.rotation = {
    pitch: keyframe.rotation?.pitch ?? 0,
    yaw: keyframe.rotation?.yaw ?? 0,
    ...rot,
  };

  saveTimeline(player, timeline);
  return true;
}

export function delLastKeyframe(player) {
  const timeline = getTimeline(player);
  timeline.keyframes.pop();
  saveTimeline(player, timeline);
}

export function setKeyframe(player) {
  const timeline = getTimeline(player);

  if (!validateTimelineDimension(player, timeline)) return;

  const keyframe = createKeyframe(player);

  if (player.getTags().includes("editKeyframe")) {
    const keyframeIndex = Number(
      Tools.getDynamicProperty(player, "editKeyframe"),
    );

    const timeline = Tools.getDynamicProperty(player, "timeline");
    timeline.keyframes[keyframeIndex] = keyframe;

    saveTimeline(player, timeline);

    player.removeTag("editKeyframe");
    return editKeyframe_UI(player, keyframeIndex);
  } else {
    addKeyframe(player, keyframe);
  }
}
