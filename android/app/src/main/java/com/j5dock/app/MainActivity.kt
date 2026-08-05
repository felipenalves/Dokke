package com.j5dock.app

import android.annotation.SuppressLint
import android.app.AlertDialog
import android.content.Context
import android.graphics.Color
import android.net.http.SslError
import android.os.Bundle
import android.util.Log
import android.view.Gravity
import android.view.View
import android.webkit.ConsoleMessage
import android.webkit.JsResult
import android.webkit.SslErrorHandler
import android.webkit.WebChromeClient
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.FrameLayout
import android.widget.ProgressBar
import androidx.activity.ComponentActivity
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.WindowInsetsControllerCompat

class MainActivity : ComponentActivity() {

    private lateinit var web: WebView
    private lateinit var loader: ProgressBar

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        WindowCompat.setDecorFitsSystemWindows(window, false)
        WindowCompat.getInsetsController(window, window.decorView).apply {
            systemBarsBehavior = WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
            hide(WindowInsetsCompat.Type.systemBars())
        }
        // permite debug remoto do WebView via chrome://inspect
        WebView.setWebContentsDebuggingEnabled(true)

        web = WebView(this)
        loader = ProgressBar(this).apply { isIndeterminate = true }
        val root = FrameLayout(this)
        root.addView(web, FrameLayout.LayoutParams(
            FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.MATCH_PARENT))
        root.addView(loader, FrameLayout.LayoutParams(dp(48), dp(48), Gravity.CENTER))
        setContentView(root)

        val prefs = getSharedPreferences("prefs", 0)
        var url = prefs.getString("server_url", null) ?: getString(R.string.server_url)
        // permite override via intent extra (fácil de testar via am)
        intent.getStringExtra("server_url")?.let { url = it; prefs.edit().putString("server_url", it).apply() }

        web.settings.apply {
            javaScriptEnabled = true
            domStorageEnabled = true
            cacheMode = WebSettings.LOAD_NO_CACHE
            useWideViewPort = true
            loadWithOverviewMode = true
            databaseEnabled = true
        }
        web.setBackgroundColor(Color.BLACK)
        web.webViewClient = object : WebViewClient() {
            override fun onPageFinished(view: WebView?, u: String?) { loader.visibility = View.GONE }
            override fun onReceivedSslError(view: WebView?, handler: SslErrorHandler?, error: SslError?) { handler?.proceed() }
            override fun onReceivedError(view: WebView?, request: android.webkit.WebResourceRequest?, error: android.webkit.WebResourceError?) {
                Log.e("J5Dock", "WebView error: ${error?.description} (${error?.errorCode}) url=${request?.url}")
            }
        }
        web.webChromeClient = object : WebChromeClient() {
            override fun onConsoleMessage(msg: ConsoleMessage): Boolean {
                Log.d("J5Dock", "[${msg.messageLevel()}] ${msg.message()} (${msg.sourceId()}:${msg.lineNumber()})")
                return true
            }
            override fun onJsConfirm(view: WebView?, url: String?, message: String?, result: JsResult?): Boolean {
                result?.confirm(); return true
            }
        }
        web.clearCache(true)
        web.loadUrl(url)
    }

    override fun onBackPressed() { if (web.canGoBack()) web.goBack() else super.onBackPressed() }
    private var firstResume = true
    override fun onResume() {
        super.onResume()
        if (firstResume) { firstResume = false; return }
        web.reload()
    }
    private fun dp(v: Int): Int = (v * resources.displayMetrics.density).toInt()
}
