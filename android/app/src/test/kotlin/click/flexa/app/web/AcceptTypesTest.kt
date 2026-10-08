package click.flexa.app.web

import org.junit.Assert.assertEquals
import org.junit.Test

class AcceptTypesTest {
    private val known = mapOf("jpg" to "image/jpeg", "png" to "image/png", "json" to "application/json")
    private fun resolve(vararg accept: String) = AcceptTypes.resolve(accept.toList()) { known[it] }

    @Test
    fun `no restriction means any file`() {
        assertEquals(emptyList<String>(), resolve())
        assertEquals(emptyList<String>(), resolve("*/*"))
        assertEquals(emptyList<String>(), resolve("image/*", "*/*"))
    }

    @Test
    fun `keeps explicit mime types`() {
        assertEquals(listOf("image/*"), resolve("image/*"))
        assertEquals(listOf("image/png", "image/jpeg"), resolve("image/png", "image/jpeg", "image/png"))
    }

    @Test
    fun `maps known extensions`() {
        assertEquals(listOf("image/jpeg", "image/png"), resolve(".jpg", ".png"))
    }

    @Test
    fun `falls back to any file when an extension is unknown`() {
        assertEquals(emptyList<String>(), resolve(".gpx", ".tcx"))
        assertEquals(emptyList<String>(), resolve(".json", ".gpx"))
        assertEquals(emptyList<String>(), resolve("gpx"))
    }
}
