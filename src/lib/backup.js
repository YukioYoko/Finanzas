import { Capacitor } from "@capacitor/core";
import { Filesystem, Directory, Encoding } from "@capacitor/filesystem";
import { Share } from "@capacitor/share";

// Nombre del respaldo con fecha y hora, p. ej. "respaldo-mis-finanzas-2026-08-11_14-30-05.json".
// Se usan guiones en la hora porque ":" no es válido en nombres de archivo.
function backupFilename() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, "0");
  const fecha = `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
  const hora = `${p(d.getHours())}-${p(d.getMinutes())}-${p(d.getSeconds())}`;
  return `respaldo-mis-finanzas-${fecha}_${hora}.json`;
}

// Exporta todo el estado a un archivo JSON.
// - Android: lo escribe y abre el menú de compartir, donde puedes guardarlo donde
//   quieras (Archivos, Drive…) o enviarlo por otros medios (correo, WhatsApp…).
// - Web: descarga el archivo directamente.
export async function exportData(data) {
  const json = JSON.stringify(data, null, 2);
  const filename = backupFilename();

  if (Capacitor.isNativePlatform()) {
    const res = await Filesystem.writeFile({
      path: filename,
      data: json,
      directory: Directory.Cache,
      encoding: Encoding.UTF8,
    });
    await Share.share({
      title: "Respaldo de Mis Finanzas",
      text: "Guarda este archivo para restaurar tus datos cuando lo necesites.",
      url: res.uri,
      dialogTitle: "Guardar o compartir tu respaldo",
    });
  } else {
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }
}

// Valida que un objeto parseado tenga la forma mínima de un respaldo de la app
export function isValidBackup(obj) {
  return !!obj && typeof obj === "object"
    && Array.isArray(obj.accounts)
    && Array.isArray(obj.cards)
    && Array.isArray(obj.movements);
}
