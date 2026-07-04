import { system } from "@minecraft/server";
import { ModalFormData } from "@minecraft/server-ui";
import { Tools } from "../utils/tools";
import { listKeyframe_UI } from "./listKeyframeUi";
import {
  delKeyframe,
  redoKeyframe,
  renameKeyframe,
  validateEditKeyframeForm,
  getKeyframe,
} from "../services/index.js";

const Transicoes = ["Teste", "Teste2"];

export function editKeyframe_UI(player, keyframeIndex) {
  system.run(() => {
    const keyframe = getKeyframe(player, keyframeIndex);

    const keyframeName = keyframe.name ?? String(keyframeIndex);

    const form = new ModalFormData()
      .title("")
      .textField("Nomeie o keyframe", keyframeName, {
        defaultValue: `${keyframeName}`,
      })
      .dropdown("Transições", Transicoes)
      .toggle("Regravar? Marque e salve.")
      .toggle("Deletar? Marque e salve.")
      .submitButton("Salvar");

    form.show(player).then((response) => {
      const respostas = response.formValues;
      if (response.canceled) return listKeyframe_UI(player);

      validateEditKeyframeForm(player, keyframeIndex, respostas);

      renameKeyframe(player, keyframeIndex, keyframeName, respostas[0]);

      if (respostas[2]) {
        return redoKeyframe(player, keyframeIndex);
      }

      if (respostas[3]) {
        delKeyframe(player, keyframeIndex);
        return listKeyframe_UI(player);
      }

      renameKeyframe(player, keyframeIndex, keyframeName, respostas[0]);
      return editKeyframe_UI(player, keyframeIndex);
    });
  });
}
