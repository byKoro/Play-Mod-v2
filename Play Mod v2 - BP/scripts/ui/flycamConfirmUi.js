import { MessageFormData } from "@minecraft/server-ui";
import { Tools } from "../utils/index";
import {
  getSkipFlycamPrompt,
  setSkipFlycamPrompt,
} from "../services/timelineService.js";

/**
 * Pergunta se o jogador quer usar o modo flycam pra essa colocação de
 * keyframe. `onYes`/`onNo` recebem controle total do que acontece em
 * cada caso — essa UI só faz a pergunta.
 */
export function confirmFlycamUi(player, { onYes, onNo }) {
  const form = new MessageFormData();
  form.title(Tools.t("menu.flycam.confirm.title"));
  form.body(Tools.t("menu.flycam.confirm.body"));
  form.button1(Tools.t("menu.flycam.confirm.yes"));
  form.button2(Tools.t("menu.flycam.confirm.no"));

  form.show(player).then((response) => {
    if (response.canceled) return;

    if (response.selection === 0) {
      onYes();
    } else {
      onNo();
    }
  });
}

/**
 * Mesma coisa que confirmFlycamUi, mas primeiro confere se o jogador
 * já pediu pra não perguntar mais nessa timeline (seja porque
 * respondeu "não" uma vez, seja pelo toggle manual em Editar Tudo).
 * Se sim, pula direto pro fluxo sem flycam.
 *
 * É essa função que main_UI/editKeyframesUi devem chamar — não a
 * confirmFlycamUi crua.
 */
export function maybeConfirmFlycam(player, { onYes, onNo }) {
  if (getSkipFlycamPrompt(player)) {
    onNo();
    return;
  }

  confirmFlycamUi(player, {
    onYes,
    onNo: () => {
      // Escolheu "não": não pergunta mais nessa timeline daqui pra
      // frente (até o jogador reativar manualmente no toggle).
      setSkipFlycamPrompt(player, true);
      onNo();
    },
  });
}
