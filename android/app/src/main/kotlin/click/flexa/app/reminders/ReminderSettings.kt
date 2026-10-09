package click.flexa.app.reminders

import org.json.JSONArray
import org.json.JSONObject
import java.time.LocalTime
import java.util.Locale

/**
 * Reminder settings chosen in the web UI (Ustawienia → Aplikacja na Androida). They are stored only on this device.
 * Weekdays use the web convention: 0 = Monday … 6 = Sunday.
 */
data class ReminderSettings(val training: Training, val water: Water, val meals: Meals = Meals.DEFAULT) {

    data class Training(
        val enabled: Boolean,
        val time: LocalTime,
        val weekdays: Set<Int>,
        val title: String? = null,
        val sessions: List<Session> = emptyList(),
    ) {
        fun sessionFor(weekday: Int): Session? = sessions.firstOrNull { it.weekday == weekday }
    }

    data class Session(val weekday: Int, val name: String, val minutes: Int)

    data class Water(val enabled: Boolean, val from: LocalTime, val to: LocalTime, val everyHours: Int)

    /** Times of day (ascending, unique) at which to remind about logging a meal. */
    data class Meals(val enabled: Boolean, val times: List<LocalTime>) {
        companion object {
            const val MAX_TIMES = 6
            val DEFAULT = Meals(enabled = false, times = listOf(LocalTime.of(8, 30), LocalTime.of(13, 30), LocalTime.of(19, 0)))
        }
    }

    val anyEnabled: Boolean get() = training.enabled || water.enabled || meals.enabled

    fun toJson(): JSONObject = JSONObject()
        .put("training", JSONObject().apply {
            put("enabled", training.enabled)
            put("time", formatTime(training.time))
            put("weekdays", JSONArray(training.weekdays.sorted()))
            training.title?.let { put("title", it) }
            if (training.sessions.isNotEmpty()) {
                put("sessions", JSONArray(training.sessions.map {
                    JSONObject().put("weekday", it.weekday).put("name", it.name).put("minutes", it.minutes)
                }))
            }
        })
        .put("water", JSONObject()
            .put("enabled", water.enabled)
            .put("from", formatTime(water.from))
            .put("to", formatTime(water.to))
            .put("everyHours", water.everyHours))
        .put("meals", JSONObject()
            .put("enabled", meals.enabled)
            .put("times", JSONArray(meals.times.map { formatTime(it) })))

    companion object {
        const val MAX_TEXT_CHARS = 120
        const val MAX_MINUTES = 600
        const val MIN_EVERY_HOURS = 1
        const val MAX_EVERY_HOURS = 4

        val DEFAULT = ReminderSettings(
            Training(enabled = false, time = LocalTime.of(18, 0), weekdays = emptySet()),
            Water(enabled = false, from = LocalTime.of(9, 0), to = LocalTime.of(21, 0), everyHours = 2),
        )

        private val TIME = Regex("^([01]\\d|2[0-3]):([0-5]\\d)$")
        private val TRAINING_KEYS = setOf("enabled", "time", "weekdays", "title", "sessions")
        private val SESSION_KEYS = setOf("weekday", "name", "minutes")
        private val WATER_KEYS = setOf("enabled", "from", "to", "everyHours")
        private val MEALS_KEYS = setOf("enabled", "times")

        fun formatTime(time: LocalTime): String = String.format(Locale.ROOT, "%02d:%02d", time.hour, time.minute)

        fun keys(json: JSONObject): Set<String> = json.keys().asSequence().toSet()

        /** Strict parser: any unknown key, wrong type or out-of-range value rejects the whole settings object. */
        fun parse(training: Any?, water: Any?, meals: Any? = null): ReminderSettings? {
            val t = parseTraining(training as? JSONObject ?: return null) ?: return null
            val w = parseWater(water as? JSONObject ?: return null) ?: return null
            // Pages and settings saved before meal reminders existed have no "meals" key: they keep the disabled default.
            val m = when (meals) {
                null, JSONObject.NULL -> Meals.DEFAULT
                is JSONObject -> parseMeals(meals) ?: return null
                else -> return null
            }
            return ReminderSettings(t, w, m)
        }

        fun fromJson(raw: String?): ReminderSettings? {
            if (raw == null) return null
            val json = try { JSONObject(raw) } catch (_: Exception) { return null }
            val known = keys(json)
            if (!known.containsAll(setOf("training", "water")) || !setOf("training", "water", "meals").containsAll(known)) return null
            return parse(json.opt("training"), json.opt("water"), json.opt("meals"))
        }

        private fun parseTraining(json: JSONObject): Training? {
            if (!TRAINING_KEYS.containsAll(keys(json))) return null
            val enabled = json.opt("enabled") as? Boolean ?: return null
            val time = time(json.opt("time")) ?: return null
            val days = json.opt("weekdays") as? JSONArray ?: return null
            if (days.length() > 7) return null
            val weekdays = (0 until days.length()).map { weekday(days.opt(it)) ?: return null }
            if (weekdays.toSet().size != weekdays.size) return null
            if (enabled && weekdays.isEmpty()) return null
            val title = when (val raw = json.opt("title")) {
                null, JSONObject.NULL -> null
                else -> text(raw) ?: return null
            }
            val sessions = when (val raw = json.opt("sessions")) {
                null, JSONObject.NULL -> emptyList()
                is JSONArray -> {
                    if (raw.length() > 7) return null
                    (0 until raw.length()).map { session(raw.opt(it)) ?: return null }
                }
                else -> return null
            }
            if (sessions.map { it.weekday }.toSet().size != sessions.size) return null
            return Training(enabled, time, weekdays.toSet(), title, sessions)
        }

        private fun session(raw: Any?): Session? {
            val json = raw as? JSONObject ?: return null
            if (keys(json) != SESSION_KEYS) return null
            val weekday = weekday(json.opt("weekday")) ?: return null
            val name = text(json.opt("name")) ?: return null
            val minutes = int(json.opt("minutes"))?.takeIf { it in 1..MAX_MINUTES } ?: return null
            return Session(weekday, name, minutes)
        }

        private fun parseWater(json: JSONObject): Water? {
            if (keys(json) != WATER_KEYS) return null
            val enabled = json.opt("enabled") as? Boolean ?: return null
            val from = time(json.opt("from")) ?: return null
            val to = time(json.opt("to")) ?: return null
            if (!from.isBefore(to)) return null
            val every = int(json.opt("everyHours"))?.takeIf { it in MIN_EVERY_HOURS..MAX_EVERY_HOURS } ?: return null
            return Water(enabled, from, to, every)
        }

        private fun parseMeals(json: JSONObject): Meals? {
            if (keys(json) != MEALS_KEYS) return null
            val enabled = json.opt("enabled") as? Boolean ?: return null
            val raw = json.opt("times") as? JSONArray ?: return null
            if (raw.length() > Meals.MAX_TIMES) return null
            val times = (0 until raw.length()).map { time(raw.opt(it)) ?: return null }
            if (times.zipWithNext().any { (a, b) -> !a.isBefore(b) }) return null
            if (enabled && times.isEmpty()) return null
            return Meals(enabled, times)
        }

        private fun time(raw: Any?): LocalTime? {
            val match = TIME.matchEntire(raw as? String ?: return null) ?: return null
            return LocalTime.of(match.groupValues[1].toInt(), match.groupValues[2].toInt())
        }

        /** Whole numbers only (JSON `2`, not `2.5` or `"2"`). */
        private fun int(raw: Any?): Int? = when (raw) {
            is Int -> raw
            is Long -> raw.takeIf { it in Int.MIN_VALUE..Int.MAX_VALUE }?.toInt()
            else -> null
        }

        private fun weekday(raw: Any?): Int? = int(raw)?.takeIf { it in 0..6 }

        private fun text(raw: Any?): String? {
            val value = (raw as? String)?.trim() ?: return null
            if (value.isEmpty() || value.length > MAX_TEXT_CHARS) return null
            if (value.any { it.isISOControl() }) return null
            return value
        }
    }
}
