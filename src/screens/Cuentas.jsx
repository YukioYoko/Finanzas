import { useState } from "react";
import { useTheme } from "../theme";
import { money, uid, todayISO } from "../utils/format";
import { balanceOfCard, clampDay, isDebtType, cardTypeLabel } from "../lib/finance";
import { Field, TextInput, Select, Btn, Chip, Card, SectionTitle, Empty } from "../components/ui";

export default function Cuentas({ data, update }) {
  const C = useTheme();
  const { accounts, cards, movements } = data;
  const [showAccForm, setShowAccForm] = useState(false);
  const [accName, setAccName] = useState("");
  const [accBank, setAccBank] = useState("");
  const [accType, setAccType] = useState("banco");
  const [debtAmount, setDebtAmount] = useState("");
  const [debtRateType, setDebtRateType] = useState("none"); // none | mensual | anual
  const [debtRate, setDebtRate] = useState("");
  const [cardFormFor, setCardFormFor] = useState(null); // accountId
  const [cardName, setCardName] = useState("");
  const [cardType, setCardType] = useState("debito");
  const [cardLast4, setCardLast4] = useState("");
  const [cardDigital4, setCardDigital4] = useState("");
  const [cardRate, setCardRate] = useState("");
  const [cardCutDay, setCardCutDay] = useState("");
  const [cardPayDay, setCardPayDay] = useState("");
  const [editBalFor, setEditBalFor] = useState(null); // cardId
  const [newBal, setNewBal] = useState("");
  const [newRate, setNewRate] = useState("");
  const [newRatePeriod, setNewRatePeriod] = useState("anual");
  const [newCutDay, setNewCutDay] = useState("");
  const [newPayDay, setNewPayDay] = useState("");
  const [newDigital4, setNewDigital4] = useState("");

  const resetCardForm = () => {
    setCardName(""); setCardType("debito"); setCardLast4(""); setCardDigital4("");
    setCardRate(""); setCardCutDay(""); setCardPayDay("");
  };

  const addAccount = () => {
    if (!accName.trim()) return;
    const account = { id: uid(), name: accName.trim(), bank: accType === "banco" ? accBank.trim() : "", type: accType };
    const patch = { accounts: [...accounts, account] };
    if (accType === "efectivo") {
      // Una cuenta de efectivo trae su propia "cartera" para registrar movimientos
      patch.cards = [...cards, { id: uid(), accountId: account.id, name: "Efectivo", type: "efectivo", last4: "" }];
    }
    if (accType === "deuda") {
      // Una deuda trae una única "tarjeta" que lleva el monto; los pagos la reducen
      const card = { id: uid(), accountId: account.id, name: "Deuda", type: "deuda", last4: "", lastAccrual: todayISO() };
      if (debtRateType !== "none") {
        card.rate = parseFloat(debtRate) || 0;
        card.ratePeriod = debtRateType;
      }
      patch.cards = [...cards, card];
      const amount = parseFloat(debtAmount);
      if (amount > 0) {
        // Monto inicial como ajuste: cuenta en la deuda pero no como gasto del mes
        patch.movements = [{
          id: uid(),
          cardId: card.id,
          type: "gasto",
          amount,
          title: "Deuda inicial",
          categoryId: null,
          date: todayISO(),
          months: 1,
          commission: 0,
          adjust: true,
        }, ...movements];
      }
    }
    update(patch);
    setAccName(""); setAccBank(""); setAccType("banco");
    setDebtAmount(""); setDebtRateType("none"); setDebtRate("");
    setShowAccForm(false);
  };

  const toggleAccountCount = (id) =>
    update({ accounts: accounts.map((a) => (a.id === id ? { ...a, excluded: !a.excluded } : a)) });

  const toggleCardCount = (id) =>
    update({ cards: cards.map((c) => (c.id === id ? { ...c, excluded: !c.excluded } : c)) });

  const deleteAccount = (id) => {
    const accCards = cards.filter((c) => c.accountId === id).map((c) => c.id);
    if (!window.confirm("Se eliminará la cuenta, sus tarjetas y todos sus movimientos. ¿Continuar?")) return;
    update({
      accounts: accounts.filter((a) => a.id !== id),
      cards: cards.filter((c) => c.accountId !== id),
      movements: movements.filter((m) => !accCards.includes(m.cardId)),
    });
  };

  const addCard = (accountId) => {
    if (!cardName.trim()) return;
    const card = {
      id: uid(),
      accountId,
      name: cardName.trim(),
      type: cardType,
      last4: cardLast4.trim().slice(-4),
    };
    if (cardType === "ahorro") {
      card.rate = parseFloat(cardRate) || 0;
      card.lastAccrual = todayISO();
    }
    if (cardType === "credito") {
      card.cutDay = clampDay(cardCutDay);
      card.payDay = clampDay(cardPayDay);
    }
    if (cardType !== "ahorro" && cardDigital4) {
      card.digitalLast4 = cardDigital4;
    }
    update({ cards: [...cards, card] });
    resetCardForm();
    setCardFormFor(null);
  };

  const deleteCard = (id) => {
    if (!window.confirm("Se eliminará la tarjeta y todos sus movimientos. ¿Continuar?")) return;
    update({ cards: cards.filter((c) => c.id !== id), movements: movements.filter((m) => m.cardId !== id) });
  };

  const openBalanceEditor = (card) => {
    if (editBalFor === card.id) { setEditBalFor(null); return; }
    setEditBalFor(card.id);
    setNewBal(balanceOfCard(card, movements).toFixed(2));
    setNewRate(card.rate != null ? String(card.rate) : "");
    setNewRatePeriod(card.ratePeriod === "mensual" ? "mensual" : "anual");
    setNewCutDay(clampDay(card.cutDay) ? String(card.cutDay) : "");
    setNewPayDay(clampDay(card.payDay) ? String(card.payDay) : "");
    setNewDigital4(card.digitalLast4 || "");
  };

  const saveBalance = (card) => {
    const target = parseFloat(newBal);
    const patch = {};
    const cardPatch = {};
    // Actualizar tasa si es caja de ahorro
    if (card.type === "ahorro") {
      const r = parseFloat(newRate) || 0;
      if (r !== Number(card.rate)) cardPatch.rate = r;
    }
    // Actualizar días de corte y pago si es crédito
    if (card.type === "credito") {
      const cd = clampDay(newCutDay), pd = clampDay(newPayDay);
      if (cd !== clampDay(card.cutDay)) cardPatch.cutDay = cd;
      if (pd !== clampDay(card.payDay)) cardPatch.payDay = pd;
    }
    // Actualizar interés si es deuda
    if (card.type === "deuda") {
      const r = parseFloat(newRate) || 0;
      if (r !== (Number(card.rate) || 0)) cardPatch.rate = r;
      if (newRatePeriod !== (card.ratePeriod === "mensual" ? "mensual" : "anual")) cardPatch.ratePeriod = newRatePeriod;
    }
    // Tarjeta digital asociada (débito y crédito)
    if (card.type === "debito" || card.type === "credito") {
      if (newDigital4 !== (card.digitalLast4 || "")) cardPatch.digitalLast4 = newDigital4;
    }
    if (Object.keys(cardPatch).length) {
      patch.cards = cards.map((c) => (c.id === card.id ? { ...c, ...cardPatch } : c));
    }
    // Ajustar saldo con un movimiento de ajuste (mantiene el historial cuadrado)
    if (!isNaN(target)) {
      const current = balanceOfCard(card, movements);
      const diff = Math.round((target - current) * 100) / 100;
      if (Math.abs(diff) >= 0.01) {
        const type = isDebtType(card.type)
          ? (diff > 0 ? "gasto" : "ingreso")   // subir deuda = gasto, bajarla = pago
          : (diff > 0 ? "ingreso" : "gasto");  // subir saldo = ingreso, bajarlo = gasto
        patch.movements = [{
          id: uid(),
          cardId: card.id,
          type,
          amount: Math.abs(diff),
          title: `Ajuste de saldo (${money(current)} → ${money(target)})`,
          categoryId: null,
          date: todayISO(),
          months: 1,
          commission: 0,
          adjust: true,
        }, ...movements];
      }
    }
    if (Object.keys(patch).length) update(patch);
    setEditBalFor(null);
  };

  return (
    <div className="space-y-4">
      <SectionTitle right={<Btn onClick={() => setShowAccForm((v) => !v)}>{showAccForm ? "Cancelar" : "+ Nueva cuenta"}</Btn>}>
        Tus cuentas
      </SectionTitle>

      {showAccForm && (
        <Card>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Field label="Tipo de cuenta">
              <Select value={accType} onChange={(e) => setAccType(e.target.value)}>
                <option value="banco">Cuenta bancaria</option>
                <option value="efectivo">Efectivo</option>
                <option value="deuda">Deuda</option>
              </Select>
            </Field>
            <Field label={accType === "deuda" ? "Título de la deuda" : "Nombre de la cuenta"}>
              <TextInput
                value={accName}
                onChange={(e) => setAccName(e.target.value)}
                placeholder={accType === "efectivo" ? "Ej. Cartera, Guardadito…" : accType === "deuda" ? "Ej. Préstamo del coche, Le debo a Juan…" : "Ej. Cuenta principal"}
              />
            </Field>
            {accType === "banco" && (
              <Field label="Banco (opcional)">
                <TextInput value={accBank} onChange={(e) => setAccBank(e.target.value)} placeholder="Ej. BBVA, Banorte…" />
              </Field>
            )}
            {accType === "deuda" && (
              <>
                <Field label="Monto de la deuda (MXN)">
                  <TextInput type="number" min="0" step="0.01" value={debtAmount} onChange={(e) => setDebtAmount(e.target.value)} placeholder="0.00" />
                </Field>
                <Field label="Interés">
                  <Select value={debtRateType} onChange={(e) => setDebtRateType(e.target.value)}>
                    <option value="none">Sin interés</option>
                    <option value="mensual">Porcentaje mensual</option>
                    <option value="anual">Porcentaje anual</option>
                  </Select>
                </Field>
                {debtRateType !== "none" && (
                  <Field label={`Tasa ${debtRateType} (%)`}>
                    <TextInput type="number" min="0" step="0.01" value={debtRate} onChange={(e) => setDebtRate(e.target.value)} placeholder="Ej. 3" />
                  </Field>
                )}
              </>
            )}
          </div>
          {accType === "efectivo" && (
            <p className="text-xs mt-2" style={{ color: C.faint }}>
              Las cuentas de efectivo no llevan tarjetas: se crea una cartera única donde registras entradas y salidas de dinero.
            </p>
          )}
          {accType === "deuda" && (
            <p className="text-xs mt-2" style={{ color: C.faint }}>
              La deuda se descuenta de tu balance total. Con interés, crece automáticamente cada día (compuesto). Para abonarle, hazle una transferencia desde otra cuenta o regístrale un ingreso.
            </p>
          )}
          <div className="mt-3">
            <Btn onClick={addAccount}>Guardar cuenta</Btn>
          </div>
        </Card>
      )}

      {accounts.length === 0 && !showAccForm && (
        <Empty>Aún no tienes cuentas. Crea la primera con "+ Nueva cuenta" y después agrégale tarjetas de débito o crédito.</Empty>
      )}

      {accounts.map((acc) => {
        const accCards = cards.filter((c) => c.accountId === acc.id);
        const isCash = acc.type === "efectivo";
        const isDebtAcc = acc.type === "deuda";
        // Balance de la cuenta: saldos disponibles menos lo que se debe (crédito y deudas)
        const accBalance = accCards.reduce(
          (s, c) => s + (isDebtType(c.type) ? -balanceOfCard(c, movements) : balanceOfCard(c, movements)),
          0
        );
        const hasDebt = accCards.some((c) => isDebtType(c.type));
        return (
          <Card key={acc.id} style={acc.excluded ? { opacity: 0.55 } : {}}>
            <div className="flex items-start justify-between gap-3 mb-1">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="font-medium">{acc.name}</h3>
                  {isCash && <Chip color={C.green} bg={C.accentSoft}>Efectivo</Chip>}
                  {isDebtAcc && <Chip color={C.red}>Deuda</Chip>}
                  {acc.excluded && <Chip color={C.faint}>Fuera de la contabilización</Chip>}
                </div>
                {acc.bank && <p className="text-xs" style={{ color: C.faint }}>{acc.bank}</p>}
              </div>
              <div className="text-right shrink-0">
                {isDebtAcc ? (
                  <>
                    <p className="text-xs" style={{ color: C.faint }}>Debes</p>
                    <span className="font-mono text-lg" style={{ color: -accBalance > 0 ? C.red : C.green, fontVariantNumeric: "tabular-nums" }}>
                      {money(-accBalance)}
                    </span>
                  </>
                ) : (
                  <>
                    <p className="text-xs" style={{ color: C.faint }}>Balance{hasDebt ? " (menos crédito)" : ""}</p>
                    <span className="font-mono text-lg" style={{ color: accBalance < 0 ? C.red : C.text, fontVariantNumeric: "tabular-nums" }}>
                      {money(accBalance)}
                    </span>
                  </>
                )}
              </div>
            </div>
            <div className="flex gap-2 flex-wrap mb-3">
              <Btn kind="ghost" onClick={() => toggleAccountCount(acc.id)}>
                {acc.excluded ? "Contabilizar" : "No contabilizar"}
              </Btn>
              {!isCash && !isDebtAcc && (
                <Btn kind="ghost" onClick={() => { setCardFormFor(cardFormFor === acc.id ? null : acc.id); resetCardForm(); }}>
                  {cardFormFor === acc.id ? "Cancelar" : "+ Tarjeta"}
                </Btn>
              )}
              <Btn kind="danger" onClick={() => deleteAccount(acc.id)}>Eliminar</Btn>
            </div>

            {cardFormFor === acc.id && (
              <div className="rounded-lg p-3 mb-3" style={{ background: C.surface2, border: `1px solid ${C.border}` }}>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Field label={cardType === "ahorro" ? "Nombre de la caja" : "Nombre de la tarjeta"}>
                    <TextInput value={cardName} onChange={(e) => setCardName(e.target.value)} placeholder={cardType === "ahorro" ? "Ej. Ahorro emergencias" : "Ej. Oro, Nómina…"} />
                  </Field>
                  <Field label="Tipo">
                    <Select value={cardType} onChange={(e) => setCardType(e.target.value)}>
                      <option value="debito">Tarjeta de débito</option>
                      <option value="credito">Tarjeta de crédito</option>
                      <option value="ahorro">Caja de ahorro</option>
                    </Select>
                  </Field>
                  {cardType === "ahorro" ? (
                    <Field label="Rendimiento anual (%)">
                      <TextInput type="number" min="0" step="0.01" value={cardRate} onChange={(e) => setCardRate(e.target.value)} placeholder="Ej. 10" />
                    </Field>
                  ) : (
                    <Field label="Últimos 4 dígitos (opcional)">
                      <TextInput value={cardLast4} onChange={(e) => setCardLast4(e.target.value.replace(/\D/g, "").slice(0, 4))} placeholder="1234" />
                    </Field>
                  )}
                  {cardType !== "ahorro" && (
                    <Field label="Tarjeta digital (últimos 4, opcional)">
                      <TextInput value={cardDigital4} onChange={(e) => setCardDigital4(e.target.value.replace(/\D/g, "").slice(0, 4))} placeholder="5678" />
                    </Field>
                  )}
                  {cardType === "credito" && (
                    <>
                      <Field label="Día de corte (1–31)">
                        <TextInput type="number" min="1" max="31" value={cardCutDay} onChange={(e) => setCardCutDay(e.target.value)} placeholder="Ej. 15" />
                      </Field>
                      <Field label="Día límite de pago (1–31)">
                        <TextInput type="number" min="1" max="31" value={cardPayDay} onChange={(e) => setCardPayDay(e.target.value)} placeholder="Ej. 5" />
                      </Field>
                    </>
                  )}
                </div>
                {cardType !== "ahorro" && (
                  <p className="text-xs mt-2" style={{ color: C.faint }}>
                    Si tu banco te dio una tarjeta digital con otra terminación, agrégala: los cargos hechos con ella se asignarán a esta misma tarjeta y cuenta.
                  </p>
                )}
                {cardType === "ahorro" && (
                  <p className="text-xs mt-2" style={{ color: C.faint }}>
                    Los rendimientos se abonan automáticamente cada día con interés compuesto según el porcentaje.
                  </p>
                )}
                {cardType === "credito" && (
                  <p className="text-xs mt-2" style={{ color: C.faint }}>
                    Con el día de corte y el de pago, el Resumen calcula cuánto gastas por periodo y cuánto debes pagar cada mes. En el celular además recibirás una notificación en cada fecha.
                  </p>
                )}
                <div className="mt-3">
                  <Btn onClick={() => addCard(acc.id)}>Guardar tarjeta</Btn>
                </div>
              </div>
            )}

            {accCards.length === 0 ? (
              <p className="text-xs" style={{ color: C.faint }}>Sin tarjetas. Agrega una de débito o crédito.</p>
            ) : (
              <ul className="space-y-2">
                {accCards.map((card) => {
                  const bal = balanceOfCard(card, movements);
                  const isCredit = card.type === "credito";
                  const isSavings = card.type === "ahorro";
                  const isCashCard = card.type === "efectivo";
                  const isDebtCard = card.type === "deuda";
                  const typeLabel = isDebtCard ? "Deuda" : isCredit ? "Crédito" : isSavings ? "Ahorro" : isCashCard ? "Efectivo" : "Débito";
                  const typeColor = isDebtCard ? C.red : isCredit ? C.amber : isSavings ? C.accent : isCashCard ? C.green : C.blue;
                  const balLabel = isDebtCard ? "Debes" : isCredit ? "Deuda" : isSavings ? "Ahorro" : isCashCard ? "Efectivo" : "Saldo";
                  const detalles = [
                    isSavings && `${Number(card.rate) || 0}% anual`,
                    isDebtCard && (Number(card.rate) > 0
                      ? `Interés ${card.rate}% ${card.ratePeriod === "mensual" ? "mensual" : "anual"} · crece a diario`
                      : "Sin interés"),
                    isCredit && clampDay(card.cutDay) && `Corte día ${card.cutDay}${clampDay(card.payDay) ? ` · Pago día ${card.payDay}` : ""}`,
                    card.digitalLast4 && `Digital ····${card.digitalLast4}`,
                    card.excluded && "No contabilizada",
                  ].filter(Boolean).join(" · ");
                  return (
                    <li key={card.id} className="rounded-lg px-3 py-3" style={{ background: C.bg, border: `1px solid ${C.borderSoft}`, opacity: card.excluded ? 0.55 : 1 }}>
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <Chip color={typeColor} bg={isSavings || isCashCard ? C.accentSoft : undefined}>{typeLabel}</Chip>
                            <span className="text-sm font-medium truncate">{card.name}</span>
                            {card.last4 && <span className="text-xs" style={{ color: C.faint }}>····{card.last4}</span>}
                          </div>
                          {detalles && <p className="text-xs mt-1" style={{ color: C.faint }}>{detalles}</p>}
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-xs" style={{ color: C.faint }}>{balLabel}</p>
                          <span className="font-mono text-base" style={{ color: isDebtType(card.type) ? (bal > 0 ? C.red : C.green) : (bal < 0 ? C.red : C.green), fontVariantNumeric: "tabular-nums" }}>
                            {money(bal)}
                          </span>
                        </div>
                      </div>
                      <div className="flex gap-2 mt-2 justify-end flex-wrap">
                        <Btn kind="ghost" onClick={() => toggleCardCount(card.id)} style={{ padding: "4px 10px" }} title={card.excluded ? "Volver a contabilizar" : "Excluir de la contabilización"}>
                          {card.excluded ? "Contar" : "No contar"}
                        </Btn>
                        <Btn kind="ghost" onClick={() => openBalanceEditor(card)} style={{ padding: "4px 10px" }}>
                          {editBalFor === card.id ? "Cancelar" : "✎ Editar"}
                        </Btn>
                        {!isCashCard && !isDebtCard && (
                          <Btn kind="danger" onClick={() => deleteCard(card.id)} style={{ padding: "4px 10px" }}>✕</Btn>
                        )}
                      </div>

                      {editBalFor === card.id && (
                        <div className="mt-3 rounded-lg p-3" style={{ background: C.surface2, border: `1px solid ${C.border}` }}>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <Field label={isDebtType(card.type) ? "Nueva deuda (MXN)" : "Nuevo saldo (MXN)"}>
                              <TextInput type="number" step="0.01" value={newBal} onChange={(e) => setNewBal(e.target.value)} />
                            </Field>
                            {isSavings && (
                              <Field label="Rendimiento anual (%)">
                                <TextInput type="number" min="0" step="0.01" value={newRate} onChange={(e) => setNewRate(e.target.value)} />
                              </Field>
                            )}
                            {isDebtCard && (
                              <>
                                <Field label="Tasa de interés (%)">
                                  <TextInput type="number" min="0" step="0.01" value={newRate} onChange={(e) => setNewRate(e.target.value)} placeholder="0 = sin interés" />
                                </Field>
                                <Field label="Periodo de la tasa">
                                  <Select value={newRatePeriod} onChange={(e) => setNewRatePeriod(e.target.value)}>
                                    <option value="mensual">Mensual</option>
                                    <option value="anual">Anual</option>
                                  </Select>
                                </Field>
                              </>
                            )}
                            {isCredit && (
                              <>
                                <Field label="Día de corte (1–31)">
                                  <TextInput type="number" min="1" max="31" value={newCutDay} onChange={(e) => setNewCutDay(e.target.value)} placeholder="Ej. 15" />
                                </Field>
                                <Field label="Día límite de pago (1–31)">
                                  <TextInput type="number" min="1" max="31" value={newPayDay} onChange={(e) => setNewPayDay(e.target.value)} placeholder="Ej. 5" />
                                </Field>
                              </>
                            )}
                            {!isSavings && !isCashCard && (
                              <Field label="Tarjeta digital (últimos 4, opcional)">
                                <TextInput value={newDigital4} onChange={(e) => setNewDigital4(e.target.value.replace(/\D/g, "").slice(0, 4))} placeholder="5678" />
                              </Field>
                            )}
                          </div>
                          <p className="text-xs mt-2" style={{ color: C.faint }}>
                            La diferencia se registra como un movimiento de "Ajuste de saldo" para que el historial siga cuadrando.
                          </p>
                          <div className="mt-3">
                            <Btn onClick={() => saveBalance(card)}>Aplicar</Btn>
                          </div>
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>
        );
      })}
    </div>
  );
}
