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
  getKeyframePos,
  getKeyframeRot,
  setKeyframePosition,
  setKeyframeRotation,
  getCurrentTimeline,
} from "../services/index.js";
import { getTimeline } from "../services/index.js";

const Transicoes = ["Teste", "Teste2"];

export function editKeyframe_UI(player, keyframeIndex) {
  system.run(() => {
    const keyframe = getKeyframe(player, keyframeIndex);
    const keyframeName = keyframe.name ?? String(keyframeIndex);
    const keyframePos = getKeyframePos(player, keyframeIndex);
    const keyframeRot = getKeyframeRot(player, keyframeIndex);
    const posText = Object.entries(keyframePos)
      .map(([key, value]) => `${key}: ${value}`)
      .join("  ");

    const rotText = Object.entries(keyframeRot)
      .map(([key, value]) => `${key}: ${value}`)
      .join("  ");

    /// Definir modal
    const campos = [
      {
        type: "textField",
        label: "Nomeie o keyframe",
        placeholder: keyframeName,
        options: {
          defaultValue: keyframeName,
        },
      },
      {
        type: "toggle",
        label: "Regravar? Marque e salve.",
      },
      {
        type: "toggle",
        label: "Deletar? Marque e salve.",
      },
      {
        type: "textField",
        label: "Ajuste fino posição",
        placeholder: keyframeName,
        options: {
          defaultValue: posText,
        },
      },
      {
        type: "textField",
        label: "Ajuste fino rotação",
        placeholder: keyframeName,
        options: {
          defaultValue: rotText,
        },
      },
    ];

    // Constroi modal
    const form = new ModalFormData();
    form.title(`Timeline atual: ${getCurrentTimeline(player)}`);
    campos.forEach((campo) => {
      switch (campo.type) {
        case "textField":
          form.textField(campo.label, campo.placeholder, campo.options);
          break;

        case "dropdown":
          form.dropdown(campo.label, campo.options);
          break;

        case "toggle":
          form.toggle(campo.label);
          break;
      }
    });

    form.submitButton("Salvar");

    // Ações do modal
    form.show(player).then((response) => {
      const value = response.formValues;
      if (response.canceled) return listKeyframe_UI(player);

      validateEditKeyframeForm(player, keyframeIndex, value);

      renameKeyframe(player, keyframeIndex, keyframeName, value[0]);

      if (redoKeyframe(player, keyframeIndex, value[1])) return;

      if (delKeyframe(player, keyframeIndex, value[2])) {
        return listKeyframe_UI(player);
      }
      setKeyframePosition(player, keyframeIndex, value[3]);
      setKeyframeRotation(player, keyframeIndex, value[4]);

      return editKeyframe_UI(player, keyframeIndex);
    });
  });
}
