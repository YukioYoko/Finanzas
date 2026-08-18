import { useState, useMemo } from "react";
import { useTheme } from "../theme";
import { MONTH_NAMES } from "../constants";
import { money, uid, todayISO, isoOf, fmtDia } from "../utils/format";
import { cardLabel, movTotal, balanceOfCard, creditStatement, clampDay, isDebtType, creditUsage, cashOverdraft } from "../lib/finance";
import { Field, TextInput, Select, Btn, Chip, Amount, Card, SectionTitle, Empty, InfoHint } from "../components/ui";
import GraficaMensual from "../components/GraficaMensual";
import GraficaCategorias from "../components/GraficaCategorias";

export default function Resumen({ data, update }) {
  const C = useTheme();
  const now = new Date();
  const [payFor, setPayFor] = useState(null); // cardId de la tarjeta a pagar
  const [paySrc, setPaySrc] = useState("");
  const [payAmt, setPayAmt] = useState("");
  const [payDate, setPayDate] = useState(todayISO());
  const [payError, setPayError] = useState("");
  const ym = now.toISOString().slice(0, 7);
  const year = String(now.getFullYear());

  const { accounts, cards, categories, movements } = data;

  const catById = useMemo(() => Object.fromEntries(categories.map((c) => [c.id, c])), [categories]);
  const cardById = useMemo(() => Object.fromEntries(cards.map((c) => [c.id, c])), [cards]);
  const accById = useMemo(() => Object.fromEntries(accounts.map((a) => [a.id, a])), [accounts]);

  // Solo entran a la contabilización las tarjetas no excluidas cuya cuenta tampoco esté excluida
  const isCountedCard = (c) => c && !c.excluded && !(accById[c.accountId]?.excluded);
  const counted = movements.filter((m) => isCountedCard(cardById[m.cardId]));
  const excludedCount = cards.filter((c) => !isCountedCard(c)).length;

  const gastosMes = counted.filter((m) => m.type === "gasto" && !m.adjust && !m.transfer && m.date.startsWith(ym));
  const ingresosMes = counted.filter((m) => m.type === "ingreso" && !m.adjust && !m.transfer && m.date.startsWith(ym));
  const totalGastosMes = gastosMes.reduce((s, m) => s + movTotal(m), 0);
  const totalIngresosMes = ingresosMes.reduce((s, m) => s + movTotal(m), 0);

  // Agrupar gastos por frecuencia de su categoría
  const groupByFreq = (freq, period) =>
    counted
      .filter((m) => m.type === "gasto" && !m.adjust && !m.transfer && (catById[m.categoryId]?.freq || "esporadico") === freq && m.date.startsWith(period))
      .reduce((acc, m) => {
        const key = m.categoryId || "sin";
        acc[key] = (acc[key] || 0) + movTotal(m);
        return acc;
      }, {});

  // Gastos semanales: agrupados por la semana en curso (lunes a hoy)
  const startOfWeek = (d) => { const m = new Date(d); const dw = m.getDay(); m.setDate(m.getDate() + (dw === 0 ? -6 : 1 - dw)); m.setHours(0, 0, 0, 0); return m; };
  const weekStartISO = isoOf(startOfWeek(now));
  const semanales = counted
    .filter((m) => m.type === "gasto" && !m.adjust && !m.transfer && catById[m.categoryId]?.freq === "semanal" && m.date >= weekStartISO)
    .reduce((acc, m) => { const k = m.categoryId || "sin"; acc[k] = (acc[k] || 0) + movTotal(m); return acc; }, {});

  const mensuales = groupByFreq("mensual", ym);
  const anuales = groupByFreq("anual", year);
  const esporadicos = groupByFreq("esporadico", ym);

  const sum = (obj) => Object.values(obj).reduce((s, v) => s + v, 0);

  // Color de la barra de uso de crédito: verde con margen, ámbar apretado, rojo al tope
  const usageColor = (ratio) => (ratio >= 0.9 ? C.red : ratio >= 0.7 ? C.amber : C.green);

  // Dinero disponible (débito, ahorro y efectivo) de lo contabilizado
  const availableBalance = cards
    .filter((c) => isCountedCard(c) && !isDebtType(c.type))
    .reduce((s, c) => s + balanceOfCard(c, movements), 0);

  // Deudas (préstamos y similares) contabilizadas
  const debtAccCards = cards.filter((c) => c.type === "deuda" && isCountedCard(c));
  const otherDebt = debtAccCards.reduce((s, c) => s + balanceOfCard(c, movements), 0);

  // Deuda de tarjetas de crédito: gastos - pagos/ingresos
  const creditCards = cards.filter((c) => c.type === "credito" && isCountedCard(c));
  const debtByCard = creditCards.map((c) => {
    const g = movements.filter((m) => m.cardId === c.id && m.type === "gasto").reduce((s, m) => s + movTotal(m), 0);
    const p = movements.filter((m) => m.cardId === c.id && m.type === "ingreso").reduce((s, m) => s + movTotal(m), 0);
    return { card: c, debt: g - p, statement: creditStatement(c, movements, now) };
  });
  const totalDebt = debtByCard.reduce((s, d) => s + d.debt, 0);
  // Balance neto: lo disponible menos la deuda en crédito y las demás deudas
  const netBalance = availableBalance - totalDebt - otherDebt;
  // Por pagar este mes: saldo al corte (con mensualidades MSI); sin día de corte, la deuda completa
  const totalToPayAll = debtByCard.reduce((s, d) => s + (d.statement ? d.statement.toPay : Math.max(d.debt, 0)), 0);

  // Pago de tarjeta de crédito o de deuda: transferencia (no cuenta como gasto/ingreso).
  // El origen puede ser cualquier cuenta con dinero disponible (no crédito ni otra deuda).
  const sourceCards = cards.filter((c) => c.type !== "credito" && c.type !== "deuda");
  const openPay = (card, statement, debt) => {
    if (payFor === card.id) { setPayFor(null); return; }
    setPayFor(card.id);
    setPaySrc("");
    // Con día de corte configurado se propone el pago del mes (saldo al corte),
    // aunque sea $0; sin corte (o en deudas) se propone la deuda total.
    setPayAmt((statement ? statement.toPay : Math.max(debt, 0)).toFixed(2));
    setPayDate(todayISO());
    setPayError("");
  };
  const doPay = (card) => {
    const amt = parseFloat(payAmt);
    const src = cards.find((c) => c.id === paySrc);
    if (!src) return setPayError("Elige la cuenta desde la que pagas.");
    if (!amt || amt <= 0) return setPayError("Escribe un monto mayor a cero.");
    const over = cashOverdraft(src, movements, amt);
    if (over > 0) return setPayError(`Tu efectivo no alcanza: quedaría en −${money(over)}. El efectivo no puede quedar negativo; paga desde otra cuenta o registra una deuda.`);
    const isDebt = card.type === "deuda";
    const targetName = isDebt ? (accById[card.accountId]?.name || "deuda") : card.name;
    const label = isDebt ? `Pago de deuda ${targetName}` : `Pago de tarjeta ${targetName}`;
    const tid = uid();
    const base = { categoryId: null, date: payDate, months: 1, commission: 0, transfer: true, transferId: tid };
    update({
      movements: [
        { ...base, id: uid(), cardId: src.id, type: "gasto", amount: amt, title: label },
        { ...base, id: uid(), cardId: card.id, type: "ingreso", amount: amt, title: `Pago desde ${src.name}` },
        ...movements,
      ],
    });
    setPayFor(null); setPayError("");
  };

  // Elimina una deuda ya liquidada: quita su cuenta, su tarjeta y sus movimientos
  // internos (deuda inicial, intereses y las patas de ingreso de los pagos). Las
  // patas de gasto de los pagos (que salieron de otras cuentas) se conservan como
  // registro, así el balance no cambia.
  const deleteDebt = (card) => {
    if (!window.confirm("La deuda está liquidada. Se eliminará la cuenta de deuda y sus movimientos internos; los pagos que hiciste desde otras cuentas se conservan. ¿Continuar?")) return;
    update({
      accounts: accounts.filter((a) => a.id !== card.accountId),
      cards: cards.filter((c) => c.id !== card.id),
      movements: movements.filter((m) => m.cardId !== card.id),
    });
    if (payFor === card.id) setPayFor(null);
  };

  // Editor de pago reutilizable (tarjetas de crédito y deudas)
  const payEditor = (card, statement, debt) => (
    <div className="mt-3 rounded-lg p-3" style={{ background: C.surface2, border: `1px solid ${C.border}` }}>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Field label="Pagar desde">
          <Select value={paySrc} onChange={(e) => setPaySrc(e.target.value)}>
            <option value="">— Elegir cuenta —</option>
            {sourceCards.map((c) => (
              <option key={c.id} value={c.id}>{cardLabel(c, accounts)} · {money(balanceOfCard(c, movements))}</option>
            ))}
          </Select>
        </Field>
        <Field label="Monto (MXN)">
          <TextInput type="number" min="0" step="0.01" value={payAmt} onChange={(e) => setPayAmt(e.target.value)} />
        </Field>
        <Field label="Fecha">
          <TextInput type="date" value={payDate} onChange={(e) => setPayDate(e.target.value)} />
        </Field>
      </div>
      {statement ? (
        <p className="text-xs mt-2" style={{ color: C.muted }}>
          Pago del mes sugerido: <span className="font-mono" style={{ color: C.amber }}>{money(statement.toPay)}</span>
          {" · "}Deuda total: <span className="font-mono">{money(debt)}</span>
        </p>
      ) : (
        <p className="text-xs mt-2" style={{ color: C.muted }}>
          Saldo por pagar: <span className="font-mono" style={{ color: C.red }}>{money(Math.max(debt, 0))}</span>
        </p>
      )}
      {payError && <p className="text-xs mt-2" style={{ color: C.red }}>{payError}</p>}
      <p className="text-xs mt-2" style={{ color: C.faint }}>
        Se registra como transferencia: baja {card.type === "deuda" ? "la deuda" : "la deuda de la tarjeta"} y el saldo de la cuenta elegida, sin contarse como gasto ni ingreso del mes.
      </p>
      <div className="mt-3">
        <Btn onClick={() => doPay(card)}>Registrar pago</Btn>
      </div>
    </div>
  );

  // Cajas de ahorro
  const savingsCards = cards.filter((c) => c.type === "ahorro" && isCountedCard(c));
  const savingsByCard = savingsCards.map((c) => {
    const balance = balanceOfCard(c, movements);
    const rate = Number(c.rate) || 0;
    return { card: c, balance, rate, monthlyYield: (balance * rate) / 100 / 12 };
  });
  const totalSavings = savingsByCard.reduce((s, d) => s + d.balance, 0);
  // Solo rendimientos de ahorro (ingresos); los intereses de deudas son gastos
  const interesesYear = counted
    .filter((m) => m.interest && m.type === "ingreso" && m.date.startsWith(year))
    .reduce((s, m) => s + movTotal(m), 0);

  // Compras a meses activas
  const msi = counted
    .filter((m) => m.type === "gasto" && Number(m.months) > 1)
    .map((m) => {
      const total = movTotal(m);
      const mensualidad = total / Number(m.months);
      const start = new Date(m.date + "T00:00:00");
      const elapsed = (now.getFullYear() - start.getFullYear()) * 12 + (now.getMonth() - start.getMonth());
      const pagados = Math.min(Math.max(elapsed, 0), Number(m.months));
      return { ...m, total, mensualidad, pagados, restantes: Number(m.months) - pagados };
    })
    .filter((m) => m.restantes > 0)
    .sort((a, b) => a.restantes - b.restantes);

  const FreqBlock = ({ title, group, note }) => (
    <Card>
      <div className="flex items-baseline justify-between mb-2">
        <h3 className="text-sm font-medium" style={{ color: C.text }}>{title}</h3>
        <Amount value={sum(group)} sign="-" size="text-sm" />
      </div>
      <p className="text-xs mb-3" style={{ color: C.faint }}>{note}</p>
      {Object.keys(group).length === 0 ? (
        <p className="text-xs" style={{ color: C.faint }}>Sin gastos registrados.</p>
      ) : (
        <ul className="space-y-1.5">
          {Object.entries(group)
            .sort((a, b) => b[1] - a[1])
            .map(([catId, total]) => (
              <li key={catId} className="flex justify-between text-sm">
                <span style={{ color: C.muted }}>{catById[catId]?.name || "Sin categoría"}</span>
                <span className="font-mono" style={{ color: C.text, fontVariantNumeric: "tabular-nums" }}>{money(total)}</span>
              </li>
            ))}
        </ul>
      )}
    </Card>
  );

  return (
    <div className="space-y-6">
      {excludedCount > 0 && (
        <p className="text-xs" style={{ color: C.faint }}>
          {excludedCount === 1 ? "1 tarjeta está fuera de la contabilización" : `${excludedCount} tarjetas están fuera de la contabilización`}; sus movimientos no se incluyen en este resumen. Puedes activarlas en la pestaña Cuentas.
        </p>
      )}
      {/* Balance neto y pago del mes */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Card>
          <p className="text-xs uppercase tracking-wider mb-1" style={{ color: C.muted }}>Balance total</p>
          <span className="font-mono text-3xl" style={{ color: netBalance < 0 ? C.red : C.text }}>
            {money(netBalance)}
          </span>
          <p className="text-xs mt-2" style={{ color: C.faint }}>
            Disponible {money(availableBalance)} − crédito {money(totalDebt)}{otherDebt > 0 ? <> − deudas {money(otherDebt)}</> : null}
          </p>
        </Card>
        <Card>
          <p className="text-xs uppercase tracking-wider mb-1" style={{ color: C.muted }}>Por pagar este mes</p>
          <span className="font-mono text-3xl" style={{ color: totalToPayAll > 0 ? C.amber : C.green }}>
            {money(totalToPayAll)}
          </span>
          <p className="text-xs mt-2" style={{ color: C.faint }}>
            Pagos de tarjetas de crédito del mes; las compras a meses solo cuentan su mensualidad al corte
          </p>
        </Card>
      </div>

      {/* Cifras del mes */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <Card>
          <p className="text-xs uppercase tracking-wider mb-1" style={{ color: C.muted }}>Gastos de {MONTH_NAMES[now.getMonth()]}</p>
          <Amount value={totalGastosMes} sign="-" size="text-2xl" />
        </Card>
        <Card>
          <p className="text-xs uppercase tracking-wider mb-1" style={{ color: C.muted }}>Ingresos de {MONTH_NAMES[now.getMonth()]}</p>
          <Amount value={totalIngresosMes} sign="+" size="text-2xl" />
        </Card>
        <Card>
          <p className="text-xs uppercase tracking-wider mb-1" style={{ color: C.muted }}>Deuda en crédito</p>
          <span className="font-mono text-2xl" style={{ color: totalDebt > 0 ? C.amber : C.green, fontVariantNumeric: "tabular-nums" }}>
            {money(totalDebt)}
          </span>
        </Card>
        <Card>
          <p className="text-xs uppercase tracking-wider mb-1" style={{ color: C.muted }}>Ahorro total</p>
          <span className="font-mono text-2xl" style={{ color: C.accent, fontVariantNumeric: "tabular-nums" }}>
            {money(totalSavings)}
          </span>
        </Card>
      </div>

      {/* Gastos e ingresos por mes */}
      <div>
        <SectionTitle>Gastos e ingresos por mes</SectionTitle>
        <GraficaMensual counted={counted} />
      </div>

      {/* Desglose por categoría */}
      <div>
        <SectionTitle>Por categoría (este mes)</SectionTitle>
        <GraficaCategorias counted={counted} categories={categories} />
      </div>

      {/* Cajas de ahorro */}
      {savingsCards.length > 0 && (
        <div>
          <SectionTitle right={interesesYear > 0 ? (
            <span className="text-xs" style={{ color: C.green }}>+{money(interesesYear)} en rendimientos este año</span>
          ) : null}>
            Cajas de ahorro
          </SectionTitle>
          <div className="space-y-2">
            {savingsByCard.map(({ card, balance, rate, monthlyYield }) => (
              <Card key={card.id} className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm truncate">{cardLabel(card, accounts)}</span>
                    <Chip color={C.accent} bg={C.accentSoft}>{rate}% anual</Chip>
                  </div>
                  {rate > 0 && balance > 0 && (
                    <p className="text-xs mt-1" style={{ color: C.faint }}>
                      Genera ≈ {money(monthlyYield)} al mes · se abona automáticamente cada día
                    </p>
                  )}
                </div>
                <span className="font-mono text-sm shrink-0" style={{ color: C.accent, fontVariantNumeric: "tabular-nums" }}>
                  {money(balance)}
                </span>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Gastos por frecuencia */}
      <div>
        <SectionTitle>Gastos por tipo</SectionTitle>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <FreqBlock title="Semanales" group={semanales} note="Esta semana" />
          <FreqBlock title="Mensuales" group={mensuales} note={`Mes actual (${MONTH_NAMES[now.getMonth()]})`} />
          <FreqBlock title="Anuales" group={anuales} note={`Acumulado ${year}`} />
          <FreqBlock title="Esporádicos" group={esporadicos} note={`Mes actual (${MONTH_NAMES[now.getMonth()]})`} />
        </div>
      </div>

      {/* Compras a meses */}
      <div>
        <SectionTitle>Compras a meses activas</SectionTitle>
        {msi.length === 0 ? (
          <Empty>No tienes compras a meses en curso. Al registrar un gasto con tarjeta de crédito puedes marcarlo "a meses".</Empty>
        ) : (
          <div className="space-y-2">
            {msi.map((m) => (
              <Card key={m.id} className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm truncate">{m.title || m.description || "Compra a meses"}</p>
                  <p className="text-xs mt-0.5" style={{ color: C.faint }}>
                    {cardById[m.cardId] ? cardLabel(cardById[m.cardId], accounts) : "Tarjeta eliminada"}
                    {Number(m.commission) > 0 && <> · comisión {money(m.commission)}</>}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="font-mono text-sm" style={{ fontVariantNumeric: "tabular-nums" }}>
                    {money(m.mensualidad)}<span style={{ color: C.faint }}>/mes</span>
                  </p>
                  <p className="text-xs" style={{ color: C.amber }}>{m.restantes} de {m.months} meses restantes</p>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Deudas (préstamos y similares) */}
      {debtAccCards.length > 0 && (
        <div>
          <SectionTitle right={<span className="text-xs" style={{ color: C.red }}>Total: {money(otherDebt)}</span>}>
            Deudas
          </SectionTitle>
          <div className="space-y-2">
            {debtAccCards.map((c) => {
              const acc = accById[c.accountId];
              const bal = balanceOfCard(c, movements);
              const liquidada = bal <= 0.005;
              return (
                <Card key={c.id}>
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <span className="text-sm truncate">{acc ? acc.name : "Deuda"}</span>
                      <p className="text-xs mt-1" style={{ color: C.faint }}>
                        {Number(c.rate) > 0
                          ? `Interés ${c.rate}% ${c.ratePeriod === "mensual" ? "mensual" : "anual"} · crece a diario`
                          : "Sin interés"}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-xs" style={{ color: C.faint }}>{liquidada ? "Liquidada" : "Debes"}</p>
                      <span className="font-mono text-sm" style={{ color: liquidada ? C.green : C.red, fontVariantNumeric: "tabular-nums" }}>
                        {money(Math.max(bal, 0))}
                      </span>
                    </div>
                  </div>
                  <div className="flex gap-2 mt-2 justify-end flex-wrap">
                    {liquidada ? (
                      <Btn kind="danger" onClick={() => deleteDebt(c)}>Eliminar deuda</Btn>
                    ) : (
                      <Btn kind={payFor === c.id ? "ghost" : "primary"} onClick={() => openPay(c, null, bal)}>
                        {payFor === c.id ? "Cancelar" : "Pagar deuda"}
                      </Btn>
                    )}
                  </div>
                  {payFor === c.id && payEditor(c, null, bal)}
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {/* Tarjetas de crédito: deuda, estado de cuenta y pago */}
      {creditCards.length > 0 && (
        <div>
          <SectionTitle right={totalToPayAll > 0 ? (
            <span className="text-xs" style={{ color: C.amber }}>Pago del mes: {money(totalToPayAll)}</span>
          ) : null}>
            Tarjetas de crédito
          </SectionTitle>
          <div className="space-y-2">
            {debtByCard.map(({ card, debt, statement }) => {
              const usage = creditUsage(card, movements);
              return (
              <Card key={card.id}>
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div className="min-w-0">
                    <span className="text-sm">{cardLabel(card, accounts)}</span>
                    <div className="flex gap-2 mt-1 flex-wrap">
                      {statement ? (
                        <>
                          <Chip color={C.faint}>Corte: día {clampDay(card.cutDay)}</Chip>
                          {statement.dueDate && (
                            <Chip color={C.amber} bg={C.amberSoft}>Paga antes del {fmtDia(statement.dueDate)}</Chip>
                          )}
                        </>
                      ) : (
                        <Chip color={C.faint}>Sin día de corte · configúralo en Cuentas</Chip>
                      )}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-xs" style={{ color: C.faint }}>Deuda total</p>
                    <span className="font-mono text-sm" style={{ color: debt > 0 ? C.red : C.green, fontVariantNumeric: "tabular-nums" }}>
                      {money(debt)}
                    </span>
                  </div>
                </div>

                {/* Barra de uso del crédito respecto al límite configurado */}
                {usage && (
                  <div className="mt-3">
                    <div className="flex items-center justify-between mb-1 gap-2">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs" style={{ color: C.faint }}>Uso del crédito</span>
                        {usage.ratio >= 0.7 && (
                          <InfoHint title="Estás usando gran parte de tu crédito" icon="!" color={C.red}>
                            Vas en el {Math.round(usage.ratio * 100)}% de tu límite ({money(usage.debt)} de {money(usage.limit)}). Un uso alto te deja poco margen ante imprevistos y, si se reporta al buró, puede afectar tu historial (lo ideal es mantenerlo por debajo del 30%). Procura pagar más del mínimo para bajar el saldo, evita nuevas compras grandes en esta tarjeta y, cuando puedas, reparte tus gastos en otros medios.
                          </InfoHint>
                        )}
                      </div>
                      <span className="text-xs font-mono" style={{ color: usageColor(usage.ratio), fontVariantNumeric: "tabular-nums" }}>
                        {Math.round(usage.ratio * 100)}% · {money(usage.available)} disponible
                      </span>
                    </div>
                    <div style={{ background: C.bg, borderRadius: 6, height: 8, overflow: "hidden", border: `1px solid ${C.borderSoft}` }}>
                      <div style={{ width: `${Math.min(usage.ratio, 1) * 100}%`, background: usageColor(usage.ratio), height: "100%", borderRadius: 6, minWidth: usage.ratio > 0 ? 4 : 0 }} />
                    </div>
                  </div>
                )}

                {statement ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
                    <div className="rounded-lg px-3 py-2" style={{ background: C.bg, border: `1px solid ${C.borderSoft}` }}>
                      <p className="text-xs" style={{ color: C.faint }}>Gasto del periodo (desde el {fmtDia(statement.lastCut)})</p>
                      <span className="font-mono text-sm" style={{ fontVariantNumeric: "tabular-nums" }}>{money(statement.periodSpend)}</span>
                    </div>
                    {/* El botón Pagar vive junto al pago del mes: eso es lo que se paga, no la deuda total */}
                    <div className="rounded-lg px-3 py-2 flex items-center justify-between gap-3" style={{ background: C.bg, border: `1px solid ${C.borderSoft}` }}>
                      <div>
                        <p className="text-xs" style={{ color: C.faint }}>Pago de este mes (saldo al corte)</p>
                        <span className="font-mono text-sm" style={{ color: statement.toPay > 0 ? C.amber : C.green, fontVariantNumeric: "tabular-nums" }}>
                          {money(statement.toPay)}
                        </span>
                      </div>
                      <Btn kind={statement.toPay > 0 ? "primary" : "ghost"} onClick={() => openPay(card, statement, debt)}>
                        {payFor === card.id ? "Cancelar" : "Pagar"}
                      </Btn>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-lg px-3 py-2 mt-3 flex items-center justify-between gap-3" style={{ background: C.bg, border: `1px solid ${C.borderSoft}` }}>
                    <p className="text-xs" style={{ color: C.faint }}>
                      Sin día de corte no se puede calcular el pago del mes; el pago se propone por la deuda total.
                    </p>
                    <Btn kind="ghost" onClick={() => openPay(card, statement, debt)}>
                      {payFor === card.id ? "Cancelar" : "Pagar"}
                    </Btn>
                  </div>
                )}

                {payFor === card.id && payEditor(card, statement, debt)}
              </Card>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
