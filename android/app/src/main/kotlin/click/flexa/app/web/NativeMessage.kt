package click.flexa.app.web

import click.flexa.app.reminders.ReminderProtocol
import click.flexa.app.reminders.ReminderSettings
import org.json.JSONObject

/** Messages the web app may send through `window.flexaNative.postMessage`. Everything else is ignored. */
sealed interface NativeMessage {
    data class SaveFile(val name: String, val text: String, val mime: String) : NativeMessage
    data object CheckUpdate : NativeMessage
    data class GetReminders(val id: String?) : NativeMessage
    data class SetReminders(val id: String?, val settings: ReminderSettings) : NativeMessage
    /** A well-formed `reminders.set` whose settings failed validation; the page gets an error reply. */
    data class InvalidReminders(val id: String?) : NativeMessage
    data object OpenNotificationSettings : NativeMessage

    companion object {
        const val MAX_MESSAGE_CHARS = 12_000_000
        const val MIME_JSON = "application/json"
        const val MIME_CSV = "text/csv"
        private const val MAX_NAME_CHARS = 80
        private const val DEFAULT_BASE_NAME = "flexa-eksport"
        private val EXTENSIONS = mapOf(MIME_JSON to "json", MIME_CSV to "csv")
        private val GET_KEYS = setOf("type", "id")
        private val SET_KEYS = setOf("type", "id", "training", "water")

        fun parse(raw: String?): NativeMessage? {
            if (raw == null || raw.length > MAX_MESSAGE_CHARS) return null
            val json = try { JSONObject(raw) } catch (_: Exception) { return null }
            return when (json.optString("type")) {
                "check-update" -> CheckUpdate
                "save-file" -> {
                    val text = json.optString("text", "")
                    val mime = json.optString("mime")
                    if (mime !in EXTENSIONS || text.isEmpty()) null
                    else SaveFile(safeFileName(json.optString("name"), mime), text, mime)
                }
                "reminders.get" -> {
                    if (!GET_KEYS.containsAll(ReminderSettings.keys(json))) return null
                    GetReminders((requestId(json) ?: return null).ifEmpty { null })
                }
                "reminders.set" -> {
                    if (!SET_KEYS.containsAll(ReminderSettings.keys(json))) return null
                    val id = (requestId(json) ?: return null).ifEmpty { null }
                    val settings = ReminderSettings.parse(json.opt("training"), json.opt("water"))
                    if (settings == null) InvalidReminders(id) else SetReminders(id, settings)
                }
                "reminders.open-settings" -> if (ReminderSettings.keys(json) == setOf("type")) OpenNotificationSettings else null
                else -> null
            }
        }

        /** The optional request id: `""` when absent, `null` when present but malformed (the message is then dropped). */
        private fun requestId(json: JSONObject): String? = when (val id = json.opt("id")) {
            null -> ""
            is String -> id.takeIf { ReminderProtocol.isValidId(it) }
            else -> null
        }

        /** Keeps letters, digits, dots, dashes and spaces, and makes the name end with the extension of [mime]. */
        fun safeFileName(requested: String, mime: String = MIME_JSON): String {
            val extension = EXTENSIONS[mime] ?: EXTENSIONS.getValue(MIME_JSON)
            val cleaned = requested.trim()
                .replace(Regex("[^A-Za-z0-9._ -]"), "-")
                .trim('.', '-', ' ')
                .take(MAX_NAME_CHARS)
            if (cleaned.isEmpty()) return "$DEFAULT_BASE_NAME.$extension"
            return if (cleaned.endsWith(".$extension", ignoreCase = true)) cleaned else "$cleaned.$extension"
        }
    }
}
