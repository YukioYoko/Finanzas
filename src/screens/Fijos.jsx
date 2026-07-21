import { useState, useMemo } from "react";
import { useTheme } from "../theme";
import { FREQS } from "../constants";
import { money, uid, todayISO, fmtDia } from "../utils/format";
import { cardLabel, clampDay, nextChargeOf, cardTypeLabel } from "../lib/finance";
import { Field, TextInput, Select, Btn, Chip, Amount, Card, SectionTitle, Empty } from "../components/ui";

// Formulario de cargo fijo, para crear (initial vacío) o editar (initial = cargo existente)
function FijoForm({ data, initial, onSave, onCancel }) {
  const C = useTheme();
  const { accounts, cards, categories } = data;
  const initCard = initial ? cards.find((c) => c.id === initial.cardId) : null;
  const [title, setTitle] = useState(initial ? (initial.title || initial.description || "") : "");
  const [description, setDescription] = useState(initial && initial.title ? (initial.description || "") : "");
  const [amount, setAmount] = useState(initial ? String(initial.amount) : "");
  const [accountId, setAccountId] = useState(initCard ? initCard.accountId : "");
  const [cardId, setCardId] = useState(initial ? initial.cardId : "");
  const [categoryId, setCategoryId] = useState(initial ? (initial.categoryId || "") : "");
  const [day, setDay] = useState(initial ? String(initial.day) : "");
  const [endDate, setEndDate] = useState(initial?.endDate || "");
  const [error, setError] = useState("");
  const accCards = cards.filter((c) => c.accountId === accountId);

  const save = () => {
    if (!title.trim()) return setError("Escribe un título (ej. Netflix, Spotify…).");
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) return setError("Escribe un monto mayor a cero.");
    if (!cardId) return setError("Elige la cuenta y tarjeta donde se cobra.");
    if (!categoryId) return setError("Elige una categoría.");
    const d = clampDay(day);
    if (!d) return setError("Escribe el día de cobro (1–31).");
    onSave({
      title: title.trim(),
      description: description.trim(),
      amount: amt,
      cardId,
      categoryId,
      day: d,
      endDate: endDate || null,
    });
  };

  return (
    <Card style={initial ? { borderColor: C.accent } : undefined}>
      {initial && (
        <div className="flex items-center justify-between mb-3">
          <Chip color={C.accent} bg={C.accentSoft}>Editando cargo fijo</Chip>
          <Btn kind="ghost" onClick={onCancel} style={{ padding: "4px 10px" }}>Cancelar</Btn>
        </div>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field label="Título">
          <TextInput value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ej. Netflix, Spotify, gimnasio…" />
        </Field>
        <Field label="Descripción (opcional)">
          <TextInput value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Detalles extra" />
        </Field>
        <Field label="Monto mensual (MXN)">
          <TextInput type="number" min="0" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" />
        </Field>
        <Field label="Día de cobro (1–31)">
          <TextInput type="number" min="1" max="31" value={day} onChange={(e) => setDay(e.target.value)} placeholder="Ej. 16" />
        </Field>
        <Field label="Cuenta">
          <Select value={accountId} onChange={(e) => { setAccountId(e.target.value); setCardId(""); }}>
            <option value="">— Elegir cuenta —</option>
            {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}{a.bank ? ` (${a.bank})` : ""}</option>)}
          </Select>
        </Field>
        <Field label="Tarjeta donde se cobra">
          <Select value={cardId} onChange={(e) => setCardId(e.target.value)} disabled={!accountId}>
            <option value="">{accountId ? "— Elegir tarjeta —" : "Primero elige una cuenta"}</option>
            {accCards.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}{c.last4 ? ` ····${c.last4}` : ""} · {cardTypeLabel(c.type)}
              </option>
            ))}
          </Select>
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
        <Field label="Fecha de fin (opcional)">
          <TextInput type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
        </Field>
      </div>
      <p className="text-xs mt-2" style={{ color: C.faint }}>
        El gasto se registra automáticamente cada mes en el día de cobro. Si el mes no tiene ese día, se usa el último día del mes. Con fecha de fin, se deja de cobrar después de esa fecha.
      </p>
      {error && <p className="text-xs mt-3" style={{ color: C.red }}>{error}</p>}
      <div className="mt-4">
        <Btn onClick={save}>{initial ? "Guardar cambios" : "Guardar cargo fijo"}</Btn>
      </div>
    </Card>
  );
}

export default function Fijos({ data, update }) {
  const C = useTheme();
  const { accounts, cards, categories } = data;
  const recurring = data.recurring || [];
  const [show, setShow] = useState(false);
  const [editId, setEditId] = useState(null);

  const cardById = useMemo(() => Object.fromEntries(cards.map((c) => [c.id, c])), [cards]);
  const catById = useMemo(() => Object.fromEntries(categories.map((c) => [c.id, c])), [categories]);

  const activos = recurring.filter((r) => nextChargeOf(r) !== null);
  const totalMensual = activos.reduce((s, r) => s + (Number(r.amount) || 0), 0);

  const addFijo = (fields) => {
    update({ recurring: [...recurring, { id: uid(), createdAt: todayISO(), lastApplied: null, ...fields }] });
    setShow(false);
  };

  const saveFijo = (fields) => {
    update({ recurring: recurring.map((r) => (r.id === editId ? { ...r, ...fields } : r)) });
    setEditId(null);
  };

  const del = (r) => {
    if (!window.confirm("Se dejará de generar este cargo. Los movimientos ya creados se conservan. ¿Eliminar?")) return;
    update({ recurring: recurring.filter((x) => x.id !== r.id) });
  };

  return (
    <div className="space-y-4">
      <SectionTitle right={<Btn onClick={() => setShow((v) => !v)}>{show ? "Cancelar" : "+ Nuevo cargo fijo"}</Btn>}>
        Cargos fijos mensuales
      </SectionTitle>

      {activos.length > 0 && (
        <Card className="flex items-center justify-between">
          <p className="text-xs uppercase tracking-wider" style={{ color: C.muted }}>Total fijo al mes</p>
          <Amount value={totalMensual} sign="-" size="text-xl" />
        </Card>
      )}

      {show && <FijoForm data={data} onSave={addFijo} onCancel={() => setShow(false)} />}

      {recurring.length === 0 && !show ? (
        <Empty>Sin cargos fijos. Agrega tus suscripciones y servicios con "+ Nuevo cargo fijo" y se registrarán solos cada mes.</Empty>
      ) : (
        <div className="space-y-2">
          {recurring.map((r) => {
            if (editId === r.id) {
              return <FijoForm key={r.id} data={data} initial={r} onSave={saveFijo} onCancel={() => setEditId(null)} />;
            }
            const card = cardById[r.cardId];
            const cat = catById[r.categoryId];
            const next = nextChargeOf(r);
            return (
              <Card key={r.id} className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium truncate">{r.title || r.description}</span>
                    {cat && <Chip>{cat.name}</Chip>}
                    <Chip color={C.faint}>Cada día {clampDay(r.day)}</Chip>
                    {r.endDate && <Chip color={C.amber} bg={C.amberSoft}>Hasta {r.endDate}</Chip>}
                    {!next && <Chip color={C.faint}>Finalizado</Chip>}
                  </div>
                  {r.title && r.description && (
                    <p className="text-xs mt-0.5" style={{ color: C.muted }}>{r.description}</p>
                  )}
                  <p className="text-xs mt-1" style={{ color: C.faint }}>
                    {card ? cardLabel(card, accounts) : "Tarjeta eliminada"}
                    {next && <> · próximo cobro: {fmtDia(next)}</>}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Amount value={Number(r.amount) || 0} sign="-" size="text-sm" />
                  <Btn kind="ghost" onClick={() => setEditId(r.id)} style={{ padding: "4px 8px" }}>✎</Btn>
                  <Btn kind="danger" onClick={() => del(r)} style={{ padding: "4px 8px" }}>✕</Btn>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
