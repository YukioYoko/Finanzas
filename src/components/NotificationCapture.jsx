import { useState, useEffect } from "react";
import { Capacitor } from "@capacitor/core";
import { useTheme } from "../theme";
import { NotificationInbox } from "../lib/notifications";
import { Btn, Card, Toggle, TextInput } from "./ui";

// Centro de control (en Ajustes) de la lectura de notificaciones: interruptor
// principal, permiso de acceso y elección de apps. Solo se usa en el APK.
export default function NotificationCapture({ data, update }) {
  const C = useTheme();
  const captureOn = !!data.notifCaptureEnabled;
  const inboxApps = data.inboxApps || {};
  const appList = Object.entries(inboxApps).sort((a, b) => a[1].label.localeCompare(b[1].label));

  const [inboxEnabled, setInboxEnabled] = useState(null); // null = desconocido, false = falta conceder
  useEffect(() => {
    if (!captureOn) return;
    NotificationInbox.isEnabled().then((r) => setInboxEnabled(!!r.enabled)).catch(() => {});
  }, [captureOn]);

  const toggleCapture = () => update({ notifCaptureEnabled: !captureOn });

  const setAppEnabled = (pkg, label, enabled) =>
    update({ inboxApps: { ...inboxApps, [pkg]: { label: label || inboxApps[pkg]?.label || pkg, enabled } } });
  const toggleApp = (pkg) => setAppEnabled(pkg, inboxApps[pkg]?.label, !inboxApps[pkg]?.enabled);

  const enabledCount = appList.filter(([, a]) => a.enabled).length;

  // Menú desplegable de apps + selector de apps instaladas
  const [appsOpen, setAppsOpen] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [installed, setInstalled] = useState([]);
  const [pickerLoading, setPickerLoading] = useState(false);
  const [appSearch, setAppSearch] = useState("");
  const openPicker = async () => {
    const next = !pickerOpen;
    setPickerOpen(next);
    if (next && !installed.length) {
      setPickerLoading(true);
      try {
        const { apps } = await NotificationInbox.listInstalledApps();
        setInstalled((apps || []).slice().sort((a, b) => a.label.localeCompare(b.label)));
      } catch {
        // plugin viejo o sin permiso: se queda vacío
      }
      setPickerLoading(false);
    }
  };
  const filteredInstalled = installed.filter((a) => a.label.toLowerCase().includes(appSearch.trim().toLowerCase()));

  if (!Capacitor.isNativePlatform()) return null;

  return (
    <Card>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-sm font-medium">Registrar cargos desde notificaciones</h3>
          <p className="text-xs mt-1" style={{ color: C.faint }}>
            Opcional. Si lo activas, la app lee las notificaciones de los bancos que tú elijas para sugerirte movimientos ya con el monto. Todo se procesa en tu teléfono; nada se envía a internet. Puedes desactivarlo cuando quieras.
          </p>
        </div>
        <Toggle on={captureOn} onClick={toggleCapture} label="Activar registro desde notificaciones" />
      </div>

      {captureOn && (
        <div className="mt-3 space-y-3">
          {/* Paso 1: conceder acceso a notificaciones */}
          {inboxEnabled === false && (
            <div className="rounded-lg p-3 flex items-center justify-between gap-3 flex-wrap" style={{ background: C.bg, border: `1px solid ${C.borderSoft}` }}>
              <p className="text-xs min-w-0 flex-1" style={{ color: C.faint }}>
                Concede el acceso a notificaciones en los ajustes del sistema para que la app pueda leer los cargos.
              </p>
              <Btn kind="ghost" onClick={() => NotificationInbox.openSettings().catch(() => {})}>
                Permitir acceso
              </Btn>
            </div>
          )}

          {/* Paso 2: elegir apps (menú desplegable) */}
          <div className="rounded-lg" style={{ background: C.bg, border: `1px solid ${C.borderSoft}` }}>
            <button
              onClick={() => setAppsOpen((v) => !v)}
              aria-expanded={appsOpen}
              className="w-full flex items-center justify-between px-3 py-2.5 text-left"
            >
              <span className="text-sm" style={{ color: C.text }}>
                Apps de las que registrar cargos
                {enabledCount > 0 && (
                  <span style={{ color: C.faint }}> · {enabledCount} activa{enabledCount === 1 ? "" : "s"}</span>
                )}
              </span>
              <span aria-hidden="true" style={{ color: C.faint }}>{appsOpen ? "−" : "+"}</span>
            </button>

            {appsOpen && (
              <div className="px-3 pb-3">
                <p className="text-xs mb-2" style={{ color: C.faint }}>
                  Solo se leen las notificaciones de las apps que actives.
                </p>

                {appList.length > 0 && (
                  <ul className="space-y-2 mb-2">
                    {appList.map(([pkg, app]) => (
                      <li key={pkg} className="flex items-center justify-between gap-3">
                        <span className="text-sm truncate" style={{ color: app.enabled ? C.text : C.muted }}>{app.label}</span>
                        <Toggle on={app.enabled} onClick={() => toggleApp(pkg)} label={`${app.enabled ? "Desactivar" : "Activar"} ${app.label}`} />
                      </li>
                    ))}
                  </ul>
                )}

                <Btn kind="ghost" onClick={openPicker}>
                  {pickerOpen ? "Cerrar lista" : "+ Elegir de mis apps instaladas"}
                </Btn>

                {pickerOpen && (
                  <div className="mt-3">
                    <TextInput value={appSearch} onChange={(e) => setAppSearch(e.target.value)} placeholder="Buscar app…" />
                    {pickerLoading ? (
                      <p className="text-xs mt-3" style={{ color: C.faint }}>Cargando apps…</p>
                    ) : (
                      <ul className="mt-3 space-y-2" style={{ maxHeight: 280, overflowY: "auto" }}>
                        {filteredInstalled.map((a) => {
                          const on = !!inboxApps[a.pkg]?.enabled;
                          return (
                            <li key={a.pkg} className="flex items-center justify-between gap-3">
                              <span className="text-sm truncate" style={{ color: on ? C.text : C.muted }}>{a.label}</span>
                              <Toggle on={on} onClick={() => setAppEnabled(a.pkg, a.label, !on)} label={`${on ? "Desactivar" : "Activar"} ${a.label}`} />
                            </li>
                          );
                        })}
                        {!filteredInstalled.length && (
                          <li className="text-xs" style={{ color: C.faint }}>{installed.length ? "Sin resultados." : "No se encontraron apps."}</li>
                        )}
                      </ul>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </Card>
  );
}
