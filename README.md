# Play Mod v2

Addon para **Minecraft Bedrock** que transforma a câmera do jogador em uma ferramenta de cinematografia: grave uma sequência de keyframes (posição + rotação), e o addon interpola tudo em um movimento de câmera suave, pronto pra gravação de trailers, machinimas e conteúdo em geral.

Criado por **Koro**.

---

## ✨ Funcionalidades

### Timelines & Keyframes

- Crie múltiplas **timelines** (sequências de câmera), salve, liste e alterne entre elas.
- Marque quantos **keyframes** quiser por timeline (posição + rotação do jogador no momento).
- Edite, renomeie, regrave ou apague keyframes individualmente — ou tudo de uma vez.
- Ajuste a duração total da animação e ative/desative **loop**.

### Reprodução

- Câmera em modo livre, com transições suavizadas entre keyframes (spline).
- **Pausar, continuar e parar** a animação a qualquer momento, sem sair do modo cinemático.
- Esquema de controle "câmera relativa" opcional, pra mover o jogador em relação à direção da câmera durante a gravação.

### Marcadores visuais de keyframe

- Ative um marcador visual (entidade 3D) em cada keyframe salvo, pra visualizar o trajeto da câmera direto no mundo.
- **Clique direito** em um marcador abre a edição daquele keyframe específico.
- Marcadores são indestrutíveis (sem física, imunes a dano, não removíveis por comandos como `/kill` sem serem automaticamente restaurados) e desaparecem sozinhos enquanto a animação está rodando.

### Item ativador

- Um item específico (configurável em `constants.js`) abre o menu do addon.
- Fica protegido contra drop acidental durante a reprodução da câmera, e é devolvido automaticamente ao jogador caso ele morra nesse meio-tempo.

### Interface

- Todos os menus in-game (forms) com ícones dedicados para cada ação.
- Painel de créditos customizado (JSON UI) no menu principal.
- **Totalmente localizado** em 4 idiomas: Português (BR), Inglês (US), Russo e Espanhol (MX).

### Robustez

- Recuperação automática de estado caso o jogador saia do mundo, morra ou o mundo seja fechado no meio de uma animação — nada fica "preso" ou quebrado numa próxima sessão.

---

## 📋 Requisitos

- Minecraft Bedrock Edition — versão mínima **1.26.0**.
- Beta APIs **não são necessárias** — o addon usa apenas APIs estáveis (`@minecraft/server` 2.8.0, `@minecraft/server-ui` 2.1.0, `@minecraft/common` 1.2.0).

## 📦 Instalação

1. Baixe as pastas `Play Mod v2 - BP` (Behavior Pack) e `Play Mod v2 - RP` (Resource Pack).
2. Copie cada uma para:
   - **Behavior Pack** → `com.mojang/development_behavior_packs/`
   - **Resource Pack** → `com.mojang/development_resource_packs/`
3. No seu mundo, ative os dois packs (Behavior e Resource) nas configurações.
4. Certifique-se de que o mundo tem os módulos de script habilitados (qualquer mundo padrão do 1.26+ já suporta).

## 🎮 Como usar

1. Segure o item ativador e clique com o botão direito para abrir o menu principal.
2. Use **Definir Keyframe** para marcar a posição/rotação atual da câmera.
3. Repita em diferentes pontos para construir o trajeto.
4. Em **Gerenciar Timelines**, ajuste opções de loop e câmera relativa, e clique em **Iniciar** para reproduzir.
5. Durante a reprodução, use o item novamente para pausar, continuar ou parar.

## 🗂️ Estrutura do projeto

```
Play Mod v2 - BP/
├── entities/            → definição de comportamento da entidade marcadora
├── scripts/
│   ├── main.js           → ponto de entrada, eventos globais
│   ├── constants.js       → identificador do item ativador
│   ├── services/          → lógica principal (timelines, câmera, opções, marcadores, item)
│   └── ui/                 → todos os menus (forms)
└── texts/                → localização (pt_BR, en_US, ru_RU, es_MX)

Play Mod v2 - RP/
├── entity/               → definição visual da entidade marcadora
├── models/, render_controllers/  → geometria e render da entidade marcadora
├── textures/              → ícones dos menus
├── ui/server_form.json     → painel de créditos customizado (JSON UI)
└── texts/                 → localização (espelha a BP)
```
## 📝 Licença

Todos os direitos reservados a **Koro**. Se pretende reutilizar ou redistribuir partes deste projeto, entre em contato antes.# Play-Mod-v2
