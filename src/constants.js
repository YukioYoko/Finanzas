export const FREQS = [
  { id: "semanal", label: "Semanal", plural: "Semanales" },
  { id: "mensual", label: "Mensual", plural: "Mensuales" },
  { id: "anual", label: "Anual", plural: "Anuales" },
  { id: "esporadico", label: "Esporádico", plural: "Esporádicos" },
];

// Días de la semana (0 = domingo, coincide con Date.getDay())
export const WEEKDAYS = [
  { id: 1, label: "Lunes" },
  { id: 2, label: "Martes" },
  { id: 3, label: "Miércoles" },
  { id: 4, label: "Jueves" },
  { id: 5, label: "Viernes" },
  { id: 6, label: "Sábado" },
  { id: 0, label: "Domingo" },
];

export const MESES_OPCIONES = [3, 6, 9, 12, 18, 24, 36];

export const MONTH_NAMES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
export const MONTH_SHORT = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

export const seedCategories = [
  { id: "cat-gasolina", name: "Gasolina", freq: "semanal" },
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

export const SUPPORT_EMAIL = "yukioyoko14@gmail.com";

// Forma del estado global de la app
// inboxApps: registro de apps detectadas { [paquete]: { label, enabled } } — solo se
// capturan cargos de las habilitadas. inboxSeen: firmas recientes para evitar duplicados.
// notifCaptureEnabled: la lectura de notificaciones es opcional y arranca apagada;
// el usuario la activa desde Ajustes.
export const EMPTY = { accounts: [], cards: [], categories: seedCategories, movements: [], inbox: [], inboxApps: {}, inboxSeen: [], recurring: [], theme: "dark", tourSeen: false, notifCaptureEnabled: false };
