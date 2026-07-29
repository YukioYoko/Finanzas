import { useState, useEffect } from "react";
import { Capacitor } from "@capacitor/core";
import { AppUpdate, AppUpdateAvailability } from "@capawesome/capacitor-app-update";
import { THEMES, ThemeContext } from "./theme";
import { EMPTY } from "./constants";
import { store } from "./store";
import { applyInterest, applyRecurring, ingestCaptures } from "./lib/finance";
import { scheduleCardReminders, NotificationInbox } from "./lib/notifications";
import Resumen from "./screens/Resumen";
import Cuentas from "./screens/Cuentas";
import Movimientos from "./screens/Movimientos";
import Fijos from "./screens/Fijos";
import Categorias from "./screens/Categorias";
import Ajustes from "./screens/Ajustes";
import Tour from "./components/Tour";
import { IconGear } from "./components/icons";

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
  const [showSettings, setShowSettings] = useState(false);
  const [updateReady, setUpdateReady] = useState(false);

  // Busca actualizaciones en Google Play (solo apps instaladas desde la tienda)
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    (async () => {
      try {
        const info = await AppUpdate.getAppUpdateInfo();
        if (info.updateAvailability === AppUpdateAvailability.UPDATE_AVAILABLE) setUpdateReady(true);
      } catch (e) {
        // No es una instalación de Play, o el servicio no está disponible: se ignora
      }
    })();
  }, []);

  const doUpdate = async () => {
    try {
      const info = await AppUpdate.getAppUpdateInfo();
      if (info.immediateUpdateAllowed) return AppUpdate.performImmediateUpdate();
      return AppUpdate.openAppStore();
    } catch (e) {
      try { await AppUpdate.openAppStore(); } catch (_) { /* nada más que hacer */ }
    }
  };

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
  // (solo si el usuario activó la función opcional de lectura de notificaciones).
  // Se ejecuta al abrir la app y cada vez que vuelve a primer plano, para que los
  // cargos aparezcan aunque hayan llegado con la app en segundo plano.
  const loaded = !!data;
  const captureOn = !!data?.notifCaptureEnabled;
  useEffect(() => {
    if (!loaded || !captureOn || !Capacitor.isNativePlatform()) return;
    let cancelled = false;
    const drain = async () => {
      try {
        const { items } = await NotificationInbox.drain();
        if (cancelled || !items || !items.length) return;
        setData((d) => {
          const { inboxAdd, inboxApps, inboxSeen, changed } = ingestCaptures(items, d, Date.now());
          if (!changed) return d;
          return { ...d, inbox: [...inboxAdd, ...(d.inbox || [])], inboxApps, inboxSeen };
        });
      } catch (e) {
        // Plugin no disponible o error nativo: la app sigue sin bandeja
      }
    };
    drain();
    const onVisible = () => { if (document.visibilityState === "visible") drain(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => { cancelled = true; document.removeEventListener("visibilitychange", onVisible); };
  }, [loaded, captureOn]);

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
  // Reemplaza todo el estado con un respaldo importado (rellena claves faltantes
  // y vuelve a aplicar intereses y cargos fijos, como en la carga inicial)
  const importData = (backup) => setData(applyRecurring(applyInterest({ ...EMPTY, ...backup })));

  return (
    <ThemeContext.Provider value={C}>
      <div className="min-h-screen" style={{ background: C.bg, color: C.text }}>
        <div className="max-w-4xl mx-auto px-4 pb-16">
          {/* Header fijo: separado de la barra de estado (safe-area) y pegado arriba al hacer scroll */}
          <header
            className="sticky top-0 z-30 pb-4 flex items-start justify-between"
            style={{
              background: C.bg,
              paddingTop: "calc(env(safe-area-inset-top, 0px) + 18px)",
              borderBottom: `1px solid ${C.borderSoft}`,
            }}
          >
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
              onClick={() => setShowSettings(true)}
              aria-label="Abrir ajustes"
              className="rounded-full p-2.5 transition-opacity hover:opacity-85"
              style={{ background: C.surface, border: `1px solid ${C.border}`, color: C.muted }}
            >
              <IconGear />
            </button>
          </header>

          {/* Tabs */}
          <nav className="flex gap-1 mb-6 rounded-xl p-1" style={{ background: C.surface, border: `1px solid ${C.borderSoft}` }}>
            {TABS.map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className="flex-1 min-w-0 truncate rounded-lg py-2 text-sm transition-colors"
                style={tab === t.id
                  ? { background: C.accentSoft, color: C.accent, border: `1px solid ${C.border}`, fontWeight: 600 }
                  : { color: C.muted, border: "1px solid transparent" }}
              >
                {t.label}
              </button>
            ))}
          </nav>

          {updateReady && (
            <div
              className="mb-4 rounded-xl p-3 flex items-center justify-between gap-3 flex-wrap"
              style={{ background: C.accentSoft, border: `1px solid ${C.accent}` }}
            >
              <div className="min-w-0">
                <p className="text-sm font-medium" style={{ color: C.accent }}>Hay una actualización disponible</p>
                <p className="text-xs mt-0.5" style={{ color: C.muted }}>Actualiza para tener las últimas mejoras y correcciones.</p>
              </div>
              <button
                onClick={doUpdate}
                className="rounded-lg px-3 py-2 text-sm shrink-0"
                style={{ background: C.accent, color: C.accentText, fontWeight: 600 }}
              >
                Actualizar
              </button>
            </div>
          )}

          {TABS.map(({ id, Screen }) => (tab === id ? <Screen key={id} data={data} update={update} /> : null))}
        </div>

        {/* Ajustes: sidebar deslizable desde la derecha */}
        {showSettings && (
          <div className="fixed inset-0 z-40">
            <div
              className="absolute inset-0"
              style={{ background: "rgba(0,0,0,0.5)", animation: "fade-in 0.2s ease-out" }}
              onClick={() => setShowSettings(false)}
              aria-hidden="true"
            />
            <aside
              className="absolute right-0 top-0 h-full w-full max-w-sm overflow-y-auto p-4"
              style={{ background: C.bg, borderLeft: `1px solid ${C.border}`, animation: "slide-in-right 0.2s ease-out" }}
              role="dialog"
              aria-label="Ajustes"
            >
              <Ajustes
                data={data}
                update={update}
                onImport={importData}
                onClose={() => setShowSettings(false)}
                onShowTour={() => { setShowSettings(false); setShowTour(true); }}
              />
            </aside>
          </div>
        )}

        {/* Recorrido de bienvenida: primera vez, o cuando se pide desde Ajustes */}
        {(showTour || !data.tourSeen) && (
          <Tour onClose={() => { setShowTour(false); if (!data.tourSeen) update({ tourSeen: true }); }} />
        )}
      </div>
    </ThemeContext.Provider>
  );
}
