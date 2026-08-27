import { useState, useMemo, useEffect } from "react";
import { useTheme } from "../theme";
import { MONTH_NAMES } from "../constants";
import { money } from "../utils/format";
import { movTotal } from "../lib/finance";
import { Pill, Empty, Field, Select } from "./ui";

const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

// Resumen anual por categoría, con histórico por año y comparación mes vs. total del año.
// `counted` son los movimientos ya filtrados a tarjetas contabilizadas.
export default function ResumenAnual({ counted, categories, onClose }) {
  const C = useTheme();
  const nowYear = new Date().getFullYear();
  const [year, setYear] = useState(nowYear);
  const [tipo, setTipo] = useState("gasto");
  const [mes, setMes] = useState(null); // null = todo el año; 0–11 = mes

  // Bloquea el scroll de la pantalla de fondo mientras el modal está abierto
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, []);

  const catById = useMemo(() => Object.fromEntries(categories.map((c) => [c.id, c])), [categories]);

  // Los movimientos de interés no llevan categoría: rendimientos de ahorro (ingreso)
  // se agrupan como "Inversiones" y los intereses de deudas (gasto) como "Intereses".
  const keyOf = (m) => (m.interest ? (m.type === "ingreso" ? "inversiones" : "intereses") : m.categoryId || "sin");
  const nameOf = (id) =>
    id === "inversiones" ? "Inversiones" : id === "intereses" ? "Intereses" : catById[id]?.name || "Sin categoría";

  // Años con datos (más el año actual), para navegar el histórico
  const years = useMemo(() => {
    const set = new Set(
      counted.filter((m) => !m.adjust && !m.transfer).map((m) => Number(m.date.slice(0, 4))).filter(Boolean)
    );
    set.add(nowYear);
    return [...set].sort((a, b) => a - b);
  }, [counted, nowYear]);

  // Meses (0–11) que tienen movimientos del tipo y año elegidos, para no listar vacíos
  const monthsWithData = useMemo(() => {
    const set = new Set();
    const yPrefix = `${year}-`;
    counted
      .filter((m) => m.type === tipo && !m.adjust && !m.transfer && m.date.startsWith(yPrefix))
      .forEach((m) => set.add(Number(m.date.slice(5, 7)) - 1));
    return set;
  }, [counted, tipo, year]);

  // Si el mes seleccionado se queda sin datos (al cambiar tipo/año), vuelve a "Todo el año"
  useEffect(() => {
    if (mes != null && !monthsWithData.has(mes)) setMes(null);
  }, [monthsWithData, mes]);

  // Sumas por categoría del año y (si aplica) del mes seleccionado
  const { rows, annualTotal, monthTotal, max } = useMemo(() => {
    const yPrefix = `${year}-`;
    const mPrefix = mes != null ? `${year}-${String(mes + 1).padStart(2, "0")}-` : null;
    const annual = {};
    const month = {};
    counted
      .filter((m) => m.type === tipo && !m.adjust && !m.transfer && m.date.startsWith(yPrefix))
      .forEach((m) => {
        const k = keyOf(m);
        const v = movTotal(m);
        annual[k] = (annual[k] || 0) + v;
        if (mPrefix && m.date.startsWith(mPrefix)) month[k] = (month[k] || 0) + v;
      });
    const rows = Object.keys(annual)
      .map((id) => ({ id, name: nameOf(id), annual: annual[id], month: month[id] || 0 }))
      .sort((a, b) => b.annual - a.annual);
    const annualTotal = rows.reduce((s, r) => s + r.annual, 0);
    const monthTotal = rows.reduce((s, r) => s + r.month, 0);
    const max = rows.reduce((m, r) => Math.max(m, r.annual), 0);
    return { rows, annualTotal, monthTotal, max };
  }, [counted, tipo, year, mes]); // eslint-disable-line react-hooks/exhaustive-deps

  const color = tipo === "gasto" ? C.chartGasto : C.chartIngreso;
  const selecting = mes != null;
  const headerTotal = selecting ? monthTotal : annualTotal;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Resumen anual"
    >
      <div className="absolute inset-0" style={{ background: "rgba(0,0,0,0.6)" }} onClick={onClose} aria-hidden="true" />
      <div
        className="relative w-full max-w-lg rounded-2xl flex flex-col"
        style={{ background: C.surface, border: `1px solid ${C.border}`, height: "92vh" }}
      >
        {/* Encabezado */}
        <div className="flex items-center justify-between gap-3 p-4" style={{ borderBottom: `1px solid ${C.borderSoft}` }}>
          <h2 className="text-sm uppercase tracking-widest" style={{ color: C.accent }}>Resumen anual</h2>
          <button
            onClick={onClose}
            aria-label="Cerrar"
            className="rounded-full p-2 transition-opacity hover:opacity-85"
            style={{ border: `1px solid ${C.border}`, color: C.muted, lineHeight: 1 }}
          >
            ✕
          </button>
        </div>

        {/* Controles */}
        <div className="p-4 space-y-3" style={{ borderBottom: `1px solid ${C.borderSoft}` }}>
          {/* Año y mes como listas desplegables (ahorran espacio) */}
          <div className="grid grid-cols-2 gap-3">
            <Field label="Año">
              <Select value={year} onChange={(e) => setYear(Number(e.target.value))}>
                {[...years].reverse().map((y) => <option key={y} value={y}>{y}</option>)}
              </Select>
            </Field>
            <Field label="Mes">
              <Select value={mes == null ? "" : String(mes)} onChange={(e) => setMes(e.target.value === "" ? null : Number(e.target.value))}>
                <option value="">Todo el año</option>
                {MONTH_NAMES.map((n, i) => (monthsWithData.has(i) ? <option key={i} value={i}>{cap(n)}</option> : null))}
              </Select>
            </Field>
          </div>

          {/* Gastos / Ingresos */}
          <div className="flex gap-1">
            {[["gasto", "Gastos"], ["ingreso", "Ingresos"]].map(([id, label]) => (
              <Pill key={id} on={tipo === id} onClick={() => setTipo(id)}>{label}</Pill>
            ))}
          </div>

          {/* Total de la selección */}
          <div className="flex items-baseline justify-between">
            <span className="text-xs" style={{ color: C.faint }}>
              {selecting ? `${MONTH_NAMES[mes]} de ${year}` : `Todo ${year}`}
            </span>
            <span className="font-mono text-xl" style={{ color, fontVariantNumeric: "tabular-nums" }}>{money(headerTotal)}</span>
          </div>
          {selecting && (
            <p className="text-xs" style={{ color: C.faint }}>
              Barra fuerte: el mes · barra clara: total del año. Total del año: <span className="font-mono">{money(annualTotal)}</span>
            </p>
          )}
        </div>

        {/* Lista por categoría (ocupa el resto con scroll interno) */}
        <div className="p-4 overflow-y-auto flex-1 min-h-0">
          {rows.length === 0 ? (
            <Empty>Sin {tipo === "gasto" ? "gastos" : "ingresos"} en {year}.</Empty>
          ) : (
            <ul className="space-y-3">
              {rows.map((r) => {
                const shown = selecting ? r.month : r.annual;
                const annualW = max ? (r.annual / max) * 100 : 0;
                const monthW = max ? ((selecting ? r.month : r.annual) / max) * 100 : 0;
                const pct = selecting && r.annual > 0 ? Math.round((r.month / r.annual) * 100) : null;
                return (
                  <li key={r.id}>
                    <div className="flex justify-between items-baseline text-sm mb-1 gap-2">
                      <span className="truncate" style={{ color: C.muted }}>{r.name}</span>
                      <span className="font-mono shrink-0" style={{ color: C.text, fontVariantNumeric: "tabular-nums" }}>
                        {money(shown)}
                        {selecting && <span style={{ color: C.faint }}> / {money(r.annual)}</span>}
                      </span>
                    </div>
                    <div style={{ position: "relative", background: C.bg, borderRadius: 6, height: 10, overflow: "hidden" }}>
                      {/* Total anual (tono claro) */}
                      <div style={{ position: "absolute", left: 0, top: 0, height: "100%", width: `${annualW}%`, background: color, opacity: 0.28, borderRadius: 6 }} />
                      {/* Monto del mes o del año (tono fuerte) */}
                      <div style={{ position: "absolute", left: 0, top: 0, height: "100%", width: `${monthW}%`, background: color, borderRadius: 6, minWidth: shown > 0 ? 3 : 0 }} />
                    </div>
                    {selecting && pct != null && (
                      <p className="text-xs mt-0.5" style={{ color: C.faint }}>{pct}% del año en este mes</p>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
