import { system, EasingType, world } from "@minecraft/server";
import { isPlaying } from "./playCamera.js";
import { isInFlycam } from "./flycamService.js";
import { getPlayOptions, applyControlScheme } from "./playOptionsService.js";
import { Tools } from "../utils/index.js";

// playerId -> estado do preset ativo
const presetStates = new Map();

// Fatores de suavização (0-1): quanto maior, mais "grudado" no
// jogador; quanto menor, mais "atrasado"/cinemático.
const LOCATION_SMOOTHING = 0.18;
const ROTATION_SMOOTHING = 0.15;

// Suavização do ângulo-base nos presets "relativos". Bem mais lenta
// que as de cima de propósito: usar a rotação da CABEÇA (mouse look)
// direto faria a câmera reagir a cada micro-olhada; suavizando bem
// devagar, ela só acompanha a direção GERAL que o jogador está
// virando, que é o que "relativo à sua posição" realmente quer dizer.
const BASE_ANGLE_SMOOTHING = 0.05;

const DEFAULT_HEIGHT = 4;
const DEFAULT_DISTANCE = 5;
const DEFAULT_SPEED = 2; // graus por tick (órbita/pêndulo)
const DEFAULT_SWEEP = 60; // amplitude do pêndulo, graus pra cada lado

const FIXED_ANGLES = { north: 180, east: 270, south: 0, west: 90 };

// Ângulo relativo (em relação à direção que o jogador está olhando)
// usado pelos presets que sempre seguem por trás — 180° = atrás.
const CHASE_RELATIVE_ANGLE = 180;

const ALWAYS_RELATIVE_MODES = new Set(["chase", "handheld"]);

/** true se o jogador tem um preset de câmera ao vivo ativo agora. */
export function isInPreset(player) {
  return presetStates.has(player.id);
}

// --- Preferências persistidas (lembradas entre usos/sessões) --------

export function getPresetHeight(player) {
  return Tools.getDynamicProperty(player, "presetHeight") ?? DEFAULT_HEIGHT;
}
export function getPresetDistance(player) {
  return Tools.getDynamicProperty(player, "presetDistance") ?? DEFAULT_DISTANCE;
}
export function getPresetSpeed(player) {
  return Tools.getDynamicProperty(player, "presetSpeed") ?? DEFAULT_SPEED;
}
export function getPresetSweep(player) {
  return Tools.getDynamicProperty(player, "presetSweep") ?? DEFAULT_SWEEP;
}
export function getPresetRelative(player) {
  return Tools.getDynamicProperty(player, "presetRelative") ?? false;
}

/** true se a preferência global de "câmera relativa" (WASD) está ligada. */
export function isControlSchemeRelative(player) {
  return getPlayOptions(player).controlScheme === "camera_relative";
}

export function savePresetSettings(
  player,
  { height, distance, speed, sweep, relative },
) {
  if (height !== undefined)
    Tools.setDynamicProperty(player, "presetHeight", height);
  if (distance !== undefined)
    Tools.setDynamicProperty(player, "presetDistance", distance);
  if (speed !== undefined)
    Tools.setDynamicProperty(player, "presetSpeed", speed);
  if (sweep !== undefined)
    Tools.setDynamicProperty(player, "presetSweep", sweep);
  if (relative !== undefined)
    Tools.setDynamicProperty(player, "presetRelative", relative);
}

function canStartPreset(player) {
  if (isPlaying(player) || isInFlycam(player)) {
    Tools.playError(player);
    player.sendMessage(Tools.t("sys.error.camera_busy"));
    return false;
  }
  return true;
}

// Menor caminho angular (evita girar pelo lado errado ao se aproximar
// do ângulo alvo, igual o unwrap usado na reprodução das timelines).
function lerpAngleShortest(from, to, t) {
  const diff = ((((to - from + 540) % 360) + 360) % 360) - 180;
  return from + diff * t;
}

// Atualiza (suavemente) e devolve o ângulo-base desse tick. Presets
// não-relativos não têm base nenhuma (0 = bússola fixa do mundo).
function updateBaseAngle(player, state) {
  const isRelative = state.relative || ALWAYS_RELATIVE_MODES.has(state.mode);
  if (!isRelative) return 0;

  const target = player.getRotation().y;
  state.smoothBaseAngle =
    state.smoothBaseAngle === null
      ? target
      : lerpAngleShortest(state.smoothBaseAngle, target, BASE_ANGLE_SMOOTHING);

  return state.smoothBaseAngle;
}

// Cada modo calcula o ÂNGULO da câmera nesse tick, em cima da base já
// suavizada — é a única diferença real entre os presets "simples"
// (órbita, fixo, perseguição, pêndulo) — todos usam o mesmo motor de
// suavização/look-at embaixo.
function computeAngle(player, state) {
  const base = updateBaseAngle(player, state);

  switch (state.mode) {
    case "orbit":
    case "aerial":
      state.angle = (state.angle + state.speed) % 360;
      return base + state.angle;

    case "fixed":
      return base + state.angle;

    case "chase":
    case "handheld":
      return base + CHASE_RELATIVE_ANGLE;

    case "pendulum": {
      state.phase = (state.phase ?? 0) + state.speed;
      const oscillation = Math.sin((state.phase * Math.PI) / 180) * state.sweep;
      return base + oscillation;
    }

    default:
      return base;
  }
}

// Ruído orgânico (câmera de mão): soma de senoides com frequências
// diferentes, pra não parecer um movimento repetitivo/mecânico.
function computeHandheldShake(state) {
  state.noiseTime = (state.noiseTime ?? 0) + 1;
  const t = state.noiseTime;

  return {
    offset: {
      x: Math.sin(t * 0.13) * 0.12 + Math.sin(t * 0.031) * 0.05,
      y: Math.sin(t * 0.11 + 1.3) * 0.08,
      z: Math.cos(t * 0.09 + 0.7) * 0.1,
    },
    rotation: {
      pitch: Math.sin(t * 0.07 + 2.1) * 1.5,
      yaw: Math.sin(t * 0.085 + 0.4) * 1.5,
    },
  };
}

function startTracking(player, state) {
  if (isInPreset(player)) {
    stopPreset(player);
  }
  if (!canStartPreset(player)) return;

  state.angle = state.mode === "fixed" ? state.angle : 0;
  state.smoothLocation = null;
  state.smoothRotation = null;
  state.smoothBaseAngle = null;
  state.noiseTime = 0;
  state.phase = 0;
  state.stopRequested = false;
  state.controlSchemeApplied = false;

  state.intervalId = system.runInterval(() => {
    // Sempre relê o estado do mapa. Se "pararam" enquanto isso (ver
    // stopPreset), o sinal fica em stopRequested — tratado logo
    // abaixo, ANTES de qualquer setCamera novo nesse tick. É isso que
    // garante que o clear() é sempre a ÚLTIMA coisa que mexe na
    // câmera do jogador, sem nenhuma chance de um setCamera correr
    // por fora depois (a causa da câmera ficar "presa" fora do
    // jogador antes dessa correção).
    const current = presetStates.get(player.id);
    if (!current) return;

    if (!player.isValid) {
      cleanupPresetOnLeave(player.id);
      return;
    }

    if (current.stopRequested) {
      finishStop(player, current);
      return;
    }

    const currentLocation = player.location;
    if (!current.smoothLocation) {
      current.smoothLocation = { ...currentLocation };
      current.smoothRotation = { x: 0, y: 0 };
    }

    current.smoothLocation.x +=
      (currentLocation.x - current.smoothLocation.x) * LOCATION_SMOOTHING;
    current.smoothLocation.y +=
      (currentLocation.y - current.smoothLocation.y) * LOCATION_SMOOTHING;
    current.smoothLocation.z +=
      (currentLocation.z - current.smoothLocation.z) * LOCATION_SMOOTHING;

    const angle = computeAngle(player, current);
    const yawRad = (angle * Math.PI) / 180;

    const offset = {
      x: -Math.sin(yawRad) * current.distance,
      y: current.height,
      z: Math.cos(yawRad) * current.distance,
    };

    let cameraLocation = {
      x: current.smoothLocation.x + offset.x,
      y: current.smoothLocation.y + offset.y,
      z: current.smoothLocation.z + offset.z,
    };

    // Mira um pouco acima dos pés do jogador (altura do peito).
    const lookAt = {
      x: current.smoothLocation.x,
      y: current.smoothLocation.y + 1,
      z: current.smoothLocation.z,
    };

    const dx = lookAt.x - cameraLocation.x;
    const dy = cameraLocation.y - lookAt.y; // positivo = câmera acima do alvo
    const dz = lookAt.z - cameraLocation.z;
    const horizontalDist = Math.sqrt(dx * dx + dz * dz) || 1e-6;

    const targetYaw = Math.atan2(-dx, dz) * (180 / Math.PI);
    const targetPitch = Math.atan2(dy, horizontalDist) * (180 / Math.PI);

    current.smoothRotation.y = lerpAngleShortest(
      current.smoothRotation.y,
      targetYaw,
      ROTATION_SMOOTHING,
    );
    current.smoothRotation.x = lerpAngleShortest(
      current.smoothRotation.x,
      targetPitch,
      ROTATION_SMOOTHING,
    );

    let finalRotation = {
      x: current.smoothRotation.x,
      y: current.smoothRotation.y,
    };

    // Câmera de mão: soma o tremor por cima da posição/rotação já
    // suavizadas — é só um "acabamento" visual, não muda o motor.
    if (current.mode === "handheld") {
      const shake = computeHandheldShake(current);
      cameraLocation = {
        x: cameraLocation.x + shake.offset.x,
        y: cameraLocation.y + shake.offset.y,
        z: cameraLocation.z + shake.offset.z,
      };
      finalRotation = {
        x: finalRotation.x + shake.rotation.pitch,
        y: finalRotation.y + shake.rotation.yaw,
      };
    }

    player.camera.setCamera("minecraft:free", {
      location: cameraLocation,
      rotation: finalRotation,
      easeOptions: { easeTime: 0.05, easeType: EasingType.Linear },
    });

    // O controlscheme só pode ser aplicado com a câmera JÁ em modo
    // free — por isso só mexemos nisso depois do primeiro setCamera
    // acima ter rodado (mesma regra do playCamera.iniciar()).
    if (!current.controlSchemeApplied) {
      current.controlSchemeApplied = true;
      if (current.useControlScheme) {
        applyControlScheme(player, "camera_relative");
      }
    }
  }, 1);

  presetStates.set(player.id, state);

  Tools.playSuccess(player);
  player.sendMessage(Tools.t("menu.preset.started"));
}

function finishStop(player, state) {
  presetStates.delete(player.id);
  system.clearRun(state.intervalId);

  player.camera.clear();
  if (state.useControlScheme) {
    applyControlScheme(player, "none");
  }

  player.sendMessage(Tools.t("menu.preset.stopped"));
}

/** Órbita 360° contínua ao redor do jogador, girando `speed` graus/tick. */
export function startOrbitPreset(
  player,
  { height, distance, speed, relative, controlScheme },
) {
  startTracking(player, {
    mode: "orbit",
    height,
    distance,
    speed,
    relative,
    angle: 0,
    useControlScheme: !!controlScheme,
  });
}

/** Câmera "ao vivo" num ângulo fixo (norte/leste/sul/oeste) relativo ao jogador. */
export function startFixedPreset(
  player,
  direction,
  { height, distance, relative, controlScheme },
) {
  startTracking(player, {
    mode: "fixed",
    height,
    distance,
    relative,
    angle: FIXED_ANGLES[direction] ?? 0,
    useControlScheme: !!controlScheme,
  });
}

/** Câmera de perseguição: sempre atrás do jogador, olhando pra ele. */
export function startChasePreset(player, { height, distance, controlScheme }) {
  startTracking(player, {
    mode: "chase",
    height,
    distance,
    relative: true,
    angle: 0,
    useControlScheme: !!controlScheme,
  });
}

/** Câmera de mão: igual perseguição, com tremor orgânico por cima. */
export function startHandheldPreset(
  player,
  { height, distance, controlScheme },
) {
  startTracking(player, {
    mode: "handheld",
    height,
    distance,
    relative: true,
    angle: 0,
    useControlScheme: !!controlScheme,
  });
}

/** Pêndulo: balança de um lado pro outro num arco, em vez de girar 360°. */
export function startPendulumPreset(
  player,
  { height, distance, speed, sweep, relative, controlScheme },
) {
  startTracking(player, {
    mode: "pendulum",
    height,
    distance,
    speed,
    sweep,
    relative,
    angle: 0,
    useControlScheme: !!controlScheme,
  });
}

/** Aérea: órbita ampla e alta, tipo plano de estabelecimento cinematográfico. */
export function startAerialPreset(
  player,
  { height, distance, speed, relative, controlScheme },
) {
  startTracking(player, {
    mode: "aerial",
    height,
    distance,
    speed,
    relative,
    angle: 0,
    useControlScheme: !!controlScheme,
  });
}

/**
 * Pede pra parar o preset ativo. NÃO mexe na câmera diretamente — só
 * sinaliza; é o próprio loop (na função finishStop, acima) que faz a
 * limpeza de verdade, garantindo que nada mais chama setCamera depois.
 */
export function stopPreset(player) {
  const state = presetStates.get(player.id);
  if (!state) return;
  state.stopRequested = true;
}

/**
 * Limpeza leve (playerLeave, ou o próprio loop detectando jogador
 * inválido) — só derruba o timer e o estado, sem tentar comando nenhum.
 */
export function cleanupPresetOnLeave(playerId) {
  const state = presetStates.get(playerId);
  if (!state) return;
  presetStates.delete(playerId);
  system.clearRun(state.intervalId);
}
