package com.dokke.app

import java.net.URI
import java.util.Locale

/** URLs accepted as Dokke server endpoints and WebView origins. */
internal object ServerUrl {
    private val allowedSchemes = setOf("http", "https")

    /**
     * Returns a canonical HTTP(S) URL or null for an unsafe/malformed value.
     * LAN HTTP is intentional: the desktop server is commonly reached over Wi-Fi.
     */
    fun normalize(raw: String?): String? {
        val value = raw?.trim()?.takeIf { it.isNotEmpty() && it.length <= 2048 } ?: return null
        val parsed = parse(value, rejectFragment = true) ?: return null
        val host = normalizedHost(parsed.host) ?: return null
        val authority = buildString {
            append(host)
            if (parsed.port != -1) {
                append(':')
                append(parsed.port)
            }
        }
        return buildString {
            append(parsed.scheme.lowercase(Locale.ROOT))
            append("://")
            append(authority)
            parsed.rawPath?.let { append(it) }
            parsed.rawQuery?.let {
                append('?')
                append(it)
            }
        }
    }

    fun isSameOrigin(serverUrl: String?, candidateUrl: String?): Boolean {
        val base = parse(serverUrl ?: return false) ?: return false
        val candidate = parse(candidateUrl ?: return false, rejectFragment = false) ?: return false
        val baseHost = normalizedHost(base.host) ?: return false
        val candidateHost = normalizedHost(candidate.host) ?: return false
        val baseScheme = base.scheme.lowercase(Locale.ROOT)
        val candidateScheme = candidate.scheme.lowercase(Locale.ROOT)
        return baseScheme == candidateScheme &&
            baseHost == candidateHost &&
            effectivePort(baseScheme, base.port) == effectivePort(candidateScheme, candidate.port)
    }

    /** Only web URLs are candidates for opening outside the WebView. */
    fun isExternalWebUrl(raw: String?): Boolean {
        val parsed = parse(raw ?: return false, rejectFragment = false) ?: return false
        return parsed.scheme.lowercase(Locale.ROOT) in allowedSchemes
    }

    private fun parse(raw: String, rejectFragment: Boolean = true): URI? {
        val parsed = try {
            URI(raw)
        } catch (_: IllegalArgumentException) {
            return null
        }
        val scheme = parsed.scheme?.lowercase(Locale.ROOT) ?: return null
        if (scheme !in allowedSchemes || parsed.isOpaque || parsed.rawUserInfo != null) return null
        if (parsed.host.isNullOrBlank() || parsed.rawAuthority.isNullOrBlank()) return null
        if (parsed.port !in -1..65535 || (rejectFragment && parsed.rawFragment != null)) return null
        return parsed
    }

    private fun normalizedHost(raw: String?): String? {
        val host = raw?.trim()?.removePrefix("[")?.removeSuffix("]")?.lowercase(Locale.ROOT)
        return host?.takeIf { it.isNotEmpty() }
    }

    private fun effectivePort(scheme: String, port: Int): Int {
        if (port != -1) return port
        return if (scheme == "https") 443 else 80
    }
}
