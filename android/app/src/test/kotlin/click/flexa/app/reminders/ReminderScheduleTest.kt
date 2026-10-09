package click.flexa.app.reminders

import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import java.time.LocalDate
import java.time.LocalDateTime
import java.time.LocalTime
import java.time.ZoneId
import java.time.ZonedDateTime

class ReminderScheduleTest {
    private val warsaw = ZoneId.of("Europe/Warsaw")

    private fun at(text: String, zone: ZoneId = warsaw): ZonedDateTime = LocalDateTime.parse(text).atZone(zone)

    private fun training(time: String = "18:00", vararg days: Int, enabled: Boolean = true) =
        ReminderSettings.Training(enabled, LocalTime.parse(time), days.toSet())

    private fun water(from: String = "09:00", to: String = "21:00", every: Int = 2, enabled: Boolean = true) =
        ReminderSettings.Water(enabled, LocalTime.parse(from), LocalTime.parse(to), every)

    @Test
    fun `uses Monday as day 0 like the training plan`() {
        assertEquals(0, ReminderSchedule.weekdayIndex(LocalDate.parse("2026-10-05")))
        assertEquals(3, ReminderSchedule.weekdayIndex(LocalDate.parse("2026-10-08")))
        assertEquals(6, ReminderSchedule.weekdayIndex(LocalDate.parse("2026-10-11")))
    }

    @Test
    fun `next training is later today on a training day`() {
        // 2026-10-08 is a Thursday (3).
        assertEquals(at("2026-10-08T18:00"), ReminderSchedule.nextTraining(training("18:00", 3), at("2026-10-08T09:15")))
    }

    @Test
    fun `next training skips to the next planned day once today's time has passed`() {
        val plan = training("18:00", 0, 3, 5)
        assertEquals(at("2026-10-10T18:00"), ReminderSchedule.nextTraining(plan, at("2026-10-08T18:00")))
        assertEquals(at("2026-10-12T18:00"), ReminderSchedule.nextTraining(plan, at("2026-10-10T20:00")))
    }

    @Test
    fun `a single weekly day comes back a week later`() {
        assertEquals(at("2026-10-15T07:30"), ReminderSchedule.nextTraining(training("07:30", 3), at("2026-10-08T08:00")))
    }

    @Test
    fun `disabled or empty training reminders never fire`() {
        assertNull(ReminderSchedule.nextTraining(training("18:00", 3, enabled = false), at("2026-10-08T09:00")))
        assertNull(ReminderSchedule.nextTraining(training("18:00"), at("2026-10-08T09:00")))
    }

    @Test
    fun `keeps the wall-clock time across the autumn daylight saving change`() {
        // 2026-10-25 (Sunday): clocks go back from 03:00 CEST to 02:00 CET.
        val plan = training("18:00", 5, 6)
        val sunday = ReminderSchedule.nextTraining(plan, at("2026-10-24T19:00"))!!
        assertEquals(LocalDateTime.parse("2026-10-25T18:00"), sunday.toLocalDateTime())
        assertEquals(3600, sunday.offset.totalSeconds)
        assertEquals(25 * 3600L, java.time.Duration.between(at("2026-10-24T18:00"), sunday).seconds)
    }

    @Test
    fun `a time inside the spring gap moves forward by the gap and fires once`() {
        // 2026-03-29 (Sunday): 02:00 CET jumps to 03:00 CEST, so 02:30 does not exist.
        val plan = training("02:30", 6)
        val first = ReminderSchedule.nextTraining(plan, at("2026-03-28T12:00"))!!
        assertEquals(LocalDateTime.parse("2026-03-29T03:30"), first.toLocalDateTime())
        assertEquals(LocalDateTime.parse("2026-04-05T02:30"), ReminderSchedule.nextTraining(plan, first)!!.toLocalDateTime())
    }

    @Test
    fun `an ambiguous autumn time fires only once`() {
        // 02:30 happens twice on 2026-10-25; the first occurrence is used and the second is skipped.
        val plan = training("02:30", 6)
        val first = ReminderSchedule.nextTraining(plan, at("2026-10-24T12:00"))!!
        assertEquals(7200, first.offset.totalSeconds)
        assertEquals(LocalDate.parse("2026-11-01"), ReminderSchedule.nextTraining(plan, first)!!.toLocalDate())
    }

    @Test
    fun `uses the device time zone`() {
        val tokyo = ZoneId.of("Asia/Tokyo")
        assertEquals(at("2026-10-08T18:00", tokyo), ReminderSchedule.nextTraining(training("18:00", 3), at("2026-10-08T10:00", tokyo)))
    }

    @Test
    fun `water slots fill the window`() {
        assertEquals(
            listOf("09:00", "11:00", "13:00", "15:00", "17:00", "19:00", "21:00").map(LocalTime::parse),
            ReminderSchedule.waterSlots(water()),
        )
        assertEquals(listOf("09:00", "12:00", "15:00", "18:00", "21:00").map(LocalTime::parse), ReminderSchedule.waterSlots(water(every = 3)))
        assertEquals(listOf("09:00", "13:00", "17:00").map(LocalTime::parse), ReminderSchedule.waterSlots(water(to = "20:00", every = 4)))
        assertEquals(listOf("20:00", "23:00").map(LocalTime::parse), ReminderSchedule.waterSlots(water("20:00", "23:59", 3)))
        assertEquals(listOf(LocalTime.parse("22:30")), ReminderSchedule.waterSlots(water("22:30", "23:00", 4)))
    }

    @Test
    fun `next water reminder`() {
        val plan = water()
        assertEquals(at("2026-10-08T09:00"), ReminderSchedule.nextWater(plan, at("2026-10-08T06:00")))
        assertEquals(at("2026-10-08T13:00"), ReminderSchedule.nextWater(plan, at("2026-10-08T11:00")))
        assertEquals(at("2026-10-08T13:00"), ReminderSchedule.nextWater(plan, at("2026-10-08T12:59")))
        assertEquals(at("2026-10-09T09:00"), ReminderSchedule.nextWater(plan, at("2026-10-08T21:00")))
        assertEquals(at("2026-10-09T09:00"), ReminderSchedule.nextWater(plan, at("2026-10-08T23:30")))
        assertNull(ReminderSchedule.nextWater(water(enabled = false), at("2026-10-08T06:00")))
    }

    @Test
    fun `water reminders follow the wall clock on the spring change`() {
        val plan = water("01:00", "05:00", 1)
        val gap = ReminderSchedule.nextWater(plan, at("2026-03-29T01:30"))!!
        assertEquals(LocalDateTime.parse("2026-03-29T03:00"), gap.toLocalDateTime())
        assertEquals(LocalDateTime.parse("2026-03-29T04:00"), ReminderSchedule.nextWater(plan, gap)!!.toLocalDateTime())
    }

    @Test
    fun `next dispatches by kind`() {
        val settings = ReminderSettings(training("18:00", 3), water())
        assertEquals(at("2026-10-08T18:00"), ReminderSchedule.next(ReminderKind.TRAINING, settings, at("2026-10-08T17:00")))
        assertEquals(at("2026-10-08T17:00"), ReminderSchedule.next(ReminderKind.WATER, settings, at("2026-10-08T16:00")))
        assertEquals(ReminderKind.WATER, ReminderKind.fromKey("water"))
        assertEquals("/plan", ReminderKind.TRAINING.path)
        assertEquals("/", ReminderKind.WATER.path)
        assertNull(ReminderKind.fromKey("other"))
    }

    @Test
    fun `drops duplicate and stale alarms`() {
        val slot = 1_000_000_000L
        assertTrue(ReminderSchedule.shouldNotify(slot, slot + 60_000, 0))
        assertTrue(ReminderSchedule.shouldNotify(slot, slot + ReminderSchedule.MAX_LATENESS_MS, slot - 1))
        assertFalse(ReminderSchedule.shouldNotify(slot, slot + 60_000, slot))
        assertFalse(ReminderSchedule.shouldNotify(slot, slot + ReminderSchedule.MAX_LATENESS_MS + 1, 0))
    }

    @Test
    fun `training text prefers the session of the day`() {
        val sessions = listOf(ReminderSettings.Session(3, "Dzień 2: Nogi", 50))
        val withSession = ReminderSettings.Training(true, LocalTime.NOON, setOf(0, 3), "Mój plan", sessions)
        assertEquals(ReminderSchedule.TrainingText.Session("Dzień 2: Nogi", 50), ReminderSchedule.trainingText(withSession, 3))
        assertEquals(ReminderSchedule.TrainingText.Title("Mój plan"), ReminderSchedule.trainingText(withSession, 0))
        assertEquals(ReminderSchedule.TrainingText.Generic, ReminderSchedule.trainingText(withSession.copy(title = null), 0))
    }

    @Test
    fun `state replies carry the settings, permission and request id`() {
        val reply = JSONObject(ReminderProtocol.state("r-1", ReminderSettings.DEFAULT, ReminderProtocol.PERMISSION_DEFAULT))
        assertEquals("reminders.state", reply.getString("type"))
        assertEquals("r-1", reply.getString("id"))
        assertEquals("default", reply.getString("permission"))
        assertTrue(reply.getBoolean("supported"))
        assertEquals("18:00", reply.getJSONObject("training").getString("time"))
        assertEquals(2, reply.getJSONObject("water").getInt("everyHours"))
        assertFalse(JSONObject(ReminderProtocol.state(null, ReminderSettings.DEFAULT, "granted")).has("id"))
        val error = JSONObject(ReminderProtocol.error("r-2"))
        assertEquals("reminders.error", error.getString("type"))
        assertEquals("r-2", error.getString("id"))
    }

    private fun meals(vararg times: String, enabled: Boolean = true) =
        ReminderSettings.Meals(enabled, times.map { LocalTime.parse(it) })

    @Test
    fun `next meal reminder is the following time of day`() {
        val plan = meals("08:30", "13:30", "19:00")
        assertEquals(at("2026-10-08T13:30"), ReminderSchedule.nextMeals(plan, at("2026-10-08T09:00")))
        assertEquals(at("2026-10-08T19:00"), ReminderSchedule.nextMeals(plan, at("2026-10-08T13:30")))
    }

    @Test
    fun `meal reminders roll over to the next morning`() {
        assertEquals(at("2026-10-09T08:30"), ReminderSchedule.nextMeals(meals("08:30", "19:00"), at("2026-10-08T20:00")))
    }

    @Test
    fun `disabled or empty meal reminders never fire`() {
        assertNull(ReminderSchedule.nextMeals(meals("08:30", enabled = false), at("2026-10-08T07:00")))
        assertNull(ReminderSchedule.nextMeals(meals(), at("2026-10-08T07:00")))
    }

    @Test
    fun `meal reminders open the meals page`() {
        assertEquals("/meals", ReminderKind.MEALS.path)
        assertEquals(ReminderKind.MEALS, ReminderKind.fromKey("meals"))
        val settings = ReminderSettings.DEFAULT.copy(meals = meals("12:00"))
        assertEquals(at("2026-10-08T12:00"), ReminderSchedule.next(ReminderKind.MEALS, settings, at("2026-10-08T08:00")))
    }
}
