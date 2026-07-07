import { system, world } from "@minecraft/server";
import { getTimeline, getCurrentTimeline } from "./timelineService.js";
import { editKeyframe_UI } from "../ui/index.js";
import { Tools } from "../utils/index.js";

const MARKER_TYPE_ID = "playmod:keyframe_marker";
const VISIBLE_PROPERTY = "showKeyframeMarkers";

// Dynamic properties gravadas em CADA entidade marcadora (não no
// jogador), pra sabermos a quem ela pertence e onde ela deveria estar
// — usado tanto pelo respawn após /kill quanto pela checagem
// anti-teleporte.
const OWNER_PROPERTY = "ownerId";
const POSITION_PROPERTY = "correctPosition";
const DIMENSION_PROPERTY = "correctDimension";

// Distância (em blocos) tolerada antes de considerar que a entidade foi
// deslocada e precisa voltar pro lugar certo.
const DRIFT_TOLERANCE = 0.1;

const ALL_DIMENSIONS = [
  "minecraft:overworld",
  "minecraft:nether",
  "minecraft:the_end",
];

// Lista em memória de todas as entidades marcadoras vivas nessa sessão
// (entityId -> { entity, ownerId }). Existe pra evitar ter que varrer
// as 3 dimensões inteiras (dimension.getEntities) toda vez que
// precisamos remover ou checar os marcadores — isso é caro e era
// chamado com bastante frequência (toda edição de keyframe + o guard
// anti-teleporte 1x/segundo). Com essa lista, essas operações passam a
// ser O(número de marcadores), sem nenhuma consulta ao mundo.
const trackedMarkers = new Map();

function getMarkerTag(player) {
  return `playmod_marker_${player.id}`;
}

/** true se o jogador optou por ver os marcadores dos keyframes. */
export function areMarkersVisible(player) {
  return Tools.getDynamicProperty(player, VISIBLE_PROPERTY) ?? false;
}

/**
 * Remoção rápida (só usa a lista em memória) — usada em todo o fluxo
 * normal (adicionar/editar/deletar keyframe, trocar timeline, etc.).
 */
function removeTrackedMarkersOf(player) {
  for (const [id, info] of trackedMarkers) {
    if (info.ownerId !== player.id) continue;
    if (info.entity.isValid) info.entity.remove();
    trackedMarkers.delete(id);
  }
}

/**
 * Remoção "de verdade" (consulta o mundo nas 3 dimensões) — mais cara,
 * por isso só é usada no login do jogador, pra pegar marcadores de uma
 * sessão anterior que a lista em memória não conhece mais (ela é
 * zerada toda vez que o mundo é recarregado, mas as entidades em si
 * continuam salvas no mundo).
 */
function purgeStaleMarkersOf(player) {
  const tag = getMarkerTag(player);

  for (const dimensionId of ALL_DIMENSIONS) {
    const dimension = world.getDimension(dimensionId);
    for (const entity of dimension.getEntities({
      type: MARKER_TYPE_ID,
      tags: [tag],
    })) {
      entity.remove();
      trackedMarkers.delete(entity.id);
    }
  }
}

function spawnMarker(player, keyframe, keyframeIndex) {
  const dimension = world.getDimension(keyframe.dimension);
  const entity = dimension.spawnEntity(MARKER_TYPE_ID, keyframe.position);

  entity.addTag(getMarkerTag(player));
  entity.nameTag = "";

  Tools.setDynamicProperty(entity, OWNER_PROPERTY, player.id);
  Tools.setDynamicProperty(entity, POSITION_PROPERTY, keyframe.position);
  Tools.setDynamicProperty(entity, DIMENSION_PROPERTY, keyframe.dimension);
  Tools.setDynamicProperty(entity, "keyframeIndex", keyframeIndex);

  trackedMarkers.set(entity.id, { entity, ownerId: player.id });
}

/**
 * Reconstrói do zero os marcadores do jogador a partir da timeline
 * atual. Chamado sempre que uma keyframe é adicionada/editada/removida
 * ou a timeline atual muda — desde que o toggle esteja ligado e a
 * animação não esteja rodando (ver hideKeyframeMarkers).
 */
export function syncKeyframeMarkers(player) {
  removeTrackedMarkersOf(player);

  if (!areMarkersVisible(player)) return;

  const timeline = getTimeline(player);
  if (!timeline?.keyframes) return;

  timeline.keyframes.forEach((keyframe, index) => {
    spawnMarker(player, keyframe, index);
  });
}

/**
 * Liga/desliga a visualização dos marcadores (chamado pelo novo toggle
 * no menu de editar todos os keyframes).
 */
export function setKeyframeMarkersVisible(player, visible) {
  Tools.setDynamicProperty(player, VISIBLE_PROPERTY, visible);
  syncKeyframeMarkers(player);
}

/**
 * Some com os marcadores sem mexer na preferência do jogador — chamado
 * quando a animação começa a rodar (playCamera.iniciar).
 */
export function hideKeyframeMarkers(player) {
  removeTrackedMarkersOf(player);
}

/**
 * Traz os marcadores de volta se o jogador tiver a preferência ligada
 * — chamado quando a animação para (playCamera.stopAnimation).
 */
export function restoreKeyframeMarkersIfEnabled(player) {
  if (!areMarkersVisible(player)) return;
  syncKeyframeMarkers(player);
}

/**
 * Segurança de login: limpa qualquer marcador que tenha sobrado de uma
 * sessão anterior (a lista em memória não sabe mais deles, por isso
 * aqui é a única hora em que fazemos a busca "de verdade" no mundo) e
 * então reconstrói do zero a partir do estado salvo.
 */
export function resetKeyframeMarkersOnJoin(player) {
  purgeStaleMarkersOf(player);
  syncKeyframeMarkers(player);
}

// --- Clique direito no marker abre a edição daquele keyframe ---------

world.afterEvents.playerInteractWithEntity.subscribe((ev) => {
  const { player, target } = ev;
  if (target.typeId !== MARKER_TYPE_ID) return;

  // Só o dono desse keyframe pode editar clicando na entidade.
  const ownerId = Tools.getDynamicProperty(target, OWNER_PROPERTY);
  if (ownerId !== player.id) return;

  const keyframeIndex = Tools.getDynamicProperty(target, "keyframeIndex");
  if (keyframeIndex === undefined) return;

  editKeyframe_UI(player, keyframeIndex);
});

// --- Segurança contra remoção/deslocamento externo -------------------

function findOwnerPlayer(ownerId) {
  return world.getAllPlayers().find((p) => p.id === ownerId);
}

world.afterEvents.entityDie.subscribe((ev) => {
  const dead = ev.deadEntity;
  if (dead.typeId !== MARKER_TYPE_ID) return;

  trackedMarkers.delete(dead.id);

  const ownerId = Tools.getDynamicProperty(dead, OWNER_PROPERTY);
  const position = Tools.getDynamicProperty(dead, POSITION_PROPERTY);
  const dimensionId = Tools.getDynamicProperty(dead, DIMENSION_PROPERTY);
  const keyframeIndex = Tools.getDynamicProperty(dead, "keyframeIndex");

  if (!ownerId || !position || !dimensionId) return;

  // Só recria no próximo tick (a entidade morta ainda está sendo
  // processada nesse exato instante).
  system.run(() => {
    const player = findOwnerPlayer(ownerId);
    if (!player || !player.isValid) return;
    if (!areMarkersVisible(player)) return;

    // Confere se o keyframe correspondente ainda existe e ainda é essa
    // posição — evita recriar um marcador "fantasma" de um keyframe que
    // foi legitimamente deletado bem na hora do /kill.
    const timeline = getTimeline(player);
    const keyframe = timeline?.keyframes?.[keyframeIndex];
    if (!keyframe) return;
    if (
      keyframe.position.x !== position.x ||
      keyframe.position.y !== position.y ||
      keyframe.position.z !== position.z
    ) {
      return;
    }

    spawnMarker(player, keyframe, keyframeIndex);
  });
});

/**
 * Checagem periódica (NÃO a cada tick — 1x por segundo) que corrige
 * qualquer marcador deslocado por /tp ou qualquer outro meio externo.
 * Não existe evento nativo de "entidade foi teleportada", então essa é
 * a única forma de detectar isso. Usa só a lista em memória — nenhuma
 * consulta ao mundo — então o custo é mínimo mesmo rodando 1x/segundo.
 */
export function startMarkerDriftGuard() {
  system.runInterval(() => {
    for (const [id, info] of trackedMarkers) {
      const entity = info.entity;

      if (!entity.isValid) {
        trackedMarkers.delete(id);
        continue;
      }

      const correctPos = Tools.getDynamicProperty(entity, POSITION_PROPERTY);
      if (!correctPos) continue;

      const current = entity.location;
      const dx = Math.abs(current.x - correctPos.x);
      const dy = Math.abs(current.y - correctPos.y);
      const dz = Math.abs(current.z - correctPos.z);

      if (
        dx > DRIFT_TOLERANCE ||
        dy > DRIFT_TOLERANCE ||
        dz > DRIFT_TOLERANCE
      ) {
        entity.teleport(correctPos, { dimension: entity.dimension });
      }
    }
  }, 20);
}
