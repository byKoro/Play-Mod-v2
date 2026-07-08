import { Tools } from "../utils/index";
import {
  createTimeline,
  getTimeline,
  limitTimelineKeyframes,
  saveTimeline,
  validateTimelineDimension,
} from "./timelineService";
import { editKeyframe_UI } from "../ui/index";

// Se `override` for passado ({ position, rotation, dimension }), usa
// esses valores em vez de ler a posição/rotação atual do jogador — é
// o que permite o flycam colocar um keyframe na posição virtual da
// câmera voadora, não na posição real do corpo do jogador.
export function createKeyframe(player, override = null) {
  return {
    name: "",
    position: override?.position ?? getHeadPosition(player),
    rotation: override?.rotation ?? getPlayerRotation(player),
    dimension: override?.dimension ?? getDimension(player),
  };
}

export function addKeyframe(player, keyframe) {
  let timeline = getTimeline(player);

  if (!timeline) {
    timeline = createTimeline(player);
  }

  timeline.keyframes.push(keyframe);
  saveTimeline(player, timeline);

  Tools.playSuccess(player);
  player.sendMessage(Tools.t("sys.msg.success.keyframe_set"));
}

/** Insere um keyframe ANTES do índice dado (empurra os seguintes). */
export function insertKeyframeAt(player, index, keyframe) {
  const timeline = getTimeline(player);
  if (!timeline) return false;

  const clampedIndex = Math.max(0, Math.min(index, timeline.keyframes.length));
  timeline.keyframes.splice(clampedIndex, 0, keyframe);
  saveTimeline(player, timeline);

  Tools.playSuccess(player);
  player.sendMessage(Tools.t("sys.msg.success.keyframe_set"));
  return true;
}

/** Substitui o keyframe no índice dado por um novo. */
export function replaceKeyframe(player, index, keyframe) {
  const timeline = getTimeline(player);
  if (!timeline?.keyframes[index]) return false;

  timeline.keyframes[index] = keyframe;
  saveTimeline(player, timeline);

  Tools.playSuccess(player);
  player.sendMessage(Tools.t("sys.msg.success.keyframe_updated"));
  return true;
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

// Prepara (ou cria) a timeline atual e roda as checagens de limite e
// dimensão que TODO caminho de colocar keyframe precisa passar —
// usado tanto pelo fluxo clássico (setKeyframe) quanto pelo flycam
// (placeFlycamKeyframe), pra manter as duas formas sempre consistentes.
function prepareKeyframePlacement(player) {
  let timeline = getTimeline(player);

  if (!timeline) {
    timeline = createTimeline(player);
    saveTimeline(player, timeline);
  }

  if (limitTimelineKeyframes(player)) return null;
  if (!validateTimelineDimension(player, timeline)) return null;

  return timeline;
}

export function redoKeyframe(player, keyframeIndex, value) {
  if (value) {
    Tools.setDynamicProperty(player, "editKeyframe", keyframeIndex);
    player.addTag("editKeyframe");
    return true;
  }
  return false;
}

/** Equivalente a redoKeyframe, mas pro fluxo de INSERIR sem flycam. */
export function requestInsertKeyframe(player, index) {
  Tools.setDynamicProperty(player, "insertKeyframe", index);
  player.addTag("insertKeyframe");
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
    Tools.playSuccess(player);
    player.sendMessage(Tools.t("sys.msg.success.frame_removed"));
  } else {
    Tools.playError(player);
    player.sendMessage(Tools.t("sys.error.no_keyframes"));
  }
}

// Fluxo clássico: chamado quando o jogador usa o item ativador "no
// mundo" (não em flycam). Cobre os 3 casos possíveis conforme a tag
// que o jogador estiver carregando: regravar (editKeyframe), inserir
// (insertKeyframe), ou adicionar no fim (nenhuma das duas).
// Abaixo disso é o "vazio" do mundo — não faz sentido gravar câmera lá.
const MIN_KEYFRAME_Y = -64;

function validateKeyframeHeight(player, keyframe) {
  if (keyframe.position.y < MIN_KEYFRAME_Y) {
    Tools.playError(player);
    player.sendMessage(Tools.t("sys.error.below_world", [MIN_KEYFRAME_Y]));
    return false;
  }
  return true;
}

export function setKeyframe(player) {
  const timeline = prepareKeyframePlacement(player);
  if (!timeline) return;

  const keyframe = createKeyframe(player);
  if (!validateKeyframeHeight(player, keyframe)) return;

  if (player.getTags().includes("editKeyframe")) {
    const keyframeIndex = Number(
      Tools.getDynamicProperty(player, "editKeyframe"),
    );
    if (isNaN(keyframeIndex) || !timeline.keyframes[keyframeIndex]) return;

    player.removeTag("editKeyframe");
    replaceKeyframe(player, keyframeIndex, keyframe);
    return editKeyframe_UI(player, keyframeIndex);
  }

  if (player.getTags().includes("insertKeyframe")) {
    const insertIndex = Number(
      Tools.getDynamicProperty(player, "insertKeyframe"),
    );
    player.removeTag("insertKeyframe");
    if (!isNaN(insertIndex)) insertKeyframeAt(player, insertIndex, keyframe);
    return;
  }

  addKeyframe(player, keyframe);
}

// Fluxo flycam: chamado a cada ponto colocado durante o voo, com a
// posição/rotação virtual da câmera (não a do corpo do jogador) e o
// modo definido no início do voo (append/insert/replace).
export function placeFlycamKeyframe(player, override, mode) {
  const timeline = prepareKeyframePlacement(player);
  if (!timeline) return false;

  const keyframe = createKeyframe(player, override);
  if (!validateKeyframeHeight(player, keyframe)) return false;

  if (mode.kind === "replace") {
    return replaceKeyframe(player, mode.index, keyframe);
  }

  if (mode.kind === "insert") {
    return insertKeyframeAt(player, mode.index, keyframe);
  }

  addKeyframe(player, keyframe);
  return true;
}
