import { Tools } from "../utils/index.js";

const PLAY_OPTIONS_PROPERTY = "playOptions";

// Mapeia a opção salva pro comando /controlscheme correspondente.
// "none" limpa o esquema (volta ao padrão do preset de câmera atual).
const CONTROL_SCHEME_COMMANDS = {
  none: "clear",
  camera_relative: "set camera_relative",
};

function defaultPlayOptions() {
  return {
    loop: false,
    controlScheme: "none", // "none" | "camera_relative"
    lookAtPlayer: false,
    hideDuringPlayback: false,
  };
}

export function getPlayOptions(player) {
  return (
    Tools.getDynamicProperty(player, PLAY_OPTIONS_PROPERTY) ??
    defaultPlayOptions()
  );
}

function savePlayOptions(player, options) {
  Tools.setDynamicProperty(player, PLAY_OPTIONS_PROPERTY, options);
}

export function toggleLoop(player) {
  const options = getPlayOptions(player);
  options.loop = !options.loop;
  savePlayOptions(player, options);
  return options;
}

// Alterna se a rotação da câmera, durante a reprodução, ignora o que
// foi gravado em cada keyframe e passa a mirar continuamente nos pés
// do jogador (posição atual, em tempo real) — a posição do caminho
// continua vindo normalmente da spline; só a rotação muda de fonte.
export function toggleLookAtPlayer(player) {
  const options = getPlayOptions(player);
  options.lookAtPlayer = !options.lookAtPlayer;
  savePlayOptions(player, options);
  return options;
}

// Alterna se o jogador fica invisível (efeito de invisibilidade)
// durante a reprodução — some quando a animação começa, volta ao
// normal quando ela para (ver playCamera.iniciar/stopAnimation).
export function toggleHideDuringPlayback(player) {
  const options = getPlayOptions(player);
  options.hideDuringPlayback = !options.hideDuringPlayback;
  savePlayOptions(player, options);
  return options;
}

// Aplica de fato o esquema de controle no jogador via comando nativo.
// IMPORTANTE: o comando /controlscheme só tem efeito quando a câmera do
// jogador já está no modo "minecraft:free". Por isso essa função não deve
// ser chamada aqui no menu de opções (a câmera ainda está no modo padrão) —
// quem aplica de verdade é o playCamera.iniciar(), logo após colocar a
// câmera em modo free.
export function applyControlScheme(player, controlScheme) {
  const command = CONTROL_SCHEME_COMMANDS[controlScheme] ?? "clear";
  player.runCommand(`controlscheme @s ${command}`);
}

// Alterna a PREFERÊNCIA de esquema de controle: clicar no já ativo desativa
// (volta pro padrão); clicar no outro troca — só um dos dois fica marcado
// por vez. Isso só salva a escolha; a aplicação real acontece quando a
// animação começa (ver nota em applyControlScheme acima).
export function toggleControlScheme(player, scheme) {
  const options = getPlayOptions(player);
  const next = options.controlScheme === scheme ? "none" : scheme;

  options.controlScheme = next;
  savePlayOptions(player, options);

  return options;
}
