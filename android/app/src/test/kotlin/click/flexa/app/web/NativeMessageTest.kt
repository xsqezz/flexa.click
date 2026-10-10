package click.flexa.app.web

import org.json.JSONArray
import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class NativeMessageTest {
    @Test
    fun `parses a shared photo request with an optional id and rejects extras`() {
        assertEquals(NativeMessage.TakeSharedImage("s-1"), NativeMessage.parse("{\"type\":\"shared-image.take\",\"id\":\"s-1\"}"))
        assertEquals(NativeMessage.TakeSharedImage(null), NativeMessage.parse("{\"type\":\"shared-image.take\"}"))
        assertNull(NativeMessage.parse("{\"type\":\"shared-image.take\",\"id\":\"s-1\",\"uri\":\"file:///x\"}"))
        assertNull(NativeMessage.parse("{\"type\":\"shared-image.take\",\"id\":\"bad id!\"}"))
    }

    private fun message(type: String, vararg fields: Pair<String, Any>): String =
        JSONObject().put("type", type).also { json -> fields.forEach { json.put(it.first, it.second) } }.toString()

    private fun save(name: String = "a.json", mime: String = "application/json", text: String = "{}") =
        message("save-file", "name" to name, "mime" to mime, "text" to text)

    private fun training() = JSONObject().put("enabled", true).put("time", "18:00").put("weekdays", JSONArray(listOf(0, 2)))
    private fun water() = JSONObject().put("enabled", false).put("from", "09:00").put("to", "21:00").put("everyHours", 2)

    @Test
    fun `parses a save request`() {
        val raw = save(name = "flexa-cloud-2026-10-08.json", text = "{\"a\":1}")
        assertEquals(NativeMessage.SaveFile("flexa-cloud-2026-10-08.json", "{\"a\":1}", "application/json"), NativeMessage.parse(raw))
    }

    @Test
    fun `parses a CSV save request and keeps the csv extension`() {
        assertEquals(
            NativeMessage.SaveFile("flexa-posilki.csv", "data;kcal\n", "text/csv"),
            NativeMessage.parse(save(name = "flexa-posilki.csv", mime = "text/csv", text = "data;kcal\n")),
        )
        assertEquals(
            NativeMessage.SaveFile("raport.csv", "a", "text/csv"),
            NativeMessage.parse(save(name = "raport", mime = "text/csv", text = "a")),
        )
        assertEquals(
            NativeMessage.SaveFile("raport.json.csv", "a", "text/csv"),
            NativeMessage.parse(save(name = "raport.json", mime = "text/csv", text = "a")),
        )
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
        assertNull(NativeMessage.parse(save(mime = "text/plain", text = "a")))
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
        assertEquals("flexa-eksport.csv", NativeMessage.safeFileName("", "text/csv"))
        assertEquals("dane.json", NativeMessage.safeFileName("dane"))
        assertEquals("Dane.JSON", NativeMessage.safeFileName("Dane.JSON"))
        assertEquals("Dane.CSV", NativeMessage.safeFileName("Dane.CSV", "text/csv"))
        assertEquals("etc-passwd.json", NativeMessage.safeFileName("../../etc/passwd"))
        assertEquals("etc-passwd.csv", NativeMessage.safeFileName("../../etc/passwd", "text/csv"))
        assertEquals("a-b-c.json", NativeMessage.safeFileName("a\\b/c"))
        assertEquals("flexa-eksport.json", NativeMessage.safeFileName("...."))
        assertEquals(80 + ".json".length, NativeMessage.safeFileName("x".repeat(300)).length)
        assertEquals(80 + ".csv".length, NativeMessage.safeFileName("x".repeat(300), "text/csv").length)
    }

    @Test
    fun `parses reminder requests with an optional id`() {
        assertEquals(NativeMessage.GetReminders("r-1"), NativeMessage.parse(message("reminders.get", "id" to "r-1")))
        assertEquals(NativeMessage.GetReminders(null), NativeMessage.parse(message("reminders.get")))
        val set = NativeMessage.parse(message("reminders.set", "id" to "abc", "training" to training(), "water" to water()))
        assertTrue(set is NativeMessage.SetReminders)
        set as NativeMessage.SetReminders
        assertEquals("abc", set.id)
        assertEquals(setOf(0, 2), set.settings.training.weekdays)
        assertEquals(NativeMessage.OpenNotificationSettings, NativeMessage.parse(message("reminders.open-settings")))
    }

    @Test
    fun `answers invalid reminder settings with an error instead of storing them`() {
        val badWater = water().put("everyHours", 5)
        assertEquals(
            NativeMessage.InvalidReminders("abc"),
            NativeMessage.parse(message("reminders.set", "id" to "abc", "training" to training(), "water" to badWater)),
        )
        assertEquals(NativeMessage.InvalidReminders(null), NativeMessage.parse(message("reminders.set", "training" to training())))
    }

    @Test
    fun `drops reminder messages with unknown fields or a malformed id`() {
        assertNull(NativeMessage.parse(message("reminders.get", "id" to "<script>")))
        assertNull(NativeMessage.parse(message("reminders.get", "id" to "x".repeat(41))))
        assertNull(NativeMessage.parse(message("reminders.get", "id" to 7)))
        assertNull(NativeMessage.parse(message("reminders.get", "extra" to true)))
        assertNull(NativeMessage.parse(message("reminders.set", "training" to training(), "water" to water(), "exact" to true)))
        assertNull(NativeMessage.parse(message("reminders.open-settings", "url" to "https://evil.example")))
    }

    @Test
    fun `accepts optional meal reminders and rejects malformed ones`() {
        val meals = JSONObject().put("enabled", true).put("times", JSONArray(listOf("08:30", "19:00")))
        val ok = NativeMessage.parse(message("reminders.set", "id" to "m1", "training" to training(), "water" to water(), "meals" to meals))
        assertTrue(ok is NativeMessage.SetReminders)
        assertEquals(listOf(java.time.LocalTime.of(8, 30), java.time.LocalTime.of(19, 0)), (ok as NativeMessage.SetReminders).settings.meals.times)
        val bad = JSONObject().put("enabled", true).put("times", JSONArray(listOf("19:00", "08:30")))
        assertEquals(
            NativeMessage.InvalidReminders("m1"),
            NativeMessage.parse(message("reminders.set", "id" to "m1", "training" to training(), "water" to water(), "meals" to bad)),
        )
    }
}
