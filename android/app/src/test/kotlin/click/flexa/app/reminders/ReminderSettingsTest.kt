package click.flexa.app.reminders

import org.json.JSONArray
import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Test
import java.time.LocalTime

class ReminderSettingsTest {
    private fun training(vararg changes: Pair<String, Any?>) = JSONObject()
        .put("enabled", true).put("time", "18:30").put("weekdays", JSONArray(listOf(0, 2, 4)))
        .also { json -> changes.forEach { (key, value) -> if (value == null) json.remove(key) else json.put(key, value) } }

    private fun water(vararg changes: Pair<String, Any?>) = JSONObject()
        .put("enabled", true).put("from", "09:00").put("to", "21:00").put("everyHours", 2)
        .also { json -> changes.forEach { (key, value) -> if (value == null) json.remove(key) else json.put(key, value) } }

    private fun session(weekday: Any = 0, name: Any = "Dzień 1: Całe ciało A", minutes: Any = 45) =
        JSONObject().put("weekday", weekday).put("name", name).put("minutes", minutes)

    @Test
    fun `parses valid settings`() {
        val settings = ReminderSettings.parse(
            training("title" to "Plan", "sessions" to JSONArray(listOf(session(), session(weekday = 2, minutes = 30)))),
            water(),
        )!!
        assertEquals(LocalTime.of(18, 30), settings.training.time)
        assertEquals(setOf(0, 2, 4), settings.training.weekdays)
        assertEquals("Plan", settings.training.title)
        assertEquals(ReminderSettings.Session(2, "Dzień 1: Całe ciało A", 30), settings.training.sessionFor(2))
        assertEquals(ReminderSettings.Water(true, LocalTime.of(9, 0), LocalTime.of(21, 0), 2), settings.water)
    }

    @Test
    fun `round-trips through storage`() {
        val settings = ReminderSettings.parse(training("sessions" to JSONArray(listOf(session()))), water("everyHours" to 3))!!
        assertEquals(settings, ReminderSettings.fromJson(settings.toJson().toString()))
        assertEquals(ReminderSettings.DEFAULT, ReminderSettings.fromJson(ReminderSettings.DEFAULT.toJson().toString()))
        assertNull(ReminderSettings.fromJson("broken"))
        assertNull(ReminderSettings.fromJson(null))
    }

    @Test
    fun `allows a disabled training reminder without days`() {
        assertNotNull(ReminderSettings.parse(training("enabled" to false, "weekdays" to JSONArray()), water()))
        assertNull(ReminderSettings.parse(training("weekdays" to JSONArray()), water()))
    }

    @Test
    fun `rejects wrong training values`() {
        val bad = listOf(
            training("enabled" to "true"),
            training("time" to "24:00"),
            training("time" to "7:00"),
            training("time" to "07:60"),
            training("time" to 700),
            training("weekdays" to JSONArray(listOf(7))),
            training("weekdays" to JSONArray(listOf(-1))),
            training("weekdays" to JSONArray(listOf(1, 1))),
            training("weekdays" to JSONArray(listOf(1.5))),
            training("weekdays" to "0,1"),
            training("title" to ""),
            training("title" to "x".repeat(121)),
            training("title" to "a\nb"),
            training("title" to 5),
            training("sessions" to JSONArray(listOf(session(weekday = 7)))),
            training("sessions" to JSONArray(listOf(session(minutes = 0)))),
            training("sessions" to JSONArray(listOf(session(minutes = 601)))),
            training("sessions" to JSONArray(listOf(session(name = "")))),
            training("sessions" to JSONArray(listOf(session(), session()))),
            training("sessions" to JSONArray(listOf(session().put("kind", "full-a")))),
            training("sessions" to "none"),
            training("unknown" to 1),
            training("enabled" to null),
        )
        bad.forEach { assertNull(it.toString(), ReminderSettings.parse(it, water())) }
    }

    @Test
    fun `rejects wrong water values`() {
        val bad = listOf(
            water("everyHours" to 0),
            water("everyHours" to 5),
            water("everyHours" to 2.5),
            water("everyHours" to "2"),
            water("from" to "21:00", "to" to "09:00"),
            water("from" to "12:00", "to" to "12:00"),
            water("to" to "25:00"),
            water("from" to null),
            water("extra" to true),
        )
        bad.forEach { assertNull(it.toString(), ReminderSettings.parse(training(), it)) }
        assertNull(ReminderSettings.parse(training(), "water"))
        assertNull(ReminderSettings.parse(null, water()))
    }

    private fun meals(vararg changes: Pair<String, Any?>) = JSONObject()
        .put("enabled", true).put("times", JSONArray(listOf("08:30", "13:30", "19:00")))
        .also { json -> changes.forEach { (key, value) -> if (value == null) json.remove(key) else json.put(key, value) } }

    @Test
    fun `settings without meals keep the disabled default`() {
        val settings = ReminderSettings.parse(training(), water())!!
        assertEquals(ReminderSettings.Meals.DEFAULT, settings.meals)
        assertEquals(false, settings.meals.enabled)
    }

    @Test
    fun `parses and round-trips meal reminders`() {
        val settings = ReminderSettings.parse(training(), water(), meals())!!
        assertEquals(listOf(LocalTime.of(8, 30), LocalTime.of(13, 30), LocalTime.of(19, 0)), settings.meals.times)
        assertEquals(true, settings.anyEnabled)
        assertEquals(settings, ReminderSettings.fromJson(settings.toJson().toString()))
    }

    @Test
    fun `reads settings stored before meal reminders existed`() {
        val old = JSONObject().put("training", training()).put("water", water()).toString()
        assertEquals(ReminderSettings.Meals.DEFAULT, ReminderSettings.fromJson(old)!!.meals)
    }

    @Test
    fun `rejects wrong meal values`() {
        val bad = listOf(
            meals("enabled" to "true"),
            meals("times" to JSONArray()),
            meals("times" to JSONArray(listOf("13:30", "08:30"))),
            meals("times" to JSONArray(listOf("08:30", "08:30"))),
            meals("times" to JSONArray(listOf("8:30"))),
            meals("times" to JSONArray(listOf("08:30", "09:30", "10:30", "11:30", "12:30", "13:30", "14:30"))),
            meals("times" to "08:30"),
            meals("extra" to 1),
            meals("times" to null),
        )
        bad.forEach { assertNull(it.toString(), ReminderSettings.parse(training(), water(), it)) }
        assertNull(ReminderSettings.parse(training(), water(), "meals"))
        assertNotNull(ReminderSettings.parse(training(), water(), meals("enabled" to false, "times" to JSONArray())))
    }
}
