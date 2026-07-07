import { ItemLockMode, ItemStack } from "@minecraft/server";
import { ACTIVATOR_ITEM_ID } from "../constants.js";
import { Tools } from "../utils/index.js";

const PENDING_RETURN_PROPERTY = "pendingActivatorReturn";

function getInventoryContainer(player) {
  return player.getComponent("minecraft:inventory")?.container;
}

function forEachActivatorSlot(player, callback) {
  const container = getInventoryContainer(player);
  if (!container) return;

  for (let slot = 0; slot < container.size; slot++) {
    const item = container.getItem(slot);
    if (item?.typeId === ACTIVATOR_ITEM_ID) {
      callback(container, slot, item);
    }
  }
}

/**
 * Trava todas as cópias do item ativador no inventário do jogador,
 * impedindo que sejam dropadas ou movidas enquanto a animação roda.
 */
export function lockActivatorItem(player) {
  forEachActivatorSlot(player, (container, slot, item) => {
    if (item.lockMode !== ItemLockMode.slot) {
      item.lockMode = ItemLockMode.slot;
      container.setItem(slot, item);
    }
  });
}

/**
 * Libera o item ativador, devolvendo o comportamento normal de
 * drop/movimentação. Chamado ao parar/pausar a animação e como
 * segurança no login do jogador.
 */
export function unlockActivatorItem(player) {
  forEachActivatorSlot(player, (container, slot, item) => {
    if (item.lockMode !== ItemLockMode.none) {
      item.lockMode = ItemLockMode.none;
      container.setItem(slot, item);
    }
  });
}

/**
 * Marca que o item ativador precisa ser devolvido ao jogador no
 * próximo respawn/login (chamado quando o jogador morre com a
 * animação em andamento — o item pode cair no chão na morte mesmo
 * estando travado, já que o lockMode não impede o drop por morte).
 */
export function flagActivatorReturn(player) {
  Tools.setDynamicProperty(player, PENDING_RETURN_PROPERTY, true);
}

/**
 * Devolve o item ativador ao jogador se houver uma devolução
 * pendente (marcada por flagActivatorReturn). Seguro de chamar
 * sempre — não faz nada se não houver pendência.
 */
export function resolvePendingActivatorReturn(player) {
  const pending = Tools.getDynamicProperty(player, PENDING_RETURN_PROPERTY);
  if (!pending) return;

  const container = getInventoryContainer(player);

  if (container) {
    let alreadyHasItem = false;
    for (let slot = 0; slot < container.size; slot++) {
      if (container.getItem(slot)?.typeId === ACTIVATOR_ITEM_ID) {
        alreadyHasItem = true;
        break;
      }
    }

    if (!alreadyHasItem) {
      container.addItem(new ItemStack(ACTIVATOR_ITEM_ID, 1));
    }
  }

  Tools.setDynamicProperty(player, PENDING_RETURN_PROPERTY, false);
}
