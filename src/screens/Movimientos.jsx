import { useState, useMemo } from "react";
import { useTheme } from "../theme";
import { FREQS, MESES_OPCIONES } from "../constants";
import { money, uid, todayISO, isoOf } from "../utils/format";
import { cardLabel, movTotal, cardTypeLabel, balanceOfCard, cashOverdraft } from "../lib/finance";
import { Field, TextInput, Select, Btn, Chip, Amount, Card, SectionTitle, Empty, Pill } from "../components/ui";
import { IconSplit } from "../components/icons";

const PERIODOS = [
  { id: "recientes", label: "Últimos 10" },
  { id: "dia", label: "Hoy" },
  { id: "semana", label: "Esta semana" },
  { id: "mes", label: "Este mes" },
  { id: "anio", label: "Este año" },
];

// Lunes de la semana que contiene `d` (semana inicia en lunes)
function startOfWeek(d) {
  const monday = new Date(d);
  const day = monday.getDay(); // 0 domingo .. 6 sábado
  monday.setDate(monday.getDate() + (day === 0 ? -6 : 1 - day));
  monday.setHours(0, 0, 0, 0);
  return monday;
}

// Filtra una lista ya ordenada (más nuevo primero) según el periodo elegido
function filterByPeriodo(sorted, periodo) {
  if (periodo === "recientes") return sorted.slice(0, 10);
  const now = new Date();
  let fromISO;
  if (periodo === "dia") fromISO = todayISO();
  else if (periodo === "semana") fromISO = isoOf(startOfWeek(now));
  else if (periodo === "mes") fromISO = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
  else fromISO = `${now.getFullYear()}-01-01`; // anio
  return sorted.filter((m) => m.date >= fromISO);
}

// Una cuenta de efectivo tiene una única cartera (auto-creada). Devuelve su id para
// autoseleccionarla y así poder ocultar el selector de tarjeta, o null si no es efectivo.
function cashCardId(accountId, accounts, cards) {
  const acc = accounts.find((a) => a.id === accountId);
  if (acc?.type !== "efectivo") return null;
  return cards.find((c) => c.accountId === accountId && c.type === "efectivo")?.id || null;
}

// Mensaje de alerta cuando un gasto dejaría el efectivo en negativo (no se permite)
const cashOverdraftMsg = (over) =>
  `Este movimiento deja tu efectivo en negativo (−${money(over)}). El efectivo no puede quedar por debajo de cero. Si de verdad debes ese dinero, crea una cuenta de tipo "Deuda" en la pestaña Cuentas y regístralo ahí.`;

// Un cargo detectado en una notificación, pendiente de que el usuario lo complete.
// Se puede confirmar como gasto, ingreso, o convertir en una transferencia entre cuentas.
function InboxItem({ item, data, onConfirm, onDiscard }) {
  const C = useTheme();
  const { accounts, cards, categories } = data;
  const initialCard = cards.find((c) => c.id === item.cardId);
  const [accountId, setAccountId] = useState(initialCard ? initialCard.accountId : "");
  const [cardId, setCardId] = useState(item.cardId || "");
  const [type, setType] = useState(item.type || "gasto");
  const [toAccountId, setToAccountId] = useState("");
  const [toCardId, setToCardId] = useState("");
  const [amount, setAmount] = useState(String(item.amount));
  const [date, setDate] = useState(item.date);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [error, setError] = useState("");
  const isTransfer = type === "transfer";
  const accCards = cards.filter((c) => c.accountId === accountId);
  const toAccCards = cards.filter((c) => c.accountId === toAccountId);
  const isCashAccount = cashCardId(accountId, accounts, cards) !== null;
  const isToCashAccount = cashCardId(toAccountId, accounts, cards) !== null;

  const confirm = () => {
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) return setError("Escribe un monto mayor a cero.");
    if (isTransfer) {
      if (!cardId) return setError("Elige la cuenta y tarjeta de origen.");
      if (!toCardId) return setError("Elige la cuenta y tarjeta de destino.");
      if (cardId === toCardId) return setError("El origen y el destino deben ser distintos.");
      const over = cashOverdraft(cards.find((c) => c.id === cardId), data.movements, amt);
      if (over > 0) return setError(cashOverdraftMsg(over));
      return onConfirm(item, { transfer: true, fromCard: cardId, toCard: toCardId, amount: amt, date, title: title.trim() });
    }
    if (!title.trim()) return setError("Escribe un título (ej. el comercio).");
    if (!cardId) return setError("Elige la cuenta y la tarjeta.");
    if (!categoryId) return setError("Elige una categoría.");
    if (type === "gasto") {
      const over = cashOverdraft(cards.find((c) => c.id === cardId), data.movements, amt);
      if (over > 0) return setError(cashOverdraftMsg(over));
    }
    onConfirm(item, { cardId, type, amount: amt, date, title: title.trim(), description: description.trim(), categoryId });
  };

  return (
    <Card style={{ borderColor: isTransfer ? C.blue : C.amber }}>
      <div className="flex items-center justify-between gap-3 mb-2 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          <Chip color={C.amber} bg={C.amberSoft}>Detectado en notificación</Chip>
          <Amount value={parseFloat(amount) || 0} sign={isTransfer ? "" : type === "gasto" ? "-" : "+"} size="text-sm" />
        </div>
        <Btn kind="danger" onClick={() => onDiscard(item)} size="sm">Descartar</Btn>
      </div>
      <p className="text-xs mb-3" style={{ color: C.faint }}>{item.text}</p>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Field label="Tipo">
          <Select value={type} onChange={(e) => setType(e.target.value)}>
            <option value="gasto">Gasto</option>
            <option value="ingreso">Ingreso</option>
            <option value="transfer">Transferencia entre cuentas</option>
          </Select>
        </Field>
        <Field label={isTransfer ? "Cuenta origen" : "Cuenta"}>
          <Select value={accountId} onChange={(e) => { const id = e.target.value; setAccountId(id); setCardId(cashCardId(id, accounts, cards) || ""); }}>
            <option value="">— Elegir cuenta —</option>
            {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}{a.bank ? ` (${a.bank})` : ""}</option>)}
          </Select>
        </Field>
        {!isCashAccount && (
          <Field label={isTransfer ? "Tarjeta origen" : "Tarjeta"}>
            <Select value={cardId} onChange={(e) => setCardId(e.target.value)} disabled={!accountId}>
              <option value="">{accountId ? "— Elegir tarjeta —" : "Primero elige una cuenta"}</option>
              {accCards.map((c) => (
                <option key={c.id} value={c.id}>{c.name}{c.last4 ? ` ····${c.last4}` : ""}</option>
              ))}
            </Select>
          </Field>
        )}
        {isTransfer && (
          <>
            <Field label="Cuenta destino">
              <Select value={toAccountId} onChange={(e) => { const id = e.target.value; setToAccountId(id); setToCardId(cashCardId(id, accounts, cards) || ""); }}>
                <option value="">— Elegir cuenta —</option>
                {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}{a.bank ? ` (${a.bank})` : ""}</option>)}
              </Select>
            </Field>
            {!isToCashAccount && (
              <Field label="Tarjeta destino">
                <Select value={toCardId} onChange={(e) => setToCardId(e.target.value)} disabled={!toAccountId}>
                  <option value="">{toAccountId ? "— Elegir tarjeta —" : "Primero elige una cuenta"}</option>
                  {toAccCards.filter((c) => c.id !== cardId).map((c) => (
                    <option key={c.id} value={c.id}>{c.name}{c.last4 ? ` ····${c.last4}` : ""} · {cardTypeLabel(c.type)}</option>
                  ))}
                </Select>
              </Field>
            )}
          </>
        )}
        <Field label="Monto (MXN)">
          <TextInput type="number" min="0" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} />
        </Field>
        <Field label="Fecha">
          <TextInput type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>
        {!isTransfer && (
          <Field label="Categoría">
            <Select value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
              <option value="">— Elegir categoría —</option>
              {FREQS.map((f) => (
                <optgroup key={f.id} label={f.label}>
                  {categories.filter((c) => c.freq === f.id).map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </optgroup>
              ))}
            </Select>
          </Field>
        )}
        <Field label={isTransfer ? "Título (opcional)" : "Título"}>
          <TextInput value={title} onChange={(e) => setTitle(e.target.value)} placeholder={isTransfer ? "Se genera solo si lo dejas vacío" : "Ej. Súper, gasolina…"} />
        </Field>
        {!isTransfer && (
          <div className="sm:col-span-2">
            <Field label="Descripción (opcional)">
              <TextInput value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Detalles extra" />
            </Field>
          </div>
        )}
      </div>
      {isTransfer && (
        <p className="text-xs mt-2" style={{ color: C.faint }}>
          La transferencia mueve el dinero entre tus cuentas sin contarse como gasto ni ingreso. Si el destino es una tarjeta de crédito, funciona como pago de la tarjeta.
        </p>
      )}
      {error && <p className="text-xs mt-2" style={{ color: C.red }}>{error}</p>}
      <div className="mt-3">
        <Btn onClick={confirm}>{isTransfer ? "Confirmar transferencia" : "Confirmar movimiento"}</Btn>
      </div>
    </Card>
  );
}

// Transferencia detectada entre dos notificaciones (gasto + ingreso del mismo monto)
function InboxTransferItem({ item, data, onConfirm, onDiscard }) {
  const C = useTheme();
  const { accounts, cards } = data;
  const fromCard0 = cards.find((c) => c.id === item.fromCardId);
  const toCard0 = cards.find((c) => c.id === item.toCardId);
  const [fromAcc, setFromAcc] = useState(fromCard0 ? fromCard0.accountId : "");
  const [fromCard, setFromCard] = useState(item.fromCardId || "");
  const [toAcc, setToAcc] = useState(toCard0 ? toCard0.accountId : "");
  const [toCard, setToCard] = useState(item.toCardId || "");
  const [amount, setAmount] = useState(String(item.amount));
  const [date, setDate] = useState(item.date);
  const [title, setTitle] = useState("");
  const [error, setError] = useState("");
  const fromCards = cards.filter((c) => c.accountId === fromAcc);
  const toCards = cards.filter((c) => c.accountId === toAcc);
  const isFromCash = cashCardId(fromAcc, accounts, cards) !== null;
  const isToCash = cashCardId(toAcc, accounts, cards) !== null;

  const confirm = () => {
    const amt = parseFloat(amount);
    if (!fromCard) return setError("Elige la cuenta y tarjeta de origen.");
    if (!toCard) return setError("Elige la cuenta y tarjeta de destino.");
    if (fromCard === toCard) return setError("El origen y el destino deben ser distintos.");
    if (!amt || amt <= 0) return setError("Escribe un monto mayor a cero.");
    onConfirm(item, { transfer: true, fromCard, toCard, amount: amt, date, title: title.trim() });
  };

  return (
    <Card style={{ borderColor: C.blue }}>
      <div className="flex items-center justify-between gap-3 mb-2 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          <Chip color={C.blue}>Transferencia detectada</Chip>
          <Amount value={parseFloat(amount) || 0} sign="" size="text-sm" />
        </div>
        <Btn kind="danger" onClick={() => onDiscard(item)} size="sm">Descartar</Btn>
      </div>
      {item.text && <p className="text-xs mb-3" style={{ color: C.faint }}>{item.text}</p>}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field label="Cuenta origen">
          <Select value={fromAcc} onChange={(e) => { const id = e.target.value; setFromAcc(id); setFromCard(cashCardId(id, accounts, cards) || ""); }}>
            <option value="">— Elegir cuenta —</option>
            {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}{a.bank ? ` (${a.bank})` : ""}</option>)}
          </Select>
        </Field>
        {!isFromCash && (
          <Field label="Tarjeta origen">
            <Select value={fromCard} onChange={(e) => setFromCard(e.target.value)} disabled={!fromAcc}>
              <option value="">{fromAcc ? "— Elegir tarjeta —" : "Primero elige una cuenta"}</option>
              {fromCards.map((c) => <option key={c.id} value={c.id}>{c.name}{c.last4 ? ` ····${c.last4}` : ""} · {cardTypeLabel(c.type)}</option>)}
            </Select>
          </Field>
        )}
        <Field label="Cuenta destino">
          <Select value={toAcc} onChange={(e) => { const id = e.target.value; setToAcc(id); setToCard(cashCardId(id, accounts, cards) || ""); }}>
            <option value="">— Elegir cuenta —</option>
            {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}{a.bank ? ` (${a.bank})` : ""}</option>)}
          </Select>
        </Field>
        {!isToCash && (
          <Field label="Tarjeta destino">
            <Select value={toCard} onChange={(e) => setToCard(e.target.value)} disabled={!toAcc}>
              <option value="">{toAcc ? "— Elegir tarjeta —" : "Primero elige una cuenta"}</option>
              {toCards.filter((c) => c.id !== fromCard).map((c) => <option key={c.id} value={c.id}>{c.name}{c.last4 ? ` ····${c.last4}` : ""} · {cardTypeLabel(c.type)}</option>)}
            </Select>
          </Field>
        )}
        <Field label="Monto (MXN)">
          <TextInput type="number" min="0" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} />
        </Field>
        <Field label="Fecha">
          <TextInput type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>
        <div className="sm:col-span-2">
          <Field label="Título (opcional)">
            <TextInput value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Se genera solo si lo dejas vacío" />
          </Field>
        </div>
      </div>
      {error && <p className="text-xs mt-2" style={{ color: C.red }}>{error}</p>}
      <div className="mt-3">
        <Btn onClick={confirm}>Confirmar transferencia</Btn>
      </div>
    </Card>
  );
}

// Editor inline de un movimiento existente
function MovEditor({ mov, data, onSave, onCancel }) {
  const C = useTheme();
  const { accounts, cards, categories } = data;
  const initCard = cards.find((c) => c.id === mov.cardId);
  const [accountId, setAccountId] = useState(initCard ? initCard.accountId : "");
  const [cardId, setCardId] = useState(mov.cardId || "");
  const [type, setType] = useState(mov.type);
  const [title, setTitle] = useState(mov.title || mov.description || "");
  const [description, setDescription] = useState(mov.title ? (mov.description || "") : "");
  const [amount, setAmount] = useState(String(mov.amount));
  const [date, setDate] = useState(mov.date);
  const [categoryId, setCategoryId] = useState(mov.categoryId || "");
  const [aMeses, setAMeses] = useState(Number(mov.months) > 1);
  const [months, setMonths] = useState(Number(mov.months) > 1 ? Number(mov.months) : 3);
  const [commission, setCommission] = useState(Number(mov.commission) > 0 ? String(mov.commission) : "");
  const [error, setError] = useState("");
  const accCards = cards.filter((c) => c.accountId === accountId);
  const selectedCard = cards.find((c) => c.id === cardId);
  const isCashAccount = cashCardId(accountId, accounts, cards) !== null;
  const isAdjust = !!mov.adjust; // los ajustes de saldo no llevan categoría ni MSI
  const isCreditExpense = !isAdjust && type === "gasto" && selectedCard?.type === "credito";

  const save = () => {
    const amt = parseFloat(amount);
    if (!title.trim()) return setError("Escribe un título.");
    if (!cardId) return setError("Elige la cuenta y la tarjeta.");
    if (!amt || amt <= 0) return setError("Escribe un monto mayor a cero.");
    if (!isAdjust && !categoryId) return setError("Elige una categoría.");
    onSave({
      ...mov,
      cardId,
      type,
      title: title.trim(),
      description: description.trim(),
      amount: amt,
      date,
      categoryId: isAdjust ? null : categoryId,
      months: isCreditExpense && aMeses ? Number(months) : 1,
      commission: isCreditExpense && aMeses ? (parseFloat(commission) || 0) : 0,
    });
  };

  return (
    <Card style={{ borderColor: C.accent }}>
      <div className="flex items-center justify-between mb-3">
        <Chip color={C.accent} bg={C.accentSoft}>{isAdjust ? "Editando ajuste de saldo" : "Editando movimiento"}</Chip>
        <Btn kind="ghost" onClick={onCancel} size="sm">Cancelar</Btn>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field label="Título">
          <TextInput value={title} onChange={(e) => setTitle(e.target.value)} />
        </Field>
        <Field label="Descripción (opcional)">
          <TextInput value={description} onChange={(e) => setDescription(e.target.value)} />
        </Field>
        <Field label="Tipo">
          <Select value={type} onChange={(e) => setType(e.target.value)}>
            <option value="gasto">Gasto</option>
            <option value="ingreso">Ingreso</option>
          </Select>
        </Field>
        <Field label="Fecha">
          <TextInput type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>
        <Field label="Cuenta">
          <Select value={accountId} onChange={(e) => { const id = e.target.value; setAccountId(id); setCardId(cashCardId(id, accounts, cards) || ""); }}>
            <option value="">— Elegir cuenta —</option>
            {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}{a.bank ? ` (${a.bank})` : ""}</option>)}
          </Select>
        </Field>
        {!isCashAccount && (
          <Field label="Tarjeta">
            <Select value={cardId} onChange={(e) => setCardId(e.target.value)} disabled={!accountId}>
              <option value="">{accountId ? "— Elegir tarjeta —" : "Primero elige una cuenta"}</option>
              {accCards.map((c) => (
                <option key={c.id} value={c.id}>{c.name}{c.last4 ? ` ····${c.last4}` : ""}</option>
              ))}
            </Select>
          </Field>
        )}
        <Field label="Monto (MXN)">
          <TextInput type="number" min="0" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} />
        </Field>
        {!isAdjust && (
          <Field label="Categoría">
            <Select value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
              <option value="">— Elegir categoría —</option>
              {FREQS.map((f) => (
                <optgroup key={f.id} label={f.label}>
                  {categories.filter((c) => c.freq === f.id).map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </optgroup>
              ))}
            </Select>
          </Field>
        )}
      </div>
      {isCreditExpense && (
        <div className="mt-3 rounded-lg p-3" style={{ background: C.amberSoft, border: `1px solid ${C.amber}` }}>
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium" style={{ color: C.amber }}>Compra a meses</p>
            <button
              onClick={() => setAMeses((v) => !v)}
              className="rounded-full px-3 py-1 text-xs"
              style={aMeses
                ? { background: C.amber, color: "#221A08", fontWeight: 600 }
                : { border: `1px solid ${C.border}`, color: C.muted, background: C.surface }}
            >
              {aMeses ? "A meses: sí" : "A meses: no"}
            </button>
          </div>
          {aMeses && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
              <Field label="Número de meses">
                <Select value={months} onChange={(e) => setMonths(Number(e.target.value))}>
                  {MESES_OPCIONES.map((m) => <option key={m} value={m}>{m} meses</option>)}
                </Select>
              </Field>
              <Field label="Comisión (MXN, opcional)">
                <TextInput type="number" min="0" step="0.01" value={commission} onChange={(e) => setCommission(e.target.value)} />
              </Field>
            </div>
          )}
        </div>
      )}
      {error && <p className="text-xs mt-2" style={{ color: C.red }}>{error}</p>}
      <div className="mt-3">
        <Btn onClick={save}>Guardar cambios</Btn>
      </div>
    </Card>
  );
}

// Editor de una transferencia: edita las DOS patas a la vez para que siga cuadrando
function TransferEditor({ mov, data, onSave, onCancel }) {
  const C = useTheme();
  const { accounts, cards, movements } = data;
  const legs = movements.filter((m) => m.transferId === mov.transferId);
  const gastoLeg = legs.find((m) => m.type === "gasto");
  const ingresoLeg = legs.find((m) => m.type === "ingreso");
  const fromCard0 = cards.find((c) => c.id === gastoLeg?.cardId);
  const toCard0 = cards.find((c) => c.id === ingresoLeg?.cardId);
  const [fromAcc, setFromAcc] = useState(fromCard0 ? fromCard0.accountId : "");
  const [fromCard, setFromCard] = useState(gastoLeg?.cardId || "");
  const [toAcc, setToAcc] = useState(toCard0 ? toCard0.accountId : "");
  const [toCard, setToCard] = useState(ingresoLeg?.cardId || "");
  const [amount, setAmount] = useState(String(gastoLeg?.amount ?? mov.amount));
  const [date, setDate] = useState(mov.date);
  // Si el título es el automático ("Transferencia a/desde …") lo dejamos vacío para regenerarlo
  const custom = mov.title && !/^Transferencia (a|desde) /.test(mov.title) ? mov.title : "";
  const [title, setTitle] = useState(custom);
  const [description, setDescription] = useState(mov.description || "");
  const [error, setError] = useState("");
  const fromCards = cards.filter((c) => c.accountId === fromAcc);
  const toCards = cards.filter((c) => c.accountId === toAcc);
  const isFromCash = cashCardId(fromAcc, accounts, cards) !== null;
  const isToCash = cashCardId(toAcc, accounts, cards) !== null;

  const save = () => {
    const amt = parseFloat(amount);
    if (!fromCard) return setError("Elige la cuenta y tarjeta de origen.");
    if (!toCard) return setError("Elige la cuenta y tarjeta de destino.");
    if (fromCard === toCard) return setError("El origen y el destino deben ser distintos.");
    if (!amt || amt <= 0) return setError("Escribe un monto mayor a cero.");
    onSave(mov.transferId, { fromCard, toCard, amount: amt, date, title: title.trim(), description: description.trim() });
  };

  return (
    <Card style={{ borderColor: C.blue }}>
      <div className="flex items-center justify-between mb-3">
        <Chip color={C.blue}>Editando transferencia</Chip>
        <Btn kind="ghost" onClick={onCancel} size="sm">Cancelar</Btn>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field label="Cuenta origen">
          <Select value={fromAcc} onChange={(e) => { const id = e.target.value; setFromAcc(id); setFromCard(cashCardId(id, accounts, cards) || ""); }}>
            <option value="">— Elegir cuenta —</option>
            {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}{a.bank ? ` (${a.bank})` : ""}</option>)}
          </Select>
        </Field>
        {!isFromCash && (
          <Field label="Tarjeta origen">
            <Select value={fromCard} onChange={(e) => setFromCard(e.target.value)} disabled={!fromAcc}>
              <option value="">{fromAcc ? "— Elegir tarjeta —" : "Primero elige una cuenta"}</option>
              {fromCards.map((c) => <option key={c.id} value={c.id}>{c.name}{c.last4 ? ` ····${c.last4}` : ""} · {cardTypeLabel(c.type)}</option>)}
            </Select>
          </Field>
        )}
        <Field label="Cuenta destino">
          <Select value={toAcc} onChange={(e) => { const id = e.target.value; setToAcc(id); setToCard(cashCardId(id, accounts, cards) || ""); }}>
            <option value="">— Elegir cuenta —</option>
            {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}{a.bank ? ` (${a.bank})` : ""}</option>)}
          </Select>
        </Field>
        {!isToCash && (
          <Field label="Tarjeta destino">
            <Select value={toCard} onChange={(e) => setToCard(e.target.value)} disabled={!toAcc}>
              <option value="">{toAcc ? "— Elegir tarjeta —" : "Primero elige una cuenta"}</option>
              {toCards.filter((c) => c.id !== fromCard).map((c) => <option key={c.id} value={c.id}>{c.name}{c.last4 ? ` ····${c.last4}` : ""} · {cardTypeLabel(c.type)}</option>)}
            </Select>
          </Field>
        )}
        <Field label="Monto (MXN)">
          <TextInput type="number" min="0" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} />
        </Field>
        <Field label="Fecha">
          <TextInput type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>
        <Field label="Título (opcional)">
          <TextInput value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Se genera solo si lo dejas vacío" />
        </Field>
        <Field label="Descripción (opcional)">
          <TextInput value={description} onChange={(e) => setDescription(e.target.value)} />
        </Field>
      </div>
      <p className="text-xs mt-2" style={{ color: C.faint }}>Se actualizan las dos patas de la transferencia para que el saldo siga cuadrando.</p>
      {error && <p className="text-xs mt-2" style={{ color: C.red }}>{error}</p>}
      <div className="mt-3">
        <Btn onClick={save}>Guardar cambios</Btn>
      </div>
    </Card>
  );
}

export default function Movimientos({ data, update }) {
  const C = useTheme();
  const { accounts, cards, categories, movements } = data;
  const inbox = data.inbox || [];
  const [show, setShow] = useState(false);

  // La lectura de notificaciones es opcional; se configura en Ajustes. Aquí solo
  // mostramos la bandeja "Por confirmar" con lo que ya se detectó.
  const captureOn = !!data.notifCaptureEnabled;

  const confirmInbox = (item, fields) => {
    // Transferencia detectada: crea las dos patas (gasto en origen, ingreso en destino)
    if (fields.transfer) {
      const from = cards.find((c) => c.id === fields.fromCard);
      const to = cards.find((c) => c.id === fields.toCard);
      const tid = uid();
      const base = { categoryId: null, date: fields.date, months: 1, commission: 0, transfer: true, transferId: tid, description: "" };
      return update({
        movements: [
          { ...base, id: uid(), cardId: fields.fromCard, type: "gasto", amount: fields.amount, title: fields.title || `Transferencia a ${to?.name || "?"}` },
          { ...base, id: uid(), cardId: fields.toCard, type: "ingreso", amount: fields.amount, title: fields.title || `Transferencia desde ${from?.name || "?"}` },
          ...movements,
        ],
        inbox: inbox.filter((i) => i.id !== item.id),
      });
    }
    update({
      movements: [{ id: uid(), months: 1, commission: 0, ...fields }, ...movements],
      inbox: inbox.filter((i) => i.id !== item.id),
    });
  };
  const discardInbox = (item) => update({ inbox: inbox.filter((i) => i.id !== item.id) });

  const [type, setType] = useState("gasto");
  const [accountId, setAccountId] = useState("");
  const [cardId, setCardId] = useState("");
  const [toAccountId, setToAccountId] = useState("");
  const [toCardId, setToCardId] = useState("");
  const [amount, setAmount] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [editId, setEditId] = useState(null);
  const [periodo, setPeriodo] = useState("recientes");
  const [catFilter, setCatFilter] = useState([]); // categorías seleccionadas (vacío = todas)
  const [cardFilter, setCardFilter] = useState([]); // tarjetas seleccionadas (vacío = todas)
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [categoryId, setCategoryId] = useState("");
  const [date, setDate] = useState(todayISO());
  const [aMeses, setAMeses] = useState(false);
  const [months, setMonths] = useState(3);
  const [commission, setCommission] = useState("");
  const [error, setError] = useState("");
  // Pago dividido: una compra pagada con varios medios; cada fila es { cuenta, tarjeta, monto }
  const [splitMode, setSplitMode] = useState(false);
  const [splitRows, setSplitRows] = useState([{ accountId: "", cardId: "", amount: "" }, { accountId: "", cardId: "", amount: "" }]);

  const isTransfer = type === "transfer";
  const isSplit = type === "gasto" && splitMode;
  const accCards = cards.filter((c) => c.accountId === accountId);
  const toAccCards = cards.filter((c) => c.accountId === toAccountId);
  const selectedCard = cards.find((c) => c.id === cardId);
  const isCreditExpense = type === "gasto" && !splitMode && selectedCard?.type === "credito";
  // Efectivo: cuenta con una sola cartera; se autoselecciona y se oculta el selector de tarjeta
  const isCashAccount = cashCardId(accountId, accounts, cards) !== null;
  const isToCashAccount = cashCardId(toAccountId, accounts, cards) !== null;
  const splitTotal = splitRows.reduce((s, r) => s + (parseFloat(r.amount) || 0), 0);

  // Actualiza una fila del pago dividido (y autoselecciona la cartera si es efectivo)
  const setSplitRow = (i, patch) => setSplitRows((rows) => rows.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  const addSplitRow = () => setSplitRows((rows) => [...rows, { accountId: "", cardId: "", amount: "" }]);
  const removeSplitRow = (i) => setSplitRows((rows) => (rows.length <= 1 ? rows : rows.filter((_, idx) => idx !== i)));

  const catById = useMemo(() => Object.fromEntries(categories.map((c) => [c.id, c])), [categories]);
  const cardById = useMemo(() => Object.fromEntries(cards.map((c) => [c.id, c])), [cards]);

  const resetForm = () => {
    setType("gasto"); setAccountId(""); setCardId(""); setToAccountId(""); setToCardId(""); setAmount(""); setTitle(""); setDescription("");
    setCategoryId(""); setDate(todayISO()); setAMeses(false); setMonths(3); setCommission(""); setError("");
    setSplitMode(false); setSplitRows([{ accountId: "", cardId: "", amount: "" }, { accountId: "", cardId: "", amount: "" }]);
  };

  // Pago dividido: crea un gasto por cada medio de pago, todos con el mismo splitId
  const saveSplit = () => {
    if (!title.trim()) return setError("Escribe un título para la compra.");
    if (!categoryId) return setError("Elige una categoría (puedes crear más en la pestaña Categorías).");
    const rows = splitRows
      .map((r) => ({ cardId: r.cardId, amount: parseFloat(r.amount) || 0 }))
      .filter((r) => r.cardId && r.amount > 0);
    if (rows.length === 0) return setError("Agrega al menos un medio de pago con su monto.");
    // El efectivo no puede quedar negativo (agrupa por tarjeta por si se repite)
    const byCard = {};
    rows.forEach((r) => { byCard[r.cardId] = (byCard[r.cardId] || 0) + r.amount; });
    for (const cid of Object.keys(byCard)) {
      const over = cashOverdraft(cards.find((c) => c.id === cid), movements, byCard[cid]);
      if (over > 0) return setError(cashOverdraftMsg(over));
    }
    const t = title.trim();
    const desc = description.trim();
    if (rows.length === 1) {
      // Un solo medio: es un gasto normal, sin marca de dividido
      update({ movements: [{ id: uid(), cardId: rows[0].cardId, type: "gasto", amount: rows[0].amount, title: t, description: desc, categoryId, date, months: 1, commission: 0 }, ...movements] });
    } else {
      const sid = uid();
      const legs = rows.map((r) => ({ id: uid(), cardId: r.cardId, type: "gasto", amount: r.amount, title: t, description: desc, categoryId, date, months: 1, commission: 0, split: true, splitId: sid }));
      update({ movements: [...legs, ...movements] });
    }
    resetForm();
    setShow(false);
  };

  const save = () => {
    if (isSplit) return saveSplit();
    const amt = parseFloat(amount);
    if (!cardId) return setError(isTransfer ? "Elige la cuenta y tarjeta de origen." : "Elige una cuenta y una tarjeta.");
    if (!amt || amt <= 0) return setError("Escribe un monto mayor a cero.");
    if (isTransfer) {
      if (!toCardId) return setError("Elige la cuenta y tarjeta de destino.");
      if (toCardId === cardId) return setError("El origen y el destino deben ser distintos.");
      const over = cashOverdraft(cards.find((c) => c.id === cardId), movements, amt);
      if (over > 0) return setError(cashOverdraftMsg(over));
      const from = cards.find((c) => c.id === cardId);
      const to = cards.find((c) => c.id === toCardId);
      const tid = uid();
      const t = title.trim();
      const base = { categoryId: null, date, months: 1, commission: 0, transfer: true, transferId: tid, description: description.trim() };
      update({
        movements: [
          { ...base, id: uid(), cardId, type: "gasto", amount: amt, title: t || `Transferencia a ${to?.name || "?"}` },
          { ...base, id: uid(), cardId: toCardId, type: "ingreso", amount: amt, title: t || `Transferencia desde ${from?.name || "?"}` },
          ...movements,
        ],
      });
      resetForm();
      setShow(false);
      return;
    }
    if (!title.trim()) return setError("Escribe un título para el movimiento.");
    if (!categoryId) return setError("Elige una categoría (puedes crear más en la pestaña Categorías).");
    if (type === "gasto") {
      const over = cashOverdraft(cards.find((c) => c.id === cardId), movements, amt);
      if (over > 0) return setError(cashOverdraftMsg(over));
    }
    const mov = {
      id: uid(),
      cardId,
      type,
      amount: amt,
      title: title.trim(),
      description: description.trim(),
      categoryId,
      date,
      months: isCreditExpense && aMeses ? Number(months) : 1,
      commission: isCreditExpense && aMeses ? (parseFloat(commission) || 0) : 0,
    };
    update({ movements: [mov, ...movements] });
    resetForm();
    setShow(false);
  };

  const saveEdit = (edited) => {
    update({ movements: movements.map((m) => (m.id === edited.id ? edited : m)) });
    setEditId(null);
  };

  // Guarda una transferencia editando sus DOS patas juntas (mantiene el cuadre)
  const saveTransfer = (transferId, { fromCard, toCard, amount: amt, date: d, title: t, description: desc }) => {
    const from = cards.find((c) => c.id === fromCard);
    const to = cards.find((c) => c.id === toCard);
    update({
      movements: movements.map((m) => {
        if (m.transferId !== transferId) return m;
        const base = { ...m, amount: amt, date: d, description: desc, months: 1, commission: 0 };
        if (m.type === "gasto") return { ...base, cardId: fromCard, title: t || `Transferencia a ${to?.name || "?"}` };
        return { ...base, cardId: toCard, title: t || `Transferencia desde ${from?.name || "?"}` };
      }),
    });
    setEditId(null);
  };

  // Al borrar una pata de una transferencia (o de un pago dividido) se borran todas
  const del = (id) => {
    const mov = movements.find((m) => m.id === id);
    if (mov?.transferId) return update({ movements: movements.filter((m) => m.transferId !== mov.transferId) });
    if (mov?.splitId) return update({ movements: movements.filter((m) => m.splitId !== mov.splitId) });
    update({ movements: movements.filter((m) => m.id !== id) });
  };

  const sorted = [...movements].sort((a, b) => (a.date < b.date ? 1 : -1));
  const byCat = catFilter.length ? sorted.filter((m) => catFilter.includes(m.categoryId)) : sorted;
  const byCard = cardFilter.length ? byCat.filter((m) => cardFilter.includes(m.cardId)) : byCat;
  const visibles = filterByPeriodo(byCard, periodo);
  const activeFilters = catFilter.length + cardFilter.length;

  // Agrupa las patas de un pago dividido (mismo splitId) en una sola fila de la lista
  const visibleRows = [];
  const seenSplit = new Set();
  for (const m of visibles) {
    if (m.splitId) {
      if (seenSplit.has(m.splitId)) continue;
      seenSplit.add(m.splitId);
      visibleRows.push({ kind: "split", splitId: m.splitId, legs: visibles.filter((x) => x.splitId === m.splitId), rep: m });
    } else {
      visibleRows.push({ kind: "single", m });
    }
  }

  const totalConComision = (parseFloat(amount) || 0) + (parseFloat(commission) || 0);
  const mensualidad = aMeses && months > 0 ? totalConComision / months : 0;

  return (
    <div className="space-y-4">
      <SectionTitle right={<Btn onClick={() => { setShow((v) => !v); if (!show) resetForm(); }}>{show ? "Cancelar" : "+ Nuevo movimiento"}</Btn>}>
        Movimientos
      </SectionTitle>

      {captureOn && inbox.length > 0 && (
        <div>
          <h3 className="text-xs uppercase tracking-widest mb-2" style={{ color: C.amber }}>
            Por confirmar ({inbox.length})
          </h3>
          <div className="space-y-2">
            {inbox.map((item) => (
              item.kind === "transfer"
                ? <InboxTransferItem key={item.id} item={item} data={data} onConfirm={confirmInbox} onDiscard={discardInbox} />
                : <InboxItem key={item.id} item={item} data={data} onConfirm={confirmInbox} onDiscard={discardInbox} />
            ))}
          </div>
        </div>
      )}

      {show && (
        <Card>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Tipo">
              <Select value={type} onChange={(e) => setType(e.target.value)}>
                <option value="gasto">Gasto</option>
                <option value="ingreso">Ingreso / Depósito / Pago a tarjeta</option>
                <option value="transfer">Transferencia entre cuentas</option>
              </Select>
            </Field>
            <Field label="Fecha">
              <TextInput type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </Field>
            {type === "gasto" && (
              <div className="sm:col-span-2">
                <button
                  type="button"
                  onClick={() => { setSplitMode((v) => !v); setError(""); }}
                  className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-opacity hover:opacity-85"
                  style={splitMode
                    ? { background: C.accentSoft, color: C.accent, border: `1px solid ${C.accent}`, fontWeight: 600 }
                    : { background: C.surface, color: C.muted, border: `1px solid ${C.border}` }}
                >
                  <IconSplit width={16} height={16} />
                  {splitMode ? "Pago dividido activado" : "Pagar con varios medios"}
                </button>
              </div>
            )}
            {!isSplit && (
              <>
                <Field label={isTransfer ? "Cuenta origen" : "Cuenta"}>
                  <Select value={accountId} onChange={(e) => { const id = e.target.value; setAccountId(id); setCardId(cashCardId(id, accounts, cards) || ""); }}>
                    <option value="">— Elegir cuenta —</option>
                    {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}{a.bank ? ` (${a.bank})` : ""}</option>)}
                  </Select>
                </Field>
                {!isCashAccount && (
                  <Field label={isTransfer ? "Tarjeta origen" : "Tarjeta"}>
                    <Select value={cardId} onChange={(e) => setCardId(e.target.value)} disabled={!accountId}>
                      <option value="">{accountId ? "— Elegir tarjeta —" : "Primero elige una cuenta"}</option>
                      {accCards.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}{c.last4 ? ` ····${c.last4}` : ""} · {cardTypeLabel(c.type)}
                        </option>
                      ))}
                    </Select>
                  </Field>
                )}
              </>
            )}
            {isTransfer && (
              <>
                <Field label="Cuenta destino">
                  <Select value={toAccountId} onChange={(e) => { const id = e.target.value; setToAccountId(id); setToCardId(cashCardId(id, accounts, cards) || ""); }}>
                    <option value="">— Elegir cuenta —</option>
                    {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}{a.bank ? ` (${a.bank})` : ""}</option>)}
                  </Select>
                </Field>
                {!isToCashAccount && (
                  <Field label="Tarjeta destino">
                    <Select value={toCardId} onChange={(e) => setToCardId(e.target.value)} disabled={!toAccountId}>
                      <option value="">{toAccountId ? "— Elegir tarjeta —" : "Primero elige una cuenta"}</option>
                      {toAccCards.filter((c) => c.id !== cardId).map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}{c.last4 ? ` ····${c.last4}` : ""} · {cardTypeLabel(c.type)}
                        </option>
                      ))}
                    </Select>
                  </Field>
                )}
              </>
            )}
            {!isSplit && (
              <Field label="Monto (MXN)">
                <TextInput type="number" min="0" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" />
              </Field>
            )}
            {!isTransfer && (
              <Field label="Categoría">
                <Select value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
                  <option value="">— Elegir categoría —</option>
                  {FREQS.map((f) => (
                    <optgroup key={f.id} label={f.label}>
                      {categories.filter((c) => c.freq === f.id).map((c) => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </optgroup>
                  ))}
                </Select>
              </Field>
            )}
            <Field label={isTransfer ? "Título (opcional)" : "Título"}>
              <TextInput value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ej. Súper, Netflix, gasolina…" />
            </Field>
            <Field label="Descripción (opcional)">
              <TextInput value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Detalles extra del movimiento" />
            </Field>
          </div>

          {/* Pago dividido: montos por cada medio de pago */}
          {isSplit && (
            <div className="mt-4 rounded-lg p-3" style={{ background: C.surface2, border: `1px solid ${C.border}` }}>
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-medium">Medios de pago</p>
                <span className="text-xs" style={{ color: C.muted }}>
                  Total: <span className="font-mono" style={{ color: C.text }}>{money(splitTotal)}</span>
                </span>
              </div>
              <div className="space-y-3">
                {splitRows.map((r, i) => {
                  const rowAccCards = cards.filter((c) => c.accountId === r.accountId);
                  const rowIsCash = cashCardId(r.accountId, accounts, cards) !== null;
                  return (
                    <div key={i} className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      <Field label="Cuenta">
                        <Select value={r.accountId} onChange={(e) => { const id = e.target.value; setSplitRow(i, { accountId: id, cardId: cashCardId(id, accounts, cards) || "" }); }}>
                          <option value="">— Elegir —</option>
                          {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}{a.bank ? ` (${a.bank})` : ""}</option>)}
                        </Select>
                      </Field>
                      {rowIsCash ? (
                        <Field label="Tarjeta">
                          <div className="text-sm" style={{ padding: "9px 0", color: C.faint }}>Efectivo</div>
                        </Field>
                      ) : (
                        <Field label="Tarjeta">
                          <Select value={r.cardId} onChange={(e) => setSplitRow(i, { cardId: e.target.value })} disabled={!r.accountId}>
                            <option value="">{r.accountId ? "— Elegir —" : "Primero la cuenta"}</option>
                            {rowAccCards.map((c) => <option key={c.id} value={c.id}>{c.name}{c.last4 ? ` ····${c.last4}` : ""} · {cardTypeLabel(c.type)}</option>)}
                          </Select>
                        </Field>
                      )}
                      <div className="flex items-end gap-2">
                        <div className="flex-1">
                          <Field label="Monto (MXN)">
                            <TextInput type="number" min="0" step="0.01" value={r.amount} onChange={(e) => setSplitRow(i, { amount: e.target.value })} placeholder="0.00" />
                          </Field>
                        </div>
                        {splitRows.length > 1 && (
                          <Btn kind="danger" onClick={() => removeSplitRow(i)} title="Quitar este medio">✕</Btn>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="mt-2">
                <Btn kind="ghost" onClick={addSplitRow} size="sm">+ Agregar medio</Btn>
              </div>
              <p className="text-xs mt-2" style={{ color: C.faint }}>
                Cada medio se registra como un gasto en su cuenta; juntos forman una sola compra (la suma es el total). Se agrupan en un solo movimiento en la lista.
              </p>
            </div>
          )}

          {/* Opciones exclusivas de tarjeta de crédito */}
          {isCreditExpense && (
            <div className="mt-4 rounded-lg p-3" style={{ background: C.amberSoft, border: `1px solid ${C.amber}` }}>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium" style={{ color: C.amber }}>Compra a meses</p>
                  <p className="text-xs" style={{ color: C.faint }}>Difiere el pago y registra la comisión si aplica.</p>
                </div>
                <button
                  onClick={() => setAMeses((v) => !v)}
                  className="rounded-full px-3 py-1 text-xs"
                  style={aMeses
                    ? { background: C.amber, color: C.accentText === "#FFFFFF" ? "#FFFFFF" : "#221A08", fontWeight: 600 }
                    : { border: `1px solid ${C.border}`, color: C.muted, background: C.surface }}
                >
                  {aMeses ? "A meses: sí" : "A meses: no"}
                </button>
              </div>

              {aMeses && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
                  <Field label="Número de meses">
                    <Select value={months} onChange={(e) => setMonths(Number(e.target.value))}>
                      {MESES_OPCIONES.map((m) => <option key={m} value={m}>{m} meses</option>)}
                    </Select>
                  </Field>
                  <Field label="Comisión (MXN, opcional)">
                    <TextInput type="number" min="0" step="0.01" value={commission} onChange={(e) => setCommission(e.target.value)} placeholder="0.00" />
                  </Field>
                  <div className="sm:col-span-2 flex flex-wrap gap-x-6 gap-y-1 text-xs" style={{ color: C.muted }}>
                    <span>Total con comisión: <span className="font-mono" style={{ color: C.text }}>{money(totalConComision)}</span></span>
                    <span>Mensualidad: <span className="font-mono" style={{ color: C.amber }}>{money(mensualidad)}</span></span>
                  </div>
                </div>
              )}
            </div>
          )}

          {isTransfer && (
            <p className="text-xs mt-3" style={{ color: C.faint }}>
              La transferencia mueve el dinero entre tus cuentas sin contarse como gasto ni ingreso en el resumen. Si el destino es una tarjeta de crédito, funciona como pago de la tarjeta.
            </p>
          )}
          {error && <p className="text-xs mt-3" style={{ color: C.red }}>{error}</p>}
          <div className="mt-4">
            <Btn onClick={save}>Guardar movimiento</Btn>
          </div>
        </Card>
      )}

      {sorted.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex gap-1 flex-wrap">
              {PERIODOS.map((p) => (
                <Pill key={p.id} on={periodo === p.id} onClick={() => setPeriodo(p.id)}>{p.label}</Pill>
              ))}
            </div>
            <Btn kind={filtersOpen || activeFilters ? "primary" : "ghost"} size="sm" onClick={() => setFiltersOpen((v) => !v)}>
              Filtros{activeFilters ? ` · ${activeFilters}` : ""}
            </Btn>
          </div>

          {/* Chips de los filtros activos, para verlos de un vistazo sin abrir el panel */}
          {activeFilters > 0 && !filtersOpen && (
            <div className="flex flex-wrap gap-1.5 items-center">
              {cardFilter.map((id) => {
                const c = cardById[id];
                if (!c) return null;
                return (
                  <button key={id} onClick={() => setCardFilter((prev) => prev.filter((x) => x !== id))}
                    className="rounded-full px-2.5 py-0.5 text-xs inline-flex items-center gap-1"
                    style={{ background: C.accentSoft, color: C.accent, border: `1px solid ${C.border}` }}>
                    {c.name}{c.last4 ? ` ····${c.last4}` : ""} <span aria-hidden="true">✕</span>
                  </button>
                );
              })}
              {catFilter.map((id) => {
                const c = catById[id];
                if (!c) return null;
                return (
                  <button key={id} onClick={() => setCatFilter((prev) => prev.filter((x) => x !== id))}
                    className="rounded-full px-2.5 py-0.5 text-xs inline-flex items-center gap-1"
                    style={{ background: C.accentSoft, color: C.accent, border: `1px solid ${C.border}` }}>
                    {c.name} <span aria-hidden="true">✕</span>
                  </button>
                );
              })}
              <button onClick={() => { setCatFilter([]); setCardFilter([]); }} className="text-xs px-1" style={{ color: C.muted }}>
                Limpiar
              </button>
            </div>
          )}

          {filtersOpen && (
            <Card style={{ paddingTop: 12, paddingBottom: 12 }}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs uppercase tracking-wider" style={{ color: C.muted }}>Cuentas y tarjetas</span>
                {cardFilter.length > 0 && (
                  <button onClick={() => setCardFilter([])} className="text-xs" style={{ color: C.accent }}>Limpiar</button>
                )}
              </div>
              <div className="space-y-2.5">
                {accounts.map((a) => {
                  const accCardList = cards.filter((c) => c.accountId === a.id);
                  if (!accCardList.length) return null;
                  const ids = accCardList.map((c) => c.id);
                  const allOn = ids.every((id) => cardFilter.includes(id));
                  const toggleAll = () => setCardFilter((prev) => (allOn ? prev.filter((x) => !ids.includes(x)) : [...new Set([...prev, ...ids])]));
                  return (
                    <div key={a.id}>
                      <button onClick={toggleAll} className="text-xs mb-1 transition-opacity hover:opacity-80" style={{ color: allOn ? C.accent : C.faint, fontWeight: allOn ? 600 : 400 }}>
                        {a.name}{a.bank ? ` · ${a.bank}` : ""}
                      </button>
                      <div className="flex flex-wrap gap-2">
                        {accCardList.map((c) => (
                          <Pill
                            key={c.id}
                            on={cardFilter.includes(c.id)}
                            onClick={() => setCardFilter((prev) => (prev.includes(c.id) ? prev.filter((x) => x !== c.id) : [...prev, c.id]))}
                          >
                            {c.name}{c.last4 ? ` ····${c.last4}` : ""}
                          </Pill>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="flex items-center justify-between mt-4 mb-2">
                <span className="text-xs uppercase tracking-wider" style={{ color: C.muted }}>Categorías</span>
                {catFilter.length > 0 && (
                  <button onClick={() => setCatFilter([])} className="text-xs" style={{ color: C.accent }}>Limpiar</button>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                {categories.map((c) => (
                  <Pill
                    key={c.id}
                    on={catFilter.includes(c.id)}
                    onClick={() => setCatFilter((prev) => (prev.includes(c.id) ? prev.filter((x) => x !== c.id) : [...prev, c.id]))}
                  >
                    {c.name}
                  </Pill>
                ))}
              </div>

              {activeFilters > 0 && (
                <div className="mt-4 pt-3 flex items-center justify-between" style={{ borderTop: `1px solid ${C.borderSoft}` }}>
                  <span className="text-xs" style={{ color: C.faint }}>{activeFilters} {activeFilters === 1 ? "filtro activo" : "filtros activos"}</span>
                  <button onClick={() => { setCatFilter([]); setCardFilter([]); }} className="text-xs" style={{ color: C.muted }}>
                    Limpiar todos
                  </button>
                </div>
              )}
            </Card>
          )}

          {periodo === "recientes" && byCard.length > 10 && (
            <span className="text-xs" style={{ color: C.faint }}>Mostrando 10 de {byCard.length}</span>
          )}
        </div>
      )}

      {sorted.length === 0 && !show ? (
        <Empty>
          {accounts.length === 0
            ? "Primero crea una cuenta y una tarjeta en la pestaña Cuentas; después registra aquí tus movimientos."
            : 'Sin movimientos todavía. Usa "+ Nuevo movimiento" para registrar el primero.'}
        </Empty>
      ) : visibles.length === 0 ? (
        <Empty>{activeFilters > 0 ? "Sin movimientos con los filtros seleccionados." : "Sin movimientos en este periodo."}</Empty>
      ) : (
        <div className="space-y-2">
          {visibleRows.map((row) => {
            // Pago dividido: una sola tarjeta que agrupa todas las patas
            if (row.kind === "split") {
              const { legs, rep } = row;
              const total = legs.reduce((s, l) => s + movTotal(l), 0);
              const cat = catById[rep.categoryId];
              return (
                <Card key={row.splitId} className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium truncate">{rep.title || rep.description || "Compra"}</span>
                      {cat && <Chip>{cat.name}</Chip>}
                      <Chip color={C.blue}>Pago dividido</Chip>
                    </div>
                    {rep.title && rep.description && (
                      <p className="text-xs mt-0.5" style={{ color: C.muted }}>{rep.description}</p>
                    )}
                    <ul className="mt-1 space-y-0.5">
                      {legs.map((l) => {
                        const lc = cardById[l.cardId];
                        return (
                          <li key={l.id} className="text-xs flex justify-between gap-3" style={{ color: C.faint }}>
                            <span className="truncate">{lc ? cardLabel(lc, accounts) : "Tarjeta eliminada"}</span>
                            <span className="font-mono" style={{ fontVariantNumeric: "tabular-nums" }}>{money(movTotal(l))}</span>
                          </li>
                        );
                      })}
                    </ul>
                    <p className="text-xs mt-1" style={{ color: C.faint }}>{rep.date}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Amount value={total} sign="-" size="text-sm" />
                    <Btn kind="danger" onClick={() => del(rep.id)} size="sm">✕</Btn>
                  </div>
                </Card>
              );
            }
            const m = row.m;
            const cat = catById[m.categoryId];
            const card = cardById[m.cardId];
            const isGasto = m.type === "gasto";
            const hasMSI = Number(m.months) > 1;
            const editable = !m.interest; // transferencias, ajustes e ingresos ya se pueden editar; los rendimientos no
            if (editId === m.id) {
              return m.transfer
                ? <TransferEditor key={m.id} mov={m} data={data} onSave={saveTransfer} onCancel={() => setEditId(null)} />
                : <MovEditor key={m.id} mov={m} data={data} onSave={saveEdit} onCancel={() => setEditId(null)} />;
            }
            return (
              <Card key={m.id} className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium truncate">{m.title || m.description || (isGasto ? "Gasto" : "Ingreso")}</span>
                    {cat && <Chip>{cat.name}</Chip>}
                    {m.interest && <Chip color={C.green} bg={C.accentSoft}>Rendimiento automático</Chip>}
                    {m.adjust && <Chip color={C.faint}>Ajuste manual</Chip>}
                    {m.transfer && <Chip color={C.blue}>Transferencia</Chip>}
                    {m.recurring && <Chip color={C.accent} bg={C.accentSoft}>Cargo fijo</Chip>}
                    {hasMSI && <Chip color={C.amber} bg={C.amberSoft}>{m.months} MSI</Chip>}
                    {Number(m.commission) > 0 && <Chip color={C.red}>Comisión {money(m.commission)}</Chip>}
                  </div>
                  {m.title && m.description && (
                    <p className="text-xs mt-0.5" style={{ color: C.muted }}>{m.description}</p>
                  )}
                  <p className="text-xs mt-1" style={{ color: C.faint }}>
                    {m.date} · {card ? cardLabel(card, accounts) : "Tarjeta eliminada"}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <div className="text-right">
                    <Amount value={movTotal(m)} sign={isGasto ? "-" : "+"} size="text-sm" />
                    {hasMSI && (
                      <p className="text-xs font-mono" style={{ color: C.faint, fontVariantNumeric: "tabular-nums" }}>
                        {money(movTotal(m) / m.months)}/mes
                      </p>
                    )}
                  </div>
                  {editable && (
                    <Btn kind="ghost" onClick={() => setEditId(m.id)} size="sm">✎</Btn>
                  )}
                  <Btn kind="danger" onClick={() => del(m.id)} size="sm">✕</Btn>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
