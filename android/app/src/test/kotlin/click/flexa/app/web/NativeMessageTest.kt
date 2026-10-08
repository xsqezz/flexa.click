package click.flexa.app.web

import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class NativeMessageTest {
    private fun message(type: String, vararg fields: Pair<String, Any>): String =
        JSONObject().put("type", type).also { json -> fields.forEach { json.put(it.first, it.second) } }.toString()

    private fun save(name: String = "a.json", mime: String = "application/json", text: String = "{}") =
        message("save-file", "name" to name, "mime" to mime, "text" to text)

    @Test
    fun `parses a save request`() {
        val raw = save(name = "flexa-cloud-2026-10-08.json", text = "{\"a\":1}")
        assertEquals(NativeMessage.SaveFile("flexa-cloud-2026-10-08.json", "{\"a\":1}"), NativeMessage.parse(raw))
    }

    @Test
    fun `parses an update check`() {
        assertEquals(NativeMessage.CheckUpdate, NativeMessage.parse(message("check-update")))
    }

    @Test
    fun `ignores anything it does not know`() {
        assertNull(NativeMessage.parse(null))
        assertNull(NativeMessage.parse(""))
        assertNull(NativeMessage.parse("not json"))
        assertNull(NativeMessage.parse(message("install-apk", "url" to "https://evil.example/a.apk")))
        assertNull(NativeMessage.parse(save(mime = "text/html", text = "<b>")))
        assertNull(NativeMessage.parse(save(text = "")))
        assertNull(NativeMessage.parse(message("save-file", "name" to "a.json", "mime" to "application/json")))
    }

    @Test
    fun `rejects oversized messages`() {
        assertNull(NativeMessage.parse("x".repeat(NativeMessage.MAX_MESSAGE_CHARS + 1)))
    }

    @Test
    fun `makes file names safe`() {
        assertEquals("flexa-eksport.json", NativeMessage.safeFileName(""))
        assertEquals("flexa-eksport.json", NativeMessage.safeFileName("   "))
        assertEquals("dane.json", NativeMessage.safeFileName("dane"))
        assertEquals("Dane.JSON", NativeMessage.safeFileName("Dane.JSON"))
        assertEquals("etc-passwd.json", NativeMessage.safeFileName("../../etc/passwd"))
        assertEquals("a-b-c.json", NativeMessage.safeFileName("a\\b/c"))
        assertEquals("flexa-eksport.json", NativeMessage.safeFileName("...."))
        assertEquals(80 + ".json".length, NativeMessage.safeFileName("x".repeat(300)).length)
    }
}
