import { world, InputPermissionCategory } from "@minecraft/server";
import { ACTIVATOR_ITEM_ID } from "./constants.js";
import { registerTimelineEvents } from "./services/timelineService.js";
import {
  isPlaying,
  stopAnimation,
  resetStalePlaybackState,
  cleanupPlaybackOnLeave,
} from "./services/playCamera.js";
import { startKeyframeMarkerLoop } from "./services/keyframeMarkerService.js";
import {
  isInFlycam,
  placeFlycamPoint,
  exitFlycam,
  cleanupFlycamOnLeave,
} from "./services/flycamService.js";
import {
  isInPreset,
  stopPreset,
  cleanupPresetOnLeave,
} from "./services/presetCameraService.js";
import {
  flagActivatorReturn,
  resolvePendingActivatorReturn,
} from "./services/itemGuardService.js";
import { main_UI } from "./ui/mainUi.js";
import { redoKeyframeUi } from "./ui/redoKeyframeUi.js";
import { insertKeyframeUi } from "./ui/insertKeyframeUi.js";
import { playControlUi } from "./ui/playControlUi.js";

world.afterEvents.itemUse.subscribe((ev) => {
  const player = ev.source;

  // Só reage ao item ativador do addon — qualquer outro item usado
  // pelo jogador é ignorado.
  if (ev.itemStack?.typeId !== ACTIVATOR_ITEM_ID) return;

  // Em flycam, usar o item de novo é o próprio jeito de colocar um
  // keyframe na posição atual do voo — tem prioridade sobre tudo mais.
  if (isInFlycam(player)) {
    return placeFlycamPoint(player);
  }

  // Preset de câmera ao vivo (360°/N/E/S/W) ativo: usar o item de novo
  // simplesmente encerra o preset.
  if (isInPreset(player)) {
    return stopPreset(player);
  }

  if (player.getTags().includes("insertKeyframe")) {
    return insertKeyframeUi(player);
  }

  if (player.getTags().includes("editKeyframe")) {
    return redoKeyframeUi(player);
  }

  // Animação rodando (tocando ou pausada): abre o menu de controle de
  // reprodução em vez do menu principal.
  if (isPlaying(player)) {
    return playControlUi(player);
  }

  main_UI(player);
});

// Segurança: jogador morreu com a animação em andamento, ou no meio
// de um voo flycam. O item ativador pode cair no chão na morte mesmo
// estando travado (o lockMode não impede drop por morte), então
// marcamos a devolução pra acontecer no respawn.
world.afterEvents.entityDie.subscribe((ev) => {
  const player = ev.deadEntity;
  if (player?.typeId !== "minecraft:player") return;

  if (isPlaying(player)) {
    flagActivatorReturn(player);
    stopAnimation(player);
  }

  if (isInFlycam(player)) {
    exitFlycam(player);
  }

  if (isInPreset(player)) {
    stopPreset(player);
  }
});

// Segurança: jogador saiu do mundo com a animação em andamento, ou
// voando em flycam. Só derruba os timers/estado em memória — nada de
// comandos, o jogador já não é mais válido nesse ponto.
world.afterEvents.playerLeave.subscribe(({ playerId }) => {
  cleanupPlaybackOnLeave(playerId);
  cleanupFlycamOnLeave(playerId);
  cleanupPresetOnLeave(playerId);
});

world.afterEvents.playerSpawn.subscribe(({ player, initialSpawn }) => {
  if (initialSpawn) {
    // Entrada no mundo: limpa qualquer resquício de uma sessão anterior
    // (tag "playing", controlscheme ou item travado presos por ter saído
    // do mundo, ou o próprio mundo ter sido recarregado, com a animação
    // em andamento).
    resetStalePlaybackState(player);

    // Segurança extra: garante que o movimento normal está liberado,
    // caso o jogador tenha saído do mundo no meio de um voo flycam
    // (o estado em memória já se perdeu, então exitFlycam não rodaria).
    player.inputPermissions.setPermissionCategory(
      InputPermissionCategory.Movement,
      true,
    );
  }

  // Respawn (ou login, no caso de ter morrido e saído antes de respawnar):
  // devolve o item ativador se houver uma devolução pendente.
  resolvePendingActivatorReturn(player);
});

registerTimelineEvents();
startKeyframeMarkerLoop();
