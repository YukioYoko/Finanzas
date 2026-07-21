package com.yukioyoko.finanzas;

import android.content.Intent;
import android.provider.Settings;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import org.json.JSONArray;

import java.io.File;

/**
 * Puente JS <-> nativo para la bandeja de notificaciones capturadas:
 * - isEnabled(): si el usuario ya concedió "Acceso a notificaciones"
 * - openSettings(): abre la pantalla del sistema para concederlo
 * - drain(): devuelve las notificaciones capturadas y vacía el archivo
 */
@CapacitorPlugin(name = "NotificationInbox")
public class NotificationInboxPlugin extends Plugin {

    @PluginMethod
    public void isEnabled(PluginCall call) {
        String enabled = Settings.Secure.getString(
                getContext().getContentResolver(), "enabled_notification_listeners");
        boolean on = enabled != null && enabled.contains(getContext().getPackageName());
        JSObject ret = new JSObject();
        ret.put("enabled", on);
        call.resolve(ret);
    }

    @PluginMethod
    public void openSettings(PluginCall call) {
        Intent intent = new Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS);
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        getContext().startActivity(intent);
        call.resolve();
    }

    @PluginMethod
    public void drain(PluginCall call) {
        synchronized (NotificationCaptureService.LOCK) {
            File f = new File(getContext().getFilesDir(), NotificationCaptureService.FILE_NAME);
            JSONArray arr = NotificationCaptureService.read(f);
            //noinspection ResultOfMethodCallIgnored
            f.delete();
            JSObject ret = new JSObject();
            ret.put("items", arr);
            call.resolve(ret);
        }
    }
}
