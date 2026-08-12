package com.dokke.app

import android.content.SharedPreferences
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Test

class DokkeConnectionStoreTest {
    @Test
    fun savesCanonicalEndpointAndDeletesInvalidValue() {
        val prefs = FakePreferences()

        assertEquals("http://192.168.1.9:3000/", DokkeConnectionStore.save(prefs, " HTTP://192.168.1.9:3000/ "))
        assertEquals("http://192.168.1.9:3000/", DokkeConnectionStore.read(prefs))

        assertNull(DokkeConnectionStore.save(prefs, "javascript:alert(1)"))
        assertFalse(prefs.contains("server_url"))
    }

    private class FakePreferences : SharedPreferences {
        private val values = mutableMapOf<String, Any?>()

        override fun getAll(): MutableMap<String, *> = values.toMutableMap()
        override fun getString(key: String?, defValue: String?): String? = values[key] as? String ?: defValue
        @Suppress("UNCHECKED_CAST")
        override fun getStringSet(key: String?, defValues: MutableSet<String>?): MutableSet<String>? = values[key] as? MutableSet<String> ?: defValues
        override fun getInt(key: String?, defValue: Int): Int = values[key] as? Int ?: defValue
        override fun getLong(key: String?, defValue: Long): Long = values[key] as? Long ?: defValue
        override fun getFloat(key: String?, defValue: Float): Float = values[key] as? Float ?: defValue
        override fun getBoolean(key: String?, defValue: Boolean): Boolean = values[key] as? Boolean ?: defValue
        override fun contains(key: String?): Boolean = values.containsKey(key)
        override fun edit(): SharedPreferences.Editor = FakeEditor()
        override fun registerOnSharedPreferenceChangeListener(listener: SharedPreferences.OnSharedPreferenceChangeListener?) = Unit
        override fun unregisterOnSharedPreferenceChangeListener(listener: SharedPreferences.OnSharedPreferenceChangeListener?) = Unit

        private inner class FakeEditor : SharedPreferences.Editor {
            private var clear = false
            private val pending = mutableMapOf<String, Any?>()
            private val removed = mutableSetOf<String>()

            override fun putString(key: String?, value: String?): SharedPreferences.Editor = apply { pending[key.orEmpty()] = value }
            override fun putStringSet(key: String?, values: MutableSet<String>?): SharedPreferences.Editor = apply { pending[key.orEmpty()] = values }
            override fun putInt(key: String?, value: Int): SharedPreferences.Editor = apply { pending[key.orEmpty()] = value }
            override fun putLong(key: String?, value: Long): SharedPreferences.Editor = apply { pending[key.orEmpty()] = value }
            override fun putFloat(key: String?, value: Float): SharedPreferences.Editor = apply { pending[key.orEmpty()] = value }
            override fun putBoolean(key: String?, value: Boolean): SharedPreferences.Editor = apply { pending[key.orEmpty()] = value }
            override fun remove(key: String?): SharedPreferences.Editor = apply { removed += key.orEmpty() }
            override fun clear(): SharedPreferences.Editor = apply { clear = true }
            override fun commit(): Boolean { applyChanges(); return true }
            override fun apply() = applyChanges()

            private fun applyChanges() {
                if (clear) values.clear()
                removed.forEach(values::remove)
                pending.forEach { (key, value) -> if (value == null) values.remove(key) else values[key] = value }
            }
        }
    }
}
