import { useState } from "react";
import { useTheme } from "../theme";
import { Btn } from "./ui";

const STEPS = [
  {
    title: "Bienvenido a Mis Finanzas",
    body: "Tu dinero, claro y en un solo lugar: cuentas, tarjetas, gastos, suscripciones y deudas de crédito. Todo se guarda en tu teléfono; nada sale de él.",
  },
  {
    title: "Cuentas y tarjetas",
    body: "En la pestaña Cuentas crea tus cuentas de banco o efectivo y agrégales tarjetas de débito, crédito o cajas de ahorro. A las de crédito ponles su día de corte y de pago para que la app calcule cuánto pagar cada mes; a las de ahorro, su rendimiento anual.",
  },
  {
    title: "Movimientos",
    body: "Registra gastos, ingresos y transferencias entre cuentas. Si le das permiso, la app lee las notificaciones de tu banco y te deja los cargos listos para confirmar: tú solo completas el título y la categoría.",
  },
  {
    title: "Cargos fijos",
    body: "En Fijos agrega tus suscripciones y servicios (Netflix, gimnasio, internet…). Se registran solos cada mes en su día de cobro, y puedes ponerles fecha de fin.",
  },
  {
    title: "Resumen",
    body: "Tu balance total (ya descontando la deuda de crédito), cuánto pagar este mes de tus tarjetas, la gráfica de gastos e ingresos, tus compras a meses y el detalle de cada tarjeta de crédito con su botón de pago.",
  },
  {
    title: "Todo listo",
    body: "Recibirás una notificación en cada fecha de corte y de pago de tus tarjetas. Puedes volver a ver este recorrido cuando quieras desde Ajustes, el engrane en la parte superior. Empieza creando tu primera cuenta.",
  },
];

// Recorrido de bienvenida: se muestra la primera vez que se abre la app y se
// puede volver a ver desde Ajustes. Siempre se puede saltar.
export default function Tour({ onClose }) {
  const C = useTheme();
  const [step, setStep] = useState(0);
  const isLast = step === STEPS.length - 1;
  const { title, body } = STEPS[step];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.65)" }}
      role="dialog"
      aria-modal="true"
      aria-label="Recorrido de la aplicación"
    >
      <div className="w-full max-w-md rounded-2xl p-6" style={{ background: C.surface, border: `1px solid ${C.border}` }}>
        <p className="text-xs uppercase tracking-widest mb-2" style={{ color: C.faint }}>
          Paso {step + 1} de {STEPS.length}
        </p>
        <h2 className="text-lg font-semibold mb-2" style={{ color: C.text }}>{title}</h2>
        <p className="text-sm leading-relaxed" style={{ color: C.muted }}>{body}</p>

        {/* Puntos de progreso */}
        <div className="flex gap-1.5 mt-5 mb-5" aria-hidden="true">
          {STEPS.map((_, i) => (
            <span
              key={i}
              className="rounded-full"
              style={{ width: 8, height: 8, background: i === step ? C.accent : C.borderSoft }}
            />
          ))}
        </div>

        <div className="flex items-center justify-between gap-2">
          <Btn kind="ghost" onClick={onClose} style={{ padding: "6px 12px" }}>
            Saltar
          </Btn>
          <div className="flex gap-2">
            {step > 0 && (
              <Btn kind="ghost" onClick={() => setStep((s) => s - 1)} style={{ padding: "6px 12px" }}>
                Atrás
              </Btn>
            )}
            <Btn onClick={() => (isLast ? onClose() : setStep((s) => s + 1))} style={{ padding: "6px 16px" }}>
              {isLast ? "¡Empezar!" : "Siguiente"}
            </Btn>
          </div>
        </div>
      </div>
    </div>
  );
}
