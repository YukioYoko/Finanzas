import { useState } from "react";
import { useTheme } from "../theme";
import { SUPPORT_EMAIL } from "../constants";
import { Btn, Card, SectionTitle } from "../components/ui";

// Sección plegable reutilizable (FAQ, términos…)
function Collapsible({ title, children }) {
  const C = useTheme();
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-lg" style={{ background: C.bg, border: `1px solid ${C.borderSoft}` }}>
      <button
        className="w-full flex items-center justify-between px-3 py-2.5 text-left text-sm"
        style={{ color: C.text }}
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <span className="pr-2">{title}</span>
        <span aria-hidden="true" style={{ color: C.faint }}>{open ? "−" : "+"}</span>
      </button>
      {open && (
        <div className="px-3 pb-3 text-sm leading-relaxed" style={{ color: C.muted }}>
          {children}
        </div>
      )}
    </div>
  );
}

const FAQ = [
  {
    q: "¿Dónde se guardan mis datos?",
    a: "Todo se guarda localmente en tu teléfono (o navegador). Nada se sube a internet ni se comparte. Ojo: si desinstalas la app o borras los datos de la aplicación, tu información se pierde — no hay respaldo en la nube por ahora.",
  },
  {
    q: "¿Cómo se calcula el \"Pago de este mes\" de mi tarjeta de crédito?",
    a: "Con el día de corte que configuraste: se suman los cargos hechos hasta el último corte y se restan todos tus pagos. Es el equivalente al \"pago para no generar intereses\" del banco. Las compras a meses (MSI) solo suman la mensualidad de los cortes que ya pasaron, no el total.",
  },
  {
    q: "¿Por qué las transferencias y pagos de tarjeta no aparecen como gastos?",
    a: "Porque mover dinero entre tus propias cuentas no es un gasto: tu dinero total no cambia (o baja tu saldo y tu deuda al mismo tiempo). Por eso se marcan como \"Transferencia\" y no entran en los totales del mes ni en la gráfica.",
  },
  {
    q: "¿Cómo funciona la lectura de notificaciones?",
    a: "En Movimientos, toca \"Permitir acceso\" y activa Mis Finanzas en los ajustes del sistema. A partir de ahí, cuando tu banco te notifique un cargo, aparecerá en \"Por confirmar\" con el monto y la tarjeta ya detectados. La lectura ocurre solo en tu teléfono.",
  },
  {
    q: "¿Qué es la \"tarjeta digital\"?",
    a: "Si tu banco te dio una tarjeta digital con una terminación distinta a la física, agrégala en Cuentas → ✎ Editar. Así los cargos hechos con cualquiera de las dos terminaciones se asignan a la misma tarjeta.",
  },
  {
    q: "¿Cómo corrijo el saldo de una tarjeta?",
    a: "En Cuentas, toca ✎ Editar en la tarjeta y escribe el saldo real. La diferencia se registra como un movimiento de \"Ajuste de saldo\" para que el historial siga cuadrando (no se borra nada).",
  },
  {
    q: "¿Puedo editar un movimiento o un cargo fijo ya creado?",
    a: "Sí: ambos tienen un botón ✎. Los movimientos automáticos (transferencias, rendimientos y ajustes) solo se pueden eliminar, porque editarlos descuadraría las cuentas.",
  },
  {
    q: "¿Qué pasa si mi cargo fijo cae en un día que el mes no tiene (ej. 31)?",
    a: "Se registra el último día de ese mes. Lo mismo aplica a los días de corte y pago de las tarjetas.",
  },
];

const TERMS = [
  ["1. Sobre la aplicación", "Mis Finanzas es una herramienta personal para registrar y organizar tus finanzas. No es una institución financiera ni ofrece asesoría financiera, contable o fiscal."],
  ["2. Tus datos", "Toda la información que capturas (cuentas, tarjetas, movimientos) se almacena únicamente en tu dispositivo. La app no envía tus datos a servidores externos ni los comparte con terceros."],
  ["3. Lectura de notificaciones", "Si concedes el acceso a notificaciones, la app analiza localmente las notificaciones de tu teléfono para detectar cargos con montos. Ese contenido nunca sale de tu dispositivo y puedes revocar el permiso en cualquier momento desde los ajustes del sistema."],
  ["4. Exactitud de la información", "Los cálculos (saldos, estados de cuenta, intereses, mensualidades) son estimaciones basadas en lo que tú registras y pueden diferir de los cálculos de tu banco. Ante cualquier diferencia, la información oficial de tu institución financiera es la que vale."],
  ["5. Respaldo", "Al ser almacenamiento local, eres responsable de conservar tu dispositivo y sus datos. Desinstalar la app o borrar sus datos elimina tu información de forma permanente."],
  ["6. Responsabilidad", "La app se ofrece \"tal cual\", sin garantías. El desarrollador no se hace responsable de decisiones financieras tomadas con base en la información mostrada, ni de pérdidas de datos."],
  ["7. Cambios", "Estos términos pueden actualizarse con nuevas versiones de la app. El uso continuado tras una actualización implica la aceptación de los términos vigentes."],
];

export default function Ajustes({ data, update, onBack, onShowTour }) {
  const C = useTheme();
  const mode = data.theme === "light" ? "light" : "dark";

  return (
    <div className="space-y-4">
      <SectionTitle right={<Btn kind="ghost" onClick={onBack}>← Volver</Btn>}>Ajustes</SectionTitle>

      {/* Apariencia y recorrido */}
      <Card>
        <h3 className="text-sm font-medium mb-3">Preferencias</h3>
        <div className="flex flex-col sm:flex-row gap-2">
          <Btn kind="ghost" onClick={() => update({ theme: mode === "dark" ? "light" : "dark" })}>
            {mode === "dark" ? "☀️ Cambiar a tema claro" : "🌙 Cambiar a tema oscuro"}
          </Btn>
          <Btn kind="ghost" onClick={onShowTour}>
            🚀 Ver el recorrido de la app
          </Btn>
        </div>
      </Card>

      {/* Preguntas frecuentes */}
      <Card>
        <h3 className="text-sm font-medium mb-3">Preguntas frecuentes</h3>
        <div className="space-y-2">
          {FAQ.map(({ q, a }) => (
            <Collapsible key={q} title={q}>{a}</Collapsible>
          ))}
        </div>
      </Card>

      {/* Soporte */}
      <Card>
        <h3 className="text-sm font-medium mb-2">Soporte</h3>
        <p className="text-sm mb-3" style={{ color: C.muted }}>
          ¿Encontraste un error o tienes una sugerencia? Escríbeme y cuéntame qué pasó, en qué pantalla y, si puedes, adjunta una captura. Como tus datos viven solo en tu teléfono, nadie más puede verlos — describe el problema con tus propias palabras.
        </p>
        <a
          href={`mailto:${SUPPORT_EMAIL}?subject=Soporte%20Mis%20Finanzas`}
          className="inline-block rounded-lg px-3 py-2 text-sm"
          style={{ background: C.accent, color: C.accentText, fontWeight: 600 }}
        >
          ✉️ Contactar soporte
        </a>
        <p className="text-xs mt-2" style={{ color: C.faint }}>{SUPPORT_EMAIL}</p>
      </Card>

      {/* Términos y condiciones */}
      <Card>
        <h3 className="text-sm font-medium mb-3">Legal</h3>
        <Collapsible title="Términos y condiciones">
          <div className="space-y-3">
            {TERMS.map(([t, body]) => (
              <div key={t}>
                <p className="font-medium" style={{ color: C.text }}>{t}</p>
                <p>{body}</p>
              </div>
            ))}
          </div>
        </Collapsible>
      </Card>

      {/* Acerca de */}
      <p className="text-xs text-center" style={{ color: C.faint }}>
        Mis Finanzas · hecha con React + Capacitor · tus datos nunca salen de tu dispositivo
      </p>
    </div>
  );
}
