class StaticKeyProvider {
  constructor({ currentVersion, keys }) {
    this.keys = new Map();
    Object.entries(keys || {}).forEach(([version, key]) => {
      const normalized = Buffer.from(key);
      if (normalized.length !== 32) throw new Error(`La clave ${version} no contiene 32 bytes.`);
      this.keys.set(version, normalized);
    });
    this.setCurrentVersion(currentVersion);
  }

  setCurrentVersion(version) {
    if (!this.keys.has(version)) throw new Error('La version de clave actual no existe en el keyring.');
    this.currentVersion = version;
  }

  getCurrentVersion() {
    return this.currentVersion;
  }

  getKey(version) {
    const key = this.keys.get(version);
    if (!key) throw new Error('La version de clave solicitada no esta disponible.');
    return Buffer.from(key);
  }

  isReady() {
    return this.keys.has(this.currentVersion);
  }
}

module.exports = { StaticKeyProvider };
