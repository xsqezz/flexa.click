package click.flexa.app.update

import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class UpdateAnnouncerTest {

    @Test
    fun `a fresh install is not announced`() {
        assertFalse(UpdateAnnouncer.shouldAnnounce(firstInstallTime = 1_000, lastUpdateTime = 1_000, seenUpdateTime = 0))
    }

    @Test
    fun `the first launch after an update is announced even if no version was recorded before`() {
        assertTrue(UpdateAnnouncer.shouldAnnounce(firstInstallTime = 1_000, lastUpdateTime = 5_000, seenUpdateTime = 0))
    }

    @Test
    fun `reopening the same version is not announced again`() {
        assertFalse(UpdateAnnouncer.shouldAnnounce(firstInstallTime = 1_000, lastUpdateTime = 5_000, seenUpdateTime = 5_000))
    }

    @Test
    fun `a later update is announced again`() {
        assertTrue(UpdateAnnouncer.shouldAnnounce(firstInstallTime = 1_000, lastUpdateTime = 9_000, seenUpdateTime = 5_000))
    }
}
