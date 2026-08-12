package com.dokke.app

import android.content.SharedPreferences

/** Persists only the last validated server endpoint. */
internal object DokkeConnectionStore {
    private const val KEY_SERVER_URL = "server_url"

    fun read(prefs: SharedPreferences): String? {
        val raw = prefs.getString(KEY_SERVER_URL, null)
        val normalized = ServerUrl.normalize(raw)
        if (raw != null && normalized == null) {
            prefs.edit().remove(KEY_SERVER_URL).apply()
        }
        return normalized
    }

    fun save(prefs: SharedPreferences, raw: String?): String? {
        val normalized = ServerUrl.normalize(raw)
        if (normalized == null) {
            prefs.edit().remove(KEY_SERVER_URL).apply()
            return null
        }
        prefs.edit().putString(KEY_SERVER_URL, normalized).apply()
        return normalized
    }
}
