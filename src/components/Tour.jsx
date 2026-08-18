import { useState, useEffect } from "react";
import { useTheme } from "../theme";
import { Btn } from "./ui";

// Cada paso apunta a una pestaña (para cambiar el fondo) y, si aplica, muestra
// una réplica del botón que el usuario debe buscar en esa pantalla.
const STEPS = [
  {
    tab: "resumen",
    title: "Bienvenido a Mis Finanzas",
    body: "Tu dinero, claro y en un solo lugar: cuentas, tarjetas, gastos, suscripciones y deudas. Todo se guarda en tu teléfono; nada sale de él. Te muestro dónde está cada cosa.",
  },
  {
    tab: "cuentas",
    title: "1. Crea tus cuentas y tarjetas",
    body: "En la pestaña Cuentas creas cuentas de banco, efectivo o deuda, y les agregas tarjetas de débito, crédito o cajas de ahorro. A las de crédito ponles su día de corte, de pago y su crédito máximo.",
    action: "+ Nueva cuenta",
    where: "Arriba a la derecha, en Cuentas.",
  },
  {
    tab: "movimientos",
    title: "2. Registra tus movimientos",
    body: "Aquí agregas gastos, ingresos y transferencias. Puedes pagar una compra con varios medios a la vez, y —si le das permiso— la app lee las notificaciones de tu banco y te deja los cargos listos para confirmar.",
    action: "+ Nuevo movimiento",
    where: "Arriba a la derecha, en Movimientos.",
  },
  {
    tab: "fijos",
    title: "3. Cargos y abonos fijos",
    body: "Programa tus suscripciones y servicios (cargos), o depósitos automáticos como tu ahorro mensual (abonos). Se registran solos según su frecuencia.",
    action: "+ Nuevo fijo",
    where: "Arriba a la derecha, en Fijos.",
  },
  {
    tab: "categorias",
    title: "4. Categorías",
    body: "Organiza tus gastos e ingresos por categoría (mensual, anual o esporádico). Con ellas la app arma tus gráficas y tus totales por tipo.",
    action: "Crear categoría",
    where: "Escribe el nombre en el formulario de arriba y toca este botón.",
  },
  {
    tab: "resumen",
    title: "5. Tu resumen",
    body: "El balance total (ya descontando lo que debes), cuánto pagar este mes, tus gráficas, las compras a meses y cada tarjeta o deuda con su botón para pagar. Aquí ves tu panorama completo.",
  },
  {
    tab: "resumen",
    title: "Todo listo",
    body: "Recibirás un aviso en cada fecha de corte y de pago. Puedes repetir este recorrido cuando quieras desde Ajustes. Empieza creando tu primera cuenta.",
    action: "⚙",
    where: "El engrane, arriba a la derecha: ahí están Ajustes, respaldo y este recorrido.",
  },
];

// Recorrido de bienvenida: se muestra la primera vez y se puede volver a ver
// desde Ajustes. Cambia la pestaña de fondo (onStep) y siempre se puede saltar.
export default function Tour({ onClose, onStep }) {
  const C = useTheme();
  const [step, setStep] = useState(0);
  const isLast = step === STEPS.length - 1;
  const s = STEPS[step];

  // Cambia la pestaña de fondo cada vez que avanza el paso
  useEffect(() => { onStep?.(s.tab); }, [step]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col justify-end"
      role="dialog"
      aria-modal="true"
      aria-label="Recorrido de la aplicación"
    >
      {/* Captura los toques para guiar el recorrido, pero deja ver la app
          (barra de pestañas y botones) con un velo muy sutil. */}
      <div className="absolute inset-0" style={{ background: "rgba(0,0,0,0.25)" }} aria-hidden="true" />

      <div className="relative w-full p-4" style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 16px)" }}>
        <div
          className="max-w-md mx-auto rounded-2xl p-5"
          style={{ background: C.surface, border: `1px solid ${C.border}`, boxShadow: "0 -10px 40px rgba(0,0,0,0.45)" }}
        >
          <p className="text-xs uppercase tracking-widest mb-2" style={{ color: C.faint }}>
            Paso {step + 1} de {STEPS.length}
          </p>
          <h2 className="text-lg font-semibold mb-2" style={{ color: C.text }}>{s.title}</h2>
          <p className="text-sm leading-relaxed" style={{ color: C.muted }}>{s.body}</p>

          {/* Réplica del botón que debe buscar en la pantalla actual */}
          {s.action && (
            <div className="mt-4 flex items-center gap-2 flex-wrap rounded-xl p-3" style={{ background: C.bg, border: `1px solid ${C.borderSoft}` }}>
              <span className="text-xs" style={{ color: C.faint }}>Búscalo así:</span>
              <span
                className="rounded-lg px-3 py-1.5 text-sm inline-flex items-center justify-center"
                style={{ background: C.accent, color: C.accentText, fontWeight: 600 }}
              >
                {s.action}
              </span>
              {s.where && <span className="text-xs w-full" style={{ color: C.muted }}>{s.where}</span>}
            </div>
          )}

          {/* Puntos de progreso */}
          <div className="flex gap-1.5 mt-5 mb-5" aria-hidden="true">
            {STEPS.map((_, i) => (
              <button
                key={i}
                onClick={() => setStep(i)}
                className="rounded-full transition-colors"
                style={{ width: 8, height: 8, padding: 0, border: "none", background: i === step ? C.accent : C.borderSoft }}
                aria-label={`Ir al paso ${i + 1}`}
              />
            ))}
          </div>

          <div className="flex items-center justify-between gap-2">
            <Btn kind="ghost" onClick={onClose}>Saltar</Btn>
            <div className="flex gap-2">
              {step > 0 && (
                <Btn kind="ghost" onClick={() => setStep((v) => v - 1)}>Atrás</Btn>
              )}
              <Btn size="lg" onClick={() => (isLast ? onClose() : setStep((v) => v + 1))}>
                {isLast ? "¡Empezar!" : "Siguiente"}
              </Btn>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
