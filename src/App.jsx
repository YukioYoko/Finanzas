import { useState, useEffect } from "react";
import { Capacitor } from "@capacitor/core";
import { THEMES, ThemeContext } from "./theme";
import { EMPTY } from "./constants";
import { store } from "./store";
import { applyInterest, applyRecurring, parseCapturedNotification } from "./lib/finance";
import { scheduleCardReminders, NotificationInbox } from "./lib/notifications";
import Resumen from "./screens/Resumen";
import Cuentas from "./screens/Cuentas";
import Movimientos from "./screens/Movimientos";
import Fijos from "./screens/Fijos";
import Categorias from "./screens/Categorias";
import Ajustes from "./screens/Ajustes";
import Tour from "./components/Tour";

const STORAGE_KEY = "finanzas:data";

const TABS = [
  { id: "resumen", label: "Resumen", Screen: Resumen },
  { id: "cuentas", label: "Cuentas", Screen: Cuentas },
  { id: "movimientos", label: "Movimientos", Screen: Movimientos },
  { id: "fijos", label: "Fijos", Screen: Fijos },
  { id: "categorias", label: "Categorías", Screen: Categorias },
];

export default function FinanzasApp() {
  const [data, setData] = useState(null);
  const [tab, setTab] = useState("resumen");
  const [saveError, setSaveError] = useState(false);
  const [showTour, setShowTour] = useState(false);

  // Cargar
  useEffect(() => {
    (async () => {
      try {
        const res = await store.get(STORAGE_KEY);
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
        await store.set(STORAGE_KEY, JSON.stringify(data));
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
            <div className="flex gap-2">
              <button
                onClick={toggleTheme}
                aria-label={mode === "dark" ? "Cambiar a tema claro" : "Cambiar a tema oscuro"}
                className="rounded-full px-3 py-1.5 text-sm flex items-center gap-2 transition-opacity hover:opacity-85"
                style={{ background: C.surface, border: `1px solid ${C.border}`, color: C.muted }}
              >
                <span aria-hidden="true">{mode === "dark" ? "☀️" : "🌙"}</span>
                <span className="hidden sm:inline">{mode === "dark" ? "Tema claro" : "Tema oscuro"}</span>
              </button>
              <button
                onClick={() => setTab("ajustes")}
                aria-label="Abrir ajustes"
                className="rounded-full px-3 py-1.5 text-sm transition-opacity hover:opacity-85"
                style={{ background: C.surface, border: `1px solid ${C.border}`, color: tab === "ajustes" ? C.accent : C.muted }}
              >
                <span aria-hidden="true">⚙️</span>
              </button>
            </div>
          </header>

          {/* Tabs */}
          <nav className="flex gap-1 mb-6 rounded-xl p-1" style={{ background: C.surface, border: `1px solid ${C.borderSoft}` }}>
            {TABS.map((t) => (
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

          {TABS.map(({ id, Screen }) => (tab === id ? <Screen key={id} data={data} update={update} /> : null))}
          {tab === "ajustes" && (
            <Ajustes data={data} update={update} onBack={() => setTab("resumen")} onShowTour={() => setShowTour(true)} />
          )}
        </div>

        {/* Recorrido de bienvenida: primera vez, o cuando se pide desde Ajustes */}
        {(showTour || !data.tourSeen) && (
          <Tour onClose={() => { setShowTour(false); if (!data.tourSeen) update({ tourSeen: true }); }} />
        )}
      </div>
    </ThemeContext.Provider>
  );
}
