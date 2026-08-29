package com.dokke.app

import android.content.Context
import android.os.Build
import java.util.Locale

/** Native Android copy for messages shown outside the PWA WebView. */
object AndroidLanguage {
    private val portuguese = mapOf(
        "update.downloadCheck" to "Não foi possível verificar o download.",
        "update.downloadError" to "Não foi possível baixar a atualização.",
        "update.fileMissing" to "O arquivo da atualização não está disponível.",
        "update.invalidPackage" to "A atualização não corresponde ao Dokke instalado.",
        "update.alreadyDownloading" to "A atualização já está sendo baixada.",
        "update.invalidVersion" to "Versão de atualização inválida.",
        "update.current" to "O Dokke já está atualizado.",
        "update.permissionTitle" to "Permitir atualização",
        "update.permissionMessage" to "Para atualizar o Dokke, permita que este app instale a nova versão.",
        "update.cancel" to "Agora não",
        "update.settings" to "Abrir configurações",
        "update.downloadTitle" to "Atualização do Dokke",
        "update.downloadDescription" to "Baixando a versão {version}",
        "update.downloadStarted" to "Baixando a atualização…",
        "update.permissionDenied" to "Permissão para instalar a atualização não concedida.",
        "update.installerError" to "Não foi possível abrir o instalador do Android.",
        "external.openError" to "Não foi possível abrir o link externo.",
        "offline.title" to "O Dokke está fechado no computador",
        "offline.description" to "Abra o aplicativo Dokke no computador para liberar o dock neste celular.",
        "offline.status" to "Computador desconectado",
        "offline.retry" to "Tentar novamente",
        "offline.hint" to "O celular está funcionando. Só falta abrir o Dokke no computador.",
    )

    private val english = mapOf(
        "update.downloadCheck" to "Could not verify the download.",
        "update.downloadError" to "Could not download the update.",
        "update.fileMissing" to "The update file is not available.",
        "update.invalidPackage" to "The update does not match the installed Dokke app.",
        "update.alreadyDownloading" to "The update is already downloading.",
        "update.invalidVersion" to "Invalid update version.",
        "update.current" to "Dokke is already up to date.",
        "update.permissionTitle" to "Allow update",
        "update.permissionMessage" to "To update Dokke, allow this app to install the new version.",
        "update.cancel" to "Not now",
        "update.settings" to "Open settings",
        "update.downloadTitle" to "Dokke update",
        "update.downloadDescription" to "Downloading version {version}",
        "update.downloadStarted" to "Downloading update…",
        "update.permissionDenied" to "Permission to install the update was not granted.",
        "update.installerError" to "Could not open the Android installer.",
        "external.openError" to "Could not open the external link.",
        "offline.title" to "Dokke is closed on the computer",
        "offline.description" to "Open the Dokke app on the computer to enable the dock on this phone.",
        "offline.status" to "Computer disconnected",
        "offline.retry" to "Try again",
        "offline.hint" to "The phone is working. Dokke just needs to be opened on the computer.",
    )

    fun text(context: Context, key: String, values: Map<String, String> = emptyMap()): String {
        val language = current(context)
        val template = (if (language == "pt-BR") portuguese[key] else english[key])
            ?: portuguese[key]
            ?: key
        return values.entries.fold(template) { result, entry ->
            result.replace("{" + entry.key + "}", entry.value)
        }
    }

    private fun current(context: Context): String {
        val locale: Locale = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
            context.resources.configuration.locales[0]
        } else {
            @Suppress("DEPRECATION")
            context.resources.configuration.locale
        }
        return if (locale.language.equals("pt", ignoreCase = true)) "pt-BR" else "en"
    }
}
