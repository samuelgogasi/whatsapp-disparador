package br.com.empauta.disparador;

import androidx.activity.ComponentActivity;
import androidx.activity.OnBackPressedCallback;
import android.app.AlertDialog;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.view.View;
import android.view.WindowInsets;
import android.webkit.CookieManager;
import android.webkit.JsResult;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.ProgressBar;
import android.widget.TextView;
import android.widget.Toast;

public final class MainActivity extends ComponentActivity {
    private WebView web;
    private ProgressBar progress;
    private LinearLayout offline;
    private final Uri server = Uri.parse(BuildConfig.SERVER_URL);

    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setBackgroundColor(Color.rgb(242, 246, 246));
        root.setOnApplyWindowInsetsListener((view, insets) -> {
            if (Build.VERSION.SDK_INT >= 30) {
                android.graphics.Insets safe = insets.getInsets(WindowInsets.Type.systemBars() | WindowInsets.Type.ime());
                view.setPadding(safe.left, safe.top, safe.right, safe.bottom);
            } else {
                view.setPadding(insets.getSystemWindowInsetLeft(), insets.getSystemWindowInsetTop(), insets.getSystemWindowInsetRight(), insets.getSystemWindowInsetBottom());
            }
            return insets;
        });
        progress = new ProgressBar(this, null, android.R.attr.progressBarStyleHorizontal);
        root.addView(progress, new LinearLayout.LayoutParams(-1, 6));
        offline = new LinearLayout(this);
        offline.setOrientation(LinearLayout.VERTICAL);
        offline.setPadding(32, 48, 32, 32);
        TextView message = new TextView(this);
        message.setText(R.string.offline_message);
        message.setTextSize(18);
        offline.addView(message);
        Button retry = new Button(this); retry.setText(R.string.retry);
        retry.setOnClickListener(v -> { offline.setVisibility(View.GONE); web.setVisibility(View.VISIBLE); web.loadUrl(BuildConfig.SERVER_URL); });
        offline.addView(retry); offline.setVisibility(View.GONE); root.addView(offline);
        web = new WebView(this);
        root.addView(web, new LinearLayout.LayoutParams(-1, 0, 1));
        setContentView(root);
        WebSettings settings = web.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(false);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        settings.setJavaScriptCanOpenWindowsAutomatically(false);
        CookieManager.getInstance().setAcceptCookie(true);
        CookieManager.getInstance().setAcceptThirdPartyCookies(web, false);
        WebView.setWebContentsDebuggingEnabled(BuildConfig.DEBUG);
        web.setWebViewClient(new WebViewClient() {
            @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                Uri url = request.getUrl();
                if (!request.isForMainFrame()) return true;
                if (isPanel(url)) return false;
                openExternal(url); return true;
            }
            @Override public void onPageFinished(WebView view, String url) { CookieManager.getInstance().flush(); }
            @Override public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
                if (request.isForMainFrame()) { progress.setVisibility(View.GONE); web.setVisibility(View.GONE); offline.setVisibility(View.VISIBLE); }
            }
            // SSL errors retain WebView's default cancel behavior. Never bypass them.
        });
        web.setWebChromeClient(new WebChromeClient() {
            @Override public void onProgressChanged(WebView view, int value) { progress.setProgress(value); progress.setVisibility(value == 100 ? View.GONE : View.VISIBLE); }
            @Override public boolean onJsConfirm(WebView view, String url, String message, JsResult result) {
                if (!isPanel(Uri.parse(url))) { result.cancel(); return true; }
                new AlertDialog.Builder(MainActivity.this).setTitle("Em Pauta").setMessage(message)
                    .setPositiveButton("Confirmar", (dialog, which) -> result.confirm())
                    .setNegativeButton("Cancelar", (dialog, which) -> result.cancel())
                    .setOnCancelListener(dialog -> result.cancel()).show();
                return true;
            }
        });
        getOnBackPressedDispatcher().addCallback(this, new OnBackPressedCallback(true) {
            @Override public void handleOnBackPressed() { goBack(); }
        });
        if (state == null || web.restoreState(state) == null || !isPanel(Uri.parse(web.getUrl() == null ? "" : web.getUrl()))) web.loadUrl(BuildConfig.SERVER_URL);
    }
    private boolean isPanel(Uri url) {
        return "https".equals(url.getScheme()) && server.getHost().equals(url.getHost()) && (url.getPort() == -1 || url.getPort() == 443) && url.getUserInfo() == null;
    }
    private void openExternal(Uri url) {
        // No javascript:, file:, arbitrary intent: or native bridge access.
        if (!"https".equals(url.getScheme()) || url.getHost() == null) return;
        try { startActivity(new Intent(Intent.ACTION_VIEW, url).addCategory(Intent.CATEGORY_BROWSABLE)); }
        catch (ActivityNotFoundException error) { Toast.makeText(this, "Não há aplicativo disponível para abrir este link.", Toast.LENGTH_LONG).show(); }
    }
    private void goBack() { if (web.canGoBack()) web.goBack(); else finish(); }
    @Override protected void onSaveInstanceState(Bundle out) { super.onSaveInstanceState(out); web.saveState(out); }
    @Override protected void onStop() { CookieManager.getInstance().flush(); super.onStop(); }
    @Override protected void onDestroy() { web.destroy(); super.onDestroy(); }
}
