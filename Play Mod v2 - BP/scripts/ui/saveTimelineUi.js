import { ModalFormData } from "@minecraft/server-ui";
import { system } from "@minecraft/server";
import { exportTimeline, getTimeline, hasTimeline } from "../services/index";
import { listKeyframe_UI } from "../ui/listKeyframeUi";

export function saveTimelineUi(player, erroMsg = "") {
  // Se houver uma mensagem de erro na reabertura, usamos ela, se não, o texto padrão
  let textField = erroMsg !== "" ? erroMsg : "Salvar nome da timeline";

  system.run(() => {
    const form = new ModalFormData().title("Exportar Timeline");
    form.textField(textField, "Escreva...");

    form.show(player).then((response) => {
      // 1. Primeiro de tudo: checa se o jogador fechou o formulário
      if (response.canceled) return listKeyframe_UI(player);

      // 2. Extrai a string real de dentro da array do formulário
      const timelineNameString = response.formValues[0]?.trim();

      // Validação extra: caso ele clique em enviar sem digitar nada
      if (!timelineNameString) {
        player.dimension.playSound("note.bass", player.location);
        return saveTimelineUi(player, "§cO nome não pode ser vazio!");
      }

      // 3. Passa a string do nome para verificar se já existe
      if (hasTimeline(player, timelineNameString)) {
        player.dimension.playSound("note.bass", player.location);

        // RECURSÃO: Executa a função novamente passando o jogador e o aviso de erro
        return saveTimelineUi(player, "§cEssa timeline já existe!");
      }

      // 4. Se passou pelas checagens, prossegue com o salvamento
      const timeline = getTimeline(player);
      timeline.name = timelineNameString;

      exportTimeline(player, timelineNameString);
    });
  });
}
