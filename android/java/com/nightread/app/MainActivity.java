package com.nightread.app;

import android.app.Activity;
import android.content.Intent;
import android.net.Uri;
import android.graphics.Color;
import android.os.Build;
import android.os.Bundle;
import android.view.View;
import android.view.ViewGroup;
import android.view.Window;
import android.view.WindowInsets;
import android.view.WindowManager;
import android.webkit.JavascriptInterface;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

/**
 * 单 Activity + WebView 外壳。
 * 页面全部在 assets 里，离线可用。
 */
public class MainActivity extends Activity {

    private static final String START_URL = "file:///android_asset/index.html?app=1";
    private static final int BG_START = 0xFF0F1922;

    private WebView web;
    private int insetTop = 0;
    private int insetBottom = 0;
    private boolean pageReady = false;
    private android.webkit.ValueCallback<Uri[]> fileCb = null;
    private static final int FILE_REQ = 4321;
    private android.os.PowerManager.WakeLock wake = null;

    @Override
    protected void onCreate(Bundle saved) {
        super.onCreate(saved);
        requestWindowFeature(Window.FEATURE_NO_TITLE);

        Window win = getWindow();
        win.setStatusBarColor(Color.TRANSPARENT);
        win.setNavigationBarColor(Color.TRANSPARENT);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            WindowManager.LayoutParams lp = win.getAttributes();
            lp.layoutInDisplayCutoutMode =
                    WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES;
            win.setAttributes(lp);
        }
        applySystemUi(!isSystemDark());

        web = new WebView(this);
        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setAllowFileAccess(true);
        s.setAllowContentAccess(false);
        s.setSupportZoom(false);
        s.setBuiltInZoomControls(false);
        s.setDisplayZoomControls(false);
        s.setMediaPlaybackRequiresUserGesture(true);
        s.setTextZoom(100);
        s.setCacheMode(WebSettings.LOAD_DEFAULT);
        s.setUseWideViewPort(false);
        s.setLoadWithOverviewMode(false);

        web.setBackgroundColor(BG_START);
        web.setOverScrollMode(View.OVER_SCROLL_NEVER);
        web.setVerticalScrollBarEnabled(false);
        web.setHorizontalScrollBarEnabled(false);
        web.setLayoutParams(new ViewGroup.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
        web.addJavascriptInterface(new Bridge(), "Android");

        web.setWebViewClient(new WebViewClient() {
            @Override
            public void onPageFinished(WebView view, String url) {
                pageReady = true;
                pushInsets();
            }

            @Override
            public boolean shouldOverrideUrlLoading(WebView view, String url) {
                if (url != null && (url.startsWith("http://") || url.startsWith("https://"))) {
                    try {
                        startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse(url)));
                        return true;
                    } catch (Exception e) {
                        return false;
                    }
                }
                return false;
            }
        });

        web.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onShowFileChooser(WebView view,
                                             android.webkit.ValueCallback<Uri[]> cb,
                                             FileChooserParams params) {
                if (fileCb != null) {
                    fileCb.onReceiveValue(null);
                }
                fileCb = cb;
                Intent i = new Intent(Intent.ACTION_GET_CONTENT);
                i.addCategory(Intent.CATEGORY_OPENABLE);
                i.setType("image/*");
                try {
                    startActivityForResult(Intent.createChooser(i, "选择图片"), FILE_REQ);
                } catch (Exception e) {
                    fileCb = null;
                    return false;
                }
                return true;
            }
        });

        web.setOnApplyWindowInsetsListener(new View.OnApplyWindowInsetsListener() {
            @Override
            public WindowInsets onApplyWindowInsets(View v, WindowInsets insets) {
                insetTop = insets.getSystemWindowInsetTop();
                insetBottom = insets.getSystemWindowInsetBottom();
                pushInsets();
                return insets;
            }
        });

        setContentView(web);
        web.loadUrl(START_URL);
    }

    @Override
    protected void onActivityResult(int req, int res, Intent data) {
        if (req == FILE_REQ) {
            Uri[] out = null;
            if (res == RESULT_OK && data != null && data.getData() != null) {
                out = new Uri[]{data.getData()};
            }
            if (fileCb != null) {
                fileCb.onReceiveValue(out);
                fileCb = null;
            }
            return;
        }
        super.onActivityResult(req, res, data);
    }

    @Override
    protected void onResume() {
        super.onResume();
        if (web != null) {
            web.resumeTimers();
            web.post(new Runnable() {
                @Override
                public void run() {
                    web.evaluateJavascript("window.__resume&&window.__resume()", null);
                }
            });
            pushInsets();
        }
    }

    private void holdWake(boolean on) {
        try {
            if (wake == null) {
                android.os.PowerManager pm =
                        (android.os.PowerManager) getSystemService(android.content.Context.POWER_SERVICE);
                wake = pm.newWakeLock(android.os.PowerManager.PARTIAL_WAKE_LOCK, "nightread:gen");
                wake.setReferenceCounted(false);
            }
            if (on) {
                if (!wake.isHeld()) {
                    wake.acquire(10 * 60 * 1000L);
                }
            } else {
                if (wake.isHeld()) {
                    wake.release();
                }
            }
        } catch (Exception e) {
        }
    }

    private boolean isSystemDark() {
        int mode = getResources().getConfiguration().uiMode
                & android.content.res.Configuration.UI_MODE_NIGHT_MASK;
        return mode == android.content.res.Configuration.UI_MODE_NIGHT_YES;
    }

    private void applySystemUi(boolean lightIcons) {
        int flags = View.SYSTEM_UI_FLAG_LAYOUT_STABLE
                | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
                | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION;
        if (lightIcons) {
            flags |= View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                flags |= View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR;
            }
        }
        getWindow().getDecorView().setSystemUiVisibility(flags);
    }

    private void pushInsets() {
        if (web == null || !pageReady) {
            return;
        }
        String js = "window.__setInset&&window.__setInset(" + insetTop + "," + insetBottom + ")";
        web.evaluateJavascript(js, null);
    }

    @Override
    public void onBackPressed() {
        if (web == null) {
            super.onBackPressed();
            return;
        }
        web.evaluateJavascript("(window.__andBack&&window.__andBack())?1:0",
                new ValueCallback<String>() {
                    @Override
                    public void onReceiveValue(String value) {
                        if (!"1".equals(value)) {
                            MainActivity.super.onBackPressed();
                        }
                    }
                });
    }

    /** 给网页用的小桥 */
    public class Bridge {

        @JavascriptInterface
        public void setLightStatusBar(final boolean light) {
            runOnUiThread(new Runnable() {
                @Override
                public void run() {
                    applySystemUi(light);
                }
            });
        }


        @JavascriptInterface
        public void httpPost(final String url, final String key, final String body, final String cb) {
            new Thread(new Runnable() {
                @Override
                public void run() {
                    int code = -1;
                    String out = "";
                    try {
                        holdWake(true);
                        java.net.HttpURLConnection c = (java.net.HttpURLConnection) new java.net.URL(url).openConnection();
                        c.setRequestMethod("POST");
                        c.setConnectTimeout(20000);
                        c.setReadTimeout(300000);
                        c.setDoOutput(true);
                        c.setRequestProperty("Content-Type", "application/json; charset=utf-8");
                        if (key != null && !key.isEmpty()) {
                            c.setRequestProperty("Authorization", "Bearer " + key);
                        }
                        java.io.OutputStream os = c.getOutputStream();
                        os.write(body.getBytes("UTF-8"));
                        os.flush();
                        os.close();
                        code = c.getResponseCode();
                        java.io.InputStream is = code >= 400 ? c.getErrorStream() : c.getInputStream();
                        java.io.ByteArrayOutputStream bo = new java.io.ByteArrayOutputStream();
                        byte[] buf = new byte[8192];
                        int n;
                        while (is != null && (n = is.read(buf)) > 0) {
                            bo.write(buf, 0, n);
                        }
                        out = bo.toString("UTF-8");
                        c.disconnect();
                    } catch (java.net.SocketTimeoutException te) {
                        code = -2;
                    } catch (Exception e) {
                        code = -1;
                    } finally {
                        holdWake(false);
                    }
                    final String b64 = android.util.Base64.encodeToString(
                            out.getBytes(java.nio.charset.StandardCharsets.UTF_8),
                            android.util.Base64.NO_WRAP);
                    final int fc = code;
                    web.post(new Runnable() {
                        @Override
                        public void run() {
                            web.evaluateJavascript(
                                    "window.__http&&window.__http('" + cb + "'," + fc + ",'" + b64 + "')", null);
                        }
                    });
                }
            }).start();
        }

        @JavascriptInterface
        public void httpGet(final String url, final String key, final String cb) {
            new Thread(new Runnable() {
                @Override
                public void run() {
                    int code = -1;
                    String out = "";
                    try {
                        java.net.HttpURLConnection c = (java.net.HttpURLConnection) new java.net.URL(url).openConnection();
                        c.setRequestMethod("GET");
                        c.setConnectTimeout(8000);
                        c.setReadTimeout(8000);
                        if (key != null && !key.isEmpty()) {
                            c.setRequestProperty("Authorization", "Bearer " + key);
                        }
                        code = c.getResponseCode();
                        java.io.InputStream is = code >= 400 ? c.getErrorStream() : c.getInputStream();
                        java.io.ByteArrayOutputStream bo = new java.io.ByteArrayOutputStream();
                        byte[] buf = new byte[4096];
                        int n;
                        while (is != null && (n = is.read(buf)) > 0) {
                            bo.write(buf, 0, n);
                        }
                        out = bo.toString("UTF-8");
                        c.disconnect();
                    } catch (Exception e) {
                        code = -1;
                    }
                    final String b64 = android.util.Base64.encodeToString(
                            out.getBytes(java.nio.charset.StandardCharsets.UTF_8),
                            android.util.Base64.NO_WRAP);
                    final int fc = code;
                    web.post(new Runnable() {
                        @Override
                        public void run() {
                            web.evaluateJavascript(
                                    "window.__http&&window.__http('" + cb + "'," + fc + ",'" + b64 + "')", null);
                        }
                    });
                }
            }).start();
        }

        @JavascriptInterface
        public void openUrl(final String url) {
            runOnUiThread(new Runnable() {
                @Override
                public void run() {
                    try {
                        startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse(url)));
                    } catch (Exception e) {
                    }
                }
            });
        }

        @JavascriptInterface
        public void vibrate(final int ms, final int amp) {
            try {
                android.os.Vibrator v =
                        (android.os.Vibrator) getSystemService(android.content.Context.VIBRATOR_SERVICE);
                if (v == null || !v.hasVibrator()) {
                    return;
                }
                int a = Math.max(1, Math.min(255, amp));
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    v.vibrate(android.os.VibrationEffect.createOneShot(ms, a));
                } else {
                    v.vibrate(ms);
                }
            } catch (Exception e) {
            }
        }

        @JavascriptInterface
        public int insetTop() {
            return insetTop;
        }

        @JavascriptInterface
        public int insetBottom() {
            return insetBottom;
        }
    }
}
