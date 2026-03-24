package org.sewasankalp.ngomitr;

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

        // Configure WebView for broader device compatibility (MI, Oppo, Xiaomi, etc.)
        WebView webView = getBridge().getWebView();
        if (webView != null) {
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

            // Improve rendering on all devices
            settings.setCacheMode(WebSettings.LOAD_DEFAULT);
            settings.setMediaPlaybackRequiresUserGesture(false);
        }
    }
}
