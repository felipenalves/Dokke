package com.dokke.app

import android.annotation.SuppressLint
import android.app.AlertDialog
import android.app.DownloadManager
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.graphics.Color
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.net.Uri
import android.os.Bundle
import android.os.Build
import android.os.Environment
import android.provider.Settings
import android.util.Log
import android.view.Gravity
import android.view.View
import android.webkit.ConsoleMessage
import android.webkit.JsResult
import android.webkit.WebChromeClient
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.Button
import android.widget.FrameLayout
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.ProgressBar
import android.widget.TextView
import android.widget.Toast
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
    private lateinit var root: FrameLayout
    private lateinit var offlinePanel: View
    private var serverUrl = ""
    private var mainFrameFailed = false
    private var healed = false
    private var updateDownloadId: Long? = null
    private var pendingUpdateVersion: String? = null
    private var updateReceiverRegistered = false

    private val updateApkUrl = "https://github.com/felipenalves/Dokke/releases/latest/download/dokke.apk"
    private val updateMime = "application/vnd.android.package-archive"
    private val updateReceiver = object : BroadcastReceiver() {
        override fun onReceive(context: Context?, intent: Intent?) {
            val id = intent?.getLongExtra(DownloadManager.EXTRA_DOWNLOAD_ID, -1L) ?: return
            if (id <= 0 || id != updateDownloadId) return
            updateDownloadId = null

            val manager = getSystemService(Context.DOWNLOAD_SERVICE) as DownloadManager
            val cursor = manager.query(DownloadManager.Query().setFilterById(id))
            try {
                if (!cursor.moveToFirst()) {
                    showUpdateMessage("Não foi possível verificar o download.")
                    return
                }
                val status = cursor.getInt(cursor.getColumnIndexOrThrow(DownloadManager.COLUMN_STATUS))
                if (status != DownloadManager.STATUS_SUCCESSFUL) {
                    showUpdateMessage("Não foi possível baixar a atualização.")
                    return
                }
                val uri = manager.getUriForDownloadedFile(id)
                if (uri == null) {
                    showUpdateMessage("O arquivo da atualização não está disponível.")
                    return
                }
                installDownloadedApk(uri)
            } finally {
                cursor.close()
            }
        }
    }

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
        WebView.setWebContentsDebuggingEnabled(BuildConfig.DEBUG)

        web = WebView(this)
        loader = ProgressBar(this).apply { isIndeterminate = true }
        root = FrameLayout(this)
        root.addView(web, FrameLayout.LayoutParams(
            FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.MATCH_PARENT))
        root.addView(loader, FrameLayout.LayoutParams(dp(48), dp(48), Gravity.CENTER))
        offlinePanel = buildOfflinePanel()
        offlinePanel.visibility = View.GONE
        root.addView(offlinePanel, FrameLayout.LayoutParams(
            FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.MATCH_PARENT))
        setContentView(root)

        val prefs = getSharedPreferences("prefs", 0)
        serverUrl = prefs.getString("server_url", null) ?: getString(R.string.server_url)
        // permite override via intent extra (fácil de testar via am)
        intent.getStringExtra("server_url")?.let { serverUrl = it; prefs.edit().putString("server_url", it).apply() }
        registerUpdateReceiver()

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
            override fun onPageStarted(view: WebView?, u: String?, favicon: android.graphics.Bitmap?) {
                mainFrameFailed = false
                loader.visibility = View.VISIBLE
            }
            override fun onPageFinished(view: WebView?, u: String?) {
                if (mainFrameFailed) return
                loader.visibility = View.GONE
                hideOfflineScreen()
            }
            override fun onReceivedError(view: WebView?, request: android.webkit.WebResourceRequest?, error: android.webkit.WebResourceError?) {
                Log.e("Dokke", "WebView error: ${error?.description} (${error?.errorCode}) url=${request?.url}")
                if (request?.isForMainFrame == true) {
                    mainFrameFailed = true
                    runOnUiThread { showOfflineScreen() }
                }
                // self-heal: se o IP gravado morreu (DHCP mudou), procura o servidor na rede
                if (request?.isForMainFrame == true && error?.errorCode in netErrors && !healed) {
                    healed = true
                    discoverServer { found ->
                        if (found != null) {
                            prefs.edit().putString("server_url", found).apply()
                            runOnUiThread {
                                serverUrl = found
                                hideOfflineScreen()
                                web.loadUrl(found)
                            }
                        }
                    }
                }
            }
        }
        web.webChromeClient = object : WebChromeClient() {
            override fun onConsoleMessage(msg: ConsoleMessage): Boolean {
                Log.d("Dokke", "[${msg.messageLevel()}] ${msg.message()} (${msg.sourceId()}:${msg.lineNumber()})")
                return true
            }
            override fun onJsConfirm(view: WebView?, url: String?, message: String?, result: JsResult?): Boolean {
                result?.confirm(); return true
            }
        }
        web.clearCache(true)
        web.addJavascriptInterface(object {
            @android.webkit.JavascriptInterface
            fun hideKeyboard() {
                runOnUiThread {
                    web.clearFocus()
                    (getSystemService(Context.INPUT_METHOD_SERVICE) as android.view.inputmethod.InputMethodManager)
                        .hideSoftInputFromWindow(web.windowToken, 0)
                }
            }
            @android.webkit.JavascriptInterface
            fun appVersion(): String = BuildConfig.VERSION_NAME
            @android.webkit.JavascriptInterface
            fun requestUpdate(version: String) {
                runOnUiThread { beginUpdate(version) }
            }
        }, "DokkeAndroid")
        web.loadUrl(serverUrl)
        // descoberta automática: se o IP do Mac mudou, atualiza sozinho
        discoverServer { found ->
            if (found != null && found != serverUrl) {
                prefs.edit().putString("server_url", found).apply()
                Log.i("Dokke", "servidor encontrado na rede: $found")
                runOnUiThread {
                    serverUrl = found
                    hideOfflineScreen()
                    web.loadUrl(found)
                }
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
        pendingUpdateVersion?.let { version ->
            if (canInstallPackages()) {
                pendingUpdateVersion = null
                enqueueUpdate(version)
            }
        }
        if (firstResume) { firstResume = false; return }
        if (offlinePanel.visibility == View.VISIBLE) retryConnection() else web.reload()
    }

    private fun registerUpdateReceiver() {
        val filter = IntentFilter(DownloadManager.ACTION_DOWNLOAD_COMPLETE)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            registerReceiver(updateReceiver, filter, Context.RECEIVER_NOT_EXPORTED)
        } else {
            registerReceiver(updateReceiver, filter)
        }
        updateReceiverRegistered = true
    }

    private fun beginUpdate(version: String) {
        if (updateDownloadId != null) {
            showUpdateMessage("A atualização já está sendo baixada.")
            return
        }
        val safeVersion = version.trim().replace(Regex("[^0-9A-Za-z._-]"), "")
        if (safeVersion.isEmpty()) {
            showUpdateMessage("Versão de atualização inválida.")
            return
        }
        if (!canInstallPackages()) {
            pendingUpdateVersion = safeVersion
            AlertDialog.Builder(this)
                .setTitle("Permitir atualização")
                .setMessage("Para atualizar o Dokke, permita que este app instale a nova versão.")
                .setNegativeButton("Agora não") { _, _ -> pendingUpdateVersion = null }
                .setPositiveButton("Abrir configurações") { _, _ -> openInstallSettings() }
                .show()
            return
        }
        enqueueUpdate(safeVersion)
    }

    private fun canInstallPackages(): Boolean {
        return Build.VERSION.SDK_INT < Build.VERSION_CODES.O || packageManager.canRequestPackageInstalls()
    }

    private fun openInstallSettings() {
        try {
            startActivity(Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES, Uri.parse("package:$packageName")))
        } catch (_: Exception) {
            startActivity(Intent(Settings.ACTION_SECURITY_SETTINGS))
        }
    }

    private fun enqueueUpdate(version: String) {
        val manager = getSystemService(Context.DOWNLOAD_SERVICE) as DownloadManager
        val filename = "dokke-update-$version.apk"
        val request = DownloadManager.Request(Uri.parse(updateApkUrl))
            .setTitle("Atualização do Dokke")
            .setDescription("Baixando a versão $version")
            .setMimeType(updateMime)
            .setAllowedOverMetered(true)
            .setAllowedOverRoaming(false)
            .setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED)
            .setDestinationInExternalFilesDir(this, Environment.DIRECTORY_DOWNLOADS, filename)
        updateDownloadId = manager.enqueue(request)
        Toast.makeText(this, "Baixando a atualização…", Toast.LENGTH_LONG).show()
    }

    private fun installDownloadedApk(uri: Uri) {
        if (!canInstallPackages()) {
            showUpdateMessage("Permissão para instalar a atualização não concedida.")
            return
        }
        val intent = Intent(Intent.ACTION_VIEW).apply {
            setDataAndType(uri, updateMime)
            addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        }
        try {
            startActivity(intent)
        } catch (_: Exception) {
            showUpdateMessage("Não foi possível abrir o instalador do Android.")
        }
    }

    private fun showUpdateMessage(message: String) {
        Toast.makeText(this, message, Toast.LENGTH_LONG).show()
    }

    private fun buildOfflinePanel(): View {
        val panel = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            gravity = Gravity.CENTER
            setPadding(dp(28), dp(28), dp(28), dp(28))
            setBackgroundColor(Color.rgb(10, 10, 18))
        }

        val icon = ImageView(this).apply {
            setImageResource(R.mipmap.ic_launcher)
            scaleType = ImageView.ScaleType.CENTER_INSIDE
        }
        panel.addView(icon, LinearLayout.LayoutParams(dp(76), dp(76)).apply {
            bottomMargin = dp(22)
        })

        val title = TextView(this).apply {
            text = "O Dokke está fechado no computador"
            setTextColor(Color.WHITE)
            textSize = 22f
            typeface = Typeface.create(Typeface.DEFAULT, Typeface.BOLD)
            gravity = Gravity.CENTER
        }
        panel.addView(title, LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT))

        val description = TextView(this).apply {
            text = "Abra o aplicativo Dokke no computador para liberar o dock neste celular."
            setTextColor(Color.rgb(177, 177, 190))
            textSize = 15f
            gravity = Gravity.CENTER
            setLineSpacing(0f, 1.15f)
        }
        panel.addView(description, LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT).apply {
                topMargin = dp(12)
            })

        val status = TextView(this).apply {
            text = "Computador desconectado"
            setTextColor(Color.rgb(255, 174, 132))
            textSize = 14f
            gravity = Gravity.CENTER
            setPadding(dp(16), dp(13), dp(16), dp(13))
            background = roundedBackground(Color.rgb(35, 25, 28), Color.rgb(105, 55, 47), 12)
        }
        panel.addView(status, LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT).apply {
                topMargin = dp(24)
            })

        val retry = Button(this).apply {
            text = "Tentar novamente"
            isAllCaps = false
            textSize = 15f
            setTextColor(Color.WHITE)
            typeface = Typeface.create(Typeface.DEFAULT, Typeface.BOLD)
            background = roundedBackground(Color.rgb(239, 108, 67), Color.TRANSPARENT, 12)
            setOnClickListener { retryConnection() }
        }
        panel.addView(retry, LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT, dp(52)).apply {
                topMargin = dp(18)
            })

        val hint = TextView(this).apply {
            text = "O celular está funcionando. Só falta abrir o Dokke no computador."
            setTextColor(Color.rgb(125, 125, 140))
            textSize = 12f
            gravity = Gravity.CENTER
        }
        panel.addView(hint, LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT).apply {
                topMargin = dp(16)
            })

        return panel
    }

    private fun retryConnection() {
        healed = false
        mainFrameFailed = false
        hideOfflineScreen()
        loader.visibility = View.VISIBLE
        web.visibility = View.VISIBLE
        web.loadUrl(serverUrl)
        discoverServer { found ->
            if (found != null && found != serverUrl) {
                getSharedPreferences("prefs", 0).edit().putString("server_url", found).apply()
                runOnUiThread {
                    serverUrl = found
                    web.loadUrl(found)
                }
            }
        }
    }

    private fun showOfflineScreen() {
        loader.visibility = View.GONE
        web.visibility = View.GONE
        offlinePanel.visibility = View.VISIBLE
    }

    private fun hideOfflineScreen() {
        offlinePanel.visibility = View.GONE
        web.visibility = View.VISIBLE
    }

    private fun roundedBackground(fill: Int, stroke: Int, radius: Int): GradientDrawable {
        return GradientDrawable().apply {
            setColor(fill)
            cornerRadius = dp(radius).toFloat()
            if (stroke != Color.TRANSPARENT) setStroke(dp(1), stroke)
        }
    }

    override fun onDestroy() {
        if (updateReceiverRegistered) {
            unregisterReceiver(updateReceiver)
            updateReceiverRegistered = false
        }
        super.onDestroy()
    }

    private fun dp(v: Int): Int = (v * resources.displayMetrics.density).toInt()
}
