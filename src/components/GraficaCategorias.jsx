import { useState, useMemo } from "react";
import { useTheme } from "../theme";
import { MONTH_NAMES } from "../constants";
import { money } from "../utils/format";
import { movTotal } from "../lib/finance";
import { Card, Empty } from "./ui";

// Desglose de gastos (o ingresos) del mes por categoría, en barras horizontales.
// `counted` son los movimientos ya filtrados a tarjetas contabilizadas.
export default function GraficaCategorias({ counted, categories }) {
  const C = useTheme();
  const [tipo, setTipo] = useState("gasto");
  const now = new Date();
  const ym = now.toISOString().slice(0, 7);
  const catById = useMemo(() => Object.fromEntries(categories.map((c) => [c.id, c])), [categories]);

  const rows = useMemo(() => {
    const sums = {};
    counted
      .filter((m) => m.type === tipo && !m.adjust && !m.transfer && m.date.startsWith(ym))
      .forEach((m) => {
        // Los rendimientos de las cajas de ahorro no llevan categoría: se agrupan como "Inversiones"
        const k = m.interest ? "inversiones" : m.categoryId || "sin";
        sums[k] = (sums[k] || 0) + movTotal(m);
      });
    return Object.entries(sums)
      .map(([id, amount]) => ({
        id,
        name: id === "inversiones" ? "Inversiones" : catById[id]?.name || "Sin categoría",
        amount,
      }))
      .sort((a, b) => b.amount - a.amount);
  }, [counted, tipo, ym]); // eslint-disable-line react-hooks/exhaustive-deps

  const max = rows.reduce((m, r) => Math.max(m, r.amount), 0);
  const total = rows.reduce((s, r) => s + r.amount, 0);
  const color = tipo === "gasto" ? C.chartGasto : C.chartIngreso;

  return (
    <Card>
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <div className="flex gap-1">
          {[["gasto", "Gastos"], ["ingreso", "Ingresos"]].map(([id, label]) => (
            <button
              key={id}
              onClick={() => setTipo(id)}
              className="rounded-full px-3 py-1 text-xs transition-opacity hover:opacity-85"
              style={tipo === id
                ? { background: C.accentSoft, color: C.accent, border: `1px solid ${C.border}`, fontWeight: 600 }
                : { color: C.muted, border: `1px solid ${C.borderSoft}` }}
            >
              {label}
            </button>
          ))}
        </div>
        <span className="text-xs" style={{ color: C.faint }}>{MONTH_NAMES[now.getMonth()]} · {money(total)}</span>
      </div>

      {rows.length === 0 ? (
        <Empty>Sin {tipo === "gasto" ? "gastos" : "ingresos"} este mes.</Empty>
      ) : (
        <ul className="space-y-3">
          {rows.map((r) => (
            <li key={r.id}>
              <div className="flex justify-between items-baseline text-sm mb-1 gap-2">
                <span className="truncate" style={{ color: C.muted }}>{r.name}</span>
                <span className="font-mono shrink-0" style={{ color: C.text, fontVariantNumeric: "tabular-nums" }}>{money(r.amount)}</span>
              </div>
              <div style={{ background: C.bg, borderRadius: 6, height: 8, overflow: "hidden" }}>
                <div style={{ width: `${max ? (r.amount / max) * 100 : 0}%`, background: color, height: "100%", borderRadius: 6, minWidth: 4 }} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
