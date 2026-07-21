import { useState } from "react";
import { useTheme } from "../theme";
import { FREQS } from "../constants";
import { uid } from "../utils/format";
import { Field, TextInput, Select, Btn, Card, SectionTitle } from "../components/ui";

export default function Categorias({ data, update }) {
  const C = useTheme();
  const { categories, movements } = data;
  const [name, setName] = useState("");
  const [freq, setFreq] = useState("mensual");
  const [error, setError] = useState("");

  const add = () => {
    if (!name.trim()) return setError("Escribe un nombre para la categoría.");
    if (categories.some((c) => c.name.toLowerCase() === name.trim().toLowerCase())) {
      return setError("Ya existe una categoría con ese nombre.");
    }
    update({ categories: [...categories, { id: uid(), name: name.trim(), freq }] });
    setName(""); setError("");
  };

  const del = (id) => {
    const inUse = movements.some((m) => m.categoryId === id);
    if (inUse && !window.confirm("Hay movimientos con esta categoría; quedarán como 'Sin categoría'. ¿Eliminar?")) return;
    update({ categories: categories.filter((c) => c.id !== id) });
  };

  const setCatFreq = (id, newFreq) =>
    update({ categories: categories.map((c) => (c.id === id ? { ...c, freq: newFreq } : c)) });

  return (
    <div className="space-y-4">
      <SectionTitle>Categorías</SectionTitle>

      <Card>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
          <div className="sm:col-span-2">
            <Field label="Nueva categoría">
              <TextInput value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej. Mascotas, Vacaciones…" />
            </Field>
          </div>
          <Field label="Frecuencia del gasto">
            <Select value={freq} onChange={(e) => setFreq(e.target.value)}>
              {FREQS.map((f) => <option key={f.id} value={f.id}>{f.label}</option>)}
            </Select>
          </Field>
        </div>
        {error && <p className="text-xs mt-2" style={{ color: C.red }}>{error}</p>}
        <div className="mt-3">
          <Btn onClick={add}>Crear categoría</Btn>
        </div>
      </Card>

      {FREQS.map((f) => {
        const list = categories.filter((c) => c.freq === f.id);
        return (
          <div key={f.id}>
            <h3 className="text-xs uppercase tracking-widest mb-2" style={{ color: C.muted }}>{f.label}es</h3>
            {list.length === 0 ? (
              <p className="text-xs mb-2" style={{ color: C.faint }}>Sin categorías de este tipo.</p>
            ) : (
              <div className="space-y-2">
                {list.map((c) => (
                  <Card key={c.id} className="flex items-center justify-between gap-3" style={{ paddingTop: 10, paddingBottom: 10 }}>
                    <span className="text-sm">{c.name}</span>
                    <div className="flex items-center gap-2">
                      <Select value={c.freq} onChange={(e) => setCatFreq(c.id, e.target.value)} style={{ width: "auto", padding: "4px 8px", fontSize: 12 }}>
                        {FREQS.map((fr) => <option key={fr.id} value={fr.id}>{fr.label}</option>)}
                      </Select>
                      <Btn kind="danger" onClick={() => del(c.id)} style={{ padding: "4px 8px" }}>✕</Btn>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
