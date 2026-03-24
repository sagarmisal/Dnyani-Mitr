package org.sewasankalp.ngomitr;

import android.content.Context;
import android.os.Bundle;
import android.webkit.WebSettings;
import android.webkit.WebView;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
    }

    @Override
    public void onResume() {
        super.onResume();
        configureWebView();
    }

    @Override
    protected void onPause() {
        super.onPause();
        WebView webView = getBridge().getWebView();
        if (webView != null) {
            webView.onPause();
        }
    }

    /**
     * Handle hardware back button — MIUI/ColorOS override default Capacitor behavior.
     * If WebView can go back in history, navigate back. Otherwise, let system handle it.
     */
    @Override
    public void onBackPressed() {
        WebView webView = getBridge().getWebView();
        if (webView != null && webView.canGoBack()) {
            webView.goBack();
        } else {
            super.onBackPressed();
        }
    }

    private void configureWebView() {
        WebView webView = getBridge().getWebView();
        if (webView == null) return;

        webView.onResume();
        WebSettings settings = webView.getSettings();

        // Enable DOM storage (required for localStorage)
        settings.setDomStorageEnabled(true);

        // Enable file access for JSON import
        settings.setAllowFileAccess(true);
        settings.setAllowContentAccess(true);

        // Enable JavaScript (should already be on, but enforce it)
        settings.setJavaScriptEnabled(true);

        // Mixed content mode for OEM WebViews that may block it
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_ALWAYS_ALLOW);

        // Database and storage
        settings.setDatabaseEnabled(true);

        // Set explicit storage path for DOM/localStorage persistence
        String storagePath = getDir("dom_storage", Context.MODE_PRIVATE).getAbsolutePath();
        settings.setDatabasePath(storagePath);

        // Improve rendering on all devices
        settings.setCacheMode(WebSettings.LOAD_DEFAULT);
        settings.setMediaPlaybackRequiresUserGesture(false);

        // MIUI/Oppo/Xiaomi specific: Allow broader file access for WebView
        settings.setAllowFileAccessFromFileURLs(true);
        settings.setAllowUniversalAccessFromFileURLs(true);
    }
}
