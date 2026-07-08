import { ActionFormData, ModalFormData } from "@minecraft/server-ui";
import { system } from "@minecraft/server";
import { Tools } from "../utils/index";
import { main_UI } from "./mainUi.js";
import {
  startOrbitPreset,
  startFixedPreset,
  startChasePreset,
  startHandheldPreset,
  startPendulumPreset,
  startAerialPreset,
  getPresetHeight,
  getPresetDistance,
  getPresetSpeed,
  getPresetSweep,
  getPresetRelative,
  isControlSchemeRelative,
  savePresetSettings,
} from "../services/presetCameraService.js";

const HEIGHT_MIN = 1;
const HEIGHT_MAX = 20;
const DISTANCE_MIN = 1;
const DISTANCE_MAX = 30;
const SPEED_MIN = 1;
const SPEED_MAX = 10;
const SWEEP_MIN = 15;
const SWEEP_MAX = 120;

export function presetsUi(player) {
  system.run(async () => {
    const actions = [
      {
        text: Tools.t("menu.presets.button.orbit_360"),
        icon: "textures/ui/play_mod/preset_360.png",
        action: () => orbitSettingsUi(player),
      },
      {
        text: Tools.t("menu.presets.button.north"),
        icon: "textures/ui/play_mod/preset_direction.png",
        action: () => fixedSettingsUi(player, "north"),
      },
      {
        text: Tools.t("menu.presets.button.east"),
        icon: "textures/ui/play_mod/preset_direction.png",
        action: () => fixedSettingsUi(player, "east"),
      },
      {
        text: Tools.t("menu.presets.button.south"),
        icon: "textures/ui/play_mod/preset_direction.png",
        action: () => fixedSettingsUi(player, "south"),
      },
      {
        text: Tools.t("menu.presets.button.west"),
        icon: "textures/ui/play_mod/preset_direction.png",
        action: () => fixedSettingsUi(player, "west"),
      },
      {
        text: Tools.t("menu.presets.button.chase"),
        icon: "textures/ui/play_mod/preset_chase.png",
        action: () => chaseSettingsUi(player),
      },
      {
        text: Tools.t("menu.presets.button.handheld"),
        icon: "textures/ui/play_mod/preset_handheld.png",
        action: () => handheldSettingsUi(player),
      },
      {
        text: Tools.t("menu.presets.button.pendulum"),
        icon: "textures/ui/play_mod/preset_pendulum.png",
        action: () => pendulumSettingsUi(player),
      },
      {
        text: Tools.t("menu.presets.button.aerial"),
        icon: "textures/ui/play_mod/preset_aerial.png",
        action: () => aerialSettingsUi(player),
      },
    ];

    const form = new ActionFormData();
    form.title(Tools.t("menu.presets.title"));
    actions.forEach(({ text, icon }) => form.button(text, icon));

    try {
      const response = await form.show(player);
      if (response.canceled) return main_UI(player);
      actions[response.selection]?.action();
    } catch (error) {
      console.error(error);
    }
  });
}

function addControlSchemeToggle(form, player) {
  form.toggle(Tools.t("ui.preset.control_scheme.label"), {
    defaultValue: isControlSchemeRelative(player),
  });
}

function orbitSettingsUi(player) {
  system.run(async () => {
    const form = new ModalFormData();
    form.title(Tools.t("ui.preset.orbit.title"));
    form.slider(Tools.t("ui.preset.height.label"), HEIGHT_MIN, HEIGHT_MAX, {
      defaultValue: getPresetHeight(player),
    });
    form.slider(
      Tools.t("ui.preset.distance.label"),
      DISTANCE_MIN,
      DISTANCE_MAX,
      {
        defaultValue: getPresetDistance(player),
      },
    );
    form.slider(Tools.t("ui.preset.orbit.speed.label"), SPEED_MIN, SPEED_MAX, {
      defaultValue: getPresetSpeed(player),
    });
    form.toggle(Tools.t("ui.preset.relative.label"), {
      defaultValue: getPresetRelative(player),
    });
    addControlSchemeToggle(form, player);

    try {
      const response = await form.show(player);
      if (response.canceled) return presetsUi(player);

      const [height, distance, speed, relative, controlScheme] =
        response.formValues;
      savePresetSettings(player, { height, distance, speed, relative });
      startOrbitPreset(player, {
        height,
        distance,
        speed,
        relative,
        controlScheme,
      });
    } catch (error) {
      console.error(error);
    }
  });
}

function fixedSettingsUi(player, direction) {
  system.run(async () => {
    const form = new ModalFormData();
    form.title(Tools.t("ui.preset.fixed.title"));
    form.slider(Tools.t("ui.preset.height.label"), HEIGHT_MIN, HEIGHT_MAX, {
      defaultValue: getPresetHeight(player),
    });
    form.slider(
      Tools.t("ui.preset.distance.label"),
      DISTANCE_MIN,
      DISTANCE_MAX,
      {
        defaultValue: getPresetDistance(player),
      },
    );
    form.toggle(Tools.t("ui.preset.relative.label"), {
      defaultValue: getPresetRelative(player),
    });
    addControlSchemeToggle(form, player);

    try {
      const response = await form.show(player);
      if (response.canceled) return presetsUi(player);

      const [height, distance, relative, controlScheme] = response.formValues;
      savePresetSettings(player, { height, distance, relative });
      startFixedPreset(player, direction, {
        height,
        distance,
        relative,
        controlScheme,
      });
    } catch (error) {
      console.error(error);
    }
  });
}

// Perseguição e câmera de mão sempre seguem por trás do jogador (não
// faz sentido ter a opção "relativo" nelas — já são sempre relativas).
function chaseSettingsUi(player) {
  system.run(async () => {
    const form = new ModalFormData();
    form.title(Tools.t("ui.preset.chase.title"));
    form.slider(Tools.t("ui.preset.height.label"), HEIGHT_MIN, HEIGHT_MAX, {
      defaultValue: getPresetHeight(player),
    });
    form.slider(Tools.t("ui.preset.distance.label"), 1, 10, {
      defaultValue: Math.min(getPresetDistance(player), 10),
    });
    addControlSchemeToggle(form, player);

    try {
      const response = await form.show(player);
      if (response.canceled) return presetsUi(player);

      const [height, distance, controlScheme] = response.formValues;
      savePresetSettings(player, { height, distance });
      startChasePreset(player, { height, distance, controlScheme });
    } catch (error) {
      console.error(error);
    }
  });
}

function handheldSettingsUi(player) {
  system.run(async () => {
    const form = new ModalFormData();
    form.title(Tools.t("ui.preset.handheld.title"));
    form.slider(Tools.t("ui.preset.height.label"), HEIGHT_MIN, HEIGHT_MAX, {
      defaultValue: getPresetHeight(player),
    });
    form.slider(Tools.t("ui.preset.distance.label"), 1, 10, {
      defaultValue: Math.min(getPresetDistance(player), 10),
    });
    addControlSchemeToggle(form, player);

    try {
      const response = await form.show(player);
      if (response.canceled) return presetsUi(player);

      const [height, distance, controlScheme] = response.formValues;
      savePresetSettings(player, { height, distance });
      startHandheldPreset(player, { height, distance, controlScheme });
    } catch (error) {
      console.error(error);
    }
  });
}

function pendulumSettingsUi(player) {
  system.run(async () => {
    const form = new ModalFormData();
    form.title(Tools.t("ui.preset.pendulum.title"));
    form.slider(Tools.t("ui.preset.height.label"), HEIGHT_MIN, HEIGHT_MAX, {
      defaultValue: getPresetHeight(player),
    });
    form.slider(
      Tools.t("ui.preset.distance.label"),
      DISTANCE_MIN,
      DISTANCE_MAX,
      {
        defaultValue: getPresetDistance(player),
      },
    );
    form.slider(Tools.t("ui.preset.orbit.speed.label"), SPEED_MIN, SPEED_MAX, {
      defaultValue: getPresetSpeed(player),
    });
    form.slider(
      Tools.t("ui.preset.pendulum.sweep.label"),
      SWEEP_MIN,
      SWEEP_MAX,
      {
        defaultValue: getPresetSweep(player),
      },
    );
    form.toggle(Tools.t("ui.preset.relative.label"), {
      defaultValue: getPresetRelative(player),
    });
    addControlSchemeToggle(form, player);

    try {
      const response = await form.show(player);
      if (response.canceled) return presetsUi(player);

      const [height, distance, speed, sweep, relative, controlScheme] =
        response.formValues;
      savePresetSettings(player, { height, distance, speed, sweep, relative });
      startPendulumPreset(player, {
        height,
        distance,
        speed,
        sweep,
        relative,
        controlScheme,
      });
    } catch (error) {
      console.error(error);
    }
  });
}

function aerialSettingsUi(player) {
  system.run(async () => {
    const form = new ModalFormData();
    form.title(Tools.t("ui.preset.aerial.title"));
    form.slider(Tools.t("ui.preset.height.label"), 5, 40, {
      defaultValue: Math.max(getPresetHeight(player), 12),
    });
    form.slider(
      Tools.t("ui.preset.distance.label"),
      DISTANCE_MIN,
      DISTANCE_MAX,
      {
        defaultValue: getPresetDistance(player),
      },
    );
    form.slider(Tools.t("ui.preset.orbit.speed.label"), 1, 5, {
      defaultValue: Math.min(getPresetSpeed(player), 5),
    });
    form.toggle(Tools.t("ui.preset.relative.label"), {
      defaultValue: getPresetRelative(player),
    });
    addControlSchemeToggle(form, player);

    try {
      const response = await form.show(player);
      if (response.canceled) return presetsUi(player);

      const [height, distance, speed, relative, controlScheme] =
        response.formValues;
      savePresetSettings(player, { height, distance, speed, relative });
      startAerialPreset(player, {
        height,
        distance,
        speed,
        relative,
        controlScheme,
      });
    } catch (error) {
      console.error(error);
    }
  });
}
