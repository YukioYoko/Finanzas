import React, { useState, useEffect, useMemo, useContext, useRef, useCallback, createContext } from "react";
import { Capacitor, registerPlugin } from "@capacitor/core";
import { LocalNotifications } from "@capacitor/local-notifications";

// Plugin nativo propio (android/…/NotificationInboxPlugin.java): lee las
// notificaciones capturadas del celular para convertirlas en movimientos
const NotificationInbox = registerPlugin("NotificationInbox");

// ---------- Temas ----------
const THEMES = {
  dark: {
    bg: "#171D22",
    surface: "#1F262C",
    surface2: "#273037",
    border: "#37424B",
    borderSoft: "#2C353D",
    text: "#E9EDF0",
    muted: "#9DAAB3",
    faint: "#6E7A83",
    accent: "#5AC79C",        // menta amigable
    accentText: "#0E1B16",    // texto sobre botones de acento
    accentSoft: "rgba(90,199,156,0.12)",
    amber: "#E8C171",         // deuda / a meses
    amberSoft: "rgba(232,193,113,0.10)",
    red: "#F09083",
    green: "#74D3A6",
    blue: "#82BEE6",
    chipBg: "rgba(255,255,255,0.06)",
    // Colores de serie para gráficas, validados para daltonismo sobre `surface`
    chartGasto: "#C64A39",
    chartIngreso: "#44A778",
  },
  light: {
    bg: "#F5F7F4",
    surface: "#FFFFFF",
    surface2: "#EFF3EE",
    border: "#D8DFD6",
    borderSoft: "#E5EAE2",
    text: "#2B3431",
    muted: "#68766F",
    faint: "#9AA69E",
    accent: "#2E9E77",
    accentText: "#FFFFFF",
    accentSoft: "rgba(46,158,119,0.10)",
    amber: "#B8862F",
    amberSoft: "rgba(184,134,47,0.10)",
    red: "#D65F4E",
    green: "#2E9E77",
    blue: "#3E7FB8",
    chipBg: "rgba(0,0,0,0.04)",
    chartGasto: "#A63E30",
    chartIngreso: "#3EA373",
  },
};

const ThemeContext = createContext(THEMES.dark);
const useTheme = () => useContext(ThemeContext);

const FREQS = [
  { id: "mensual", label: "Mensual" },
  { id: "anual", label: "Anual" },
  { id: "esporadico", label: "Esporádico" },
];

const MESES_OPCIONES = [3, 6, 9, 12, 18, 24, 36];

const fmt = new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" });
const money = (n) => fmt.format(n || 0);

const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
const todayISO = () => new Date().toISOString().slice(0, 10);

const MONTH_NAMES = ["enero","febrero","marzo","abril","mayo","junio","julio","agosto","septiembre","octubre","noviembre","diciembre"];
const MONTH_SHORT = ["ene","feb","mar","abr","may","jun","jul","ago","sep","oct","nov","dic"];

// Almacenamiento: usa window.storage dentro de Claude, o localStorage en el navegador
const store = {
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

const seedCategories = [
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

const EMPTY = { accounts: [], cards: [], categories: seedCategories, movements: [], inbox: [], recurring: [], theme: "dark" };

// ---------- Componentes base ----------
function Field({ label, children }) {
  const C = useTheme();
  return (
    <label className="block">
      <span className="block text-xs uppercase tracking-wider mb-1" style={{ color: C.muted }}>{label}</span>
      {children}
    </label>
  );
}

function useInputStyle() {
  const C = useTheme();
  return {
    background: C.bg,
    border: `1px solid ${C.border}`,
    color: C.text,
    borderRadius: 8,
    padding: "8px 10px",
    width: "100%",
    fontSize: 14,
    outline: "none",
  };
}

function TextInput(props) {
  const base = useInputStyle();
  return <input {...props} style={{ ...base, ...(props.style || {}) }} />;
}

function Select({ children, ...props }) {
  const base = useInputStyle();
  return (
    <select {...props} style={{ ...base, ...(props.style || {}) }}>
      {children}
    </select>
  );
}

function Btn({ children, kind = "primary", ...props }) {
  const C = useTheme();
  const styles = {
    primary: { background: C.accent, color: C.accentText, border: "1px solid transparent", fontWeight: 600 },
    ghost: { background: "transparent", color: C.muted, border: `1px solid ${C.border}` },
    danger: { background: "transparent", color: C.red, border: `1px solid ${C.border}` },
  };
  return (
    <button
      {...props}
      className={"rounded-lg px-3 py-2 text-sm transition-opacity hover:opacity-85 " + (props.className || "")}
      style={{ ...styles[kind], ...(props.style || {}) }}
    >
      {children}
    </button>
  );
}

function Chip({ children, color, bg }) {
  const C = useTheme();
  return (
    <span
      className="inline-block rounded-full px-2 py-0.5 text-xs"
      style={{ color: color || C.muted, background: bg || C.chipBg, border: `1px solid ${C.borderSoft}` }}
    >
      {children}
    </span>
  );
}

function Amount({ value, sign, size = "text-base" }) {
  const C = useTheme();
  const color = sign === "+" ? C.green : sign === "-" ? C.red : C.text;
  return (
    <span className={`font-mono ${size}`} style={{ color, fontVariantNumeric: "tabular-nums" }}>
      {sign === "+" ? "+" : sign === "-" ? "−" : ""}{money(Math.abs(value))}
    </span>
  );
}

function Card({ children, className = "", style = {} }) {
  const C = useTheme();
  return (
    <div className={"rounded-xl p-4 " + className} style={{ background: C.surface, border: `1px solid ${C.borderSoft}`, ...style }}>
      {children}
    </div>
  );
}

function SectionTitle({ children, right }) {
  const C = useTheme();
  return (
    <div className="flex items-center justify-between mb-3">
      <h2 className="text-sm uppercase tracking-widest" style={{ color: C.accent }}>{children}</h2>
      {right}
    </div>
  );
}

function Empty({ children }) {
  const C = useTheme();
  return (
    <div className="rounded-xl p-6 text-center text-sm" style={{ border: `1px dashed ${C.border}`, color: C.faint }}>
      {children}
    </div>
  );
}

// ---------- App ----------
export default function FinanzasApp() {
  const [data, setData] = useState(null);
  const [tab, setTab] = useState("resumen");
  const [saveError, setSaveError] = useState(false);

  // Cargar
  useEffect(() => {
    (async () => {
      try {
        const res = await store.get("finanzas:data");
        if (res && res.value) {
          const parsed = JSON.parse(res.value);
          setData(applyRecurring(applyInterest({ ...EMPTY, ...parsed })));
          return;
        }
      } catch (e) {
        // no hay datos guardados todavía
      }
      setData(EMPTY);
    })();
  }, []);

  // Guardar
  useEffect(() => {
    if (!data) return;
    (async () => {
      try {
        await store.set("finanzas:data", JSON.stringify(data));
        setSaveError(false);
      } catch (e) {
        setSaveError(true);
      }
    })();
  }, [data]);

  // Recordatorios de corte y pago: reprograma al arrancar y cuando cambian las tarjetas de crédito
  const remindersKey = data
    ? JSON.stringify(data.cards.filter((c) => c.type === "credito").map((c) => [c.id, c.name, c.last4, c.cutDay, c.payDay]))
    : "";
  useEffect(() => {
    if (!data) return;
    scheduleCardReminders(data.cards);
  }, [remindersKey]); // eslint-disable-line react-hooks/exhaustive-deps

  // Genera los cargos fijos vencidos cuando cambia la lista (p. ej. al crear uno con cobro hoy)
  const recurringCount = data?.recurring?.length || 0;
  useEffect(() => {
    if (!data) return;
    setData((d) => applyRecurring(d));
  }, [recurringCount]); // eslint-disable-line react-hooks/exhaustive-deps

  // Importa las notificaciones capturadas del celular a la bandeja "Por confirmar"
  const loaded = !!data;
  useEffect(() => {
    if (!loaded || !Capacitor.isNativePlatform()) return;
    (async () => {
      try {
        const { items } = await NotificationInbox.drain();
        if (!items || !items.length) return;
        setData((d) => {
          const existing = new Set((d.inbox || []).map((i) => i.id));
          const parsed = items
            .map((it) => parseCapturedNotification(it, d.cards))
            .filter((p) => p && !existing.has(p.id));
          return parsed.length ? { ...d, inbox: [...parsed, ...(d.inbox || [])] } : d;
        });
      } catch (e) {
        // Plugin no disponible o error nativo: la app sigue sin bandeja
      }
    })();
  }, [loaded]);

  const mode = data?.theme === "light" ? "light" : "dark";
  const C = THEMES[mode];

  if (!data) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: C.bg, color: C.muted }}>
        <span className="text-sm tracking-widest uppercase">Cargando tus finanzas…</span>
      </div>
    );
  }

  const update = (patch) => setData((d) => ({ ...d, ...patch }));
  const toggleTheme = () => update({ theme: mode === "dark" ? "light" : "dark" });

  const tabs = [
    { id: "resumen", label: "Resumen" },
    { id: "cuentas", label: "Cuentas" },
    { id: "movimientos", label: "Movimientos" },
    { id: "fijos", label: "Fijos" },
    { id: "categorias", label: "Categorías" },
  ];

  return (
    <ThemeContext.Provider value={C}>
      <div className="min-h-screen" style={{ background: C.bg, color: C.text }}>
        <div className="max-w-4xl mx-auto px-4 pb-16">
          {/* Header */}
          <header className="pt-8 pb-5 flex items-start justify-between">
            <div>
              <div className="flex items-baseline gap-3">
                <h1 className="text-2xl font-semibold tracking-tight">
                  Mis <span style={{ color: C.accent }}>Finanzas</span>
                </h1>
                <span className="text-xs" style={{ color: C.faint }}>MXN · {new Date().getFullYear()}</span>
              </div>
              {saveError && (
                <p className="text-xs mt-1" style={{ color: C.red }}>
                  No se pudieron guardar los cambios. Reintenta con tu siguiente acción.
                </p>
              )}
            </div>
            <button
              onClick={toggleTheme}
              aria-label={mode === "dark" ? "Cambiar a tema claro" : "Cambiar a tema oscuro"}
              className="rounded-full px-3 py-1.5 text-sm flex items-center gap-2 transition-opacity hover:opacity-85"
              style={{ background: C.surface, border: `1px solid ${C.border}`, color: C.muted }}
            >
              <span aria-hidden="true">{mode === "dark" ? "☀️" : "🌙"}</span>
              <span className="hidden sm:inline">{mode === "dark" ? "Tema claro" : "Tema oscuro"}</span>
            </button>
          </header>

          {/* Tabs */}
          <nav className="flex gap-1 mb-6 rounded-xl p-1" style={{ background: C.surface, border: `1px solid ${C.borderSoft}` }}>
            {tabs.map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className="flex-1 rounded-lg py-2 text-sm transition-colors"
                style={tab === t.id
                  ? { background: C.accentSoft, color: C.accent, border: `1px solid ${C.border}`, fontWeight: 600 }
                  : { color: C.muted, border: "1px solid transparent" }}
              >
                {t.label}
              </button>
            ))}
          </nav>

          {tab === "resumen" && <Resumen data={data} update={update} />}
          {tab === "cuentas" && <Cuentas data={data} update={update} />}
          {tab === "movimientos" && <Movimientos data={data} update={update} />}
          {tab === "fijos" && <Fijos data={data} update={update} />}
          {tab === "categorias" && <Categorias data={data} update={update} />}
        </div>
      </div>
    </ThemeContext.Provider>
  );
}

// ---------- Helpers de datos ----------
function cardLabel(card, accounts) {
  const acc = accounts.find((a) => a.id === card.accountId);
  return `${card.name}${card.last4 ? " ····" + card.last4 : ""} · ${acc ? acc.name : "?"}`;
}

function movTotal(m) {
  return (Number(m.amount) || 0) + (Number(m.commission) || 0);
}

// Saldo por tarjeta: crédito = deuda (gastos - pagos), débito/ahorro = saldo (ingresos - gastos)
function balanceOfCard(card, movements) {
  const g = movements.filter((m) => m.cardId === card.id && m.type === "gasto").reduce((s, m) => s + movTotal(m), 0);
  const p = movements.filter((m) => m.cardId === card.id && m.type === "ingreso").reduce((s, m) => s + movTotal(m), 0);
  return card.type === "credito" ? g - p : p - g;
}

// ---------- Corte y pago de tarjetas de crédito ----------
const clampDay = (v) => { const n = parseInt(v, 10); return n >= 1 && n <= 31 ? n : null; };

// Fecha con el día pedido dentro del mes (en meses cortos se recorre al último día)
function dateWithDay(year, month, day) {
  const last = new Date(year, month + 1, 0).getDate();
  return new Date(year, month, Math.min(day, last));
}

// Último corte en o antes de `today`
function lastCutDate(cutDay, today) {
  const d = dateWithDay(today.getFullYear(), today.getMonth(), cutDay);
  return d <= today ? d : dateWithDay(today.getFullYear(), today.getMonth() - 1, cutDay);
}

// Cuántos cortes han pasado desde la compra (inclusive) hasta lastCut
function cutsSince(dateStr, cutDay, lastCut) {
  const purchase = new Date(dateStr + "T00:00:00");
  let y = purchase.getFullYear(), mo = purchase.getMonth(), count = 0;
  for (let i = 0; i < 1200; i++) {
    const cut = dateWithDay(y, mo, cutDay);
    if (cut > lastCut) break;
    if (cut >= purchase) count++;
    mo++; if (mo > 11) { mo = 0; y++; }
  }
  return count;
}

// Estado de cuenta de una tarjeta de crédito:
// - toPay: lo exigible este mes = cargos devengados al corte − todos los pagos.
//   En MSI solo devengan las mensualidades cuyos cortes ya pasaron.
// - periodSpend: gasto del periodo actual (compras después del corte; en MSI, la mensualidad próxima)
// - dueDate: fecha límite de pago siguiente al corte
function creditStatement(card, movements, today = new Date()) {
  const cutDay = clampDay(card.cutDay);
  if (!cutDay) return null;
  const lastCut = lastCutDate(cutDay, today);
  let accruedAtCut = 0, periodSpend = 0, paid = 0;
  for (const m of movements) {
    if (m.cardId !== card.id) continue;
    const total = movTotal(m);
    if (m.type === "ingreso") { paid += total; continue; }
    const monthsN = Number(m.months) || 1;
    if (monthsN > 1) {
      const due = Math.min(cutsSince(m.date, cutDay, lastCut), monthsN);
      accruedAtCut += (total / monthsN) * due;
      if (due < monthsN) periodSpend += total / monthsN;
    } else if (new Date(m.date + "T00:00:00") <= lastCut) {
      accruedAtCut += total;
    } else {
      periodSpend += total;
    }
  }
  const payDay = clampDay(card.payDay);
  let dueDate = null;
  if (payDay) {
    dueDate = dateWithDay(lastCut.getFullYear(), lastCut.getMonth(), payDay);
    if (dueDate <= lastCut) dueDate = dateWithDay(lastCut.getFullYear(), lastCut.getMonth() + 1, payDay);
  }
  return {
    lastCut,
    toPay: Math.max(Math.round((accruedAtCut - paid) * 100) / 100, 0),
    periodSpend: Math.round(periodSpend * 100) / 100,
    dueDate,
  };
}

const fmtDia = (d) => `${d.getDate()} ${MONTH_SHORT[d.getMonth()]}`;

// ---------- Cargos fijos mensuales (suscripciones, servicios…) ----------
const isoOf = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

// Primera ocurrencia del día de cobro en o después de la fecha dada
function firstOccurrenceOnOrAfter(dateStr, day) {
  const from = new Date(dateStr + "T00:00:00");
  const d = dateWithDay(from.getFullYear(), from.getMonth(), day);
  return d >= from ? d : dateWithDay(from.getFullYear(), from.getMonth() + 1, day);
}

// Siguiente ocurrencia estrictamente después de la fecha dada
function nextOccurrence(dateStr, day) {
  const after = new Date(dateStr + "T00:00:00");
  const d = dateWithDay(after.getFullYear(), after.getMonth(), day);
  return d > after ? d : dateWithDay(after.getFullYear(), after.getMonth() + 1, day);
}

// Próximo cobro pendiente de un cargo fijo (null si ya terminó)
function nextChargeOf(r) {
  const day = clampDay(r.day);
  if (!day) return null;
  const cursor = r.lastApplied ? nextOccurrence(r.lastApplied, day) : firstOccurrenceOnOrAfter(r.createdAt, day);
  if (r.endDate && cursor > new Date(r.endDate + "T00:00:00")) return null;
  return cursor;
}

// Genera los movimientos vencidos de cada cargo fijo (corre al cargar y al editar la lista)
function applyRecurring(data) {
  const today = new Date(todayISO() + "T00:00:00");
  let movements = data.movements;
  let changed = false;
  const recurring = (data.recurring || []).map((r) => {
    const day = clampDay(r.day);
    if (!day) return r;
    const end = r.endDate ? new Date(r.endDate + "T00:00:00") : null;
    let cursor = r.lastApplied ? nextOccurrence(r.lastApplied, day) : firstOccurrenceOnOrAfter(r.createdAt, day);
    let last = r.lastApplied;
    const generated = [];
    while (cursor <= today && (!end || cursor <= end) && generated.length < 120) {
      const dateStr = isoOf(cursor);
      generated.push({
        id: uid(),
        cardId: r.cardId,
        type: "gasto",
        amount: Number(r.amount) || 0,
        description: r.description,
        categoryId: r.categoryId || null,
        date: dateStr,
        months: 1,
        commission: 0,
        recurring: true,
        recurringId: r.id,
      });
      last = dateStr;
      cursor = nextOccurrence(dateStr, day);
    }
    if (!generated.length) return r;
    movements = [...generated, ...movements];
    changed = true;
    return { ...r, lastApplied: last };
  });
  return changed ? { ...data, recurring, movements } : data;
}

// ---------- Bandeja: notificaciones del banco → movimientos por confirmar ----------
// Interpreta una notificación capturada: saca el monto, adivina la tarjeta por los
// últimos 4 dígitos y el tipo por palabras clave. Si no encuentra la tarjeta, la
// deja en blanco para que el usuario la elija, pero el monto siempre queda puesto.
function parseCapturedNotification(item, cards) {
  const text = `${item.title || ""} ${item.text || ""}`.trim();
  const moneyMatch = text.match(/\$\s?(\d[\d,]*(?:\.\d{1,2})?)/);
  if (!moneyMatch) return null;
  const amount = parseFloat(moneyMatch[1].replace(/,/g, ""));
  if (!amount || amount <= 0) return null;
  const last4Match = text.match(/(?:terminaci[oó]n|term\.?|tarjeta|\*{2,}|·{2,}|x{2,})\s*[·*x]*\s*(\d{4})(?!\d)/i);
  // Busca por los dígitos de la tarjeta física o de su tarjeta digital asociada
  const card = last4Match
    ? cards.find((c) => c.last4 === last4Match[1] || c.digitalLast4 === last4Match[1])
    : null;
  const isIncome = /dep[oó]sito|abono|recibiste|te envi[oó]|n[oó]mina|rendimiento/i.test(text);
  const d = new Date(Number(item.time) || Date.now());
  return {
    id: item.id,
    amount,
    cardId: card ? card.id : "",
    type: isIncome ? "ingreso" : "gasto",
    date: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`,
    text: text.slice(0, 200),
  };
}

// ---------- Notificaciones de corte y pago (solo en el APK de Android) ----------
// Pide permiso y programa un aviso a las 9:00 del día de corte y del día de pago
// de cada tarjeta de crédito (las próximas 2 fechas de cada una). Se reprograma
// todo en cada arranque y cada vez que cambian las tarjetas.
async function scheduleCardReminders(cards) {
  if (!Capacitor.isNativePlatform()) return;
  try {
    let perm = await LocalNotifications.checkPermissions();
    if (perm.display === "prompt" || perm.display === "prompt-with-rationale") {
      perm = await LocalNotifications.requestPermissions();
    }
    if (perm.display !== "granted") return;

    const pending = await LocalNotifications.getPending();
    if (pending.notifications.length) await LocalNotifications.cancel(pending);

    const now = new Date();
    const nextDates = (day, count) => {
      const out = [];
      for (let i = 0; out.length < count && i < count + 2; i++) {
        const d = dateWithDay(now.getFullYear(), now.getMonth() + i, day);
        d.setHours(9, 0, 0, 0);
        if (d > now) out.push(d);
      }
      return out;
    };

    const notifications = [];
    let id = 1;
    for (const card of cards) {
      if (card.type !== "credito") continue;
      const label = `${card.name}${card.last4 ? " ····" + card.last4 : ""}`;
      const cutDay = clampDay(card.cutDay);
      const payDay = clampDay(card.payDay);
      for (const at of cutDay ? nextDates(cutDay, 2) : []) {
        notifications.push({
          id: id++,
          title: "Corte de tarjeta",
          body: `Hoy es la fecha de corte de tu tarjeta ${label}.`,
          schedule: { at, allowWhileIdle: true },
        });
      }
      for (const at of payDay ? nextDates(payDay, 2) : []) {
        notifications.push({
          id: id++,
          title: "Pago de tarjeta",
          body: `Hoy es la fecha límite de pago de tu tarjeta ${label}. Abre la app para ver cuánto pagar.`,
          schedule: { at, allowWhileIdle: true },
        });
      }
    }
    if (notifications.length) await LocalNotifications.schedule({ notifications });
  } catch (e) {
    // Sin plugin o sin permiso: la app funciona igual, solo sin recordatorios
  }
}

// Genera automáticamente los rendimientos de las cajas de ahorro (interés compuesto diario)
function applyInterest(data) {
  const today = todayISO();
  let movements = [...data.movements];
  let changed = false;
  const cards = data.cards.map((card) => {
    if (card.type !== "ahorro") return card;
    if (!card.lastAccrual) {
      changed = true;
      return { ...card, lastAccrual: today };
    }
    const days = Math.floor((new Date(today + "T00:00:00") - new Date(card.lastAccrual + "T00:00:00")) / 86400000);
    if (days < 1) return card;
    const rate = Number(card.rate) || 0;
    if (rate > 0) {
      const balance = balanceOfCard(card, movements);
      if (balance > 0) {
        const interest = Math.round(balance * (Math.pow(1 + rate / 100 / 365, days) - 1) * 100) / 100;
        if (interest >= 0.01) {
          movements = [{
            id: uid(),
            cardId: card.id,
            type: "ingreso",
            amount: interest,
            description: `Rendimientos ${rate}% anual (${days} ${days === 1 ? "día" : "días"})`,
            categoryId: null,
            date: today,
            months: 1,
            commission: 0,
            interest: true,
          }, ...movements];
        }
      }
    }
    changed = true;
    return { ...card, lastAccrual: today };
  });
  return changed ? { ...data, cards, movements } : data;
}

// ---------- Gráfica de gastos e ingresos por mes ----------
function useContainerWidth() {
  const [width, setWidth] = useState(0);
  const roRef = useRef(null);
  const ref = useCallback((node) => {
    if (roRef.current) { roRef.current.disconnect(); roRef.current = null; }
    if (node) {
      const ro = new ResizeObserver((entries) => setWidth(entries[0].contentRect.width));
      ro.observe(node);
      roRef.current = ro;
    }
  }, []);
  return [ref, width];
}

// Redondea el tope del eje a un número limpio (paso 1 / 2 / 2.5 / 5 × 10^n, 4 divisiones)
function niceScale(maxValue) {
  if (maxValue <= 0) return { max: 4, step: 1 };
  const raw = maxValue / 4;
  const pow = Math.pow(10, Math.floor(Math.log10(raw)));
  const f = raw / pow;
  const step = (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * pow;
  return { max: step * 4, step };
}

const tickLabel = (v) => (v >= 1000 ? `$${+(v / 1000).toFixed(1)}k` : `$${v}`);

function GraficaMensual({ counted }) {
  const C = useTheme();
  const [containerRef, width] = useContainerWidth();
  const [vista, setVista] = useState("grafica");
  const [sel, setSel] = useState(5); // mes actual

  const now = new Date();
  const meses = useMemo(() => {
    return Array.from({ length: 6 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - 5 + i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const sum = (type) => counted
        .filter((m) => m.type === type && !m.adjust && !m.transfer && m.date.startsWith(key))
        .reduce((s, m) => s + movTotal(m), 0);
      return { key, label: MONTH_SHORT[d.getMonth()], year: d.getFullYear(), gastos: sum("gasto"), ingresos: sum("ingreso") };
    });
  }, [counted]); // eslint-disable-line react-hooks/exhaustive-deps

  const hayDatos = meses.some((m) => m.gastos > 0 || m.ingresos > 0);
  const { max: yMax, step } = niceScale(Math.max(...meses.map((m) => Math.max(m.gastos, m.ingresos))));
  const ticks = [0, 1, 2, 3, 4].map((i) => i * step);

  // Geometría
  const padL = 44, padR = 8, padT = 8, plotH = 180, labelH = 24;
  const svgH = padT + plotH + labelH;
  const plotW = Math.max(width - padL - padR, 0);
  const band = plotW / 6;
  const barW = Math.max(Math.min(24, (band - 18) / 2), 4);
  const baseY = padT + plotH;
  const yOf = (v) => baseY - (v / yMax) * plotH;

  const selMes = meses[sel];

  const Swatch = ({ color }) => (
    <span aria-hidden="true" className="inline-block rounded-sm" style={{ width: 10, height: 10, background: color }} />
  );

  return (
    <Card>
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        {/* Leyenda */}
        <div className="flex items-center gap-4 text-xs" style={{ color: C.muted }}>
          <span className="flex items-center gap-1.5"><Swatch color={C.chartGasto} /> Gastos</span>
          <span className="flex items-center gap-1.5"><Swatch color={C.chartIngreso} /> Ingresos</span>
        </div>
        <Btn kind="ghost" style={{ padding: "4px 10px" }} onClick={() => setVista((v) => (v === "grafica" ? "tabla" : "grafica"))}>
          {vista === "grafica" ? "Ver tabla" : "Ver gráfica"}
        </Btn>
      </div>

      {!hayDatos ? (
        <Empty>Sin movimientos en los últimos 6 meses.</Empty>
      ) : vista === "tabla" ? (
        <table className="w-full text-sm">
          <thead>
            <tr className="text-xs uppercase tracking-wider" style={{ color: C.muted }}>
              <th className="text-left py-1.5 font-normal">Mes</th>
              <th className="text-right py-1.5 font-normal">Gastos</th>
              <th className="text-right py-1.5 font-normal">Ingresos</th>
            </tr>
          </thead>
          <tbody>
            {meses.map((m) => (
              <tr key={m.key} style={{ borderTop: `1px solid ${C.borderSoft}` }}>
                <td className="py-1.5" style={{ color: C.muted }}>{m.label} {m.year}</td>
                <td className="py-1.5 text-right font-mono" style={{ fontVariantNumeric: "tabular-nums" }}>{money(m.gastos)}</td>
                <td className="py-1.5 text-right font-mono" style={{ fontVariantNumeric: "tabular-nums" }}>{money(m.ingresos)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <div ref={containerRef}>
          {width > 0 && (
            <svg width={width} height={svgH} role="img" aria-label="Gráfica de gastos e ingresos por mes de los últimos 6 meses">
              <clipPath id="gm-plot">
                <rect x={padL} y={padT} width={plotW} height={plotH} />
              </clipPath>
              {/* Rejilla y ticks del eje Y */}
              {ticks.map((t) => (
                <g key={t}>
                  <line x1={padL} x2={padL + plotW} y1={yOf(t)} y2={yOf(t)} stroke={t === 0 ? C.border : C.borderSoft} strokeWidth="1" />
                  <text x={padL - 6} y={yOf(t) + 3.5} textAnchor="end" fontSize="10" fill={C.faint} style={{ fontVariantNumeric: "tabular-nums" }}>
                    {tickLabel(t)}
                  </text>
                </g>
              ))}
              {/* Columnas: extremo superior redondeado, base cuadrada vía clip */}
              <g clipPath="url(#gm-plot)">
                {meses.map((m, i) => {
                  const x0 = padL + i * band + (band - (barW * 2 + 2)) / 2;
                  const dim = sel === i ? 0.8 : 1;
                  return (
                    <g key={m.key} opacity={dim}>
                      {m.gastos > 0 && <rect x={x0} y={yOf(m.gastos)} width={barW} height={baseY - yOf(m.gastos) + 4} rx="4" fill={C.chartGasto} />}
                      {m.ingresos > 0 && <rect x={x0 + barW + 2} y={yOf(m.ingresos)} width={barW} height={baseY - yOf(m.ingresos) + 4} rx="4" fill={C.chartIngreso} />}
                    </g>
                  );
                })}
              </g>
              {/* Etiquetas de mes y zonas de toque (más grandes que las marcas) */}
              {meses.map((m, i) => (
                <g key={m.key}>
                  <text x={padL + i * band + band / 2} y={svgH - 8} textAnchor="middle" fontSize="10" fill={sel === i ? C.text : C.faint}>
                    {m.label}
                  </text>
                  <rect
                    x={padL + i * band} y={padT} width={band} height={plotH + labelH} fill="transparent"
                    tabIndex={0} role="button" aria-label={`${MONTH_NAMES[parseInt(m.key.slice(5), 10) - 1]}: gastos ${money(m.gastos)}, ingresos ${money(m.ingresos)}`}
                    style={{ cursor: "pointer", outline: "none" }}
                    onPointerEnter={() => setSel(i)} onClick={() => setSel(i)} onFocus={() => setSel(i)}
                  />
                </g>
              ))}
            </svg>
          )}
          {/* Lectura del mes seleccionado (tooltip fijo: funciona también en táctil) */}
          <div className="flex items-center gap-4 mt-2 text-xs flex-wrap" style={{ color: C.muted }}>
            <span className="uppercase tracking-wider">{MONTH_NAMES[parseInt(selMes.key.slice(5), 10) - 1]} {selMes.year}</span>
            <span className="flex items-center gap-1.5">
              <Swatch color={C.chartGasto} />
              <span className="font-mono" style={{ color: C.text, fontVariantNumeric: "tabular-nums" }}>{money(selMes.gastos)}</span> gastos
            </span>
            <span className="flex items-center gap-1.5">
              <Swatch color={C.chartIngreso} />
              <span className="font-mono" style={{ color: C.text, fontVariantNumeric: "tabular-nums" }}>{money(selMes.ingresos)}</span> ingresos
            </span>
          </div>
        </div>
      )}
    </Card>
  );
}

// ---------- Resumen ----------
function Resumen({ data, update }) {
  const C = useTheme();
  const now = new Date();
  const [payFor, setPayFor] = useState(null); // cardId de la tarjeta a pagar
  const [paySrc, setPaySrc] = useState("");
  const [payAmt, setPayAmt] = useState("");
  const [payDate, setPayDate] = useState(todayISO());
  const [payError, setPayError] = useState("");
  const ym = now.toISOString().slice(0, 7);
  const year = String(now.getFullYear());

  const { accounts, cards, categories, movements } = data;

  const catById = useMemo(() => Object.fromEntries(categories.map((c) => [c.id, c])), [categories]);
  const cardById = useMemo(() => Object.fromEntries(cards.map((c) => [c.id, c])), [cards]);
  const accById = useMemo(() => Object.fromEntries(accounts.map((a) => [a.id, a])), [accounts]);

  // Solo entran a la contabilización las tarjetas no excluidas cuya cuenta tampoco esté excluida
  const isCountedCard = (c) => c && !c.excluded && !(accById[c.accountId]?.excluded);
  const counted = movements.filter((m) => isCountedCard(cardById[m.cardId]));
  const excludedCount = cards.filter((c) => !isCountedCard(c)).length;

  const gastosMes = counted.filter((m) => m.type === "gasto" && !m.adjust && !m.transfer && m.date.startsWith(ym));
  const ingresosMes = counted.filter((m) => m.type === "ingreso" && !m.adjust && !m.transfer && m.date.startsWith(ym));
  const totalGastosMes = gastosMes.reduce((s, m) => s + movTotal(m), 0);
  const totalIngresosMes = ingresosMes.reduce((s, m) => s + movTotal(m), 0);

  // Agrupar gastos por frecuencia de su categoría
  const groupByFreq = (freq, period) =>
    counted
      .filter((m) => m.type === "gasto" && !m.adjust && !m.transfer && (catById[m.categoryId]?.freq || "esporadico") === freq && m.date.startsWith(period))
      .reduce((acc, m) => {
        const key = m.categoryId || "sin";
        acc[key] = (acc[key] || 0) + movTotal(m);
        return acc;
      }, {});

  const mensuales = groupByFreq("mensual", ym);
  const anuales = groupByFreq("anual", year);
  const esporadicos = groupByFreq("esporadico", ym);

  const sum = (obj) => Object.values(obj).reduce((s, v) => s + v, 0);

  // Balance total: dinero disponible (débito, ahorro y efectivo) de lo contabilizado
  const totalBalance = cards
    .filter((c) => isCountedCard(c) && c.type !== "credito")
    .reduce((s, c) => s + balanceOfCard(c, movements), 0);

  // Deuda de tarjetas de crédito: gastos - pagos/ingresos
  const creditCards = cards.filter((c) => c.type === "credito" && isCountedCard(c));
  const debtByCard = creditCards.map((c) => {
    const g = movements.filter((m) => m.cardId === c.id && m.type === "gasto").reduce((s, m) => s + movTotal(m), 0);
    const p = movements.filter((m) => m.cardId === c.id && m.type === "ingreso").reduce((s, m) => s + movTotal(m), 0);
    return { card: c, debt: g - p, statement: creditStatement(c, movements, now) };
  });
  const totalDebt = debtByCard.reduce((s, d) => s + d.debt, 0);
  const totalToPay = debtByCard.reduce((s, d) => s + (d.statement ? d.statement.toPay : 0), 0);

  // Pago de tarjeta: transferencia (no cuenta como gasto/ingreso en la contabilización)
  const sourceCards = cards.filter((c) => c.type !== "credito");
  const openPay = (card, statement, debt) => {
    if (payFor === card.id) { setPayFor(null); return; }
    setPayFor(card.id);
    setPaySrc("");
    setPayAmt((statement && statement.toPay > 0 ? statement.toPay : Math.max(debt, 0)).toFixed(2));
    setPayDate(todayISO());
    setPayError("");
  };
  const doPay = (card) => {
    const amt = parseFloat(payAmt);
    const src = cards.find((c) => c.id === paySrc);
    if (!src) return setPayError("Elige la cuenta desde la que pagas.");
    if (!amt || amt <= 0) return setPayError("Escribe un monto mayor a cero.");
    const tid = uid();
    const base = { categoryId: null, date: payDate, months: 1, commission: 0, transfer: true, transferId: tid };
    update({
      movements: [
        { ...base, id: uid(), cardId: src.id, type: "gasto", amount: amt, description: `Pago de tarjeta ${card.name}` },
        { ...base, id: uid(), cardId: card.id, type: "ingreso", amount: amt, description: `Pago desde ${src.name}` },
        ...movements,
      ],
    });
    setPayFor(null); setPayError("");
  };

  // Cajas de ahorro
  const savingsCards = cards.filter((c) => c.type === "ahorro" && isCountedCard(c));
  const savingsByCard = savingsCards.map((c) => {
    const balance = balanceOfCard(c, movements);
    const rate = Number(c.rate) || 0;
    return { card: c, balance, rate, monthlyYield: (balance * rate) / 100 / 12 };
  });
  const totalSavings = savingsByCard.reduce((s, d) => s + d.balance, 0);
  const interesesYear = counted
    .filter((m) => m.interest && m.date.startsWith(year))
    .reduce((s, m) => s + movTotal(m), 0);

  // Compras a meses activas
  const msi = counted
    .filter((m) => m.type === "gasto" && Number(m.months) > 1)
    .map((m) => {
      const total = movTotal(m);
      const mensualidad = total / Number(m.months);
      const start = new Date(m.date + "T00:00:00");
      const elapsed = (now.getFullYear() - start.getFullYear()) * 12 + (now.getMonth() - start.getMonth());
      const pagados = Math.min(Math.max(elapsed, 0), Number(m.months));
      return { ...m, total, mensualidad, pagados, restantes: Number(m.months) - pagados };
    })
    .filter((m) => m.restantes > 0)
    .sort((a, b) => a.restantes - b.restantes);

  const FreqBlock = ({ title, group, note }) => (
    <Card>
      <div className="flex items-baseline justify-between mb-2">
        <h3 className="text-sm font-medium" style={{ color: C.text }}>{title}</h3>
        <Amount value={sum(group)} sign="-" size="text-sm" />
      </div>
      <p className="text-xs mb-3" style={{ color: C.faint }}>{note}</p>
      {Object.keys(group).length === 0 ? (
        <p className="text-xs" style={{ color: C.faint }}>Sin gastos registrados.</p>
      ) : (
        <ul className="space-y-1.5">
          {Object.entries(group)
            .sort((a, b) => b[1] - a[1])
            .map(([catId, total]) => (
              <li key={catId} className="flex justify-between text-sm">
                <span style={{ color: C.muted }}>{catById[catId]?.name || "Sin categoría"}</span>
                <span className="font-mono" style={{ color: C.text, fontVariantNumeric: "tabular-nums" }}>{money(total)}</span>
              </li>
            ))}
        </ul>
      )}
    </Card>
  );

  return (
    <div className="space-y-6">
      {excludedCount > 0 && (
        <p className="text-xs" style={{ color: C.faint }}>
          {excludedCount === 1 ? "1 tarjeta está fuera de la contabilización" : `${excludedCount} tarjetas están fuera de la contabilización`}; sus movimientos no se incluyen en este resumen. Puedes activarlas en la pestaña Cuentas.
        </p>
      )}
      {/* Balance total de lo contabilizado */}
      <Card>
        <p className="text-xs uppercase tracking-wider mb-1" style={{ color: C.muted }}>Balance total</p>
        <span className="font-mono text-4xl" style={{ color: totalBalance < 0 ? C.red : C.text }}>
          {money(totalBalance)}
        </span>
        <p className="text-xs mt-2" style={{ color: C.faint }}>
          Suma de débito, ahorro y efectivo de las cuentas contabilizadas · no descuenta la deuda en crédito
        </p>
      </Card>

      {/* Cifras del mes */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <Card>
          <p className="text-xs uppercase tracking-wider mb-1" style={{ color: C.muted }}>Gastos de {MONTH_NAMES[now.getMonth()]}</p>
          <Amount value={totalGastosMes} sign="-" size="text-2xl" />
        </Card>
        <Card>
          <p className="text-xs uppercase tracking-wider mb-1" style={{ color: C.muted }}>Ingresos de {MONTH_NAMES[now.getMonth()]}</p>
          <Amount value={totalIngresosMes} sign="+" size="text-2xl" />
        </Card>
        <Card>
          <p className="text-xs uppercase tracking-wider mb-1" style={{ color: C.muted }}>Deuda en crédito</p>
          <span className="font-mono text-2xl" style={{ color: totalDebt > 0 ? C.amber : C.green, fontVariantNumeric: "tabular-nums" }}>
            {money(totalDebt)}
          </span>
        </Card>
        <Card>
          <p className="text-xs uppercase tracking-wider mb-1" style={{ color: C.muted }}>Ahorro total</p>
          <span className="font-mono text-2xl" style={{ color: C.accent, fontVariantNumeric: "tabular-nums" }}>
            {money(totalSavings)}
          </span>
        </Card>
      </div>

      {/* Gastos e ingresos por mes */}
      <div>
        <SectionTitle>Gastos e ingresos por mes</SectionTitle>
        <GraficaMensual counted={counted} />
      </div>

      {/* Cajas de ahorro */}
      {savingsCards.length > 0 && (
        <div>
          <SectionTitle right={interesesYear > 0 ? (
            <span className="text-xs" style={{ color: C.green }}>+{money(interesesYear)} en rendimientos este año</span>
          ) : null}>
            Cajas de ahorro
          </SectionTitle>
          <div className="space-y-2">
            {savingsByCard.map(({ card, balance, rate, monthlyYield }) => (
              <Card key={card.id} className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm truncate">{cardLabel(card, accounts)}</span>
                    <Chip color={C.accent} bg={C.accentSoft}>{rate}% anual</Chip>
                  </div>
                  {rate > 0 && balance > 0 && (
                    <p className="text-xs mt-1" style={{ color: C.faint }}>
                      Genera ≈ {money(monthlyYield)} al mes · se abona automáticamente cada día
                    </p>
                  )}
                </div>
                <span className="font-mono text-sm shrink-0" style={{ color: C.accent, fontVariantNumeric: "tabular-nums" }}>
                  {money(balance)}
                </span>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Gastos por frecuencia */}
      <div>
        <SectionTitle>Gastos por tipo</SectionTitle>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <FreqBlock title="Mensuales" group={mensuales} note={`Mes actual (${MONTH_NAMES[now.getMonth()]})`} />
          <FreqBlock title="Anuales" group={anuales} note={`Acumulado ${year}`} />
          <FreqBlock title="Esporádicos" group={esporadicos} note={`Mes actual (${MONTH_NAMES[now.getMonth()]})`} />
        </div>
      </div>

      {/* Compras a meses */}
      <div>
        <SectionTitle>Compras a meses activas</SectionTitle>
        {msi.length === 0 ? (
          <Empty>No tienes compras a meses en curso. Al registrar un gasto con tarjeta de crédito puedes marcarlo "a meses".</Empty>
        ) : (
          <div className="space-y-2">
            {msi.map((m) => (
              <Card key={m.id} className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm truncate">{m.description || "Compra a meses"}</p>
                  <p className="text-xs mt-0.5" style={{ color: C.faint }}>
                    {cardById[m.cardId] ? cardLabel(cardById[m.cardId], accounts) : "Tarjeta eliminada"}
                    {Number(m.commission) > 0 && <> · comisión {money(m.commission)}</>}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="font-mono text-sm" style={{ fontVariantNumeric: "tabular-nums" }}>
                    {money(m.mensualidad)}<span style={{ color: C.faint }}>/mes</span>
                  </p>
                  <p className="text-xs" style={{ color: C.amber }}>{m.restantes} de {m.months} meses restantes</p>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Tarjetas de crédito: deuda, estado de cuenta y pago */}
      {creditCards.length > 0 && (
        <div>
          <SectionTitle right={totalToPay > 0 ? (
            <span className="text-xs" style={{ color: C.amber }}>Pago del mes: {money(totalToPay)}</span>
          ) : null}>
            Tarjetas de crédito
          </SectionTitle>
          <div className="space-y-2">
            {debtByCard.map(({ card, debt, statement }) => (
              <Card key={card.id}>
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div className="min-w-0">
                    <span className="text-sm">{cardLabel(card, accounts)}</span>
                    <div className="flex gap-2 mt-1 flex-wrap">
                      {statement ? (
                        <>
                          <Chip color={C.faint}>Corte: día {clampDay(card.cutDay)}</Chip>
                          {statement.dueDate && (
                            <Chip color={C.amber} bg={C.amberSoft}>Paga antes del {fmtDia(statement.dueDate)}</Chip>
                          )}
                        </>
                      ) : (
                        <Chip color={C.faint}>Sin día de corte · configúralo en Cuentas</Chip>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <div className="text-right">
                      <p className="text-xs" style={{ color: C.faint }}>Deuda total</p>
                      <span className="font-mono text-sm" style={{ color: debt > 0 ? C.red : C.green, fontVariantNumeric: "tabular-nums" }}>
                        {money(debt)}
                      </span>
                    </div>
                    <Btn kind="ghost" onClick={() => openPay(card, statement, debt)}>
                      {payFor === card.id ? "Cancelar" : "Pagar"}
                    </Btn>
                  </div>
                </div>

                {statement && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
                    <div className="rounded-lg px-3 py-2" style={{ background: C.bg, border: `1px solid ${C.borderSoft}` }}>
                      <p className="text-xs" style={{ color: C.faint }}>Gasto del periodo (desde el {fmtDia(statement.lastCut)})</p>
                      <span className="font-mono text-sm" style={{ fontVariantNumeric: "tabular-nums" }}>{money(statement.periodSpend)}</span>
                    </div>
                    <div className="rounded-lg px-3 py-2" style={{ background: C.bg, border: `1px solid ${C.borderSoft}` }}>
                      <p className="text-xs" style={{ color: C.faint }}>Pago de este mes (saldo al corte)</p>
                      <span className="font-mono text-sm" style={{ color: statement.toPay > 0 ? C.amber : C.green, fontVariantNumeric: "tabular-nums" }}>
                        {money(statement.toPay)}
                      </span>
                    </div>
                  </div>
                )}

                {payFor === card.id && (
                  <div className="mt-3 rounded-lg p-3" style={{ background: C.surface2, border: `1px solid ${C.border}` }}>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <Field label="Pagar desde">
                        <Select value={paySrc} onChange={(e) => setPaySrc(e.target.value)}>
                          <option value="">— Elegir cuenta —</option>
                          {sourceCards.map((c) => (
                            <option key={c.id} value={c.id}>{cardLabel(c, accounts)} · {money(balanceOfCard(c, movements))}</option>
                          ))}
                        </Select>
                      </Field>
                      <Field label="Monto (MXN)">
                        <TextInput type="number" min="0" step="0.01" value={payAmt} onChange={(e) => setPayAmt(e.target.value)} />
                      </Field>
                      <Field label="Fecha">
                        <TextInput type="date" value={payDate} onChange={(e) => setPayDate(e.target.value)} />
                      </Field>
                    </div>
                    {payError && <p className="text-xs mt-2" style={{ color: C.red }}>{payError}</p>}
                    <p className="text-xs mt-2" style={{ color: C.faint }}>
                      Se registra como transferencia: baja la deuda de la tarjeta y el saldo de la cuenta elegida, sin contarse como gasto ni ingreso del mes.
                    </p>
                    <div className="mt-3">
                      <Btn onClick={() => doPay(card)}>Registrar pago</Btn>
                    </div>
                  </div>
                )}
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ---------- Cuentas ----------
function Cuentas({ data, update }) {
  const C = useTheme();
  const { accounts, cards, movements } = data;
  const [showAccForm, setShowAccForm] = useState(false);
  const [accName, setAccName] = useState("");
  const [accBank, setAccBank] = useState("");
  const [accType, setAccType] = useState("banco");
  const [cardFormFor, setCardFormFor] = useState(null); // accountId
  const [cardName, setCardName] = useState("");
  const [cardType, setCardType] = useState("debito");
  const [cardLast4, setCardLast4] = useState("");
  const [cardDigital4, setCardDigital4] = useState("");
  const [cardRate, setCardRate] = useState("");
  const [cardCutDay, setCardCutDay] = useState("");
  const [cardPayDay, setCardPayDay] = useState("");
  const [editBalFor, setEditBalFor] = useState(null); // cardId
  const [newBal, setNewBal] = useState("");
  const [newRate, setNewRate] = useState("");
  const [newCutDay, setNewCutDay] = useState("");
  const [newPayDay, setNewPayDay] = useState("");
  const [newDigital4, setNewDigital4] = useState("");

  const addAccount = () => {
    if (!accName.trim()) return;
    const account = { id: uid(), name: accName.trim(), bank: accType === "efectivo" ? "" : accBank.trim(), type: accType };
    const patch = { accounts: [...accounts, account] };
    if (accType === "efectivo") {
      // Una cuenta de efectivo trae su propia "cartera" para registrar movimientos
      patch.cards = [...cards, { id: uid(), accountId: account.id, name: "Efectivo", type: "efectivo", last4: "" }];
    }
    update(patch);
    setAccName(""); setAccBank(""); setAccType("banco"); setShowAccForm(false);
  };

  const toggleAccountCount = (id) =>
    update({ accounts: accounts.map((a) => (a.id === id ? { ...a, excluded: !a.excluded } : a)) });

  const toggleCardCount = (id) =>
    update({ cards: cards.map((c) => (c.id === id ? { ...c, excluded: !c.excluded } : c)) });

  const deleteAccount = (id) => {
    const accCards = cards.filter((c) => c.accountId === id).map((c) => c.id);
    if (!window.confirm("Se eliminará la cuenta, sus tarjetas y todos sus movimientos. ¿Continuar?")) return;
    update({
      accounts: accounts.filter((a) => a.id !== id),
      cards: cards.filter((c) => c.accountId !== id),
      movements: movements.filter((m) => !accCards.includes(m.cardId)),
    });
  };

  const addCard = (accountId) => {
    if (!cardName.trim()) return;
    const card = {
      id: uid(),
      accountId,
      name: cardName.trim(),
      type: cardType,
      last4: cardLast4.trim().slice(-4),
    };
    if (cardType === "ahorro") {
      card.rate = parseFloat(cardRate) || 0;
      card.lastAccrual = todayISO();
    }
    if (cardType === "credito") {
      card.cutDay = clampDay(cardCutDay);
      card.payDay = clampDay(cardPayDay);
    }
    if (cardType !== "ahorro" && cardDigital4) {
      card.digitalLast4 = cardDigital4;
    }
    update({ cards: [...cards, card] });
    setCardName(""); setCardType("debito"); setCardLast4(""); setCardDigital4(""); setCardRate(""); setCardCutDay(""); setCardPayDay(""); setCardFormFor(null);
  };

  const deleteCard = (id) => {
    if (!window.confirm("Se eliminará la tarjeta y todos sus movimientos. ¿Continuar?")) return;
    update({ cards: cards.filter((c) => c.id !== id), movements: movements.filter((m) => m.cardId !== id) });
  };

  const openBalanceEditor = (card) => {
    if (editBalFor === card.id) { setEditBalFor(null); return; }
    setEditBalFor(card.id);
    setNewBal(balanceOfCard(card, movements).toFixed(2));
    setNewRate(card.rate != null ? String(card.rate) : "");
    setNewCutDay(clampDay(card.cutDay) ? String(card.cutDay) : "");
    setNewPayDay(clampDay(card.payDay) ? String(card.payDay) : "");
    setNewDigital4(card.digitalLast4 || "");
  };

  const saveBalance = (card) => {
    const target = parseFloat(newBal);
    const patch = {};
    const cardPatch = {};
    // Actualizar tasa si es caja de ahorro
    if (card.type === "ahorro") {
      const r = parseFloat(newRate) || 0;
      if (r !== Number(card.rate)) cardPatch.rate = r;
    }
    // Actualizar días de corte y pago si es crédito
    if (card.type === "credito") {
      const cd = clampDay(newCutDay), pd = clampDay(newPayDay);
      if (cd !== clampDay(card.cutDay)) cardPatch.cutDay = cd;
      if (pd !== clampDay(card.payDay)) cardPatch.payDay = pd;
    }
    // Tarjeta digital asociada (débito y crédito)
    if (card.type === "debito" || card.type === "credito") {
      if (newDigital4 !== (card.digitalLast4 || "")) cardPatch.digitalLast4 = newDigital4;
    }
    if (Object.keys(cardPatch).length) {
      patch.cards = cards.map((c) => (c.id === card.id ? { ...c, ...cardPatch } : c));
    }
    // Ajustar saldo con un movimiento de ajuste (mantiene el historial cuadrado)
    if (!isNaN(target)) {
      const current = balanceOfCard(card, movements);
      const diff = Math.round((target - current) * 100) / 100;
      if (Math.abs(diff) >= 0.01) {
        const type = card.type === "credito"
          ? (diff > 0 ? "gasto" : "ingreso")   // subir deuda = gasto, bajarla = pago
          : (diff > 0 ? "ingreso" : "gasto");  // subir saldo = ingreso, bajarlo = gasto
        patch.movements = [{
          id: uid(),
          cardId: card.id,
          type,
          amount: Math.abs(diff),
          description: `Ajuste de saldo (${money(current)} → ${money(target)})`,
          categoryId: null,
          date: todayISO(),
          months: 1,
          commission: 0,
          adjust: true,
        }, ...movements];
      }
    }
    if (Object.keys(patch).length) update(patch);
    setEditBalFor(null);
  };

  return (
    <div className="space-y-4">
      <SectionTitle right={<Btn onClick={() => setShowAccForm((v) => !v)}>{showAccForm ? "Cancelar" : "+ Nueva cuenta"}</Btn>}>
        Tus cuentas
      </SectionTitle>

      {showAccForm && (
        <Card>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Field label="Tipo de cuenta">
              <Select value={accType} onChange={(e) => setAccType(e.target.value)}>
                <option value="banco">Cuenta bancaria</option>
                <option value="efectivo">Efectivo</option>
              </Select>
            </Field>
            <Field label="Nombre de la cuenta">
              <TextInput value={accName} onChange={(e) => setAccName(e.target.value)} placeholder={accType === "efectivo" ? "Ej. Cartera, Guardadito…" : "Ej. Cuenta principal"} />
            </Field>
            {accType === "banco" && (
              <Field label="Banco (opcional)">
                <TextInput value={accBank} onChange={(e) => setAccBank(e.target.value)} placeholder="Ej. BBVA, Banorte…" />
              </Field>
            )}
          </div>
          {accType === "efectivo" && (
            <p className="text-xs mt-2" style={{ color: C.faint }}>
              Las cuentas de efectivo no llevan tarjetas: se crea una cartera única donde registras entradas y salidas de dinero.
            </p>
          )}
          <div className="mt-3">
            <Btn onClick={addAccount}>Guardar cuenta</Btn>
          </div>
        </Card>
      )}

      {accounts.length === 0 && !showAccForm && (
        <Empty>Aún no tienes cuentas. Crea la primera con "+ Nueva cuenta" y después agrégale tarjetas de débito o crédito.</Empty>
      )}

      {accounts.map((acc) => {
        const accCards = cards.filter((c) => c.accountId === acc.id);
        const isCash = acc.type === "efectivo";
        return (
          <Card key={acc.id} style={acc.excluded ? { opacity: 0.55 } : {}}>
            <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-medium">{acc.name}</h3>
                  {isCash && <Chip color={C.green} bg={C.accentSoft}>Efectivo</Chip>}
                  {acc.excluded && <Chip color={C.faint}>Fuera de la contabilización</Chip>}
                </div>
                {acc.bank && <p className="text-xs" style={{ color: C.faint }}>{acc.bank}</p>}
              </div>
              <div className="flex gap-2 flex-wrap">
                <Btn kind="ghost" onClick={() => toggleAccountCount(acc.id)}>
                  {acc.excluded ? "Contabilizar" : "No contabilizar"}
                </Btn>
                {!isCash && (
                  <Btn kind="ghost" onClick={() => { setCardFormFor(cardFormFor === acc.id ? null : acc.id); setCardName(""); setCardType("debito"); setCardLast4(""); setCardDigital4(""); setCardRate(""); setCardCutDay(""); setCardPayDay(""); }}>
                    {cardFormFor === acc.id ? "Cancelar" : "+ Tarjeta"}
                  </Btn>
                )}
                <Btn kind="danger" onClick={() => deleteAccount(acc.id)}>Eliminar</Btn>
              </div>
            </div>

            {cardFormFor === acc.id && (
              <div className="rounded-lg p-3 mb-3" style={{ background: C.surface2, border: `1px solid ${C.border}` }}>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Field label={cardType === "ahorro" ? "Nombre de la caja" : "Nombre de la tarjeta"}>
                    <TextInput value={cardName} onChange={(e) => setCardName(e.target.value)} placeholder={cardType === "ahorro" ? "Ej. Ahorro emergencias" : "Ej. Oro, Nómina…"} />
                  </Field>
                  <Field label="Tipo">
                    <Select value={cardType} onChange={(e) => setCardType(e.target.value)}>
                      <option value="debito">Tarjeta de débito</option>
                      <option value="credito">Tarjeta de crédito</option>
                      <option value="ahorro">Caja de ahorro</option>
                    </Select>
                  </Field>
                  {cardType === "ahorro" ? (
                    <Field label="Rendimiento anual (%)">
                      <TextInput type="number" min="0" step="0.01" value={cardRate} onChange={(e) => setCardRate(e.target.value)} placeholder="Ej. 10" />
                    </Field>
                  ) : (
                    <Field label="Últimos 4 dígitos (opcional)">
                      <TextInput value={cardLast4} onChange={(e) => setCardLast4(e.target.value.replace(/\D/g, "").slice(0, 4))} placeholder="1234" />
                    </Field>
                  )}
                  {cardType !== "ahorro" && (
                    <Field label="Tarjeta digital (últimos 4, opcional)">
                      <TextInput value={cardDigital4} onChange={(e) => setCardDigital4(e.target.value.replace(/\D/g, "").slice(0, 4))} placeholder="5678" />
                    </Field>
                  )}
                  {cardType === "credito" && (
                    <>
                      <Field label="Día de corte (1–31)">
                        <TextInput type="number" min="1" max="31" value={cardCutDay} onChange={(e) => setCardCutDay(e.target.value)} placeholder="Ej. 15" />
                      </Field>
                      <Field label="Día límite de pago (1–31)">
                        <TextInput type="number" min="1" max="31" value={cardPayDay} onChange={(e) => setCardPayDay(e.target.value)} placeholder="Ej. 5" />
                      </Field>
                    </>
                  )}
                </div>
                {cardType !== "ahorro" && (
                  <p className="text-xs mt-2" style={{ color: C.faint }}>
                    Si tu banco te dio una tarjeta digital con otra terminación, agrégala: los cargos hechos con ella se asignarán a esta misma tarjeta y cuenta.
                  </p>
                )}
                {cardType === "ahorro" && (
                  <p className="text-xs mt-2" style={{ color: C.faint }}>
                    Los rendimientos se abonan automáticamente cada día con interés compuesto según el porcentaje.
                  </p>
                )}
                {cardType === "credito" && (
                  <p className="text-xs mt-2" style={{ color: C.faint }}>
                    Con el día de corte y el de pago, el Resumen calcula cuánto gastas por periodo y cuánto debes pagar cada mes. En el celular además recibirás una notificación en cada fecha.
                  </p>
                )}
                <div className="mt-3">
                  <Btn onClick={() => addCard(acc.id)}>Guardar tarjeta</Btn>
                </div>
              </div>
            )}

            {accCards.length === 0 ? (
              <p className="text-xs" style={{ color: C.faint }}>Sin tarjetas. Agrega una de débito o crédito.</p>
            ) : (
              <ul className="space-y-2">
                {accCards.map((card) => {
                  const bal = balanceOfCard(card, movements);
                  const isCredit = card.type === "credito";
                  const isSavings = card.type === "ahorro";
                  const isCashCard = card.type === "efectivo";
                  const typeLabel = isCredit ? "Crédito" : isSavings ? "Ahorro" : isCashCard ? "Efectivo" : "Débito";
                  const typeColor = isCredit ? C.amber : isSavings ? C.accent : isCashCard ? C.green : C.blue;
                  const balLabel = isCredit ? "Deuda" : isSavings ? "Ahorro" : isCashCard ? "Efectivo" : "Saldo";
                  return (
                    <li key={card.id} className="rounded-lg px-3 py-2" style={{ background: C.bg, border: `1px solid ${C.borderSoft}`, opacity: card.excluded ? 0.55 : 1 }}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 min-w-0 flex-wrap">
                          <Chip color={typeColor} bg={isSavings || isCashCard ? C.accentSoft : undefined}>{typeLabel}</Chip>
                          <span className="text-sm truncate">{card.name}{card.last4 && <span style={{ color: C.faint }}> ····{card.last4}</span>}</span>
                          {isSavings && <Chip color={C.accent}>{Number(card.rate) || 0}%</Chip>}
                          {isCredit && clampDay(card.cutDay) && (
                            <Chip color={C.faint}>Corte {card.cutDay}{clampDay(card.payDay) ? ` · Pago ${card.payDay}` : ""}</Chip>
                          )}
                          {card.digitalLast4 && <Chip color={C.blue}>Digital ····{card.digitalLast4}</Chip>}
                          {card.excluded && <Chip color={C.faint}>No contabilizada</Chip>}
                        </div>
                        <div className="flex items-center gap-3 shrink-0">
                          <div className="text-right">
                            <p className="text-xs" style={{ color: C.faint }}>{balLabel}</p>
                            <span className="font-mono text-sm" style={{ color: isCredit ? (bal > 0 ? C.red : C.green) : (bal < 0 ? C.red : C.green), fontVariantNumeric: "tabular-nums" }}>
                              {money(bal)}
                            </span>
                          </div>
                          <Btn kind="ghost" onClick={() => toggleCardCount(card.id)} style={{ padding: "4px 8px" }} title={card.excluded ? "Volver a contabilizar" : "Excluir de la contabilización"}>
                            {card.excluded ? "Contar" : "No contar"}
                          </Btn>
                          <Btn kind="ghost" onClick={() => openBalanceEditor(card)} style={{ padding: "4px 8px" }}>
                            {editBalFor === card.id ? "Cancelar" : "✎ Saldo"}
                          </Btn>
                          {!isCashCard && (
                            <Btn kind="danger" onClick={() => deleteCard(card.id)} style={{ padding: "4px 8px" }}>✕</Btn>
                          )}
                        </div>
                      </div>

                      {editBalFor === card.id && (
                        <div className="mt-3 rounded-lg p-3" style={{ background: C.surface2, border: `1px solid ${C.border}` }}>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <Field label={isCredit ? "Nueva deuda (MXN)" : "Nuevo saldo (MXN)"}>
                              <TextInput type="number" step="0.01" value={newBal} onChange={(e) => setNewBal(e.target.value)} />
                            </Field>
                            {isSavings && (
                              <Field label="Rendimiento anual (%)">
                                <TextInput type="number" min="0" step="0.01" value={newRate} onChange={(e) => setNewRate(e.target.value)} />
                              </Field>
                            )}
                            {isCredit && (
                              <>
                                <Field label="Día de corte (1–31)">
                                  <TextInput type="number" min="1" max="31" value={newCutDay} onChange={(e) => setNewCutDay(e.target.value)} placeholder="Ej. 15" />
                                </Field>
                                <Field label="Día límite de pago (1–31)">
                                  <TextInput type="number" min="1" max="31" value={newPayDay} onChange={(e) => setNewPayDay(e.target.value)} placeholder="Ej. 5" />
                                </Field>
                              </>
                            )}
                            {!isSavings && !isCashCard && (
                              <Field label="Tarjeta digital (últimos 4, opcional)">
                                <TextInput value={newDigital4} onChange={(e) => setNewDigital4(e.target.value.replace(/\D/g, "").slice(0, 4))} placeholder="5678" />
                              </Field>
                            )}
                          </div>
                          <p className="text-xs mt-2" style={{ color: C.faint }}>
                            La diferencia se registra como un movimiento de "Ajuste de saldo" para que el historial siga cuadrando.
                          </p>
                          <div className="mt-3">
                            <Btn onClick={() => saveBalance(card)}>Aplicar</Btn>
                          </div>
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>
        );
      })}
    </div>
  );
}

// Un cargo detectado en una notificación, pendiente de que el usuario lo complete
function InboxItem({ item, data, onConfirm, onDiscard }) {
  const C = useTheme();
  const { accounts, cards, categories } = data;
  const initialCard = cards.find((c) => c.id === item.cardId);
  const [accountId, setAccountId] = useState(initialCard ? initialCard.accountId : "");
  const [cardId, setCardId] = useState(item.cardId || "");
  const [type, setType] = useState(item.type || "gasto");
  const [amount, setAmount] = useState(String(item.amount));
  const [date, setDate] = useState(item.date);
  const [description, setDescription] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [error, setError] = useState("");
  const accCards = cards.filter((c) => c.accountId === accountId);

  const confirm = () => {
    const amt = parseFloat(amount);
    if (!cardId) return setError("Elige la cuenta y la tarjeta.");
    if (!amt || amt <= 0) return setError("Escribe un monto mayor a cero.");
    if (!categoryId) return setError("Elige una categoría.");
    onConfirm(item, { cardId, type, amount: amt, date, description: description.trim(), categoryId });
  };

  return (
    <Card style={{ borderColor: C.amber }}>
      <div className="flex items-center justify-between gap-3 mb-2 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          <Chip color={C.amber} bg={C.amberSoft}>Detectado en notificación</Chip>
          <Amount value={parseFloat(amount) || 0} sign={type === "gasto" ? "-" : "+"} size="text-sm" />
        </div>
        <Btn kind="danger" onClick={() => onDiscard(item)} style={{ padding: "4px 8px" }}>Descartar</Btn>
      </div>
      <p className="text-xs mb-3" style={{ color: C.faint }}>{item.text}</p>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Field label="Tipo">
          <Select value={type} onChange={(e) => setType(e.target.value)}>
            <option value="gasto">Gasto</option>
            <option value="ingreso">Ingreso</option>
          </Select>
        </Field>
        <Field label="Cuenta">
          <Select value={accountId} onChange={(e) => { setAccountId(e.target.value); setCardId(""); }}>
            <option value="">— Elegir cuenta —</option>
            {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}{a.bank ? ` (${a.bank})` : ""}</option>)}
          </Select>
        </Field>
        <Field label="Tarjeta">
          <Select value={cardId} onChange={(e) => setCardId(e.target.value)} disabled={!accountId}>
            <option value="">{accountId ? "— Elegir tarjeta —" : "Primero elige una cuenta"}</option>
            {accCards.map((c) => (
              <option key={c.id} value={c.id}>{c.name}{c.last4 ? ` ····${c.last4}` : ""}</option>
            ))}
          </Select>
        </Field>
        <Field label="Monto (MXN)">
          <TextInput type="number" min="0" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} />
        </Field>
        <Field label="Fecha">
          <TextInput type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>
        <Field label="Categoría">
          <Select value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
            <option value="">— Elegir categoría —</option>
            {FREQS.map((f) => (
              <optgroup key={f.id} label={f.label}>
                {categories.filter((c) => c.freq === f.id).map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </optgroup>
            ))}
          </Select>
        </Field>
        <div className="sm:col-span-3">
          <Field label="Descripción">
            <TextInput value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Ej. Súper, gasolina…" />
          </Field>
        </div>
      </div>
      {error && <p className="text-xs mt-2" style={{ color: C.red }}>{error}</p>}
      <div className="mt-3">
        <Btn onClick={confirm}>Confirmar movimiento</Btn>
      </div>
    </Card>
  );
}

// ---------- Movimientos ----------
function Movimientos({ data, update }) {
  const C = useTheme();
  const { accounts, cards, categories, movements } = data;
  const inbox = data.inbox || [];
  const [show, setShow] = useState(false);

  // Acceso a notificaciones: null = no aplica (web) o desconocido; false = falta concederlo
  const [inboxEnabled, setInboxEnabled] = useState(null);
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    NotificationInbox.isEnabled().then((r) => setInboxEnabled(!!r.enabled)).catch(() => {});
  }, []);

  const confirmInbox = (item, fields) => {
    update({
      movements: [{ id: uid(), months: 1, commission: 0, ...fields }, ...movements],
      inbox: inbox.filter((i) => i.id !== item.id),
    });
  };
  const discardInbox = (item) => update({ inbox: inbox.filter((i) => i.id !== item.id) });

  const [type, setType] = useState("gasto");
  const [accountId, setAccountId] = useState("");
  const [cardId, setCardId] = useState("");
  const [toAccountId, setToAccountId] = useState("");
  const [toCardId, setToCardId] = useState("");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [date, setDate] = useState(todayISO());
  const [aMeses, setAMeses] = useState(false);
  const [months, setMonths] = useState(3);
  const [commission, setCommission] = useState("");
  const [error, setError] = useState("");

  const isTransfer = type === "transfer";
  const accCards = cards.filter((c) => c.accountId === accountId);
  const toAccCards = cards.filter((c) => c.accountId === toAccountId);
  const selectedCard = cards.find((c) => c.id === cardId);
  const isCreditExpense = type === "gasto" && selectedCard?.type === "credito";

  const catById = useMemo(() => Object.fromEntries(categories.map((c) => [c.id, c])), [categories]);
  const cardById = useMemo(() => Object.fromEntries(cards.map((c) => [c.id, c])), [cards]);

  const resetForm = () => {
    setType("gasto"); setAccountId(""); setCardId(""); setToAccountId(""); setToCardId(""); setAmount(""); setDescription("");
    setCategoryId(""); setDate(todayISO()); setAMeses(false); setMonths(3); setCommission(""); setError("");
  };

  const save = () => {
    const amt = parseFloat(amount);
    if (!cardId) return setError(isTransfer ? "Elige la cuenta y tarjeta de origen." : "Elige una cuenta y una tarjeta.");
    if (!amt || amt <= 0) return setError("Escribe un monto mayor a cero.");
    if (isTransfer) {
      if (!toCardId) return setError("Elige la cuenta y tarjeta de destino.");
      if (toCardId === cardId) return setError("El origen y el destino deben ser distintos.");
      const from = cards.find((c) => c.id === cardId);
      const to = cards.find((c) => c.id === toCardId);
      const tid = uid();
      const desc = description.trim();
      const base = { categoryId: null, date, months: 1, commission: 0, transfer: true, transferId: tid };
      update({
        movements: [
          { ...base, id: uid(), cardId, type: "gasto", amount: amt, description: desc || `Transferencia a ${to?.name || "?"}` },
          { ...base, id: uid(), cardId: toCardId, type: "ingreso", amount: amt, description: desc || `Transferencia desde ${from?.name || "?"}` },
          ...movements,
        ],
      });
      resetForm();
      setShow(false);
      return;
    }
    if (!categoryId) return setError("Elige una categoría (puedes crear más en la pestaña Categorías).");
    const mov = {
      id: uid(),
      cardId,
      type,
      amount: amt,
      description: description.trim(),
      categoryId,
      date,
      months: isCreditExpense && aMeses ? Number(months) : 1,
      commission: isCreditExpense && aMeses ? (parseFloat(commission) || 0) : 0,
    };
    update({ movements: [mov, ...movements] });
    resetForm();
    setShow(false);
  };

  // Al borrar una pata de una transferencia se borran las dos, para no descuadrar
  const del = (id) => {
    const mov = movements.find((m) => m.id === id);
    if (mov?.transferId) return update({ movements: movements.filter((m) => m.transferId !== mov.transferId) });
    update({ movements: movements.filter((m) => m.id !== id) });
  };

  const sorted = [...movements].sort((a, b) => (a.date < b.date ? 1 : -1));

  const totalConComision = (parseFloat(amount) || 0) + (parseFloat(commission) || 0);
  const mensualidad = aMeses && months > 0 ? totalConComision / months : 0;

  return (
    <div className="space-y-4">
      <SectionTitle right={<Btn onClick={() => { setShow((v) => !v); if (!show) resetForm(); }}>{show ? "Cancelar" : "+ Nuevo movimiento"}</Btn>}>
        Movimientos
      </SectionTitle>

      {inboxEnabled === false && (
        <Card className="flex items-center justify-between gap-3 flex-wrap">
          <div className="min-w-0 flex-1">
            <p className="text-sm">Registra tus cargos automáticamente</p>
            <p className="text-xs mt-1" style={{ color: C.faint }}>
              Permite que Mis Finanzas lea las notificaciones del celular para detectar cargos y depósitos del banco; aquí te aparecerán listos para confirmar. Todo se procesa en tu teléfono, nada se envía fuera.
            </p>
          </div>
          <Btn kind="ghost" onClick={() => NotificationInbox.openSettings().catch(() => {})}>Permitir acceso</Btn>
        </Card>
      )}

      {inbox.length > 0 && (
        <div>
          <h3 className="text-xs uppercase tracking-widest mb-2" style={{ color: C.amber }}>
            Por confirmar ({inbox.length})
          </h3>
          <div className="space-y-2">
            {inbox.map((item) => (
              <InboxItem key={item.id} item={item} data={data} onConfirm={confirmInbox} onDiscard={discardInbox} />
            ))}
          </div>
        </div>
      )}

      {show && (
        <Card>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Tipo">
              <Select value={type} onChange={(e) => setType(e.target.value)}>
                <option value="gasto">Gasto</option>
                <option value="ingreso">Ingreso / Depósito / Pago a tarjeta</option>
                <option value="transfer">Transferencia entre cuentas</option>
              </Select>
            </Field>
            <Field label="Fecha">
              <TextInput type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </Field>
            <Field label={isTransfer ? "Cuenta origen" : "Cuenta"}>
              <Select value={accountId} onChange={(e) => { setAccountId(e.target.value); setCardId(""); }}>
                <option value="">— Elegir cuenta —</option>
                {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}{a.bank ? ` (${a.bank})` : ""}</option>)}
              </Select>
            </Field>
            <Field label={isTransfer ? "Tarjeta origen" : "Tarjeta"}>
              <Select value={cardId} onChange={(e) => setCardId(e.target.value)} disabled={!accountId}>
                <option value="">{accountId ? "— Elegir tarjeta —" : "Primero elige una cuenta"}</option>
                {accCards.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}{c.last4 ? ` ····${c.last4}` : ""} · {c.type === "credito" ? "Crédito" : c.type === "ahorro" ? "Caja de ahorro" : c.type === "efectivo" ? "Efectivo" : "Débito"}
                  </option>
                ))}
              </Select>
            </Field>
            {isTransfer && (
              <>
                <Field label="Cuenta destino">
                  <Select value={toAccountId} onChange={(e) => { setToAccountId(e.target.value); setToCardId(""); }}>
                    <option value="">— Elegir cuenta —</option>
                    {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}{a.bank ? ` (${a.bank})` : ""}</option>)}
                  </Select>
                </Field>
                <Field label="Tarjeta destino">
                  <Select value={toCardId} onChange={(e) => setToCardId(e.target.value)} disabled={!toAccountId}>
                    <option value="">{toAccountId ? "— Elegir tarjeta —" : "Primero elige una cuenta"}</option>
                    {toAccCards.filter((c) => c.id !== cardId).map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}{c.last4 ? ` ····${c.last4}` : ""} · {c.type === "credito" ? "Crédito" : c.type === "ahorro" ? "Caja de ahorro" : c.type === "efectivo" ? "Efectivo" : "Débito"}
                      </option>
                    ))}
                  </Select>
                </Field>
              </>
            )}
            <Field label="Monto (MXN)">
              <TextInput type="number" min="0" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" />
            </Field>
            {!isTransfer && (
              <Field label="Categoría">
                <Select value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
                  <option value="">— Elegir categoría —</option>
                  {FREQS.map((f) => (
                    <optgroup key={f.id} label={f.label}>
                      {categories.filter((c) => c.freq === f.id).map((c) => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </optgroup>
                  ))}
                </Select>
              </Field>
            )}
            <div className="sm:col-span-2">
              <Field label="Descripción">
                <TextInput value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Ej. Súper de la semana, pago de Netflix…" />
              </Field>
            </div>
          </div>

          {/* Opciones exclusivas de tarjeta de crédito */}
          {isCreditExpense && (
            <div className="mt-4 rounded-lg p-3" style={{ background: C.amberSoft, border: `1px solid ${C.amber}` }}>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium" style={{ color: C.amber }}>Compra a meses</p>
                  <p className="text-xs" style={{ color: C.faint }}>Difiere el pago y registra la comisión si aplica.</p>
                </div>
                <button
                  onClick={() => setAMeses((v) => !v)}
                  className="rounded-full px-3 py-1 text-xs"
                  style={aMeses
                    ? { background: C.amber, color: C.accentText === "#FFFFFF" ? "#FFFFFF" : "#221A08", fontWeight: 600 }
                    : { border: `1px solid ${C.border}`, color: C.muted, background: C.surface }}
                >
                  {aMeses ? "A meses: sí" : "A meses: no"}
                </button>
              </div>

              {aMeses && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
                  <Field label="Número de meses">
                    <Select value={months} onChange={(e) => setMonths(Number(e.target.value))}>
                      {MESES_OPCIONES.map((m) => <option key={m} value={m}>{m} meses</option>)}
                    </Select>
                  </Field>
                  <Field label="Comisión (MXN, opcional)">
                    <TextInput type="number" min="0" step="0.01" value={commission} onChange={(e) => setCommission(e.target.value)} placeholder="0.00" />
                  </Field>
                  <div className="sm:col-span-2 flex flex-wrap gap-x-6 gap-y-1 text-xs" style={{ color: C.muted }}>
                    <span>Total con comisión: <span className="font-mono" style={{ color: C.text }}>{money(totalConComision)}</span></span>
                    <span>Mensualidad: <span className="font-mono" style={{ color: C.amber }}>{money(mensualidad)}</span></span>
                  </div>
                </div>
              )}
            </div>
          )}

          {isTransfer && (
            <p className="text-xs mt-3" style={{ color: C.faint }}>
              La transferencia mueve el dinero entre tus cuentas sin contarse como gasto ni ingreso en el resumen. Si el destino es una tarjeta de crédito, funciona como pago de la tarjeta.
            </p>
          )}
          {error && <p className="text-xs mt-3" style={{ color: C.red }}>{error}</p>}
          <div className="mt-4">
            <Btn onClick={save}>Guardar movimiento</Btn>
          </div>
        </Card>
      )}

      {sorted.length === 0 && !show ? (
        <Empty>
          {accounts.length === 0
            ? "Primero crea una cuenta y una tarjeta en la pestaña Cuentas; después registra aquí tus movimientos."
            : 'Sin movimientos todavía. Usa "+ Nuevo movimiento" para registrar el primero.'}
        </Empty>
      ) : (
        <div className="space-y-2">
          {sorted.map((m) => {
            const cat = catById[m.categoryId];
            const card = cardById[m.cardId];
            const isGasto = m.type === "gasto";
            const hasMSI = Number(m.months) > 1;
            return (
              <Card key={m.id} className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm truncate">{m.description || (isGasto ? "Gasto" : "Ingreso")}</span>
                    {cat && <Chip>{cat.name}</Chip>}
                    {cat && <Chip color={C.faint}>{FREQS.find((f) => f.id === cat.freq)?.label}</Chip>}
                    {m.interest && <Chip color={C.green} bg={C.accentSoft}>Rendimiento automático</Chip>}
                    {m.adjust && <Chip color={C.faint}>Ajuste manual</Chip>}
                    {m.transfer && <Chip color={C.blue}>Transferencia</Chip>}
                    {m.recurring && <Chip color={C.accent} bg={C.accentSoft}>Cargo fijo</Chip>}
                    {hasMSI && <Chip color={C.amber} bg={C.amberSoft}>{m.months} MSI</Chip>}
                    {Number(m.commission) > 0 && <Chip color={C.red}>Comisión {money(m.commission)}</Chip>}
                  </div>
                  <p className="text-xs mt-1" style={{ color: C.faint }}>
                    {m.date} · {card ? cardLabel(card, accounts) : "Tarjeta eliminada"}
                  </p>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <div className="text-right">
                    <Amount value={movTotal(m)} sign={isGasto ? "-" : "+"} size="text-sm" />
                    {hasMSI && (
                      <p className="text-xs font-mono" style={{ color: C.faint, fontVariantNumeric: "tabular-nums" }}>
                        {money(movTotal(m) / m.months)}/mes
                      </p>
                    )}
                  </div>
                  <Btn kind="danger" onClick={() => del(m.id)} style={{ padding: "4px 8px" }}>✕</Btn>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ---------- Cargos fijos ----------
function Fijos({ data, update }) {
  const C = useTheme();
  const { accounts, cards, categories } = data;
  const recurring = data.recurring || [];
  const [show, setShow] = useState(false);
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [accountId, setAccountId] = useState("");
  const [cardId, setCardId] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [day, setDay] = useState("");
  const [endDate, setEndDate] = useState("");
  const [error, setError] = useState("");

  const accCards = cards.filter((c) => c.accountId === accountId);
  const cardById = useMemo(() => Object.fromEntries(cards.map((c) => [c.id, c])), [cards]);
  const catById = useMemo(() => Object.fromEntries(categories.map((c) => [c.id, c])), [categories]);

  const activos = recurring.filter((r) => nextChargeOf(r) !== null);
  const totalMensual = activos.reduce((s, r) => s + (Number(r.amount) || 0), 0);

  const resetForm = () => {
    setDescription(""); setAmount(""); setAccountId(""); setCardId("");
    setCategoryId(""); setDay(""); setEndDate(""); setError("");
  };

  const add = () => {
    if (!description.trim()) return setError("Escribe una descripción (ej. Netflix, Spotify…).");
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) return setError("Escribe un monto mayor a cero.");
    if (!cardId) return setError("Elige la cuenta y tarjeta donde se cobra.");
    if (!categoryId) return setError("Elige una categoría.");
    const d = clampDay(day);
    if (!d) return setError("Escribe el día de cobro (1–31).");
    if (endDate && endDate < todayISO()) return setError("La fecha de fin ya pasó.");
    const item = {
      id: uid(),
      description: description.trim(),
      amount: amt,
      cardId,
      categoryId,
      day: d,
      endDate: endDate || null,
      createdAt: todayISO(),
      lastApplied: null,
    };
    update({ recurring: [...recurring, item] });
    resetForm();
    setShow(false);
  };

  const del = (r) => {
    if (!window.confirm("Se dejará de generar este cargo. Los movimientos ya creados se conservan. ¿Eliminar?")) return;
    update({ recurring: recurring.filter((x) => x.id !== r.id) });
  };

  return (
    <div className="space-y-4">
      <SectionTitle right={<Btn onClick={() => { setShow((v) => !v); if (!show) resetForm(); }}>{show ? "Cancelar" : "+ Nuevo cargo fijo"}</Btn>}>
        Cargos fijos mensuales
      </SectionTitle>

      {activos.length > 0 && (
        <Card className="flex items-center justify-between">
          <p className="text-xs uppercase tracking-wider" style={{ color: C.muted }}>Total fijo al mes</p>
          <Amount value={totalMensual} sign="-" size="text-xl" />
        </Card>
      )}

      {show && (
        <Card>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Descripción">
              <TextInput value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Ej. Netflix, Spotify, gimnasio…" />
            </Field>
            <Field label="Monto mensual (MXN)">
              <TextInput type="number" min="0" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" />
            </Field>
            <Field label="Cuenta">
              <Select value={accountId} onChange={(e) => { setAccountId(e.target.value); setCardId(""); }}>
                <option value="">— Elegir cuenta —</option>
                {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}{a.bank ? ` (${a.bank})` : ""}</option>)}
              </Select>
            </Field>
            <Field label="Tarjeta donde se cobra">
              <Select value={cardId} onChange={(e) => setCardId(e.target.value)} disabled={!accountId}>
                <option value="">{accountId ? "— Elegir tarjeta —" : "Primero elige una cuenta"}</option>
                {accCards.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}{c.last4 ? ` ····${c.last4}` : ""} · {c.type === "credito" ? "Crédito" : c.type === "ahorro" ? "Caja de ahorro" : c.type === "efectivo" ? "Efectivo" : "Débito"}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Categoría">
              <Select value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
                <option value="">— Elegir categoría —</option>
                {FREQS.map((f) => (
                  <optgroup key={f.id} label={f.label}>
                    {categories.filter((c) => c.freq === f.id).map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </optgroup>
                ))}
              </Select>
            </Field>
            <Field label="Día de cobro (1–31)">
              <TextInput type="number" min="1" max="31" value={day} onChange={(e) => setDay(e.target.value)} placeholder="Ej. 16" />
            </Field>
            <Field label="Fecha de fin (opcional)">
              <TextInput type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
            </Field>
          </div>
          <p className="text-xs mt-2" style={{ color: C.faint }}>
            El gasto se registra automáticamente cada mes en el día de cobro. Si el mes no tiene ese día, se usa el último día del mes. Con fecha de fin, se deja de cobrar después de esa fecha.
          </p>
          {error && <p className="text-xs mt-3" style={{ color: C.red }}>{error}</p>}
          <div className="mt-4">
            <Btn onClick={add}>Guardar cargo fijo</Btn>
          </div>
        </Card>
      )}

      {recurring.length === 0 && !show ? (
        <Empty>Sin cargos fijos. Agrega tus suscripciones y servicios con "+ Nuevo cargo fijo" y se registrarán solos cada mes.</Empty>
      ) : (
        <div className="space-y-2">
          {recurring.map((r) => {
            const card = cardById[r.cardId];
            const cat = catById[r.categoryId];
            const next = nextChargeOf(r);
            return (
              <Card key={r.id} className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm truncate">{r.description}</span>
                    {cat && <Chip>{cat.name}</Chip>}
                    <Chip color={C.faint}>Cada día {clampDay(r.day)}</Chip>
                    {r.endDate && <Chip color={C.amber} bg={C.amberSoft}>Hasta {r.endDate}</Chip>}
                    {!next && <Chip color={C.faint}>Finalizado</Chip>}
                  </div>
                  <p className="text-xs mt-1" style={{ color: C.faint }}>
                    {card ? cardLabel(card, accounts) : "Tarjeta eliminada"}
                    {next && <> · próximo cobro: {fmtDia(next)}</>}
                  </p>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <Amount value={Number(r.amount) || 0} sign="-" size="text-sm" />
                  <Btn kind="danger" onClick={() => del(r)} style={{ padding: "4px 8px" }}>✕</Btn>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ---------- Categorías ----------
function Categorias({ data, update }) {
  const C = useTheme();
  const { categories, movements } = data;
  const [name, setName] = useState("");
  const [freq, setFreq] = useState("mensual");
  const [error, setError] = useState("");

  const add = () => {
    if (!name.trim()) return setError("Escribe un nombre para la categoría.");
    if (categories.some((c) => c.name.toLowerCase() === name.trim().toLowerCase())) {
      return setError("Ya existe una categoría con ese nombre.");
    }
    update({ categories: [...categories, { id: uid(), name: name.trim(), freq }] });
    setName(""); setError("");
  };

  const del = (id) => {
    const inUse = movements.some((m) => m.categoryId === id);
    if (inUse && !window.confirm("Hay movimientos con esta categoría; quedarán como 'Sin categoría'. ¿Eliminar?")) return;
    update({ categories: categories.filter((c) => c.id !== id) });
  };

  const setCatFreq = (id, newFreq) =>
    update({ categories: categories.map((c) => (c.id === id ? { ...c, freq: newFreq } : c)) });

  return (
    <div className="space-y-4">
      <SectionTitle>Categorías</SectionTitle>

      <Card>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
          <div className="sm:col-span-2">
            <Field label="Nueva categoría">
              <TextInput value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej. Mascotas, Vacaciones…" />
            </Field>
          </div>
          <Field label="Frecuencia del gasto">
            <Select value={freq} onChange={(e) => setFreq(e.target.value)}>
              {FREQS.map((f) => <option key={f.id} value={f.id}>{f.label}</option>)}
            </Select>
          </Field>
        </div>
        {error && <p className="text-xs mt-2" style={{ color: C.red }}>{error}</p>}
        <div className="mt-3">
          <Btn onClick={add}>Crear categoría</Btn>
        </div>
      </Card>

      {FREQS.map((f) => {
        const list = categories.filter((c) => c.freq === f.id);
        return (
          <div key={f.id}>
            <h3 className="text-xs uppercase tracking-widest mb-2" style={{ color: C.muted }}>{f.label}es</h3>
            {list.length === 0 ? (
              <p className="text-xs mb-2" style={{ color: C.faint }}>Sin categorías de este tipo.</p>
            ) : (
              <div className="space-y-2">
                {list.map((c) => (
                  <Card key={c.id} className="flex items-center justify-between gap-3" style={{ paddingTop: 10, paddingBottom: 10 }}>
                    <span className="text-sm">{c.name}</span>
                    <div className="flex items-center gap-2">
                      <Select value={c.freq} onChange={(e) => setCatFreq(c.id, e.target.value)} style={{ width: "auto", padding: "4px 8px", fontSize: 12 }}>
                        {FREQS.map((fr) => <option key={fr.id} value={fr.id}>{fr.label}</option>)}
                      </Select>
                      <Btn kind="danger" onClick={() => del(c.id)} style={{ padding: "4px 8px" }}>✕</Btn>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
