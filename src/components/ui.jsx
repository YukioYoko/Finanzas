// Primitivas de UI de la app. Reutiliza estas en lugar de escribir
// <input>/<button> con estilos sueltos: todas leen sus colores de useTheme().
import { useState } from "react";
import { useTheme } from "../theme";
import { money } from "../utils/format";

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
  return (
    <select {...props} style={{ ...base, ...(props.style || {}) }}>
      {children}
    </select>
  );
}

export function Btn({ children, kind = "primary", ...props }) {
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
