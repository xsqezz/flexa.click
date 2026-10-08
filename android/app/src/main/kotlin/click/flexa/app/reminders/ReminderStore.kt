package click.flexa.app.reminders

import android.content.Context
import androidx.core.content.edit

/** Reminder settings and bookkeeping in private SharedPreferences (excluded from backups like everything else). */
class ReminderStore(context: Context) {

    private val prefs = context.applicationContext.getSharedPreferences(FILE, Context.MODE_PRIVATE)

    fun settings(): ReminderSettings = ReminderSettings.fromJson(prefs.getString(KEY_SETTINGS, null)) ?: ReminderSettings.DEFAULT

    fun save(settings: ReminderSettings) = prefs.edit { putString(KEY_SETTINGS, settings.toJson().toString()) }

    var permissionAsked: Boolean
        get() = prefs.getBoolean(KEY_PERMISSION_ASKED, false)
        set(value) = prefs.edit { putBoolean(KEY_PERMISSION_ASKED, value) }

    fun lastNotified(kind: ReminderKind): Long = prefs.getLong(KEY_LAST_NOTIFIED + kind.key, 0L)

    fun markNotified(kind: ReminderKind, slotMillis: Long) = prefs.edit { putLong(KEY_LAST_NOTIFIED + kind.key, slotMillis) }

    private companion object {
        const val FILE = "reminders"
        const val KEY_SETTINGS = "settings"
        const val KEY_PERMISSION_ASKED = "notificationPermissionAsked"
        const val KEY_LAST_NOTIFIED = "lastNotified."
    }
}
