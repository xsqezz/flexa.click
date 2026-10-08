package click.flexa.app.web

import org.json.JSONObject

/** Messages the web app may send through `window.flexaNative.postMessage`. Everything else is ignored. */
sealed interface NativeMessage {
    data class SaveFile(val name: String, val text: String) : NativeMessage
    data object CheckUpdate : NativeMessage

    companion object {
        const val MAX_MESSAGE_CHARS = 12_000_000
        private const val MAX_NAME_CHARS = 80
        private const val DEFAULT_NAME = "flexa-eksport.json"

        fun parse(raw: String?): NativeMessage? {
            if (raw == null || raw.length > MAX_MESSAGE_CHARS) return null
            val json = try { JSONObject(raw) } catch (_: Exception) { return null }
            return when (json.optString("type")) {
                "check-update" -> CheckUpdate
                "save-file" -> {
                    val text = json.optString("text", "")
                    if (json.optString("mime") != "application/json" || text.isEmpty()) null
                    else SaveFile(safeFileName(json.optString("name")), text)
                }
                else -> null
            }
        }

        fun safeFileName(requested: String): String {
            val cleaned = requested.trim()
                .replace(Regex("[^A-Za-z0-9._ -]"), "-")
                .trim('.', '-', ' ')
                .take(MAX_NAME_CHARS)
            if (cleaned.isEmpty()) return DEFAULT_NAME
            return if (cleaned.endsWith(".json", ignoreCase = true)) cleaned else "$cleaned.json"
        }
    }
}
