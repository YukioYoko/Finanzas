import { useState, useEffect, useMemo } from "react";
import { Capacitor } from "@capacitor/core";
import { useTheme } from "../theme";
import { FREQS, MESES_OPCIONES } from "../constants";
import { money, uid, todayISO } from "../utils/format";
import { cardLabel, movTotal } from "../lib/finance";
import { NotificationInbox } from "../lib/notifications";
import { Field, TextInput, Select, Btn, Chip, Amount, Card, SectionTitle, Empty } from "../components/ui";

// Un cargo detectado en una notificación, pendiente de que el usuario lo complete
function InboxItem({ item, data, onConfirm, onDiscard }) {
  const C = useTheme();
  const { accounts, cards, categories } = data;
  const initialCard = cards.find((c) => c.id === item.cardId);
  const [accountId, setAccountId] = useState(initialCard ? initialCard.accountId : "");
  const [cardId, setCardId] = useState(item.cardId || "");
  const [type, setType] = useState(item.type || "gasto");
  const [amount, setAmount] = useState(String(item.amount));
  const [date, setDate] = useState(item.date);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [error, setError] = useState("");
  const accCards = cards.filter((c) => c.accountId === accountId);

  const confirm = () => {
    const amt = parseFloat(amount);
    if (!title.trim()) return setError("Escribe un título (ej. el comercio).");
    if (!cardId) return setError("Elige la cuenta y la tarjeta.");
    if (!amt || amt <= 0) return setError("Escribe un monto mayor a cero.");
    if (!categoryId) return setError("Elige una categoría.");
    onConfirm(item, { cardId, type, amount: amt, date, title: title.trim(), description: description.trim(), categoryId });
  };

  return (
    <Card style={{ borderColor: C.amber }}>
      <div className="flex items-center justify-between gap-3 mb-2 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          <Chip color={C.amber} bg={C.amberSoft}>Detectado en notificación</Chip>
          <Amount value={parseFloat(amount) || 0} sign={type === "gasto" ? "-" : "+"} size="text-sm" />
        </div>
        <Btn kind="danger" onClick={() => onDiscard(item)} style={{ padding: "4px 8px" }}>Descartar</Btn>
      </div>
      <p className="text-xs mb-3" style={{ color: C.faint }}>{item.text}</p>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Field label="Tipo">
          <Select value={type} onChange={(e) => setType(e.target.value)}>
            <option value="gasto">Gasto</option>
            <option value="ingreso">Ingreso</option>
          </Select>
        </Field>
        <Field label="Cuenta">
          <Select value={accountId} onChange={(e) => { setAccountId(e.target.value); setCardId(""); }}>
            <option value="">— Elegir cuenta —</option>
            {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}{a.bank ? ` (${a.bank})` : ""}</option>)}
          </Select>
        </Field>
        <Field label="Tarjeta">
          <Select value={cardId} onChange={(e) => setCardId(e.target.value)} disabled={!accountId}>
            <option value="">{accountId ? "— Elegir tarjeta —" : "Primero elige una cuenta"}</option>
            {accCards.map((c) => (
              <option key={c.id} value={c.id}>{c.name}{c.last4 ? ` ····${c.last4}` : ""}</option>
            ))}
          </Select>
        </Field>
        <Field label="Monto (MXN)">
          <TextInput type="number" min="0" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} />
        </Field>
        <Field label="Fecha">
          <TextInput type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>
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
        <Field label="Título">
          <TextInput value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ej. Súper, gasolina…" />
        </Field>
        <div className="sm:col-span-2">
          <Field label="Descripción (opcional)">
            <TextInput value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Detalles extra" />
          </Field>
        </div>
      </div>
      {error && <p className="text-xs mt-2" style={{ color: C.red }}>{error}</p>}
      <div className="mt-3">
        <Btn onClick={confirm}>Confirmar movimiento</Btn>
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
  const isCreditExpense = type === "gasto" && selectedCard?.type === "credito";

  const save = () => {
    const amt = parseFloat(amount);
    if (!title.trim()) return setError("Escribe un título.");
    if (!cardId) return setError("Elige la cuenta y la tarjeta.");
    if (!amt || amt <= 0) return setError("Escribe un monto mayor a cero.");
    if (!categoryId) return setError("Elige una categoría.");
    onSave({
      ...mov,
      cardId,
      type,
      title: title.trim(),
      description: description.trim(),
      amount: amt,
      date,
      categoryId,
      months: isCreditExpense && aMeses ? Number(months) : 1,
      commission: isCreditExpense && aMeses ? (parseFloat(commission) || 0) : 0,
    });
  };

  return (
    <Card style={{ borderColor: C.accent }}>
      <div className="flex items-center justify-between mb-3">
        <Chip color={C.accent} bg={C.accentSoft}>Editando movimiento</Chip>
        <Btn kind="ghost" onClick={onCancel} style={{ padding: "4px 10px" }}>Cancelar</Btn>
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
          <Select value={accountId} onChange={(e) => { setAccountId(e.target.value); setCardId(""); }}>
            <option value="">— Elegir cuenta —</option>
            {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}{a.bank ? ` (${a.bank})` : ""}</option>)}
          </Select>
        </Field>
        <Field label="Tarjeta">
          <Select value={cardId} onChange={(e) => setCardId(e.target.value)} disabled={!accountId}>
            <option value="">{accountId ? "— Elegir tarjeta —" : "Primero elige una cuenta"}</option>
            {accCards.map((c) => (
              <option key={c.id} value={c.id}>{c.name}{c.last4 ? ` ····${c.last4}` : ""}</option>
            ))}
          </Select>
        </Field>
        <Field label="Monto (MXN)">
          <TextInput type="number" min="0" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} />
        </Field>
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

export default function Movimientos({ data, update }) {
  const C = useTheme();
  const { accounts, cards, categories, movements } = data;
  const inbox = data.inbox || [];
  const [show, setShow] = useState(false);

  // Acceso a notificaciones: null = no aplica (web) o desconocido; false = falta concederlo
  const [inboxEnabled, setInboxEnabled] = useState(null);
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    NotificationInbox.isEnabled().then((r) => setInboxEnabled(!!r.enabled)).catch(() => {});
  }, []);

  const confirmInbox = (item, fields) => {
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
  const [categoryId, setCategoryId] = useState("");
  const [date, setDate] = useState(todayISO());
  const [aMeses, setAMeses] = useState(false);
  const [months, setMonths] = useState(3);
  const [commission, setCommission] = useState("");
  const [error, setError] = useState("");

  const isTransfer = type === "transfer";
  const accCards = cards.filter((c) => c.accountId === accountId);
  const toAccCards = cards.filter((c) => c.accountId === toAccountId);
  const selectedCard = cards.find((c) => c.id === cardId);
  const isCreditExpense = type === "gasto" && selectedCard?.type === "credito";

  const catById = useMemo(() => Object.fromEntries(categories.map((c) => [c.id, c])), [categories]);
  const cardById = useMemo(() => Object.fromEntries(cards.map((c) => [c.id, c])), [cards]);

  const resetForm = () => {
    setType("gasto"); setAccountId(""); setCardId(""); setToAccountId(""); setToCardId(""); setAmount(""); setTitle(""); setDescription("");
    setCategoryId(""); setDate(todayISO()); setAMeses(false); setMonths(3); setCommission(""); setError("");
  };

  const save = () => {
    const amt = parseFloat(amount);
    if (!cardId) return setError(isTransfer ? "Elige la cuenta y tarjeta de origen." : "Elige una cuenta y una tarjeta.");
    if (!amt || amt <= 0) return setError("Escribe un monto mayor a cero.");
    if (isTransfer) {
      if (!toCardId) return setError("Elige la cuenta y tarjeta de destino.");
      if (toCardId === cardId) return setError("El origen y el destino deben ser distintos.");
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

  // Al borrar una pata de una transferencia se borran las dos, para no descuadrar
  const del = (id) => {
    const mov = movements.find((m) => m.id === id);
    if (mov?.transferId) return update({ movements: movements.filter((m) => m.transferId !== mov.transferId) });
    update({ movements: movements.filter((m) => m.id !== id) });
  };

  const sorted = [...movements].sort((a, b) => (a.date < b.date ? 1 : -1));

  const totalConComision = (parseFloat(amount) || 0) + (parseFloat(commission) || 0);
  const mensualidad = aMeses && months > 0 ? totalConComision / months : 0;

  return (
    <div className="space-y-4">
      <SectionTitle right={<Btn onClick={() => { setShow((v) => !v); if (!show) resetForm(); }}>{show ? "Cancelar" : "+ Nuevo movimiento"}</Btn>}>
        Movimientos
      </SectionTitle>

      {inboxEnabled === false && (
        <Card className="flex items-center justify-between gap-3 flex-wrap">
          <div className="min-w-0 flex-1">
            <p className="text-sm">Registra tus cargos automáticamente</p>
            <p className="text-xs mt-1" style={{ color: C.faint }}>
              Permite que Mis Finanzas lea las notificaciones del celular para detectar cargos y depósitos del banco; aquí te aparecerán listos para confirmar. Todo se procesa en tu teléfono, nada se envía fuera.
            </p>
          </div>
          <Btn kind="ghost" onClick={() => NotificationInbox.openSettings().catch(() => {})}>Permitir acceso</Btn>
        </Card>
      )}

      {inbox.length > 0 && (
        <div>
          <h3 className="text-xs uppercase tracking-widest mb-2" style={{ color: C.amber }}>
            Por confirmar ({inbox.length})
          </h3>
          <div className="space-y-2">
            {inbox.map((item) => (
              <InboxItem key={item.id} item={item} data={data} onConfirm={confirmInbox} onDiscard={discardInbox} />
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
            <Field label={isTransfer ? "Cuenta origen" : "Cuenta"}>
              <Select value={accountId} onChange={(e) => { setAccountId(e.target.value); setCardId(""); }}>
                <option value="">— Elegir cuenta —</option>
                {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}{a.bank ? ` (${a.bank})` : ""}</option>)}
              </Select>
            </Field>
            <Field label={isTransfer ? "Tarjeta origen" : "Tarjeta"}>
              <Select value={cardId} onChange={(e) => setCardId(e.target.value)} disabled={!accountId}>
                <option value="">{accountId ? "— Elegir tarjeta —" : "Primero elige una cuenta"}</option>
                {accCards.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}{c.last4 ? ` ····${c.last4}` : ""} · {c.type === "credito" ? "Crédito" : c.type === "ahorro" ? "Caja de ahorro" : c.type === "efectivo" ? "Efectivo" : "Débito"}
                  </option>
                ))}
              </Select>
            </Field>
            {isTransfer && (
              <>
                <Field label="Cuenta destino">
                  <Select value={toAccountId} onChange={(e) => { setToAccountId(e.target.value); setToCardId(""); }}>
                    <option value="">— Elegir cuenta —</option>
                    {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}{a.bank ? ` (${a.bank})` : ""}</option>)}
                  </Select>
                </Field>
                <Field label="Tarjeta destino">
                  <Select value={toCardId} onChange={(e) => setToCardId(e.target.value)} disabled={!toAccountId}>
                    <option value="">{toAccountId ? "— Elegir tarjeta —" : "Primero elige una cuenta"}</option>
                    {toAccCards.filter((c) => c.id !== cardId).map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}{c.last4 ? ` ····${c.last4}` : ""} · {c.type === "credito" ? "Crédito" : c.type === "ahorro" ? "Caja de ahorro" : c.type === "efectivo" ? "Efectivo" : "Débito"}
                      </option>
                    ))}
                  </Select>
                </Field>
              </>
            )}
            <Field label="Monto (MXN)">
              <TextInput type="number" min="0" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" />
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
              <TextInput value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ej. Súper, Netflix, gasolina…" />
            </Field>
            <Field label="Descripción (opcional)">
              <TextInput value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Detalles extra del movimiento" />
            </Field>
          </div>

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

      {sorted.length === 0 && !show ? (
        <Empty>
          {accounts.length === 0
            ? "Primero crea una cuenta y una tarjeta en la pestaña Cuentas; después registra aquí tus movimientos."
            : 'Sin movimientos todavía. Usa "+ Nuevo movimiento" para registrar el primero.'}
        </Empty>
      ) : (
        <div className="space-y-2">
          {sorted.map((m) => {
            const cat = catById[m.categoryId];
            const card = cardById[m.cardId];
            const isGasto = m.type === "gasto";
            const hasMSI = Number(m.months) > 1;
            const editable = !m.transfer && !m.interest && !m.adjust;
            if (editId === m.id) {
              return <MovEditor key={m.id} mov={m} data={data} onSave={saveEdit} onCancel={() => setEditId(null)} />;
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
                    <Btn kind="ghost" onClick={() => setEditId(m.id)} style={{ padding: "4px 8px" }}>✎</Btn>
                  )}
                  <Btn kind="danger" onClick={() => del(m.id)} style={{ padding: "4px 8px" }}>✕</Btn>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
