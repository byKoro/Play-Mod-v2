import {
  system,
  EasingType,
  InputPermissionCategory,
} from "@minecraft/server";
import { isPlaying } from "./playCamera.js";
import { placeFlycamKeyframe } from "./keyframeService.js";
import { isInPreset } from "./presetCameraService.js";
import { Tools } from "../utils/index.js";

// playerId -> estado do voo (posição/rotação virtuais, modo, timer)
const flycamStates = new Map();

const MOVE_SPEED = 0.6; // blocos por tick com input máximo
const CAMERA_EASE_SECONDS = 0.1;

// Saída por proximidade: chegar perto do próprio corpo e ficar parado
// ali por alguns segundos volta pro normal. O corpo do jogador fica
// parado o tempo todo (o movimento normal está desligado), então essa
// distância é sempre em relação ao ponto de partida do voo.
const RETURN_DISTANCE = 2; // blocos
const RETURN_COUNTDOWN_TICKS = 5 * 20; // 5 segundos

/** true se o jogador está no modo câmera livre pra colocar keyframe. */
export function isInFlycam(player) {
  return flycamStates.has(player.id);
}

function computeForwardRight(rotation) {
  const yawRad = rotation.y * (Math.PI / 180);
  const pitchRad = rotation.x * (Math.PI / 180);

  const forward = {
    x: -Math.sin(yawRad) * Math.cos(pitchRad),
    y: -Math.sin(pitchRad),
    z: Math.cos(yawRad) * Math.cos(pitchRad),
  };
  const right = { x: Math.cos(yawRad), y: 0, z: Math.sin(yawRad) };

  return { forward, right };
}

// Monta uma base perpendicular à direção de movimento (right/up), pra
// poder espalhar os raios ao redor do caminho em qualquer direção 3D
// (subindo, descendo, na diagonal — não só andando na horizontal).
function getPerpendicularBasis(dir) {
  const worldUp = { x: 0, y: 1, z: 0 };

  // Se a direção for quase igual ao "up" do mundo (voando reto pra
  // cima/baixo), o cross product com worldUp degenera — usa outro
  // eixo de referência nesse caso.
  const alignment = Math.abs(dir.x * worldUp.x + dir.y * worldUp.y + dir.z * worldUp.z);
  const reference = alignment > 0.99 ? { x: 1, y: 0, z: 0 } : worldUp;

  let right = {
    x: dir.y * reference.z - dir.z * reference.y,
    y: dir.z * reference.x - dir.x * reference.z,
    z: dir.x * reference.y - dir.y * reference.x,
  };
  const rightLen = Math.sqrt(right.x ** 2 + right.y ** 2 + right.z ** 2) || 1;
  right = { x: right.x / rightLen, y: right.y / rightLen, z: right.z / rightLen };

  const up = {
    x: right.y * dir.z - right.z * dir.y,
    y: right.z * dir.x - right.x * dir.z,
    z: right.x * dir.y - right.y * dir.x,
  };

  return { right, up };
}

// Offsets (em blocos) usados pra formar a grade de raios ao redor do
// caminho — mesma densidade (3x3) usada por outros addons de câmera
// consolidados, só que aqui aplicada num plano perpendicular real ao
// movimento (não fixo em X/Z), então funciona voando pra qualquer lado.
const COLLISION_RAY_OFFSETS = [-0.25, 0, 0.25];

// Impede a câmera de atravessar blocos: em vez de um único raio fino
// no centro (que pode "escapar" por uma quina de parede), lança uma
// grade de 9 raios ao redor do caminho pretendido e usa a distância
// segura mais curta entre todos eles.
function avoidCollision(dimension, from, to) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const dz = to.z - from.z;
  const length = Math.sqrt(dx * dx + dy * dy + dz * dz);
  if (length < 1e-6) return to;

  const dir = { x: dx / length, y: dy / length, z: dz / length };
  const { right, up } = getPerpendicularBasis(dir);

  let closestDist = length;

  for (const rightOffset of COLLISION_RAY_OFFSETS) {
    for (const upOffset of COLLISION_RAY_OFFSETS) {
      const origin = {
        x: from.x + right.x * rightOffset + up.x * upOffset,
        y: from.y + right.y * rightOffset + up.y * upOffset,
        z: from.z + right.z * rightOffset + up.z * upOffset,
      };

      try {
        const hit = dimension.getBlockFromRay(origin, dir, {
          maxDistance: length + 0.3,
          includePassableBlocks: false,
          includeLiquidBlocks: false,
        });

        if (hit?.block) {
          const center = {
            x: hit.block.location.x + 0.5,
            y: hit.block.location.y + 0.5,
            z: hit.block.location.z + 0.5,
          };
          const distToBlock = Math.sqrt(
            (center.x - origin.x) ** 2 +
              (center.y - origin.y) ** 2 +
              (center.z - origin.z) ** 2,
          );
          closestDist = Math.min(closestDist, distToBlock - 0.4);
        }
      } catch {}
    }
  }

  const safeDist = Math.max(0.2, Math.min(length, closestDist));
  return {
    x: from.x + dir.x * safeDist,
    y: from.y + dir.y * safeDist,
    z: from.z + dir.z * safeDist,
  };
}

/**
 * Entra no modo flycam. `mode` define o que acontece a cada ponto
 * colocado:
 *  - { kind: "append" }         → adiciona no fim, pode colocar vários
 *  - { kind: "insert", index }  → insere antes do índice, um só ponto
 *  - { kind: "replace", index } → substitui o índice, um só ponto
 */
export function startFlycam(player, mode) {
  if (isInFlycam(player)) return;

  if (isPlaying(player)) {
    Tools.playError(player);
    player.sendMessage(Tools.t("sys.error.animation_playing"));
    return;
  }

  if (isInPreset(player)) {
    Tools.playError(player);
    player.sendMessage(Tools.t("sys.error.camera_busy"));
    return;
  }

  const rotation = player.getRotation();
  const location = {
    x: player.location.x,
    y: player.location.y + 1.6,
    z: player.location.z,
  };

  player.camera.setCamera("minecraft:free", {
    location,
    rotation,
    easeOptions: {
      easeTime: CAMERA_EASE_SECONDS,
      easeType: EasingType.InOutSine,
    },
  });
  player.inputPermissions.setPermissionCategory(
    InputPermissionCategory.Movement,
    false,
  );

  const state = {
    location,
    rotation,
    mode,
    placedCount: 0,
    returnCountdown: null,
    intervalId: undefined,
  };

  state.intervalId = system.runInterval(() => {
    if (!player.isValid) {
      cleanupFlycamOnLeave(player.id);
      return;
    }

    // Agachar sai do modo flycam.
    if (player.isSneaking) {
      exitFlycam(player);
      return;
    }

    state.rotation = player.getRotation();
    const { forward, right } = computeForwardRight(state.rotation);
    const moveVector = player.inputInfo.getMovementVector();

    if (moveVector.x !== 0 || moveVector.y !== 0) {
      const intended = {
        x:
          state.location.x +
          (forward.x * moveVector.y + right.x * moveVector.x) * MOVE_SPEED,
        y: state.location.y + forward.y * moveVector.y * MOVE_SPEED,
        z:
          state.location.z +
          (forward.z * moveVector.y + right.z * moveVector.x) * MOVE_SPEED,
      };

      state.location = avoidCollision(player.dimension, state.location, intended);
    }

    // Saída por proximidade: perto do próprio corpo por 5s seguidos
    // sai do flycam sozinho. Fica sempre parado até isso (mesmo já
    // começando perto, já que o voo nasce na posição do jogador) —
    // sair de perto a qualquer momento cancela a contagem.
    //
    // IMPORTANTE: essa checagem roda ANTES do setCamera de baixo. Se
    // for sair nesse tick, saímos direto (camera.clear() dentro de
    // exitFlycam) sem antes mandar mais um setCamera("minecraft:free")
    // — as duas chamadas no mesmo tick faziam a câmera "brigar" e
    // ficar presa em modo livre mesmo depois do clear.
    const dx = state.location.x - player.location.x;
    const dy = state.location.y - player.location.y;
    const dz = state.location.z - player.location.z;
    const distanceToBody = Math.sqrt(dx * dx + dy * dy + dz * dz);

    if (distanceToBody <= RETURN_DISTANCE) {
      state.returnCountdown =
        state.returnCountdown === null
          ? RETURN_COUNTDOWN_TICKS
          : state.returnCountdown - 1;

      if (state.returnCountdown <= 0) {
        exitFlycam(player);
        return;
      }

      const secondsLeft = Math.ceil(state.returnCountdown / 20);
      player.onScreenDisplay.setActionBar(
        Tools.t("menu.flycam.actionbar.returning", [secondsLeft]),
      );
    } else {
      state.returnCountdown = null;
      player.onScreenDisplay.setActionBar(
        Tools.t("menu.flycam.actionbar.hint"),
      );
    }

    player.camera.setCamera("minecraft:free", {
      location: state.location,
      rotation: state.rotation,
      easeOptions: {
        easeTime: CAMERA_EASE_SECONDS,
        easeType: EasingType.Linear,
      },
    });
  }, 1);

  flycamStates.set(player.id, state);

  Tools.playSuccess(player);
  player.sendMessage(Tools.t("menu.flycam.started"));
}

/**
 * Coloca um keyframe na posição/rotação atual do voo. Chamado quando o
 * jogador usa o item ativador enquanto está em flycam (ver main.js).
 */
export function placeFlycamPoint(player) {
  const state = flycamStates.get(player.id);
  if (!state) return;

  const override = {
    position: {
      x: Number(state.location.x.toFixed(2)),
      y: Number(state.location.y.toFixed(2)),
      z: Number(state.location.z.toFixed(2)),
    },
    rotation: {
      pitch: Number(state.rotation.x.toFixed(2)),
      yaw: Number(state.rotation.y.toFixed(2)),
    },
    dimension: player.dimension.id,
  };

  const ok = placeFlycamKeyframe(player, override, state.mode);
  if (!ok) return;

  state.placedCount++;

  // Inserir/substituir são de ponto único — some sozinho depois de um.
  if (state.mode.kind !== "append") {
    exitFlycam(player);
  }
}

/** Sai do flycam normalmente (jogador válido, restaura tudo). */
export function exitFlycam(player) {
  const state = flycamStates.get(player.id);
  if (!state) return;

  system.clearRun(state.intervalId);
  flycamStates.delete(player.id);

  player.camera.clear();
  player.inputPermissions.setPermissionCategory(
    InputPermissionCategory.Movement,
    true,
  );

  player.sendMessage(Tools.t("menu.flycam.ended", [state.placedCount]));
}

/**
 * Limpeza leve (playerLeave, ou o próprio loop detectando jogador
 * inválido) — só derruba o timer e o estado, sem tentar comando nenhum.
 */
export function cleanupFlycamOnLeave(playerId) {
  const state = flycamStates.get(playerId);
  if (!state) return;
  system.clearRun(state.intervalId);
  flycamStates.delete(playerId);
}
