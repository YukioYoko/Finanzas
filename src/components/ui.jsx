// Primitivas de UI de la app. Reutiliza estas en lugar de escribir
// <input>/<button> con estilos sueltos: todas leen sus colores de useTheme().
import { useTheme } from "../theme";
import { money } from "../utils/format";

export function Field({ label, children }) {
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

export function Empty({ children }) {
  const C = useTheme();
  return (
    <div className="rounded-xl p-6 text-center text-sm" style={{ border: `1px dashed ${C.border}`, color: C.faint }}>
      {children}
    </div>
  );
}
