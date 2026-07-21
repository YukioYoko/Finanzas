import { Capacitor, registerPlugin } from "@capacitor/core";
import { LocalNotifications } from "@capacitor/local-notifications";
import { clampDay, dateWithDay } from "./finance";

// Plugin nativo propio (android/…/NotificationInboxPlugin.java): lee las
// notificaciones capturadas del celular para convertirlas en movimientos
export const NotificationInbox = registerPlugin("NotificationInbox");

// ---------- Notificaciones de corte y pago (solo en el APK de Android) ----------
// Pide permiso y programa un aviso a las 9:00 del día de corte y del día de pago
// de cada tarjeta de crédito (las próximas 2 fechas de cada una). Se reprograma
// todo en cada arranque y cada vez que cambian las tarjetas.
export async function scheduleCardReminders(cards) {
  if (!Capacitor.isNativePlatform()) return;
  try {
    let perm = await LocalNotifications.checkPermissions();
    if (perm.display === "prompt" || perm.display === "prompt-with-rationale") {
      perm = await LocalNotifications.requestPermissions();
    }
    if (perm.display !== "granted") return;

    const pending = await LocalNotifications.getPending();
    if (pending.notifications.length) await LocalNotifications.cancel(pending);

    const now = new Date();
    const nextDates = (day, count) => {
      const out = [];
      for (let i = 0; out.length < count && i < count + 2; i++) {
        const d = dateWithDay(now.getFullYear(), now.getMonth() + i, day);
        d.setHours(9, 0, 0, 0);
        if (d > now) out.push(d);
      }
      return out;
    };

    const notifications = [];
    let id = 1;
    for (const card of cards) {
      if (card.type !== "credito") continue;
      const label = `${card.name}${card.last4 ? " ····" + card.last4 : ""}`;
      const cutDay = clampDay(card.cutDay);
      const payDay = clampDay(card.payDay);
      for (const at of cutDay ? nextDates(cutDay, 2) : []) {
        notifications.push({
          id: id++,
          title: "Corte de tarjeta",
          body: `Hoy es la fecha de corte de tu tarjeta ${label}.`,
          schedule: { at, allowWhileIdle: true },
        });
      }
      for (const at of payDay ? nextDates(payDay, 2) : []) {
        notifications.push({
          id: id++,
          title: "Pago de tarjeta",
          body: `Hoy es la fecha límite de pago de tu tarjeta ${label}. Abre la app para ver cuánto pagar.`,
          schedule: { at, allowWhileIdle: true },
        });
      }
    }
    if (notifications.length) await LocalNotifications.schedule({ notifications });
  } catch (e) {
    // Sin plugin o sin permiso: la app funciona igual, solo sin recordatorios
  }
}
