package click.flexa.app.reminders

import java.time.LocalDate
import java.time.LocalTime
import java.time.ZonedDateTime

/** What a reminder is about and which page of the app its notification opens. */
enum class ReminderKind(val key: String, val path: String) {
    TRAINING("training", "/plan"),
    WATER("water", "/"),
    ;

    companion object {
        fun fromKey(key: String?): ReminderKind? = entries.firstOrNull { it.key == key }
    }
}

/**
 * Pure calendar logic for reminders. Times are wall-clock times in the device's time zone, so "18:00" stays 18:00
 * across daylight saving changes; a time that does not exist on the day of the spring change moves forward by the gap.
 */
object ReminderSchedule {

    /** A late alarm (device asleep or off) older than this is dropped instead of showing a stale reminder. */
    const val MAX_LATENESS_MS = 90 * 60 * 1000L

    fun next(kind: ReminderKind, settings: ReminderSettings, now: ZonedDateTime): ZonedDateTime? = when (kind) {
        ReminderKind.TRAINING -> nextTraining(settings.training, now)
        ReminderKind.WATER -> nextWater(settings.water, now)
    }

    fun nextTraining(training: ReminderSettings.Training, now: ZonedDateTime): ZonedDateTime? {
        if (!training.enabled || training.weekdays.isEmpty()) return null
        val today = now.toLocalDate()
        for (offset in 0L..7L) {
            val date = today.plusDays(offset)
            if (weekdayIndex(date) !in training.weekdays) continue
            val at = ZonedDateTime.of(date, training.time, now.zone)
            if (at.isAfter(now)) return at
        }
        return null
    }

    fun nextWater(water: ReminderSettings.Water, now: ZonedDateTime): ZonedDateTime? {
        if (!water.enabled) return null
        val slots = waterSlots(water)
        val today = now.toLocalDate()
        for (offset in 0L..2L) {
            val date = today.plusDays(offset)
            for (slot in slots) {
                val at = ZonedDateTime.of(date, slot, now.zone)
                if (at.isAfter(now)) return at
            }
        }
        return null
    }

    /** Reminder times within the window: `from`, then every `everyHours`, up to and including `to`. */
    fun waterSlots(water: ReminderSettings.Water): List<LocalTime> {
        val slots = mutableListOf<LocalTime>()
        var time = water.from
        while (!time.isAfter(water.to)) {
            slots += time
            val next = time.plusHours(water.everyHours.toLong())
            if (!next.isAfter(time)) break
            time = next
        }
        return slots
    }

    /** 0 = Monday … 6 = Sunday, the same numbering the training plan uses. */
    fun weekdayIndex(date: LocalDate): Int = date.dayOfWeek.value - 1

    /** Whether an alarm planned for [slotMillis] should still show a notification when it fires at [nowMillis]. */
    fun shouldNotify(slotMillis: Long, nowMillis: Long, lastNotifiedMillis: Long): Boolean =
        slotMillis > lastNotifiedMillis && nowMillis - slotMillis <= MAX_LATENESS_MS

    fun trainingText(training: ReminderSettings.Training, weekday: Int): TrainingText {
        val session = training.sessionFor(weekday)
        return when {
            session != null -> TrainingText.Session(session.name, session.minutes)
            training.title != null -> TrainingText.Title(training.title)
            else -> TrainingText.Generic
        }
    }

    sealed interface TrainingText {
        data class Session(val name: String, val minutes: Int) : TrainingText
        data class Title(val title: String) : TrainingText
        data object Generic : TrainingText
    }
}
