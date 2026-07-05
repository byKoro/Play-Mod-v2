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

export function editKeyframe_UI(player, keyframeIndex) {
  system.run(() => {
    let keyframe, keyframePos, keyframeRot;

    try {
      keyframe = getKeyframe(player, keyframeIndex);
      keyframePos = getKeyframePos(player, keyframeIndex);
      keyframeRot = getKeyframeRot(player, keyframeIndex);
    } catch (error) {
      // Ex: o keyframe foi deletado por outro caminho e o índice ficou velho.
      console.error(error);
      Tools.playError(player);
      player.sendMessage(Tools.t("sys.error.invalid_index", [keyframeIndex]));
      return listKeyframe_UI(player);
    }

    const keyframeName = keyframe.name ?? String(keyframeIndex);
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
        label: Tools.t("ui.edit.rename.label"),
        placeholder: keyframeName,
        options: {
          defaultValue: keyframeName,
        },
      },
      {
        type: "toggle",
        label: Tools.t("ui.edit.redo.label"),
      },
      {
        type: "toggle",
        label: Tools.t("ui.edit.delete.label"),
      },
      {
        type: "textField",
        label: Tools.t("ui.edit.pos.label"),
        placeholder: keyframeName,
        options: {
          defaultValue: posText,
        },
      },
      {
        type: "textField",
        label: Tools.t("ui.edit.rot.label"),
        placeholder: keyframeName,
        options: {
          defaultValue: rotText,
        },
      },
    ];

    // Constroi modal
    const form = new ModalFormData();
    form.title(Tools.t("ui.edit.title", [keyframeIndex]));
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

    form.submitButton(Tools.t("ui.edit.button.submit"));

    // Ações do modal
    form.show(player).then((response) => {
      const value = response.formValues;
      if (response.canceled) return listKeyframe_UI(player);

      // Bloqueia se o player marcou "Regravar" e "Deletar" ao mesmo tempo.
      if (!validateEditKeyframeForm(player, keyframeIndex, value)) {
        Tools.playError(player);
        player.sendMessage(Tools.t("sys.error.multiple_actions"));
        return editKeyframe_UI(player, keyframeIndex);
      }

      renameKeyframe(player, keyframeIndex, keyframeName, value[0]);

      if (redoKeyframe(player, keyframeIndex, value[1])) return;

      if (delKeyframe(player, keyframeIndex, value[2])) {
        return listKeyframe_UI(player);
      }
      setKeyframePosition(player, keyframeIndex, value[3]);
      setKeyframeRotation(player, keyframeIndex, value[4]);

      Tools.playSuccess(player);
      player.sendMessage(Tools.t("sys.msg.success.keyframe_updated"));

      return editKeyframe_UI(player, keyframeIndex);
    });
  });
}
