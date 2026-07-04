export class Tools {
  static setDynamicProperty(player, property, value) {
    return player.setDynamicProperty(property, JSON.stringify(value));
  }

  static getDynamicProperty(player, property) {
    const value = player.getDynamicProperty(property);

    if (value === undefined) {
      return undefined;
    }

    return JSON.parse(value);
  }

  static getDistance(pos1, pos2) {
    const dx = pos2.x - pos1.x;
    const dy = pos2.y - pos1.y;
    const dz = pos2.z - pos1.z;

    return Math.sqrt(dx * dx + dy * dy + dz * dz);
  }

  static isValidNumber(value) {
    return /^-?\d+(\.\d+)?$/.test(value);
  }

  static parseVector3(text) {
    const vector = {};

    const regex = /([a-z]+)\s*:\s*(-?\d+(?:\.\d+)?)/gi;

    let match;
    while ((match = regex.exec(text)) !== null) {
      const key = match[1].toLowerCase();
      const value = match[2];

      if (this.isValidNumber(value)) {
        vector[key] = Number(value);
      }
    }

    return vector;
  }
}
