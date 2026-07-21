// Almacenamiento: usa window.storage dentro de Claude, o localStorage en el navegador
export const store = {
  async get(key) {
    if (typeof window !== "undefined" && window.storage) return window.storage.get(key);
    const value = localStorage.getItem(key);
    if (value == null) throw new Error("Sin datos guardados");
    return { key, value };
  },
  async set(key, value) {
    if (typeof window !== "undefined" && window.storage) return window.storage.set(key, value);
    localStorage.setItem(key, value);
    return { key, value };
  },
};
