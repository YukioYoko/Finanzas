// Lógica de dinero de la app. Estas funciones puras son la única fuente de
// verdad para saldos, estados de cuenta y generación automática de movimientos;
// las pantallas nunca calculan saldos por su cuenta.
import { uid, todayISO, isoOf } from "../utils/format";

export function cardLabel(card, accounts) {
  const acc = accounts.find((a) => a.id === card.accountId);
  return `${card.name}${card.last4 ? " ····" + card.last4 : ""} · ${acc ? acc.name : "?"}`;
}

export function movTotal(m) {
  return (Number(m.amount) || 0) + (Number(m.commission) || 0);
}

// Tipos de tarjeta que representan dinero que se debe (no dinero disponible)
export const isDebtType = (t) => t === "credito" || t === "deuda";

const CARD_TYPE_LABELS = { debito: "Débito", credito: "Crédito", ahorro: "Caja de ahorro", efectivo: "Efectivo", deuda: "Deuda" };
export const cardTypeLabel = (t) => CARD_TYPE_LABELS[t] || "Débito";

// Saldo por tarjeta: crédito/deuda = lo que se debe (gastos - pagos), débito/ahorro = saldo (ingresos - gastos)
export function balanceOfCard(card, movements) {
  const g = movements.filter((m) => m.cardId === card.id && m.type === "gasto").reduce((s, m) => s + movTotal(m), 0);
  const p = movements.filter((m) => m.cardId === card.id && m.type === "ingreso").reduce((s, m) => s + movTotal(m), 0);
  return isDebtType(card.type) ? g - p : p - g;
}

// ---------- Corte y pago de tarjetas de crédito ----------
export const clampDay = (v) => { const n = parseInt(v, 10); return n >= 1 && n <= 31 ? n : null; };

// Fecha con el día pedido dentro del mes (en meses cortos se recorre al último día)
export function dateWithDay(year, month, day) {
  const last = new Date(year, month + 1, 0).getDate();
  return new Date(year, month, Math.min(day, last));
}

// Último corte en o antes de `today`
export function lastCutDate(cutDay, today) {
  const d = dateWithDay(today.getFullYear(), today.getMonth(), cutDay);
  return d <= today ? d : dateWithDay(today.getFullYear(), today.getMonth() - 1, cutDay);
}

// Cuántos cortes han pasado desde la compra (inclusive) hasta lastCut
function cutsSince(dateStr, cutDay, lastCut) {
  const purchase = new Date(dateStr + "T00:00:00");
  let y = purchase.getFullYear(), mo = purchase.getMonth(), count = 0;
  for (let i = 0; i < 1200; i++) {
    const cut = dateWithDay(y, mo, cutDay);
    if (cut > lastCut) break;
    if (cut >= purchase) count++;
    mo++; if (mo > 11) { mo = 0; y++; }
  }
  return count;
}

// Estado de cuenta de una tarjeta de crédito:
// - toPay: lo exigible este mes = cargos devengados al corte − todos los pagos.
//   En MSI solo devengan las mensualidades cuyos cortes ya pasaron.
// - periodSpend: gasto del periodo actual (compras después del corte; en MSI, la mensualidad próxima)
// - dueDate: fecha límite de pago siguiente al corte
export function creditStatement(card, movements, today = new Date()) {
  const cutDay = clampDay(card.cutDay);
  if (!cutDay) return null;
  const lastCut = lastCutDate(cutDay, today);
  let accruedAtCut = 0, periodSpend = 0, paid = 0;
  for (const m of movements) {
    if (m.cardId !== card.id) continue;
    const total = movTotal(m);
    if (m.type === "ingreso") { paid += total; continue; }
    const monthsN = Number(m.months) || 1;
    if (monthsN > 1) {
      const due = Math.min(cutsSince(m.date, cutDay, lastCut), monthsN);
      accruedAtCut += (total / monthsN) * due;
      if (due < monthsN) periodSpend += total / monthsN;
    } else if (new Date(m.date + "T00:00:00") <= lastCut) {
      accruedAtCut += total;
    } else {
      periodSpend += total;
    }
  }
  const payDay = clampDay(card.payDay);
  let dueDate = null;
  if (payDay) {
    dueDate = dateWithDay(lastCut.getFullYear(), lastCut.getMonth(), payDay);
    if (dueDate <= lastCut) dueDate = dateWithDay(lastCut.getFullYear(), lastCut.getMonth() + 1, payDay);
  }
  return {
    lastCut,
    toPay: Math.max(Math.round((accruedAtCut - paid) * 100) / 100, 0),
    periodSpend: Math.round(periodSpend * 100) / 100,
    dueDate,
  };
}

// ---------- Cargos fijos mensuales (suscripciones, servicios…) ----------
// Primera ocurrencia del día de cobro en o después de la fecha dada
function firstOccurrenceOnOrAfter(dateStr, day) {
  const from = new Date(dateStr + "T00:00:00");
  const d = dateWithDay(from.getFullYear(), from.getMonth(), day);
  return d >= from ? d : dateWithDay(from.getFullYear(), from.getMonth() + 1, day);
}

// Siguiente ocurrencia estrictamente después de la fecha dada
function nextOccurrence(dateStr, day) {
  const after = new Date(dateStr + "T00:00:00");
  const d = dateWithDay(after.getFullYear(), after.getMonth(), day);
  return d > after ? d : dateWithDay(after.getFullYear(), after.getMonth() + 1, day);
}

// Próximo cobro pendiente de un cargo fijo (null si ya terminó)
export function nextChargeOf(r) {
  const day = clampDay(r.day);
  if (!day) return null;
  const cursor = r.lastApplied ? nextOccurrence(r.lastApplied, day) : firstOccurrenceOnOrAfter(r.createdAt, day);
  if (r.endDate && cursor > new Date(r.endDate + "T00:00:00")) return null;
  return cursor;
}

// Genera los movimientos vencidos de cada cargo fijo (corre al cargar y al editar la lista)
export function applyRecurring(data) {
  const today = new Date(todayISO() + "T00:00:00");
  let movements = data.movements;
  let changed = false;
  const recurring = (data.recurring || []).map((r) => {
    const day = clampDay(r.day);
    if (!day) return r;
    const end = r.endDate ? new Date(r.endDate + "T00:00:00") : null;
    let cursor = r.lastApplied ? nextOccurrence(r.lastApplied, day) : firstOccurrenceOnOrAfter(r.createdAt, day);
    let last = r.lastApplied;
    const generated = [];
    while (cursor <= today && (!end || cursor <= end) && generated.length < 120) {
      const dateStr = isoOf(cursor);
      generated.push({
        id: uid(),
        cardId: r.cardId,
        type: "gasto",
        amount: Number(r.amount) || 0,
        title: r.title || r.description || "Cargo fijo",
        description: r.title ? (r.description || "") : "",
        categoryId: r.categoryId || null,
        date: dateStr,
        months: 1,
        commission: 0,
        recurring: true,
        recurringId: r.id,
      });
      last = dateStr;
      cursor = nextOccurrence(dateStr, day);
    }
    if (!generated.length) return r;
    movements = [...generated, ...movements];
    changed = true;
    return { ...r, lastApplied: last };
  });
  return changed ? { ...data, recurring, movements } : data;
}

// Genera automáticamente el interés compuesto diario:
// - cajas de ahorro: rendimiento (ingreso) sobre el saldo, tasa anual
// - deudas: intereses (gasto) sobre lo que se debe, tasa anual o mensual (se anualiza ×12)
export function applyInterest(data) {
  const today = todayISO();
  let movements = [...data.movements];
  let changed = false;
  const cards = data.cards.map((card) => {
    if (card.type !== "ahorro" && card.type !== "deuda") return card;
    if (!card.lastAccrual) {
      changed = true;
      return { ...card, lastAccrual: today };
    }
    const days = Math.floor((new Date(today + "T00:00:00") - new Date(card.lastAccrual + "T00:00:00")) / 86400000);
    if (days < 1) return card;
    const rate = Number(card.rate) || 0;
    if (rate > 0) {
      const balance = balanceOfCard(card, movements);
      if (balance > 0) {
        const annualRate = card.ratePeriod === "mensual" ? rate * 12 : rate;
        const interest = Math.round(balance * (Math.pow(1 + annualRate / 100 / 365, days) - 1) * 100) / 100;
        if (interest >= 0.01) {
          const isDebt = card.type === "deuda";
          const periodLabel = card.ratePeriod === "mensual" ? "mensual" : "anual";
          movements = [{
            id: uid(),
            cardId: card.id,
            type: isDebt ? "gasto" : "ingreso",
            amount: interest,
            title: isDebt
              ? `Intereses ${rate}% ${periodLabel} (${days} ${days === 1 ? "día" : "días"})`
              : `Rendimientos ${rate}% anual (${days} ${days === 1 ? "día" : "días"})`,
            categoryId: null,
            date: today,
            months: 1,
            commission: 0,
            interest: true,
          }, ...movements];
        }
      }
    }
    changed = true;
    return { ...card, lastAccrual: today };
  });
  return changed ? { ...data, cards, movements } : data;
}

// ---------- Bandeja: notificaciones del banco → movimientos por confirmar ----------
// Interpreta una notificación capturada: saca el monto, adivina la tarjeta por los
// últimos 4 dígitos y el tipo por palabras clave. Si no encuentra la tarjeta, la
// deja en blanco para que el usuario la elija, pero el monto siempre queda puesto.
export function parseCapturedNotification(item, cards) {
  const text = `${item.title || ""} ${item.text || ""}`.trim();
  const moneyMatch = text.match(/\$\s?(\d[\d,]*(?:\.\d{1,2})?)/);
  if (!moneyMatch) return null;
  const amount = parseFloat(moneyMatch[1].replace(/,/g, ""));
  if (!amount || amount <= 0) return null;
  const last4Match = text.match(/(?:terminaci[oó]n|term\.?|tarjeta|\*{2,}|·{2,}|x{2,})\s*[·*x]*\s*(\d{4})(?!\d)/i);
  // Busca por los dígitos de la tarjeta física o de su tarjeta digital asociada
  const card = last4Match
    ? cards.find((c) => c.last4 === last4Match[1] || c.digitalLast4 === last4Match[1])
    : null;
  const isIncome = /dep[oó]sito|abono|recibiste|te envi[oó]|n[oó]mina|rendimiento/i.test(text);
  const d = new Date(Number(item.time) || Date.now());
  return {
    id: item.id,
    amount,
    cardId: card ? card.id : "",
    type: isIncome ? "ingreso" : "gasto",
    date: isoOf(d),
    text: text.slice(0, 200),
  };
}
