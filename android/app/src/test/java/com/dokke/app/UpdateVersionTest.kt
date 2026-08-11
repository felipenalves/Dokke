package com.dokke.app

import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class UpdateVersionTest {
    @Test
    fun equalVersionsDoNotTriggerAnUpdate() {
        assertFalse(UpdateVersion.isNewer("v0.2.6", "0.2.6"))
    }

    @Test
    fun newerVersionTriggersAnUpdate() {
        assertTrue(UpdateVersion.isNewer("v0.2.7", "0.2.6"))
    }

    @Test
    fun releaseTagIsStrictAndCanonical() {
        assertTrue(UpdateVersion.releaseTag("0.2.7") == "v0.2.7")
        assertTrue(UpdateVersion.releaseTag("v0.2.7") == "v0.2.7")
        assertTrue(UpdateVersion.releaseTag("latest") == null)
    }
}
