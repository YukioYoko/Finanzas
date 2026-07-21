import { MONTH_SHORT } from "../constants";

const fmt = new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" });

export const money = (n) => fmt.format(n || 0);

export const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

export const todayISO = () => new Date().toISOString().slice(0, 10);

// Date → "YYYY-MM-DD" en hora local (sin el corrimiento UTC de toISOString)
export const isoOf = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

// Date → "21 jul"
export const fmtDia = (d) => `${d.getDate()} ${MONTH_SHORT[d.getMonth()]}`;
