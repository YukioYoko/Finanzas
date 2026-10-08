// Primitivas de UI de la app. Reutiliza estas en lugar de escribir
// <input>/<button> con estilos sueltos: todas leen sus colores de useTheme().
import { useState, useEffect } from "react";
import { useTheme } from "../theme";
import { money } from "../utils/format";
import { balanceOfCard, isDebtType, cardTypeLabel } from "../lib/finance";

export function Field({ label, hint, children }) {
  const C = useTheme();
  return (
    <label className="block">
      <span className="flex items-center gap-1.5 text-xs uppercase tracking-wider mb-1" style={{ color: C.muted }}>
        {label}
        {hint}
      </span>
      {children}
    </label>
  );
}

// Icono "?" (o el que se pase) que abre un pequeño cuadro de diálogo con una
// explicación. Pensado para ir junto a la etiqueta de un Field (prop `hint`) o
// como aviso (p. ej. icono "!" en rojo). `icon` y `color` son opcionales.
export function InfoHint({ title, children, icon = "?", color }) {
  const C = useTheme();
  const [open, setOpen] = useState(false);
  const c = color || C.muted;
  return (
    <>
      <button
        type="button"
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); setOpen(true); }}
        aria-label={typeof title === "string" ? title : "Más información"}
        className="inline-flex items-center justify-center rounded-full shrink-0 transition-opacity hover:opacity-80"
        style={{ width: 16, height: 16, border: `1px solid ${c}`, color: c, fontSize: 10, fontWeight: 700, lineHeight: 1 }}
      >
        {icon}
      </button>
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          onClick={(e) => { e.preventDefault(); setOpen(false); }}
          role="dialog"
          aria-label={title}
        >
          <div className="absolute inset-0" style={{ background: "rgba(0,0,0,0.55)" }} aria-hidden="true" />
          <div
            className="relative rounded-xl p-4 w-full max-w-xs"
            style={{ background: C.surface, border: `1px solid ${C.border}` }}
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}
          >
            <div className="flex items-start justify-between gap-2 mb-2">
              <h4 className="text-sm font-medium normal-case tracking-normal" style={{ color: C.text }}>{title}</h4>
              <button
                type="button"
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); setOpen(false); }}
                aria-label="Cerrar"
                className="shrink-0"
                style={{ color: C.muted, fontSize: 14, lineHeight: 1 }}
              >
                ✕
              </button>
            </div>
            <p className="text-sm leading-relaxed normal-case tracking-normal" style={{ color: C.muted }}>{children}</p>
          </div>
        </div>
      )}
    </>
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

export function TextInput(props) {
  const base = useInputStyle();
  return <input {...props} style={{ ...base, ...(props.style || {}) }} />;
}

export function Select({ children, ...props }) {
  const base = useInputStyle();
  const C = useTheme();
  // Flecha (chevron) propia del tema en lugar de la del sistema, para un look limpio y uniforme
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12' fill='none' stroke='${C.muted}' stroke-width='1.6' stroke-linecap='round' stroke-linejoin='round'><path d='M3 4.5 6 7.5 9 4.5'/></svg>`;
  const chevron = `url("data:image/svg+xml;utf8,${svg.replace(/#/g, "%23")}")`;
  return (
    <select
      {...props}
      style={{
        ...base,
        appearance: "none",
        WebkitAppearance: "none",
        MozAppearance: "none",
        cursor: "pointer",
        paddingRight: 32,
        backgroundImage: chevron,
        backgroundRepeat: "no-repeat",
        backgroundPosition: "right 10px center",
        ...(props.style || {}),
      }}
    >
      {children}
    </select>
  );
}

// Selector de cuenta/tarjeta: muestra un campo "Seleccionar cuenta" y, al tocarlo,
// abre un modal con las tarjetas (con su saldo). Al elegir una se cierra; para
// cambiarla se vuelve a tocar. `cards` ya viene filtrada por quien lo usa.
export function CardPicker({ label, cards, accounts, movements, value, onChange, empty, placeholder }) {
  const C = useTheme();
  const base = useInputStyle();
  const [open, setOpen] = useState(false);
  const accName = (id) => accounts.find((a) => a.id === id)?.name || "";
  const selected = cards.find((c) => c.id === value) || null;

  // Bloquea el scroll del fondo mientras el modal está abierto
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  const Chevron = () => (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke={C.muted} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="shrink-0" aria-hidden="true">
      <path d="M3 4.5 6 7.5 9 4.5" />
    </svg>
  );

  return (
    <div>
      {label && <span className="block text-xs uppercase tracking-wider mb-1" style={{ color: C.muted }}>{label}</span>}
      <button
        type="button"
        onClick={() => setOpen(true)}
        style={{ ...base, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, textAlign: "left" }}
      >
        {selected ? (
          <span className="truncate" style={{ color: C.text }}>
            {selected.name}{selected.last4 ? ` ····${selected.last4}` : ""}
            <span style={{ color: C.faint }}> · {accName(selected.accountId)}</span>
          </span>
        ) : (
          <span className="truncate" style={{ color: C.faint }}>{placeholder || "Seleccionar cuenta"}</span>
        )}
        <Chevron />
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label={label || "Elegir cuenta"}>
          <div className="absolute inset-0" style={{ background: "rgba(0,0,0,0.6)" }} onClick={() => setOpen(false)} aria-hidden="true" />
          <div className="relative w-full max-w-md rounded-2xl flex flex-col overflow-hidden" style={{ background: C.surface, border: `1px solid ${C.border}`, maxHeight: "80vh" }}>
            <div className="flex items-center justify-between gap-3 p-4" style={{ borderBottom: `1px solid ${C.borderSoft}` }}>
              <h3 className="text-sm uppercase tracking-widest" style={{ color: C.accent }}>{label || "Elegir cuenta"}</h3>
              <button onClick={() => setOpen(false)} aria-label="Cerrar" className="rounded-full p-2 transition-opacity hover:opacity-85" style={{ border: `1px solid ${C.border}`, color: C.muted, lineHeight: 1 }}>✕</button>
            </div>
            <div className="p-4 overflow-y-auto">
              {cards.length === 0 ? (
                <p className="text-xs" style={{ color: C.faint }}>{empty || "No hay cuentas disponibles."}</p>
              ) : (
                <div className="grid grid-cols-1 gap-2">
                  {cards.map((c) => {
                    const on = value === c.id;
                    const bal = balanceOfCard(c, movements);
                    const owes = isDebtType(c.type); // crédito/deuda: el saldo es lo que se debe
                    return (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => { onChange(c.id); setOpen(false); }}
                        className="flex items-center justify-between gap-2 rounded-lg px-3 py-2.5 text-left transition-colors"
                        style={on
                          ? { background: C.accentSoft, border: `1px solid ${C.accent}` }
                          : { background: C.bg, border: `1px solid ${C.borderSoft}` }}
                      >
                        <div className="min-w-0">
                          <p className="text-sm truncate" style={{ color: C.text, fontWeight: on ? 600 : 400 }}>
                            {c.name}{c.last4 ? ` ····${c.last4}` : ""}
                          </p>
                          <p className="text-xs truncate" style={{ color: C.faint }}>
                            {accName(c.accountId)} · {cardTypeLabel(c.type)}
                          </p>
                        </div>
                        <span className="font-mono text-xs shrink-0" style={{ color: owes ? C.amber : bal < 0 ? C.red : C.muted, fontVariantNumeric: "tabular-nums" }}>
                          {owes ? `debe ${money(bal)}` : money(bal)}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Tamaños de botón unificados (usa `size` en vez de padding inline suelto)
const BTN_SIZES = {
  sm: { padding: "5px 10px", fontSize: 13 },
  md: { padding: "8px 12px", fontSize: 14 },
  lg: { padding: "10px 16px", fontSize: 15 },
};

export function Btn({ children, kind = "primary", size = "md", ...props }) {
  const C = useTheme();
  const styles = {
    primary: { background: C.accent, color: C.accentText, border: "1px solid transparent", fontWeight: 600 },
    ghost: { background: "transparent", color: C.muted, border: `1px solid ${C.border}` },
    danger: { background: "transparent", color: C.red, border: `1px solid ${C.border}` },
  };
  return (
    <button
      {...props}
      className={"rounded-lg transition-opacity hover:opacity-85 " + (props.className || "")}
      style={{ ...BTN_SIZES[size] || BTN_SIZES.md, ...styles[kind], ...(props.style || {}) }}
    >
      {children}
    </button>
  );
}

// Píldora de selección/toggle (chips de periodo, filtros, alternadores). Un solo
// estilo para que todos los "chips" clicables se vean igual en toda la app.
export function Pill({ children, on = false, ...props }) {
  const C = useTheme();
  return (
    <button
      type="button"
      {...props}
      className={"rounded-full px-3 py-1 text-xs transition-opacity hover:opacity-85 " + (props.className || "")}
      style={{
        ...(on
          ? { background: C.accentSoft, color: C.accent, border: `1px solid ${C.border}`, fontWeight: 600 }
          : { background: "transparent", color: C.muted, border: `1px solid ${C.borderSoft}` }),
        ...(props.style || {}),
      }}
    >
      {children}
    </button>
  );
}

export function Chip({ children, color, bg }) {
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

export function Amount({ value, sign, size = "text-base" }) {
  const C = useTheme();
  const color = sign === "+" ? C.green : sign === "-" ? C.red : C.text;
  return (
    <span className={`font-mono ${size}`} style={{ color, fontVariantNumeric: "tabular-nums" }}>
      {sign === "+" ? "+" : sign === "-" ? "−" : ""}{money(Math.abs(value))}
    </span>
  );
}

export function Card({ children, className = "", style = {} }) {
  const C = useTheme();
  return (
    <div className={"rounded-xl p-4 " + className} style={{ background: C.surface, border: `1px solid ${C.borderSoft}`, ...style }}>
      {children}
    </div>
  );
}

export function SectionTitle({ children, right }) {
  const C = useTheme();
  return (
    <div className="flex items-center justify-between mb-3">
      <h2 className="text-sm uppercase tracking-widest" style={{ color: C.accent }}>{children}</h2>
      {right}
    </div>
  );
}

export function Toggle({ on, onClick, label }) {
  const C = useTheme();
  return (
    <button
      onClick={onClick}
      role="switch"
      aria-checked={on}
      aria-label={label}
      className="rounded-full transition-colors shrink-0"
      style={{ width: 40, height: 22, padding: 2, background: on ? C.accent : C.borderSoft, border: `1px solid ${C.border}` }}
    >
      <span
        className="block rounded-full transition-transform"
        style={{ width: 16, height: 16, background: "#fff", transform: on ? "translateX(18px)" : "translateX(0)" }}
      />
    </button>
  );
}

export function Empty({ children }) {
  const C = useTheme();
  return (
    <div className="rounded-xl p-6 text-center text-sm" style={{ border: `1px dashed ${C.border}`, color: C.faint }}>
      {children}
    </div>
  );
}
