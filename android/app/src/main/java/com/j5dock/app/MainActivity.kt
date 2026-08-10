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
import java.net.DatagramPacket
import java.net.DatagramSocket
import java.net.InetAddress
import java.net.InetSocketAddress

class MainActivity : ComponentActivity() {

    private lateinit var web: WebView
    private lateinit var loader: ProgressBar
    private var healed = false

    private val discoverMagic = "dokke:discover".toByteArray(Charsets.UTF_8)
    private val discoverReply = Regex("^dokke:(\\d{1,3}(\\.\\d{1,3}){3}):(\\d+)$")
    private val netErrors = setOf(
        WebViewClient.ERROR_HOST_LOOKUP, WebViewClient.ERROR_CONNECT,
        WebViewClient.ERROR_TIMEOUT, WebViewClient.ERROR_UNKNOWN,
        WebViewClient.ERROR_BAD_URL,
    )

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
            cacheMode = WebSettings.LOAD_DEFAULT
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
                // self-heal: se o IP gravado morreu (DHCP mudou), procura o servidor na rede
                if (request?.isForMainFrame == true && error?.errorCode in netErrors && !healed) {
                    healed = true
                    discoverServer { found ->
                        if (found != null) runOnUiThread { web.loadUrl(found) }
                    }
                }
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
        // descoberta automática: se o IP do Mac mudou, atualiza sozinho
        discoverServer { found ->
            if (found != null && found != url) {
                prefs.edit().putString("server_url", found).apply()
                Log.i("J5Dock", "servidor encontrado na rede: $found")
                runOnUiThread { web.loadUrl(found) }
            }
        }
    }

    /** Pergunta na rede "cadê o servidor dokke?" (UDP broadcast) e devolve a URL
     *  http://<ip>:<porta> da primeira resposta válida — ou null em poucos segundos. */
    private fun discoverServer(onResult: (String?) -> Unit) {
        Thread {
            var found: String? = null
            try {
                val sock = DatagramSocket(null)
                sock.reuseAddress = true
                sock.broadcast = true
                sock.soTimeout = 1500
                sock.bind(InetSocketAddress(0))
                // 255.255.255.255 é o padrão; o direcionado cobre redes que derrubam o global
                val targets = mutableListOf("255.255.255.255")
                directedBroadcast()?.let { targets.add(it) }
                loop@ for (target in targets) {
                    for (attempt in 1..2) {
                        try {
                            sock.send(DatagramPacket(discoverMagic, discoverMagic.size,
                                InetAddress.getByName(target), 3001))
                        } catch (_: Exception) {}
                        val deadline = System.currentTimeMillis() + 1500
                        while (System.currentTimeMillis() < deadline) {
                            try {
                                val buf = ByteArray(256)
                                val pkt = DatagramPacket(buf, buf.size)
                                sock.receive(pkt)
                                val msg = String(buf, 0, pkt.length, Charsets.UTF_8)
                                val m = discoverReply.find(msg)
                                if (m != null) { found = "http://${m.groupValues[1]}:${m.groupValues[3]}"; break@loop }
                            } catch (_: Exception) { break }
                        }
                    }
                }
                sock.close()
            } catch (_: Exception) {}
            onResult(found)
        }.start()
    }

    /** Broadcast direcionado da rede atual (ex.: 192.168.1.255) — pula interfaces
     *  de tunel (Tailscale /32) e loopback. */
    private fun directedBroadcast(): String? {
        try {
            val enums = java.net.NetworkInterface.getNetworkInterfaces() ?: return null
            for (nif in enums) {
                if (!nif.isUp || nif.isLoopback) continue
                for (a in nif.interfaceAddresses) {
                    val ip = a.address as? java.net.Inet4Address ?: continue
                    val prefix = a.networkPrefixLength
                    if (prefix <= 0 || prefix >= 32) continue
                    val raw = ip.address
                    val ipInt = (raw[0].toInt() and 0xff shl 24) or (raw[1].toInt() and 0xff shl 16) or
                        (raw[2].toInt() and 0xff shl 8) or (raw[3].toInt() and 0xff)
                    val maskInt = (0xffffffff.toInt() shl (32 - prefix))
                    val bcast = (ipInt and maskInt) or maskInt.inv()
                    if (bcast == ipInt) continue
                    return "${(bcast ushr 24) and 0xff}.${(bcast ushr 16) and 0xff}.${(bcast ushr 8) and 0xff}.${bcast and 0xff}"
                }
            }
        } catch (_: Exception) {}
        return null
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
