package org.sewasankalp.ngomitr;

import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.webkit.WebSettings;
import android.webkit.WebView;

import com.getcapacitor.BridgeActivity;

import java.io.BufferedReader;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;

import org.json.JSONObject;

public class MainActivity extends BridgeActivity {

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        registerPlugin(SmsPlugin.class);
        super.onCreate(savedInstanceState);

        // F3: the app may have been LAUNCHED by tapping a backup in WhatsApp.
        handleIncomingFile(getIntent());
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        // F3: or it may already have been running (launchMode is singleTask).
        handleIncomingFile(intent);
    }

    /**
     * F3 — receive a backup by tapping it in WhatsApp.
     *
     * Before this, importing meant finding the file in a picker, which on
     * MIUI/ColorOS means navigating scoped storage to a folder WhatsApp does not
     * advertise. Tapping the attachment and choosing this app removes that whole
     * problem. The content is read here and handed to the web layer, because the
     * WebView cannot read a content:// URI granted to the Activity.
     */
    private void handleIncomingFile(Intent intent) {
        if (intent == null) return;

        final Uri uri = extractUri(intent);
        if (uri == null) return;

        new Thread(() -> {
            final String content = readUri(uri);
            if (content == null || content.trim().isEmpty()) return;

            final String name = uri.getLastPathSegment() == null ? "shared-file.json" : uri.getLastPathSegment();
            runOnUiThread(() -> deliverToWebLayer(content, name));
        }).start();
    }

    private Uri extractUri(Intent intent) {
        final String action = intent.getAction();
        if (Intent.ACTION_VIEW.equals(action)) {
            return intent.getData();
        }
        if (Intent.ACTION_SEND.equals(action)) {
            return intent.getParcelableExtra(Intent.EXTRA_STREAM);
        }
        return null;
    }

    private String readUri(Uri uri) {
        try (InputStream in = getContentResolver().openInputStream(uri)) {
            if (in == null) return null;
            final StringBuilder sb = new StringBuilder();
            final BufferedReader reader = new BufferedReader(new InputStreamReader(in, StandardCharsets.UTF_8));
            String line;
            // Backups are a few hundred KB at most; refuse anything absurd rather
            // than letting a bad file exhaust memory on a low-end phone.
            int total = 0;
            while ((line = reader.readLine()) != null) {
                total += line.length();
                if (total > 20_000_000) return null;
                sb.append(line).append('\n');
            }
            return sb.toString();
        } catch (Exception e) {
            return null;
        }
    }

    private void deliverToWebLayer(String content, String name) {
        final WebView webView = getBridge() == null ? null : getBridge().getWebView();
        if (webView == null) return;

        try {
            // JSONObject.quote handles every escaping case correctly, including
            // the Devanagari and newlines a real backup is full of.
            final JSONObject payload = new JSONObject();
            payload.put("content", content);
            payload.put("name", name);

            final String js =
                "(function(){try{"
              + "var d=" + payload.toString() + ";"
              // Park it for a web layer that has not subscribed yet — a file that
              // LAUNCHED the app always arrives before any listener exists.
              + "window.__dnyaniMitrPendingFile=d;"
              + "window.dispatchEvent(new CustomEvent('dnyanimitr:file',{detail:d}));"
              + "}catch(e){console.error('file delivery failed',e);}})();";

            webView.evaluateJavascript(js, null);
        } catch (Exception e) {
            // Never crash the app over a malformed shared file.
        }
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

            // F4: belt-and-braces for any anchor download that still reaches the
            // WebView. Without a DownloadListener these are SILENT no-ops, which
            // is how the app came to report backups it had never written. The
            // real export path is FileService (Filesystem + Share); this only
            // ensures nothing fails invisibly.
            webView.setDownloadListener((url, userAgent, contentDisposition, mimeType, contentLength) -> {
                try {
                    if (url != null && url.startsWith("blob:")) {
                        // DownloadManager cannot fetch a blob: URL. Say so loudly
                        // in the log rather than appearing to succeed.
                        android.util.Log.w("DnyaniMitr", "Blob download ignored; use the share sheet instead.");
                        return;
                    }
                    final Intent view = new Intent(Intent.ACTION_VIEW, Uri.parse(url));
                    view.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                    startActivity(view);
                } catch (Exception e) {
                    android.util.Log.w("DnyaniMitr", "Download could not be handled: " + e.getMessage());
                }
            });
        }
    }
}
