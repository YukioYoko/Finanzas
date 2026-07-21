import { useState, useMemo, useRef, useCallback } from "react";
import { useTheme } from "../theme";
import { MONTH_NAMES, MONTH_SHORT } from "../constants";
import { money } from "../utils/format";
import { movTotal } from "../lib/finance";
import { Btn, Card, Empty } from "./ui";

function useContainerWidth() {
  const [width, setWidth] = useState(0);
  const roRef = useRef(null);
  const ref = useCallback((node) => {
    if (roRef.current) { roRef.current.disconnect(); roRef.current = null; }
    if (node) {
      const ro = new ResizeObserver((entries) => setWidth(entries[0].contentRect.width));
      ro.observe(node);
      roRef.current = ro;
    }
  }, []);
  return [ref, width];
}

// Redondea el tope del eje a un número limpio (paso 1 / 2 / 2.5 / 5 × 10^n, 4 divisiones)
function niceScale(maxValue) {
  if (maxValue <= 0) return { max: 4, step: 1 };
  const raw = maxValue / 4;
  const pow = Math.pow(10, Math.floor(Math.log10(raw)));
  const f = raw / pow;
  const step = (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * pow;
  return { max: step * 4, step };
}

const tickLabel = (v) => (v >= 1000 ? `$${+(v / 1000).toFixed(1)}k` : `$${v}`);

// Columnas agrupadas de gastos e ingresos de los últimos 6 meses.
// `counted` son los movimientos ya filtrados a tarjetas contabilizadas.
export default function GraficaMensual({ counted }) {
  const C = useTheme();
  const [containerRef, width] = useContainerWidth();
  const [vista, setVista] = useState("grafica");
  const [sel, setSel] = useState(5); // mes actual

  const now = new Date();
  const meses = useMemo(() => {
    return Array.from({ length: 6 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - 5 + i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const sum = (type) => counted
        .filter((m) => m.type === type && !m.adjust && !m.transfer && m.date.startsWith(key))
        .reduce((s, m) => s + movTotal(m), 0);
      return { key, label: MONTH_SHORT[d.getMonth()], year: d.getFullYear(), gastos: sum("gasto"), ingresos: sum("ingreso") };
    });
  }, [counted]); // eslint-disable-line react-hooks/exhaustive-deps

  const hayDatos = meses.some((m) => m.gastos > 0 || m.ingresos > 0);
  const { max: yMax, step } = niceScale(Math.max(...meses.map((m) => Math.max(m.gastos, m.ingresos))));
  const ticks = [0, 1, 2, 3, 4].map((i) => i * step);

  // Geometría
  const padL = 44, padR = 8, padT = 8, plotH = 180, labelH = 24;
  const svgH = padT + plotH + labelH;
  const plotW = Math.max(width - padL - padR, 0);
  const band = plotW / 6;
  const barW = Math.max(Math.min(24, (band - 18) / 2), 4);
  const baseY = padT + plotH;
  const yOf = (v) => baseY - (v / yMax) * plotH;

  const selMes = meses[sel];

  const Swatch = ({ color }) => (
    <span aria-hidden="true" className="inline-block rounded-sm" style={{ width: 10, height: 10, background: color }} />
  );

  return (
    <Card>
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        {/* Leyenda */}
        <div className="flex items-center gap-4 text-xs" style={{ color: C.muted }}>
          <span className="flex items-center gap-1.5"><Swatch color={C.chartGasto} /> Gastos</span>
          <span className="flex items-center gap-1.5"><Swatch color={C.chartIngreso} /> Ingresos</span>
        </div>
        <Btn kind="ghost" style={{ padding: "4px 10px" }} onClick={() => setVista((v) => (v === "grafica" ? "tabla" : "grafica"))}>
          {vista === "grafica" ? "Ver tabla" : "Ver gráfica"}
        </Btn>
      </div>

      {!hayDatos ? (
        <Empty>Sin movimientos en los últimos 6 meses.</Empty>
      ) : vista === "tabla" ? (
        <table className="w-full text-sm">
          <thead>
            <tr className="text-xs uppercase tracking-wider" style={{ color: C.muted }}>
              <th className="text-left py-1.5 font-normal">Mes</th>
              <th className="text-right py-1.5 font-normal">Gastos</th>
              <th className="text-right py-1.5 font-normal">Ingresos</th>
            </tr>
          </thead>
          <tbody>
            {meses.map((m) => (
              <tr key={m.key} style={{ borderTop: `1px solid ${C.borderSoft}` }}>
                <td className="py-1.5" style={{ color: C.muted }}>{m.label} {m.year}</td>
                <td className="py-1.5 text-right font-mono" style={{ fontVariantNumeric: "tabular-nums" }}>{money(m.gastos)}</td>
                <td className="py-1.5 text-right font-mono" style={{ fontVariantNumeric: "tabular-nums" }}>{money(m.ingresos)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <div ref={containerRef}>
          {width > 0 && (
            <svg width={width} height={svgH} role="img" aria-label="Gráfica de gastos e ingresos por mes de los últimos 6 meses">
              <clipPath id="gm-plot">
                <rect x={padL} y={padT} width={plotW} height={plotH} />
              </clipPath>
              {/* Rejilla y ticks del eje Y */}
              {ticks.map((t) => (
                <g key={t}>
                  <line x1={padL} x2={padL + plotW} y1={yOf(t)} y2={yOf(t)} stroke={t === 0 ? C.border : C.borderSoft} strokeWidth="1" />
                  <text x={padL - 6} y={yOf(t) + 3.5} textAnchor="end" fontSize="10" fill={C.faint} style={{ fontVariantNumeric: "tabular-nums" }}>
                    {tickLabel(t)}
                  </text>
                </g>
              ))}
              {/* Columnas: extremo superior redondeado, base cuadrada vía clip */}
              <g clipPath="url(#gm-plot)">
                {meses.map((m, i) => {
                  const x0 = padL + i * band + (band - (barW * 2 + 2)) / 2;
                  const dim = sel === i ? 0.8 : 1;
                  return (
                    <g key={m.key} opacity={dim}>
                      {m.gastos > 0 && <rect x={x0} y={yOf(m.gastos)} width={barW} height={baseY - yOf(m.gastos) + 4} rx="4" fill={C.chartGasto} />}
                      {m.ingresos > 0 && <rect x={x0 + barW + 2} y={yOf(m.ingresos)} width={barW} height={baseY - yOf(m.ingresos) + 4} rx="4" fill={C.chartIngreso} />}
                    </g>
                  );
                })}
              </g>
              {/* Etiquetas de mes y zonas de toque (más grandes que las marcas) */}
              {meses.map((m, i) => (
                <g key={m.key}>
                  <text x={padL + i * band + band / 2} y={svgH - 8} textAnchor="middle" fontSize="10" fill={sel === i ? C.text : C.faint}>
                    {m.label}
                  </text>
                  <rect
                    x={padL + i * band} y={padT} width={band} height={plotH + labelH} fill="transparent"
                    tabIndex={0} role="button" aria-label={`${MONTH_NAMES[parseInt(m.key.slice(5), 10) - 1]}: gastos ${money(m.gastos)}, ingresos ${money(m.ingresos)}`}
                    style={{ cursor: "pointer", outline: "none" }}
                    onPointerEnter={() => setSel(i)} onClick={() => setSel(i)} onFocus={() => setSel(i)}
                  />
                </g>
              ))}
            </svg>
          )}
          {/* Lectura del mes seleccionado (tooltip fijo: funciona también en táctil) */}
          <div className="flex items-center gap-4 mt-2 text-xs flex-wrap" style={{ color: C.muted }}>
            <span className="uppercase tracking-wider">{MONTH_NAMES[parseInt(selMes.key.slice(5), 10) - 1]} {selMes.year}</span>
            <span className="flex items-center gap-1.5">
              <Swatch color={C.chartGasto} />
              <span className="font-mono" style={{ color: C.text, fontVariantNumeric: "tabular-nums" }}>{money(selMes.gastos)}</span> gastos
            </span>
            <span className="flex items-center gap-1.5">
              <Swatch color={C.chartIngreso} />
              <span className="font-mono" style={{ color: C.text, fontVariantNumeric: "tabular-nums" }}>{money(selMes.ingresos)}</span> ingresos
            </span>
          </div>
        </div>
      )}
    </Card>
  );
}
