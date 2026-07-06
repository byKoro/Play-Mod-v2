import { system, EasingType, TicksPerSecond } from "@minecraft/server";
import { getCurrentTimeline } from "../services/index.js";
import { Tools } from "../utils/index.js";

// defaultMaxTime e os valores retornados por getTransitionTimes/distribute*
// estão em SEGUNDOS (mesma unidade do easeTime do setCamera).
// system.runTimeout, porém, trabalha em TICKS (20 ticks = 1 segundo).
// Essa função converte segundos -> ticks só na hora de agendar.
function secondsToTicks(seconds) {
  return Math.max(1, Math.round(seconds * TicksPerSecond));
}

function getTransitionTimes(timeline) {
  const keyframes = timeline.keyframes;

  if (keyframes.length <= 1) {
    return [];
  }

  const distances = [];
  let totalDistance = 0;

  for (let i = 0; i < keyframes.length - 1; i++) {
    const distance = Tools.getDistance(
      keyframes[i].position,
      keyframes[i + 1].position,
    );

    distances.push(distance);
    totalDistance += distance;
  }

  // totalSeconds está em SEGUNDOS (mesma unidade do easeTime da câmera)
  const totalSeconds = timeline.defaultMaxTime;

  // Caso todas as keyframes estejam na mesma posição: distribui igualmente
  if (totalDistance === 0) {
    return distributeEqually(distances.length, totalSeconds);
  }

  return distributeProportionally(distances, totalDistance, totalSeconds);
}

// Distribui os segundos proporcionalmente à distância, garantindo que
// a soma final seja EXATAMENTE igual a totalSeconds (soma acumulada,
// arredondamento no acumulado e não no valor isolado de cada segmento,
// evitando deriva de arredondamento).
function distributeProportionally(distances, totalDistance, totalSeconds) {
  const times = [];
  let accumulatedDistance = 0;
  let previousCumulativeSeconds = 0;

  for (let i = 0; i < distances.length; i++) {
    accumulatedDistance += distances[i];

    const cumulativeSeconds =
      (accumulatedDistance / totalDistance) * totalSeconds;

    const segmentSeconds = Math.max(
      1 / TicksPerSecond, // nunca menor que 1 tick
      cumulativeSeconds - previousCumulativeSeconds,
    );

    times.push(segmentSeconds);
    previousCumulativeSeconds += segmentSeconds;
  }

  return times;
}

// Distribui os segundos igualmente entre os segmentos, também garantindo
// que a soma final seja exatamente totalSeconds (o resto vai pro último segmento).
function distributeEqually(segmentCount, totalSeconds) {
  const baseTime = totalSeconds / segmentCount;
  return Array.from({ length: segmentCount }, () => baseTime);
}

function playKeyframe(player, keyframe, easeTime = 0) {
  player.camera.setCamera("minecraft:free", {
    location: keyframe.position,
    // setCamera espera Vector2 { x, y } (x = pitch, y = yaw).
    // keyframe.rotation é salvo como { pitch, yaw }, então precisa converter.
    rotation: {
      x: keyframe.rotation.pitch,
      y: keyframe.rotation.yaw,
    },
    ...(easeTime > 0 && {
      easeOptions: {
        easeTime,
        easeType: EasingType.Linear,
      },
    }),
  });
}

function playTimeline(player, keyframes, transitionTimes, index = 1) {
  if (index >= keyframes.length) {
    player.camera.clear();
    return;
  }

  // easeTimeSeconds vai pra câmera (setCamera espera segundos).
  const easeTimeSeconds = transitionTimes[index - 1];

  playKeyframe(player, keyframes[index], easeTimeSeconds);

  // runTimeout espera TICKS, por isso a conversão aqui.
  system.runTimeout(() => {
    playTimeline(player, keyframes, transitionTimes, index + 1);
  }, secondsToTicks(easeTimeSeconds));
}

export function iniciar(player) {
  const timelineName = getCurrentTimeline(player);
  const timeline = Tools.getDynamicProperty(player, timelineName);
  if (!timeline) return;

  const keyframes = timeline.keyframes;

  if (keyframes.length === 0) return;

  // Primeira keyframe instantânea
  playKeyframe(player, keyframes[0]);

  // Apenas uma keyframe
  if (keyframes.length === 1) {
    system.runTimeout(() => {
      player.camera.clear();
    }, secondsToTicks(timeline.defaultMaxTime));

    return;
  }

  const transitionTimes = getTransitionTimes(timeline);

  playTimeline(player, keyframes, transitionTimes);
}
