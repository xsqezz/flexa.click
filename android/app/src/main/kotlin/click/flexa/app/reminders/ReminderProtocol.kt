package click.flexa.app.reminders

import org.json.JSONObject

/** Replies sent back to the page through `window.flexaNative` (`onmessage` / `addEventListener('message')`). */
object ReminderProtocol {
    const val PERMISSION_GRANTED = "granted"
    const val PERMISSION_DENIED = "denied"
    const val PERMISSION_DEFAULT = "default"

    private val REQUEST_ID = Regex("^[A-Za-z0-9-]{1,40}$")

    fun isValidId(id: String): Boolean = REQUEST_ID.matches(id)

    fun state(id: String?, settings: ReminderSettings, permission: String): String {
        val json = settings.toJson()
            .put("type", "reminders.state")
            .put("permission", permission)
            .put("supported", true)
        if (id != null) json.put("id", id)
        return json.toString()
    }

    fun error(id: String?, reason: String = "invalid"): String {
        val json = JSONObject().put("type", "reminders.error").put("reason", reason)
        if (id != null) json.put("id", id)
        return json.toString()
    }
}
