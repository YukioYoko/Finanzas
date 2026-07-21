package com.yukioyoko.finanzas;

import android.app.Notification;
import android.os.Bundle;
import android.service.notification.NotificationListenerService;
import android.service.notification.StatusBarNotification;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.nio.charset.StandardCharsets;
import java.util.regex.Pattern;

/**
 * Escucha las notificaciones del sistema (requiere que el usuario conceda
 * "Acceso a notificaciones" en Ajustes) y guarda en un archivo local las que
 * contienen un monto de dinero, para que la app las convierta en movimientos
 * pendientes de confirmar. Nada sale del dispositivo.
 */
public class NotificationCaptureService extends NotificationListenerService {

    private static final Pattern MONEY = Pattern.compile("\\$\\s?\\d[\\d,]*(?:\\.\\d{1,2})?");
    static final String FILE_NAME = "captured_notifications.json";
    static final Object LOCK = new Object();
    private static final int MAX_ITEMS = 100;

    @Override
    public void onNotificationPosted(StatusBarNotification sbn) {
        try {
            if (sbn.getPackageName().equals(getPackageName())) return;
            Notification n = sbn.getNotification();
            if (n == null || n.extras == null) return;
            Bundle extras = n.extras;
            String title = str(extras.getCharSequence(Notification.EXTRA_TITLE));
            String text = str(extras.getCharSequence(Notification.EXTRA_TEXT));
            String big = str(extras.getCharSequence(Notification.EXTRA_BIG_TEXT));
            String body = big.isEmpty() ? text : big;
            String full = (title + " " + body).trim();
            if (!MONEY.matcher(full).find()) return;

            JSONObject item = new JSONObject();
            item.put("id", sbn.getPackageName() + ":" + sbn.getPostTime());
            item.put("app", sbn.getPackageName());
            item.put("title", title);
            item.put("text", body);
            item.put("time", sbn.getPostTime());
            append(item);
        } catch (Exception ignored) {
            // Nunca tirar el servicio por una notificación rara
        }
    }

    private static String str(CharSequence cs) {
        return cs == null ? "" : cs.toString();
    }

    private void append(JSONObject item) throws Exception {
        synchronized (LOCK) {
            File f = new File(getFilesDir(), FILE_NAME);
            JSONArray arr = read(f);
            for (int i = 0; i < arr.length(); i++) {
                if (item.getString("id").equals(arr.getJSONObject(i).optString("id"))) return;
            }
            arr.put(item);
            while (arr.length() > MAX_ITEMS) arr.remove(0);
            try (FileOutputStream out = new FileOutputStream(f)) {
                out.write(arr.toString().getBytes(StandardCharsets.UTF_8));
            }
        }
    }

    static JSONArray read(File f) {
        try {
            if (!f.exists()) return new JSONArray();
            byte[] buf = new byte[(int) f.length()];
            try (FileInputStream in = new FileInputStream(f)) {
                int off = 0;
                while (off < buf.length) {
                    int r = in.read(buf, off, buf.length - off);
                    if (r < 0) break;
                    off += r;
                }
            }
            return new JSONArray(new String(buf, StandardCharsets.UTF_8));
        } catch (Exception e) {
            return new JSONArray();
        }
    }
}
