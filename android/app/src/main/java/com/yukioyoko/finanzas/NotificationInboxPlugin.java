package com.yukioyoko.finanzas;

import android.content.ComponentName;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.content.pm.ResolveInfo;
import android.provider.Settings;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.File;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

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

    // Activa o desactiva el servicio que escucha notificaciones. Mientras esté
    // desactivado, la app ni siquiera aparece en la lista de "Acceso a notificaciones"
    // del sistema: la función queda totalmente apagada hasta que el usuario la habilite.
    @PluginMethod
    public void setServiceEnabled(PluginCall call) {
        boolean enabled = Boolean.TRUE.equals(call.getBoolean("enabled", false));
        try {
            ComponentName cn = new ComponentName(getContext(), NotificationCaptureService.class);
            int state = enabled
                    ? PackageManager.COMPONENT_ENABLED_STATE_ENABLED
                    : PackageManager.COMPONENT_ENABLED_STATE_DISABLED;
            getContext().getPackageManager()
                    .setComponentEnabledSetting(cn, state, PackageManager.DONT_KILL_APP);
            call.resolve();
        } catch (Exception e) {
            call.reject("No se pudo cambiar el servicio de notificaciones", e);
        }
    }

    // Lista las apps instaladas con ícono de inicio (bancos, etc.) para que el usuario
    // elija de cuáles registrar cargos sin esperar a que llegue una notificación.
    // Usa el intent de launcher (declarado en <queries>), no el permiso restringido
    // QUERY_ALL_PACKAGES.
    @PluginMethod
    public void listInstalledApps(PluginCall call) {
        try {
            PackageManager pm = getContext().getPackageManager();
            Intent main = new Intent(Intent.ACTION_MAIN, null);
            main.addCategory(Intent.CATEGORY_LAUNCHER);
            List<ResolveInfo> resolveInfos = pm.queryIntentActivities(main, 0);
            String self = getContext().getPackageName();
            Set<String> seen = new HashSet<>();
            JSONArray apps = new JSONArray();
            for (ResolveInfo ri : resolveInfos) {
                if (ri.activityInfo == null) continue;
                String pkg = ri.activityInfo.packageName;
                if (pkg == null || pkg.equals(self) || !seen.add(pkg)) continue;
                JSONObject o = new JSONObject();
                o.put("pkg", pkg);
                o.put("label", ri.loadLabel(pm).toString());
                apps.put(o);
            }
            JSObject ret = new JSObject();
            ret.put("apps", apps);
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("No se pudieron listar las apps instaladas", e);
        }
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
