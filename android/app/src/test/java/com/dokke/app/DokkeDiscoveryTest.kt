package com.dokke.app

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class DokkeDiscoveryTest {
    @Test
    fun parsesOnlyValidDiscoveryReplies() {
        assertEquals("http://192.168.1.9:3000/", DokkeDiscovery.parseReply("dokke:192.168.1.9:3000"))
        assertNull(DokkeDiscovery.parseReply("dokke:999.168.1.9:3000"))
        assertNull(DokkeDiscovery.parseReply("dokke:192.168.1.9:0"))
        assertNull(DokkeDiscovery.parseReply("dokke:192.168.1.9:65536"))
        assertNull(DokkeDiscovery.parseReply("other:192.168.1.9:3000"))
    }

    @Test
    fun healthContractIsStrict() {
        assertEquals("http://192.168.1.9:3000/health", DokkeDiscovery.healthUrl("http://192.168.1.9:3000/"))
        assertNull(DokkeDiscovery.healthUrl("http://192.168.1.9:3000/private"))
        assertTrue(DokkeDiscovery.isDokkeHealth(200, "{\"ok\":true,\"service\":\"Dokke\"}"))
        assertFalse(DokkeDiscovery.isDokkeHealth(200, "{\"ok\":true,\"service\":\"Other\"}"))
        assertFalse(DokkeDiscovery.isDokkeHealth(401, "{\"ok\":true,\"service\":\"Dokke\"}"))
    }

    @Test
    fun healthPatternEscapesClosingObjectBraceForAndroidIcu() {
        val field = DokkeDiscovery::class.java.getDeclaredField("healthPattern").apply {
            isAccessible = true
        }
        val pattern = (field.get(DokkeDiscovery) as Regex).pattern

        assertTrue("Android ICU requires the closing object brace to be escaped", pattern.contains("\\}"))
    }
}
