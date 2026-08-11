package com.dokke.app

internal object UpdateVersion {
    private val versionPattern = Regex("^v?(\\d+)(?:\\.(\\d+))?(?:\\.(\\d+))?$")

    fun isNewer(remote: String?, installed: String?): Boolean {
        return compare(remote, installed) > 0
    }

    fun releaseTag(raw: String?): String? {
        val parts = parse(raw) ?: return null
        return "v" + parts.joinToString(".")
    }

    private fun compare(left: String?, right: String?): Int {
        val a = parse(left) ?: return -1
        val b = parse(right) ?: return 1
        for (i in 0 until maxOf(a.size, b.size)) {
            val av = a.getOrElse(i) { 0 }
            val bv = b.getOrElse(i) { 0 }
            if (av != bv) return av.compareTo(bv)
        }
        return 0
    }

    private fun parse(raw: String?): List<Int>? {
        val value = raw?.trim()?.removePrefix("v") ?: return null
        val match = versionPattern.matchEntire(value) ?: return null
        return match.groupValues.drop(1).filter { it.isNotEmpty() }.map { it.toIntOrNull() ?: return null }
    }
}
