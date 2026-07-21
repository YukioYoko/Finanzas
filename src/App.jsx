import React, { useState, useEffect, useMemo, useContext, createContext } from "react";

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

const EMPTY = { accounts: [], cards: [], categories: seedCategories, movements: [], theme: "dark" };

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
          setData(applyInterest({ ...EMPTY, ...parsed }));
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

          {tab === "resumen" && <Resumen data={data} />}
          {tab === "cuentas" && <Cuentas data={data} update={update} />}
          {tab === "movimientos" && <Movimientos data={data} update={update} />}
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

// ---------- Resumen ----------
function Resumen({ data }) {
  const C = useTheme();
  const now = new Date();
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

  const gastosMes = counted.filter((m) => m.type === "gasto" && !m.adjust && m.date.startsWith(ym));
  const ingresosMes = counted.filter((m) => m.type === "ingreso" && !m.adjust && m.date.startsWith(ym));
  const totalGastosMes = gastosMes.reduce((s, m) => s + movTotal(m), 0);
  const totalIngresosMes = ingresosMes.reduce((s, m) => s + movTotal(m), 0);

  // Agrupar gastos por frecuencia de su categoría
  const groupByFreq = (freq, period) =>
    counted
      .filter((m) => m.type === "gasto" && !m.adjust && (catById[m.categoryId]?.freq || "esporadico") === freq && m.date.startsWith(period))
      .reduce((acc, m) => {
        const key = m.categoryId || "sin";
        acc[key] = (acc[key] || 0) + movTotal(m);
        return acc;
      }, {});

  const mensuales = groupByFreq("mensual", ym);
  const anuales = groupByFreq("anual", year);
  const esporadicos = groupByFreq("esporadico", ym);

  const sum = (obj) => Object.values(obj).reduce((s, v) => s + v, 0);

  // Deuda de tarjetas de crédito: gastos - pagos/ingresos
  const creditCards = cards.filter((c) => c.type === "credito" && isCountedCard(c));
  const debtByCard = creditCards.map((c) => {
    const g = movements.filter((m) => m.cardId === c.id && m.type === "gasto").reduce((s, m) => s + movTotal(m), 0);
    const p = movements.filter((m) => m.cardId === c.id && m.type === "ingreso").reduce((s, m) => s + movTotal(m), 0);
    return { card: c, debt: g - p };
  });
  const totalDebt = debtByCard.reduce((s, d) => s + d.debt, 0);

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

      {/* Deuda por tarjeta */}
      {creditCards.length > 0 && (
        <div>
          <SectionTitle>Deuda por tarjeta de crédito</SectionTitle>
          <div className="space-y-2">
            {debtByCard.map(({ card, debt }) => (
              <Card key={card.id} className="flex items-center justify-between">
                <span className="text-sm" style={{ color: C.muted }}>{cardLabel(card, accounts)}</span>
                <span className="font-mono text-sm" style={{ color: debt > 0 ? C.red : C.green, fontVariantNumeric: "tabular-nums" }}>
                  {money(debt)}
                </span>
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
  const [cardRate, setCardRate] = useState("");
  const [editBalFor, setEditBalFor] = useState(null); // cardId
  const [newBal, setNewBal] = useState("");
  const [newRate, setNewRate] = useState("");

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
    update({ cards: [...cards, card] });
    setCardName(""); setCardType("debito"); setCardLast4(""); setCardRate(""); setCardFormFor(null);
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
  };

  const saveBalance = (card) => {
    const target = parseFloat(newBal);
    const patch = {};
    // Actualizar tasa si es caja de ahorro
    if (card.type === "ahorro") {
      const r = parseFloat(newRate) || 0;
      if (r !== Number(card.rate)) {
        patch.cards = cards.map((c) => (c.id === card.id ? { ...c, rate: r } : c));
      }
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
                  <Btn kind="ghost" onClick={() => { setCardFormFor(cardFormFor === acc.id ? null : acc.id); setCardName(""); setCardType("debito"); setCardLast4(""); setCardRate(""); }}>
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
                </div>
                {cardType === "ahorro" && (
                  <p className="text-xs mt-2" style={{ color: C.faint }}>
                    Los rendimientos se abonan automáticamente cada día con interés compuesto según el porcentaje.
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

// ---------- Movimientos ----------
function Movimientos({ data, update }) {
  const C = useTheme();
  const { accounts, cards, categories, movements } = data;
  const [show, setShow] = useState(false);

  const [type, setType] = useState("gasto");
  const [accountId, setAccountId] = useState("");
  const [cardId, setCardId] = useState("");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [date, setDate] = useState(todayISO());
  const [aMeses, setAMeses] = useState(false);
  const [months, setMonths] = useState(3);
  const [commission, setCommission] = useState("");
  const [error, setError] = useState("");

  const accCards = cards.filter((c) => c.accountId === accountId);
  const selectedCard = cards.find((c) => c.id === cardId);
  const isCreditExpense = type === "gasto" && selectedCard?.type === "credito";

  const catById = useMemo(() => Object.fromEntries(categories.map((c) => [c.id, c])), [categories]);
  const cardById = useMemo(() => Object.fromEntries(cards.map((c) => [c.id, c])), [cards]);

  const resetForm = () => {
    setType("gasto"); setAccountId(""); setCardId(""); setAmount(""); setDescription("");
    setCategoryId(""); setDate(todayISO()); setAMeses(false); setMonths(3); setCommission(""); setError("");
  };

  const save = () => {
    const amt = parseFloat(amount);
    if (!cardId) return setError("Elige una cuenta y una tarjeta.");
    if (!amt || amt <= 0) return setError("Escribe un monto mayor a cero.");
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

  const del = (id) => update({ movements: movements.filter((m) => m.id !== id) });

  const sorted = [...movements].sort((a, b) => (a.date < b.date ? 1 : -1));

  const totalConComision = (parseFloat(amount) || 0) + (parseFloat(commission) || 0);
  const mensualidad = aMeses && months > 0 ? totalConComision / months : 0;

  return (
    <div className="space-y-4">
      <SectionTitle right={<Btn onClick={() => { setShow((v) => !v); if (!show) resetForm(); }}>{show ? "Cancelar" : "+ Nuevo movimiento"}</Btn>}>
        Movimientos
      </SectionTitle>

      {show && (
        <Card>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Tipo">
              <Select value={type} onChange={(e) => setType(e.target.value)}>
                <option value="gasto">Gasto</option>
                <option value="ingreso">Ingreso / Depósito / Pago a tarjeta</option>
              </Select>
            </Field>
            <Field label="Fecha">
              <TextInput type="date" value={date} onChange={(e) => setDate(e.target.value)} />
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
                  <option key={c.id} value={c.id}>
                    {c.name}{c.last4 ? ` ····${c.last4}` : ""} · {c.type === "credito" ? "Crédito" : c.type === "ahorro" ? "Caja de ahorro" : c.type === "efectivo" ? "Efectivo" : "Débito"}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Monto (MXN)">
              <TextInput type="number" min="0" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" />
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
