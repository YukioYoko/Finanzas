export const FREQS = [
  { id: "mensual", label: "Mensual" },
  { id: "anual", label: "Anual" },
  { id: "esporadico", label: "Esporádico" },
];

export const MESES_OPCIONES = [3, 6, 9, 12, 18, 24, 36];

export const MONTH_NAMES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
export const MONTH_SHORT = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

export const seedCategories = [
  { id: "cat-comida", name: "Comida", freq: "mensual" },
  { id: "cat-transporte", name: "Transporte", freq: "mensual" },
  { id: "cat-suscripciones", name: "Suscripciones", freq: "mensual" },
  { id: "cat-servicios", name: "Servicios (luz, agua, internet)", freq: "mensual" },
  { id: "cat-seguro", name: "Seguros", freq: "anual" },
  { id: "cat-predial", name: "Predial / Tenencia", freq: "anual" },
  { id: "cat-compras", name: "Compras", freq: "esporadico" },
  { id: "cat-salud", name: "Salud", freq: "esporadico" },
  { id: "cat-nomina", name: "Nómina / Ingresos", freq: "mensual" },
];

export const SUPPORT_EMAIL = "yukio.yokogawa141002@gmail.com";

// Forma del estado global de la app
export const EMPTY = { accounts: [], cards: [], categories: seedCategories, movements: [], inbox: [], recurring: [], theme: "dark", tourSeen: false };
