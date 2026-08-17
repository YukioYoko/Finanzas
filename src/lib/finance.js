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

// Uso de una tarjeta de crédito respecto a su límite. Devuelve null si no se
// configuró un crédito máximo. `ratio` puede pasar de 1 si se rebasó el límite.
export function creditUsage(card, movements) {
  const limit = Number(card.limit) || 0;
  if (limit <= 0) return null;
  const debt = Math.max(balanceOfCard(card, movements), 0);
  return { debt, limit, available: Math.max(limit - debt, 0), ratio: debt / limit };
}

// Cuánto quedaría en negativo una cuenta de efectivo si se le carga `amount`
// (0 si no aplica o si no se pasa). El efectivo no puede quedar por debajo de 0.
export function cashOverdraft(card, movements, amount) {
  if (!card || card.type !== "efectivo") return 0;
  const after = balanceOfCard(card, movements) - (Number(amount) || 0);
  return after < 0 ? Math.round(-after * 100) / 100 : 0;
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
// ---- Frecuencia de un cargo fijo: "mes" (día 1–31) o "semana" (día 0–6), cada N ----
export const clampWeekday = (v) => { const n = parseInt(v, 10); return n >= 0 && n <= 6 ? n : null; };
const recUnit = (r) => (r.unit === "semana" ? "semana" : "mes");   // por defecto mensual (compat)
const recEvery = (r) => { const n = parseInt(r.every, 10); return n >= 1 ? n : 1; };
const recValid = (r) => (recUnit(r) === "semana" ? clampWeekday(r.weekday) != null : !!clampDay(r.day));

// Primera ocurrencia en o después de createdAt
function recFirstOccurrence(r) {
  const start = new Date((r.createdAt || todayISO()) + "T00:00:00");
  if (recUnit(r) === "semana") {
    const wd = clampWeekday(r.weekday);
    const d = new Date(start);
    d.setDate(d.getDate() + ((wd - d.getDay() + 7) % 7)); // próximo día de la semana pedido
    return d;
  }
  const day = clampDay(r.day);
  const d = dateWithDay(start.getFullYear(), start.getMonth(), day);
  return d >= start ? d : dateWithDay(start.getFullYear(), start.getMonth() + recEvery(r), day);
}

// Siguiente ocurrencia estrictamente después de dateStr
function recNextOccurrence(r, dateStr) {
  const after = new Date(dateStr + "T00:00:00");
  const every = recEvery(r);
  if (recUnit(r) === "semana") {
    const d = new Date(after);
    d.setDate(d.getDate() + 7 * every);
    return d;
  }
  return dateWithDay(after.getFullYear(), after.getMonth() + every, clampDay(r.day));
}

// Texto legible de la frecuencia, p. ej. "Cada 3 meses · día 15" o "Cada semana · lunes"
export function recurringFreqLabel(r) {
  const every = recEvery(r);
  if (recUnit(r) === "semana") {
    const names = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
    const wd = clampWeekday(r.weekday);
    const base = every === 1 ? "Cada semana" : `Cada ${every} semanas`;
    return wd != null ? `${base} · ${names[wd]}` : base;
  }
  const day = clampDay(r.day);
  const base = every === 1 ? "Cada mes" : `Cada ${every} meses`;
  return day ? `${base} · día ${day}` : base;
}

// Monto equivalente al mes (para sumar frecuencias distintas de forma comparable)
export function monthlyEquivalent(r) {
  const amt = Number(r.amount) || 0;
  const every = recEvery(r);
  if (recUnit(r) === "semana") return (amt * 52) / 12 / every; // ~4.33 semanas por mes
  return amt / every;
}

// Próximo cobro pendiente de un cargo fijo (null si ya terminó o es inválido)
export function nextChargeOf(r) {
  if (!recValid(r)) return null;
  const cursor = r.lastApplied ? recNextOccurrence(r, r.lastApplied) : recFirstOccurrence(r);
  if (r.endDate && cursor > new Date(r.endDate + "T00:00:00")) return null;
  return cursor;
}

// Genera los movimientos vencidos de cada cargo fijo (corre al cargar y al editar la lista)
export function applyRecurring(data) {
  const today = new Date(todayISO() + "T00:00:00");
  let movements = data.movements;
  let changed = false;
  const recurring = (data.recurring || []).map((r) => {
    if (!recValid(r)) return r;
    const end = r.endDate ? new Date(r.endDate + "T00:00:00") : null;
    let cursor = r.lastApplied ? recNextOccurrence(r, r.lastApplied) : recFirstOccurrence(r);
    let last = r.lastApplied;
    const generated = [];
    while (cursor <= today && (!end || cursor <= end) && generated.length < 200) {
      const dateStr = isoOf(cursor);
      generated.push({
        id: uid(),
        cardId: r.cardId,
        type: r.type === "ingreso" ? "ingreso" : "gasto",
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
      cursor = recNextOccurrence(r, dateStr);
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

// Cuando no se pudo identificar la tarjeta por los últimos 4 dígitos, intenta
// adivinarla emparejando el nombre de la app del banco con el banco/nombre de una
// cuenta. Solo devuelve una tarjeta si es inequívoco (la cuenta tiene una sola
// tarjeta usable de débito o crédito).
function guessCardFromApp(appLabel, accounts, cards) {
  if (!appLabel) return "";
  const label = appLabel.toLowerCase();
  const acc = accounts.find((a) => {
    const bank = (a.bank || "").toLowerCase();
    const name = (a.name || "").toLowerCase();
    return (bank && (label.includes(bank) || bank.includes(label)))
        || (name.length >= 3 && (label.includes(name) || name.includes(label)));
  });
  if (!acc) return "";
  const accCards = cards.filter((c) => c.accountId === acc.id && (c.type === "debito" || c.type === "credito"));
  return accCards.length === 1 ? accCards[0].id : "";
}

// Procesa las notificaciones capturadas del sistema:
// - registra cada app detectada (deshabilitada por defecto: solo se lee de las que el usuario habilite)
// - solo convierte en movimiento por confirmar las de apps habilitadas
// - dedup: misma app+monto+texto, o misma TARJETA+monto aunque venga de otra app, dentro de una ventana
// - si no se identifica la tarjeta, la adivina por la app del banco
// - si detecta un gasto y un ingreso del mismo monto en cuentas distintas, lo marca como transferencia
export function ingestCaptures(items, data, now = Date.now()) {
  const DUP_WINDOW = 10 * 60 * 1000;          // 10 min
  const SEEN_TTL = 7 * 24 * 60 * 60 * 1000;   // recuerda firmas 7 días

  const apps = { ...(data.inboxApps || {}) };
  const seen = (data.inboxSeen || []).filter((s) => now - s.time < SEEN_TTL);
  const existingIds = new Set((data.inbox || []).map((i) => i.id));
  const cardById = Object.fromEntries(data.cards.map((c) => [c.id, c]));
  const candidates = []; // { ...parsed, _t }
  let changed = false;

  for (const it of items || []) {
    const pkg = it.app || "";
    if (!pkg) continue;

    if (!apps[pkg]) {
      apps[pkg] = { label: it.appLabel || pkg, enabled: false };
      changed = true;
    } else if (it.appLabel && apps[pkg].label === pkg && it.appLabel !== pkg) {
      apps[pkg] = { ...apps[pkg], label: it.appLabel };
      changed = true;
    }
    if (!apps[pkg].enabled) continue;

    const parsed = parseCapturedNotification(it, data.cards);
    if (!parsed || existingIds.has(parsed.id)) continue;
    if (!parsed.cardId) parsed.cardId = guessCardFromApp(it.appLabel || apps[pkg].label, data.accounts, data.cards);

    const t = Number(it.time) || now;
    const title = (it.title || "").trim().toLowerCase();
    const sigs = [`${pkg}|${parsed.amount}|${title}`];
    if (parsed.cardId) sigs.push(`card|${parsed.cardId}|${parsed.amount}`); // dedup entre apps por tarjeta+monto
    const dup = sigs.some((sg) => seen.some((s) => s.sig === sg && Math.abs(t - s.time) < DUP_WINDOW))
      || candidates.some((c) => c.cardId && c.cardId === parsed.cardId && c.amount === parsed.amount && c.type === parsed.type && Math.abs(c._t - t) < DUP_WINDOW);
    if (dup) continue;

    sigs.forEach((sg) => seen.push({ sig: sg, time: t }));
    existingIds.add(parsed.id);
    candidates.push({ ...parsed, _t: t });
    changed = true;
  }

  // Empareja gasto + ingreso del mismo monto en cuentas distintas → transferencia
  const transfers = [];
  const used = new Set();
  for (let i = 0; i < candidates.length; i++) {
    if (used.has(i) || !candidates[i].cardId) continue;
    const a = candidates[i];
    const accA = cardById[a.cardId]?.accountId;
    for (let j = i + 1; j < candidates.length; j++) {
      if (used.has(j)) continue;
      const b = candidates[j];
      if (!b.cardId || b.type === a.type || a.amount !== b.amount) continue;
      const accB = cardById[b.cardId]?.accountId;
      if (!accA || !accB || accA === accB) continue;               // deben ser cuentas distintas
      if (Math.abs(a._t - b._t) > DUP_WINDOW) continue;
      const g = a.type === "gasto" ? a : b;
      const inn = a.type === "gasto" ? b : a;
      transfers.push({ id: g.id, kind: "transfer", amount: a.amount, date: g.date, fromCardId: g.cardId, toCardId: inn.cardId, text: g.text });
      used.add(i); used.add(j);
      break;
    }
  }
  const singles = candidates.filter((_, idx) => !used.has(idx)).map(({ _t, ...rest }) => rest); // eslint-disable-line no-unused-vars
  const inboxAdd = [...transfers, ...singles];

  return { inboxAdd, inboxApps: apps, inboxSeen: seen, changed };
}
