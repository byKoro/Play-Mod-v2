import { system, EasingType, TicksPerSecond } from "@minecraft/server";
import { getCurrentTimeline } from "../services/index.js";
import {
  getPlayOptions,
  applyControlScheme,
} from "../services/playOptionsService.js";
import { lockActivatorItem, unlockActivatorItem } from "./itemGuardService.js";
import { isInPreset } from "./presetCameraService.js";
import { Tools } from "../utils/index.js";

// Tag aplicada ao jogador enquanto a animação está rodando (tocando ou
// pausada). É usada pelo main.js pra decidir se o item ativador deve
// abrir o menu principal ou o menu de controle de reprodução.
const PLAYING_TAG = "playing";

// Estado de reprodução em memória, por jogador (chave = player.id).
// Guardado aqui (e não em dynamic property) porque contém IDs de
// runInterval/runTimeout e funções de avaliação da spline, que não
// podem ser serializados.
const activePlaybacks = new Map();

// ============================================================
// CONFIGURAÇÕES DE SUAVIZAÇÃO
// ============================================================

// Quantas amostras por segmento são usadas pra montar a tabela de
// comprimento de arco (velocidade constante). Mais = mais preciso,
// mas mais cálculo na hora de iniciar a timeline (feito só uma vez).
const ARC_LENGTH_SAMPLES_PER_SEGMENT = 24;

// A cada quantos ticks a câmera é reposicionada.
// 1 = atualiza 20x/seg (máxima suavidade). 2 = 10x/seg (mais leve).
const UPDATE_INTERVAL_TICKS = 1;

// Duração do ease aplicado a CADA atualização de posição durante a
// reprodução. Um valor maior que o intervalo de atualização (que a 1
// tick seria só 0.05s) sobrepõe levemente o ease da atualização
// anterior com a próxima, suavizando qualquer "degrau" residual da
// transição de um ponto calculado pro outro. 0.1s (2 ticks) é hoje o
// padrão usado por outros addons de câmera consolidados no mercado.
const CAMERA_UPDATE_EASE_SECONDS = 0.1;

// Alpha da spline Catmull-Rom centrípeta. 0.5 evita loops e "overshoot"
// quando as keyframes estão desigualmente espaçadas. Não recomendo mudar.
const CATMULL_ROM_ALPHA = 0.5;

function secondsToTicks(seconds) {
  return Math.max(1, Math.round(seconds * TicksPerSecond));
}

// ============================================================
// MATEMÁTICA BÁSICA
// ============================================================
function lerp(a, b, t) {
  return a + (b - a) * t;
}

function lerpVec(a, b, t) {
  return { x: lerp(a.x, b.x, t), y: lerp(a.y, b.y, t), z: lerp(a.z, b.z, t) };
}

function lerpRotation(a, b, t) {
  return { pitch: lerp(a.pitch, b.pitch, t), yaw: lerp(a.yaw, b.yaw, t) };
}

function positionDistance(a, b) {
  return Tools.getDistance(a, b);
}

// "Distância" angular entre duas rotações (pitch/yaw tratados como plano 2D).
function rotationDistance(a, b) {
  const dPitch = a.pitch - b.pitch;
  const dYaw = a.yaw - b.yaw;
  return Math.sqrt(dPitch * dPitch + dYaw * dYaw);
}

// ============================================================
// DESENROLAR ÂNGULOS
// Evita que o yaw dê a volta pelo lado errado (ex: de 170° pra -170°
// deveria continuar girando pra frente através de 180°, não voltar por 0°).
// ============================================================
function unwrapAngles(angles) {
  const result = [angles[0]];

  for (let i = 1; i < angles.length; i++) {
    let diff = angles[i] - result[i - 1];
    diff = ((((diff + 180) % 360) + 360) % 360) - 180; // normaliza pra [-180, 180)
    result.push(result[i - 1] + diff);
  }

  return result;
}

// ============================================================
// SPLINE CATMULL-ROM CENTRÍPETA (genérica: funciona pra posição 3D
// e pra rotação, já que só faz combinações lineares dos componentes)
//
// Ao contrário do corte de cantos (Chaikin), essa curva tem VELOCIDADE
// CONTÍNUA em cada keyframe — não existe "quina" nenhuma na tangente,
// o que resolve a brusquidão residual, especialmente perceptível na rotação.
// ============================================================
function lerpAt(a, b, ta, tb, t, lerpFn) {
  if (tb === ta) return a;
  const f = (t - ta) / (tb - ta);
  return lerpFn(a, b, f);
}

function catmullRomPoint(p0, p1, p2, p3, t, distFn, lerpFn, alpha) {
  const d01 = Math.max(distFn(p0, p1), 1e-6);
  const d12 = Math.max(distFn(p1, p2), 1e-6);
  const d23 = Math.max(distFn(p2, p3), 1e-6);

  const t0 = 0;
  const t1 = t0 + Math.pow(d01, alpha);
  const t2 = t1 + Math.pow(d12, alpha);
  const t3 = t2 + Math.pow(d23, alpha);

  const tt = t1 + t * (t2 - t1);

  const A1 = lerpAt(p0, p1, t0, t1, tt, lerpFn);
  const A2 = lerpAt(p1, p2, t1, t2, tt, lerpFn);
  const A3 = lerpAt(p2, p3, t2, t3, tt, lerpFn);

  const B1 = lerpAt(A1, A2, t0, t2, tt, lerpFn);
  const B2 = lerpAt(A2, A3, t1, t3, tt, lerpFn);

  return lerpAt(B1, B2, t1, t2, tt, lerpFn);
}

// Monta um avaliador de spline pra uma lista de pontos de controle.
// u vai de 0 até (points.length - 1); pontos fantasmas nas pontas são
// só a duplicação do primeiro/último ponto (evita overshoot na extremidade).
function makeSplineEvaluator(points, distFn, lerpFn, alpha) {
  const n = points.length;

  const getControlPoint = (i) => {
    if (i < 0) return points[0];
    if (i >= n) return points[n - 1];
    return points[i];
  };

  return (u) => {
    const clamped = Math.max(0, Math.min(u, n - 1));
    const seg = Math.min(Math.floor(clamped), n - 2);
    const t = clamped - seg;

    const p0 = getControlPoint(seg - 1);
    const p1 = getControlPoint(seg);
    const p2 = getControlPoint(seg + 1);
    const p3 = getControlPoint(seg + 2);

    return catmullRomPoint(p0, p1, p2, p3, t, distFn, lerpFn, alpha);
  };
}

// ============================================================
// TABELA DE COMPRIMENTO DE ARCO
// Permite andar em velocidade constante ao longo da curva (a spline,
// por si só, não anda em velocidade uniforme em função de u).
// ============================================================
function buildArcLengthTable(
  evaluator,
  segmentCount,
  samplesPerSegment,
  distFn,
) {
  const totalSamples = segmentCount * samplesPerSegment;
  const uValues = [];
  const points = [];

  for (let i = 0; i <= totalSamples; i++) {
    const u = (segmentCount * i) / totalSamples;
    uValues.push(u);
    points.push(evaluator(u));
  }

  const cumulative = [0];
  for (let i = 1; i < points.length; i++) {
    cumulative.push(cumulative[i - 1] + distFn(points[i - 1], points[i]));
  }

  return { uValues, cumulative, total: cumulative[cumulative.length - 1] };
}

// Dado um comprimento de arco alvo, retorna o parâmetro "u" correspondente
// (interpolado entre as duas amostras mais próximas da tabela).
export function arcLengthToU(table, targetLength) {
  const { uValues, cumulative, total } = table;

  if (total === 0) return 0;

  const clamped = Math.max(0, Math.min(targetLength, total));

  let lo = 0;
  let hi = cumulative.length - 1;

  while (lo < hi - 1) {
    const mid = (lo + hi) >> 1;
    if (cumulative[mid] <= clamped) lo = mid;
    else hi = mid;
  }

  const segLength = cumulative[hi] - cumulative[lo];
  const f = segLength === 0 ? 0 : (clamped - cumulative[lo]) / segLength;

  return lerp(uValues[lo], uValues[hi], f);
}

// ============================================================
// MONTA O CAMINHO (posição + rotação) A PARTIR DAS KEYFRAMES
// ============================================================
export function buildSmoothPath(keyframes) {
  const positions = keyframes.map((k) => k.position);

  const pitches = keyframes.map((k) => k.rotation.pitch);
  const yaws = unwrapAngles(keyframes.map((k) => k.rotation.yaw));
  const rotations = pitches.map((pitch, i) => ({ pitch, yaw: yaws[i] }));

  const segmentCount = keyframes.length - 1;

  const positionEval = makeSplineEvaluator(
    positions,
    positionDistance,
    lerpVec,
    CATMULL_ROM_ALPHA,
  );

  const rotationEval = makeSplineEvaluator(
    rotations,
    rotationDistance,
    lerpRotation,
    CATMULL_ROM_ALPHA,
  );

  const positionTable = buildArcLengthTable(
    positionEval,
    segmentCount,
    ARC_LENGTH_SAMPLES_PER_SEGMENT,
    positionDistance,
  );

  const rotationTable = buildArcLengthTable(
    rotationEval,
    segmentCount,
    ARC_LENGTH_SAMPLES_PER_SEGMENT,
    rotationDistance,
  );

  return { positionEval, rotationEval, positionTable, rotationTable };
}

// ============================================================
// EXECUÇÃO
// ============================================================
function setCameraTo(player, position, rotation, easeSeconds) {
  player.camera.setCamera("minecraft:free", {
    location: position,
    // setCamera espera Vector2 { x, y } (x = pitch, y = yaw).
    rotation: { x: rotation.pitch, y: rotation.yaw },
    ...(easeSeconds > 0 && {
      easeOptions: {
        easeTime: easeSeconds,
        easeType: EasingType.Linear,
      },
    }),
  });
}

// Para os timers (interval ou timeout, mesmo namespace de id no scripting
// API) de um estado de reprodução, sem tentar tocar no jogador.
function stopInternalTimers(state) {
  if (state.intervalId !== undefined) system.clearRun(state.intervalId);
  if (state.timeoutId !== undefined) system.clearRun(state.timeoutId);
  if (state.trackIntervalId !== undefined)
    system.clearRun(state.trackIntervalId);
  state.intervalId = undefined;
  state.timeoutId = undefined;
  state.trackIntervalId = undefined;
}

// Reset "bruto": limpa câmera, controlscheme, tag e trava do item.
// Não depende do estado em memória — por isso é seguro chamar mesmo
// quando activePlaybacks não tem nada pra esse jogador (ex: o mundo foi
// recarregado e o jogador ainda tem a tag de uma sessão anterior).
function rawReset(player) {
  if (!player.isValid) return;

  player.camera.clear();
  applyControlScheme(player, "none");
  if (player.getTags().includes(PLAYING_TAG)) player.removeTag(PLAYING_TAG);
  unlockActivatorItem(player);
}

// Rotação alternativa: em vez do valor gravado/interpolado da spline,
// calcula o ângulo pra mirar direto nos pés do jogador (posição atual,
// em tempo real) a partir de onde a câmera está nesse instante. Usa a
// mesma matemática de look-at já usada nos presets de câmera ao vivo.
function computeLookAtPlayerRotation(player, cameraPosition) {
  const feet = player.location;

  const dx = feet.x - cameraPosition.x;
  const dyDown = cameraPosition.y - feet.y; // positivo = câmera acima dos pés
  const dz = feet.z - cameraPosition.z;
  const horizontalDist = Math.sqrt(dx * dx + dz * dz) || 1e-6;

  const yaw = Math.atan2(-dx, dz) * (180 / Math.PI);
  const pitch = Math.atan2(dyDown, horizontalDist) * (180 / Math.PI);

  return { pitch, yaw };
}

function startInterval(player, state) {
  state.intervalId = system.runInterval(() => {
    // Segurança: se o jogador sair no meio da timeline, para o loop.
    if (!player.isValid) {
      cleanupPlaybackOnLeave(player.id);
      return;
    }

    state.elapsedTicks += UPDATE_INTERVAL_TICKS;

    if (state.elapsedTicks >= state.totalTicks) {
      if (state.loop) {
        // Corte seco de volta pro início (sem ease) e continua o mesmo loop.
        state.elapsedTicks = 0;
        const startRotation = state.lookAtPlayer
          ? computeLookAtPlayerRotation(player, state.keyframes[0].position)
          : state.keyframes[0].rotation;
        setCameraTo(player, state.keyframes[0].position, startRotation, 0);
        return;
      }

      stopAnimation(player);
      return;
    }

    const fraction = state.elapsedTicks / state.totalTicks;

    const positionU = arcLengthToU(
      state.positionTable,
      fraction * state.positionTable.total,
    );

    const position = state.positionEval(positionU);

    let rotation;
    if (state.lookAtPlayer) {
      rotation = computeLookAtPlayerRotation(player, position);
    } else {
      const rotationU = arcLengthToU(
        state.rotationTable,
        fraction * state.rotationTable.total,
      );
      rotation = state.rotationEval(rotationU);
    }

    setCameraTo(player, position, rotation, state.updateEaseSeconds);
  }, UPDATE_INTERVAL_TICKS);
}

function startSingleKeyframeTracking(player, state) {
  state.trackIntervalId = system.runInterval(() => {
    if (!player.isValid) {
      cleanupPlaybackOnLeave(player.id);
      return;
    }
    const rotation = computeLookAtPlayerRotation(player, state.position);
    setCameraTo(player, state.position, rotation, CAMERA_UPDATE_EASE_SECONDS);
  }, UPDATE_INTERVAL_TICKS);
}

export function iniciar(player) {
  if (isInPreset(player)) {
    Tools.playError(player);
    player.sendMessage(Tools.t("sys.error.camera_busy"));
    return;
  }

  const timelineName = getCurrentTimeline(player);
  const timeline = Tools.getDynamicProperty(player, timelineName);
  if (!timeline) return;

  const keyframes = timeline.keyframes;
  if (keyframes.length === 0) return;

  // Encerra qualquer execução anterior antes de começar uma nova.
  stopAnimation(player);

  // Primeira keyframe instantânea — é isso que coloca a câmera em modo
  // "free". SÓ a partir daqui o controlscheme pode ser aplicado de fato
  // (ver nota em playOptionsService.applyControlScheme).
  const { loop, controlScheme, lookAtPlayer } = getPlayOptions(player);

  const initialRotation = lookAtPlayer
    ? computeLookAtPlayerRotation(player, keyframes[0].position)
    : keyframes[0].rotation;
  setCameraTo(player, keyframes[0].position, initialRotation, 0);

  applyControlScheme(player, controlScheme);

  player.addTag(PLAYING_TAG);
  lockActivatorItem(player);

  // Apenas uma keyframe: não há caminho pra suavizar, só espera e limpa.
  // Se "olhar pro jogador" estiver ligado, ainda assim roda um interval
  // leve só pra ir atualizando a rotação (a posição fica parada).
  if (keyframes.length === 1) {
    const state = {
      kind: "single",
      paused: false,
      lookAtPlayer,
      position: keyframes[0].position,
    };
    activePlaybacks.set(player.id, state);

    if (lookAtPlayer) {
      startSingleKeyframeTracking(player, state);
    }

    state.timeoutId = system.runTimeout(() => {
      stopAnimation(player);
    }, secondsToTicks(timeline.defaultMaxTime));

    return;
  }

  const { positionEval, rotationEval, positionTable, rotationTable } =
    buildSmoothPath(keyframes);

  const state = {
    kind: "path",
    keyframes,
    positionEval,
    rotationEval,
    positionTable,
    rotationTable,
    loop,
    lookAtPlayer,
    totalTicks: secondsToTicks(timeline.defaultMaxTime),
    updateEaseSeconds: CAMERA_UPDATE_EASE_SECONDS,
    elapsedTicks: 0,
    paused: false,
  };

  activePlaybacks.set(player.id, state);
  startInterval(player, state);
}

/** true se o jogador tem uma animação rodando (tocando ou pausada). */
export function isPlaying(player) {
  return activePlaybacks.has(player.id);
}

/** true se a animação do jogador está pausada no momento. */
export function isPaused(player) {
  return activePlaybacks.get(player.id)?.paused ?? false;
}

/**
 * Pausa a animação: para de atualizar a posição/rotação da câmera,
 * mas NÃO chama player.camera.clear() — a câmera continua em modo
 * "free" parada no último ponto, e o jogador pode olhar livremente
 * ao redor com o mouse (o próprio modo free permite isso quando o
 * script não está forçando a rotação a cada tick).
 */
export function pauseAnimation(player) {
  const state = activePlaybacks.get(player.id);
  if (!state || state.paused) return;

  stopInternalTimers(state);
  state.paused = true;
}

/** Retoma a animação de onde ela parou (mesmo elapsedTicks de antes). */
export function resumeAnimation(player) {
  const state = activePlaybacks.get(player.id);
  if (!state || !state.paused) return;

  state.paused = false;

  // Keyframe única: não existe progresso pra retomar, a câmera já está
  // parada no lugar certo — só sair do estado "pausado" já basta (a
  // não ser que "olhar pro jogador" esteja ligado, aí precisa religar
  // o interval leve de rastreamento que o pause tinha derrubado).
  if (state.kind === "single") {
    if (state.lookAtPlayer) startSingleKeyframeTracking(player, state);
    return;
  }

  startInterval(player, state);
}

/**
 * Para definitivamente a animação: cancela os timers, limpa a câmera,
 * zera o controlscheme, remove a tag e libera o item ativador. Seguro
 * de chamar mesmo se não houver nada rodando (usado como "reset" antes
 * de iniciar uma nova execução).
 */
export function stopAnimation(player) {
  const state = activePlaybacks.get(player.id);
  if (state) stopInternalTimers(state);
  activePlaybacks.delete(player.id);

  rawReset(player);
}

/**
 * Limpeza leve usada quando só temos o playerId (ex: playerLeave, ou o
 * próprio loop detectando que o jogador não é mais válido). Não tenta
 * rodar comandos no jogador — só derruba os timers e o estado em memória.
 */
export function cleanupPlaybackOnLeave(playerId) {
  const state = activePlaybacks.get(playerId);
  if (!state) return;

  stopInternalTimers(state);
  activePlaybacks.delete(playerId);
}

/**
 * Segurança contra estado "preso": chamar no login do jogador. Limpa
 * qualquer resquício de uma sessão anterior mesmo que o estado em
 * memória já tenha se perdido (ex: o mundo foi fechado/recarregado com
 * a animação rodando, deixando a tag "playing" e o item travado presos
 * no save do jogador).
 */
export function resetStalePlaybackState(player) {
  cleanupPlaybackOnLeave(player.id);
  rawReset(player);
}
