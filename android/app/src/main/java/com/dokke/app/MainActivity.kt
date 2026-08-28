package com.dokke.app

import android.annotation.SuppressLint
import android.app.AlertDialog
import android.app.DownloadManager
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.content.pm.PackageInfo
import android.content.pm.PackageManager
import android.content.pm.ActivityInfo
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
import android.view.HapticFeedbackConstants
import android.view.View
import android.view.WindowManager
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
import androidx.core.content.ContextCompat
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.WindowInsetsControllerCompat
import java.net.DatagramPacket
import java.net.DatagramSocket
import java.net.InetAddress
import java.net.InetSocketAddress
import java.net.HttpURLConnection
import java.net.URL
import java.io.File

class MainActivity : ComponentActivity() {

    private lateinit var web: WebView
    private lateinit var loader: ProgressBar
    private lateinit var root: FrameLayout
    private lateinit var offlinePanel: View
    private var serverUrl = ""
    private val connectionPrefs by lazy(LazyThreadSafetyMode.NONE) { getSharedPreferences("prefs", 0) }
    private var mainFrameFailed = false
    private var healed = false
    private var updateDownloadId: Long? = null
    private var pendingUpdateVersion: String? = null
    private var updateReceiverRegistered = false
    private var updateExpectedVersion: String? = null

    private val updateApkBaseUrl = "https://github.com/felipenalves/Dokke/releases/download"
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
                if (!validateDownloadedApk(uri)) {
                    showUpdateMessage("A atualização não corresponde ao Dokke instalado.")
                    manager.remove(id)
                    return
                }
                installDownloadedApk(uri)
            } finally {
                cursor.close()
            }
        }
    }

    private val netErrors = setOf(
        WebViewClient.ERROR_HOST_LOOKUP, WebViewClient.ERROR_CONNECT,
        WebViewClient.ERROR_TIMEOUT, WebViewClient.ERROR_UNKNOWN,
        WebViewClient.ERROR_BAD_URL,
    )

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        // A tela permanece acesa somente enquanto a janela do APK está visível.
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
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

        serverUrl = ServerUrl.normalize(getString(R.string.server_url)) ?: ""
        DokkeConnectionStore.read(connectionPrefs)?.let { serverUrl = it }
        // Permite override via Intent extra (fácil de testar via am), mas nunca
        // grava ou carrega uma URL fora do contrato HTTP(S) com host.
        intent.getStringExtra("server_url")?.let { applyServerUrl(it, persist = true) }
        registerUpdateReceiver()

        web.settings.apply {
            javaScriptEnabled = true
            domStorageEnabled = true
            cacheMode = WebSettings.LOAD_DEFAULT
            useWideViewPort = true
            loadWithOverviewMode = true
            databaseEnabled = true
            allowFileAccess = false
            allowContentAccess = false
            javaScriptCanOpenWindowsAutomatically = false
        }
        web.setBackgroundColor(Color.BLACK)
        web.webViewClient = object : WebViewClient() {
            override fun shouldOverrideUrlLoading(view: WebView?, request: android.webkit.WebResourceRequest?): Boolean {
                if (request?.isForMainFrame != true) return false
                return handleWebViewNavigation(request.url?.toString())
            }

            @Suppress("DEPRECATION", "OVERRIDE_DEPRECATION")
            override fun shouldOverrideUrlLoading(view: WebView?, u: String?): Boolean {
                return handleWebViewNavigation(u)
            }

            override fun onPageStarted(view: WebView?, u: String?, favicon: android.graphics.Bitmap?) {
                if (u != null && !ServerUrl.isSameOrigin(serverUrl, u)) {
                    view?.stopLoading()
                    handleWebViewNavigation(u)
                    return
                }
                mainFrameFailed = false
                loader.visibility = View.VISIBLE
            }
            override fun onPageFinished(view: WebView?, u: String?) {
                if (mainFrameFailed) return
                loader.visibility = View.GONE
                hideOfflineScreen()
            }
            override fun onReceivedError(view: WebView?, request: android.webkit.WebResourceRequest?, error: android.webkit.WebResourceError?) {
                val errorCode = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) error?.errorCode else null
                val description = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) error?.description else null
                Log.e("Dokke", "WebView error: $description ($errorCode) url=${request?.url}")
                if (request?.isForMainFrame == true) {
                    mainFrameFailed = true
                    runOnUiThread { showOfflineScreen() }
                }
                // self-heal: se o IP gravado morreu (DHCP mudou), procura o servidor na rede
                if (request?.isForMainFrame == true && errorCode in netErrors && !healed) {
                    healed = true
                    discoverServer { found ->
                        if (!currentServerHealthy()) acceptDiscoveredServer(found)
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
            fun performHapticFeedback() {
                runOnUiThread {
                    val constant = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                        HapticFeedbackConstants.CONTEXT_CLICK
                    } else {
                        HapticFeedbackConstants.VIRTUAL_KEY
                    }
                    web.performHapticFeedback(constant)
                }
            }
            @android.webkit.JavascriptInterface
            fun setLoginPortrait(enabled: Boolean) {
                runOnUiThread {
                    requestedOrientation = if (enabled) {
                        ActivityInfo.SCREEN_ORIENTATION_PORTRAIT
                    } else {
                        ActivityInfo.SCREEN_ORIENTATION_UNSPECIFIED
                    }
                }
            }
            @android.webkit.JavascriptInterface
            fun appVersion(): String = BuildConfig.VERSION_NAME
            @android.webkit.JavascriptInterface
            fun requestUpdate(version: String) {
                runOnUiThread { beginUpdate(version) }
            }
        }, "DokkeAndroid")
        if (serverUrl.isNotEmpty()) web.loadUrl(serverUrl) else showOfflineScreen()
        // descoberta automática: só troca quando o servidor salvo está inacessível —
        // um respondente falso na rede não sequestra um pareamento que funciona
        discoverServer { found ->
            if (!currentServerHealthy()) acceptDiscoveredServer(found)
        }
    }

    /** O servidor atual responde ao health contract? Bloqueante: chamar fora da UI thread. */
    private fun currentServerHealthy(): Boolean {
        return serverUrl.isNotEmpty() && verifyDokkeServer(serverUrl) != null
    }

    private fun applyServerUrl(raw: String?, persist: Boolean): Boolean {
        val normalized = ServerUrl.normalize(raw)
        if (normalized == null) {
            Log.w("Dokke", "URL do servidor rejeitada: esquema inseguro, host inválido ou credenciais embutidas")
            return false
        }
        serverUrl = normalized
        if (persist) {
            DokkeConnectionStore.save(connectionPrefs, normalized)
        }
        return true
    }

    private fun handleWebViewNavigation(raw: String?): Boolean {
        if (ServerUrl.isSameOrigin(serverUrl, raw)) return false
        if (ServerUrl.isExternalWebUrl(raw)) {
            try {
                startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(raw)).addCategory(Intent.CATEGORY_BROWSABLE))
            } catch (_: Exception) {
                Toast.makeText(this, "Não foi possível abrir o link externo.", Toast.LENGTH_SHORT).show()
            }
        } else {
            Log.w("Dokke", "navegação rejeitada fora da origem confiável: $raw")
        }
        return true
    }

    private fun acceptDiscoveredServer(raw: String?) {
        val found = ServerUrl.normalize(raw) ?: return
        runOnUiThread {
            if (found == serverUrl) return@runOnUiThread
            serverUrl = found
            DokkeConnectionStore.save(connectionPrefs, found)
            Log.i("Dokke", "servidor encontrado na rede: $found")
            hideOfflineScreen()
            web.loadUrl(found)
        }
    }

    /** Pergunta na rede e só devolve um endpoint depois do health check Dokke. */
    private fun discoverServer(onResult: (String?) -> Unit) {
        Thread {
            var found: String? = null
            var sock: DatagramSocket? = null
            try {
                val socket = DatagramSocket(null)
                sock = socket
                socket.reuseAddress = true
                socket.broadcast = true
                socket.soTimeout = 1500
                socket.bind(InetSocketAddress(0))
                // 255.255.255.255 é o padrão; o direcionado cobre redes que derrubam o global
                val targets = mutableListOf("255.255.255.255")
                DokkeDiscovery.directedBroadcast()?.let { targets.add(it) }
                val discoverMagic = DokkeDiscovery.MAGIC.toByteArray(Charsets.UTF_8)
                loop@ for (target in targets) {
                    for (attempt in 1..2) {
                        try {
                            socket.send(DatagramPacket(discoverMagic, discoverMagic.size,
                                InetAddress.getByName(target), 3001))
                        } catch (_: Exception) {}
                        val deadline = System.currentTimeMillis() + 1500
                        while (System.currentTimeMillis() < deadline) {
                            try {
                                val buf = ByteArray(256)
                                val pkt = DatagramPacket(buf, buf.size)
                                socket.receive(pkt)
                                val msg = String(buf, 0, pkt.length, Charsets.UTF_8)
                                val candidate = DokkeDiscovery.parseReply(msg)
                                if (candidate != null) {
                                    found = verifyDokkeServer(candidate)
                                    if (found != null) {
                                        break@loop
                                    }
                                }
                            } catch (_: Exception) { break }
                        }
                    }
                }
            } catch (_: Exception) {}
            sock?.close()
            onResult(found)
        }.start()
    }

    /** UDP é apenas descoberta; a troca de endpoint exige o health contract. */
    private fun verifyDokkeServer(candidate: String): String? {
        val healthUrl = DokkeDiscovery.healthUrl(candidate) ?: return null
        val connection = try { URL(healthUrl).openConnection() as HttpURLConnection } catch (_: Exception) { return null }
        return try {
            connection.connectTimeout = 1200
            connection.readTimeout = 1200
            connection.requestMethod = "GET"
            connection.useCaches = false
            val body = connection.inputStream.bufferedReader(Charsets.UTF_8).use { it.readText() }
            candidate.takeIf { DokkeDiscovery.isDokkeHealth(connection.responseCode, body) }
        } catch (_: Exception) {
            null
        } finally {
            connection.disconnect()
        }
    }

    override fun onNewIntent(newIntent: Intent) {
        super.onNewIntent(newIntent)
        setIntent(newIntent)
        newIntent.getStringExtra("server_url")?.let { raw ->
            // origem vinda de fora (outro app) só vale com health check Dokke —
            // sem isso qualquer activity exportada sequestraria a conexão salva
            Thread {
                val normalized = ServerUrl.normalize(raw)
                val verified = normalized?.let { verifyDokkeServer(it) }
                runOnUiThread {
                    if (verified != null && applyServerUrl(verified, persist = true)) {
                        hideOfflineScreen()
                        web.loadUrl(serverUrl)
                    } else if (normalized != null) {
                        Log.w("Dokke", "server_url de intent rejeitada: sem health Dokke")
                    }
                }
            }.start()
        }
    }

    @Suppress("DEPRECATION")
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
            ContextCompat.registerReceiver(this, updateReceiver, filter, ContextCompat.RECEIVER_NOT_EXPORTED)
        }
        updateReceiverRegistered = true
    }

    private fun beginUpdate(version: String) {
        if (updateDownloadId != null) {
            showUpdateMessage("A atualização já está sendo baixada.")
            return
        }
        val releaseTag = UpdateVersion.releaseTag(version)
        if (releaseTag == null) {
            showUpdateMessage("Versão de atualização inválida.")
            return
        }
        val versionName = releaseTag.removePrefix("v")
        if (!UpdateVersion.isNewer(versionName, BuildConfig.VERSION_NAME)) {
            showUpdateMessage("O Dokke já está atualizado.")
            return
        }
        if (!canInstallPackages()) {
            pendingUpdateVersion = versionName
            AlertDialog.Builder(this)
                .setTitle("Permitir atualização")
                .setMessage("Para atualizar o Dokke, permita que este app instale a nova versão.")
                .setNegativeButton("Agora não") { _, _ -> pendingUpdateVersion = null }
                .setPositiveButton("Abrir configurações") { _, _ -> openInstallSettings() }
                .show()
            return
        }
        enqueueUpdate(versionName)
    }

    private fun canInstallPackages(): Boolean {
        return Build.VERSION.SDK_INT < Build.VERSION_CODES.O || packageManager.canRequestPackageInstalls()
    }

    private fun openInstallSettings() {
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                startActivity(Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES, Uri.parse("package:$packageName")))
            } else {
                startActivity(Intent(Settings.ACTION_SECURITY_SETTINGS))
            }
        } catch (_: Exception) {
            startActivity(Intent(Settings.ACTION_SECURITY_SETTINGS))
        }
    }

    private fun enqueueUpdate(version: String) {
        val releaseTag = UpdateVersion.releaseTag(version) ?: run {
            showUpdateMessage("Versão de atualização inválida.")
            return
        }
        val manager = getSystemService(Context.DOWNLOAD_SERVICE) as DownloadManager
        val filename = "dokke-update-$version.apk"
        val apkUrl = "$updateApkBaseUrl/$releaseTag/dokke.apk"
        val request = DownloadManager.Request(Uri.parse(apkUrl))
            .setTitle("Atualização do Dokke")
            .setDescription("Baixando a versão $version")
            .setMimeType(updateMime)
            .setAllowedOverMetered(true)
            .setAllowedOverRoaming(false)
            .setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED)
            .setDestinationInExternalFilesDir(this, Environment.DIRECTORY_DOWNLOADS, filename)
        updateExpectedVersion = version
        updateDownloadId = manager.enqueue(request)
        Toast.makeText(this, "Baixando a atualização…", Toast.LENGTH_LONG).show()
    }

    private fun validateDownloadedApk(uri: Uri): Boolean {
        val validationFile = File(cacheDir, "dokke-update-validation.apk")
        return try {
            val input = contentResolver.openInputStream(uri) ?: return false
            input.use { source -> validationFile.outputStream().use { target -> source.copyTo(target) } }

            val flags = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
                PackageManager.GET_SIGNING_CERTIFICATES
            } else {
                @Suppress("DEPRECATION")
                PackageManager.GET_SIGNATURES
            }
            val archive = packageManager.getPackageArchiveInfo(validationFile.absolutePath, flags) ?: return false
            if (archive.packageName != packageName) return false

            val archiveVersion = archive.versionName ?: return false
            if (!UpdateVersion.isNewer(archiveVersion, BuildConfig.VERSION_NAME)) return false
            updateExpectedVersion?.let { expected ->
                if (archiveVersion != expected) return false
            }

            val installed = packageManager.getPackageInfo(packageName, flags)
            val archiveCode = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
                archive.longVersionCode
            } else {
                @Suppress("DEPRECATION")
                archive.versionCode.toLong()
            }
            val installedCode = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
                installed.longVersionCode
            } else {
                @Suppress("DEPRECATION")
                installed.versionCode.toLong()
            }
            if (archiveCode <= installedCode) return false
            signaturesMatch(installed, archive)
        } catch (e: Exception) {
            Log.e("Dokke", "Falha ao validar APK de atualização", e)
            false
        } finally {
            validationFile.delete()
        }
    }

    private fun signaturesMatch(installed: PackageInfo, archive: PackageInfo): Boolean {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            val installedSigs = installed.signingInfo.apkContentsSigners.map { it.toCharsString() }.toSet()
            val archiveSigs = archive.signingInfo.apkContentsSigners.map { it.toCharsString() }.toSet()
            return installedSigs.isNotEmpty() && installedSigs == archiveSigs
        }
        @Suppress("DEPRECATION")
        val installedSigs = installed.signatures.map { it.toCharsString() }.toSet()
        @Suppress("DEPRECATION")
        val archiveSigs = archive.signatures.map { it.toCharsString() }.toSet()
        return installedSigs.isNotEmpty() && installedSigs == archiveSigs
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
        if (serverUrl.isNotEmpty()) web.loadUrl(serverUrl) else showOfflineScreen()
        discoverServer { found ->
            acceptDiscoveredServer(found)
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
