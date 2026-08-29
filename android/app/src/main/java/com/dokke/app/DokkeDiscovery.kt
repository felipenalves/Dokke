package com.dokke.app

import java.net.URI
import java.net.Inet4Address
import java.net.NetworkInterface

/** Protocol helpers for the native Android companion layer. */
internal object DokkeDiscovery {
    const val MAGIC = "dokke:discover"

    private val replyPattern = Regex("^dokke:(\\d{1,3}(?:\\.\\d{1,3}){3}):(\\d{1,5})$")
    private val healthPattern = Regex("^\\s*\\{\\s*\\\"ok\\\"\\s*:\\s*true\\s*,\\s*\\\"service\\\"\\s*:\\s*\\\"Dokke\\\"\\s*\\}\\s*$")

    /** Converts only a valid discovery reply into a canonical HTTP endpoint. */
    fun parseReply(raw: String?): String? {
        val match = replyPattern.matchEntire(raw?.trim() ?: return null) ?: return null
        val host = match.groupValues[1]
        if (!isValidIpv4(host)) return null
        val port = match.groupValues[2].toIntOrNull()?.takeIf { it in 1..65535 } ?: return null
        return ServerUrl.normalize("http://$host:$port/")
    }

    /** Builds the public health URL without allowing an arbitrary path/query. */
    fun healthUrl(raw: String?): String? {
        val normalized = ServerUrl.normalize(raw) ?: return null
        val uri = try { URI(normalized) } catch (_: IllegalArgumentException) { return null }
        val path = uri.rawPath
        if (uri.rawQuery != null || uri.rawFragment != null || (path != null && path.isNotEmpty() && path != "/")) {
            return null
        }
        return "${uri.scheme}://${uri.rawAuthority}/health"
    }

    /** Accepts only the minimal, public Dokke health contract. */
    fun isDokkeHealth(statusCode: Int, body: String?): Boolean {
        if (statusCode !in 200..299 || body.isNullOrBlank()) return false
        return healthPattern.matches(body)
    }

    fun isValidIpv4(host: String): Boolean {
        val octets = host.split('.')
        return octets.size == 4 && octets.all { it.toIntOrNull()?.let { value -> value in 0..255 } == true }
    }

    /** Broadcast address for the first active IPv4 interface. */
    fun directedBroadcast(): String? {
        return try {
            val interfaces = NetworkInterface.getNetworkInterfaces() ?: return null
            while (interfaces.hasMoreElements()) {
                val network = interfaces.nextElement()
                if (!network.isUp || network.isLoopback) continue
                for (address in network.interfaceAddresses) {
                    val ipv4 = address.address as? Inet4Address ?: continue
                    val prefix = address.networkPrefixLength
                    if (prefix <= 0 || prefix >= 32) continue
                    val raw = ipv4.address
                    val ip = (raw[0].toInt() and 0xff shl 24) or
                        (raw[1].toInt() and 0xff shl 16) or
                        (raw[2].toInt() and 0xff shl 8) or
                        (raw[3].toInt() and 0xff)
                    val mask = 0xffffffff.toInt() shl (32 - prefix)
                    val broadcast = (ip and mask) or mask.inv()
                    if (broadcast == ip) continue
                    return "${(broadcast ushr 24) and 0xff}.${(broadcast ushr 16) and 0xff}.${(broadcast ushr 8) and 0xff}.${broadcast and 0xff}"
                }
            }
            null
        } catch (_: Exception) {
            null
        }
    }
}
