import { system, world } from "@minecraft/server";
import { getTimeline } from "./timelineService.js";
import { isPlaying, buildSmoothPath, arcLengthToU } from "./playCamera.js";
import { Tools } from "../utils/index.js";

const VISIBLE_PROPERTY = "showKeyframeMarkers";

// A partícula "playmod:mark_point_20" é reaproveitada pra qualquer
// keyframe além do vigésimo (não temos textura numerada além disso).
const MAX_NUMBERED_MARKERS = 20;

// A cada quantos ticks os marcadores/rota são redesenhados. 2 = 10x/seg
// — suficiente pra parecer "ao vivo" sem gerar partícula demais.
const REDRAW_INTERVAL_TICKS = 2;

// Distância mínima (blocos) entre pontos consecutivos da rota, pra não
// spammar partícula em trechos muito próximos.
const TRAIL_MIN_SPACING = 0.3;

/** true se o jogador optou por ver os marcadores dos keyframes. */
export function areMarkersVisible(player) {
  return Tools.getDynamicProperty(player, VISIBLE_PROPERTY) ?? false;
}

/** Liga/desliga a visualização (chamado pelo toggle em editAllKeyframesUI). */
export function setKeyframeMarkersVisible(player, visible) {
  Tools.setDynamicProperty(player, VISIBLE_PROPERTY, visible);
}

function distanceSquared(a, b) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  const dz = a.z - b.z;
  return dx * dx + dy * dy + dz * dz;
}

function drawTrail(keyframes, dimension) {
  // Reaproveita a MESMA spline centrípeta usada na reprodução de
  // verdade (playCamera.js) — a rota mostrada é garantidamente igual
  // ao caminho que a câmera vai percorrer, não uma aproximação à parte.
  const { positionEval, positionTable } = buildSmoothPath(keyframes);
  if (positionTable.total === 0) return;

  // Amostragem adaptativa: mais pontos pra caminhos mais longos, com
  // um teto pra não pesar em timelines muito extensas.
  const steps = Math.max(
    10,
    Math.min(200, Math.floor(positionTable.total * 2)),
  );

  let last = null;
  for (let i = 0; i <= steps; i++) {
    const length = (positionTable.total * i) / steps;
    const u = arcLengthToU(positionTable, length);
    const position = positionEval(u);

    if (!last || distanceSquared(position, last) >= TRAIL_MIN_SPACING ** 2) {
      try {
        dimension.spawnParticle("playmod:path_trail", position);
      } catch {}
      last = position;
    }
  }
}

function drawMarkersForPlayer(player) {
  if (!areMarkersVisible(player)) return;
  // Enquanto a animação está rodando (tocando ou pausada), os
  // marcadores ficam escondidos — não precisa de nenhuma chamada
  // especial pra isso, só não desenhar nesse frame.
  if (isPlaying(player)) return;

  const timeline = getTimeline(player);
  const keyframes = timeline?.keyframes;
  if (!keyframes || keyframes.length === 0) return;

  keyframes.forEach((keyframe, index) => {
    const markerNum = Math.min(index + 1, MAX_NUMBERED_MARKERS);
    try {
      const dimension = world.getDimension(keyframe.dimension);
      dimension.spawnParticle(`playmod:mark_point_${markerNum}`, keyframe.position);
    } catch {}
  });

  // A rota só faz sentido dentro de uma única dimensão contínua — usa
  // a dimensão do primeiro keyframe (mesma limitação que a própria
  // reprodução já tem hoje ao tratar a timeline como um caminho só).
  if (keyframes.length > 1) {
    try {
      const dimension = world.getDimension(keyframes[0].dimension);
      drawTrail(keyframes, dimension);
    } catch {}
  }
}

/**
 * Inicia o loop que redesenha marcadores numerados + rota pra todo
 * jogador com a preferência ligada. Substitui por completo o antigo
 * sistema baseado em entidade — sem entidade, não tem mais nenhuma
 * checagem de sobrevivência, anti-kill ou anti-teleporte pra fazer.
 */
export function startKeyframeMarkerLoop() {
  system.runInterval(() => {
    for (const player of world.getAllPlayers()) {
      try {
        drawMarkersForPlayer(player);
      } catch {}
    }
  }, REDRAW_INTERVAL_TICKS);
}
