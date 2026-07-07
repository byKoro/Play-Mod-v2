import { world } from "@minecraft/server";
import { ACTIVATOR_ITEM_ID } from "./constants.js";
import { registerTimelineEvents } from "./services/timelineService.js";
import {
  isPlaying,
  stopAnimation,
  resetStalePlaybackState,
  cleanupPlaybackOnLeave,
} from "./services/playCamera.js";
import { startMarkerDriftGuard } from "./services/keyframeMarkerService.js";
import {
  flagActivatorReturn,
  resolvePendingActivatorReturn,
} from "./services/itemGuardService.js";
import { main_UI } from "./ui/mainUi.js";
import { redoKeyframeUi } from "./ui/redoKeyframeUi.js";
import { playControlUi } from "./ui/playControlUi.js";

world.afterEvents.itemUse.subscribe((ev) => {
  const player = ev.source;

  // Só reage ao item ativador do addon — qualquer outro item usado
  // pelo jogador é ignorado.
  if (ev.itemStack?.typeId !== ACTIVATOR_ITEM_ID) return;

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

// Segurança: jogador morreu com a animação em andamento. O item
// ativador pode cair no chão na morte mesmo estando travado (o
// lockMode não impede drop por morte), então marcamos a devolução
// pra acontecer no respawn, e encerramos a animação de forma limpa.
world.afterEvents.entityDie.subscribe((ev) => {
  const player = ev.deadEntity;
  if (player?.typeId !== "minecraft:player") return;

  if (isPlaying(player)) {
    flagActivatorReturn(player);
    stopAnimation(player);
  }
});

// Segurança: jogador saiu do mundo com a animação em andamento.
// Só derruba os timers/estado em memória — nada de comandos, o
// jogador já não é mais válido nesse ponto.
world.afterEvents.playerLeave.subscribe(({ playerId }) => {
  cleanupPlaybackOnLeave(playerId);
});

world.afterEvents.playerSpawn.subscribe(({ player, initialSpawn }) => {
  if (initialSpawn) {
    // Entrada no mundo: limpa qualquer resquício de uma sessão anterior
    // (tag "playing", controlscheme ou item travado presos por ter saído
    // do mundo, ou o próprio mundo ter sido recarregado, com a animação
    // em andamento).
    resetStalePlaybackState(player);
  }

  // Respawn (ou login, no caso de ter morrido e saído antes de respawnar):
  // devolve o item ativador se houver uma devolução pendente.
  resolvePendingActivatorReturn(player);
});

registerTimelineEvents();
startMarkerDriftGuard();
