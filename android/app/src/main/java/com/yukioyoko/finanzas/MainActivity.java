package com.yukioyoko.finanzas;

import android.os.Bundle;
import android.webkit.WebSettings;
import android.webkit.WebView;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(NotificationInboxPlugin.class);
        super.onCreate(savedInstanceState);
        applyWebViewSettings();
    }

    // Desactiva el zoom por gestos y adapta el tamaño de letra al del sistema,
    // pero acotado (85–105 %) para que un tamaño de fuente muy grande no desborde
    // la interfaz. Al cambiar la fuente del sistema, Android recrea la actividad
    // (fontScale no está en configChanges), así que este ajuste se vuelve a aplicar.
    private void applyWebViewSettings() {
        try {
            WebView webView = getBridge().getWebView();
            if (webView == null) return;
            WebSettings settings = webView.getSettings();
            settings.setSupportZoom(false);
            settings.setBuiltInZoomControls(false);
            settings.setDisplayZoomControls(false);

            float fontScale = getResources().getConfiguration().fontScale;
            int zoom = Math.round(fontScale * 100f);
            if (zoom < 85) zoom = 85;
            if (zoom > 105) zoom = 105;
            settings.setTextZoom(zoom);
        } catch (Exception ignored) {
            // Si algo falla, la app funciona con los ajustes por defecto del WebView
        }
    }
}
