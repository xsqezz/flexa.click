package click.flexa.app.reminders

import android.Manifest
import android.content.ActivityNotFoundException
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.provider.Settings
import androidx.activity.ComponentActivity
import androidx.activity.result.contract.ActivityResultContracts
import androidx.core.content.ContextCompat
import click.flexa.app.web.NativeMessage
import java.time.ZonedDateTime

/**
 * Activity side of reminders: answers `reminders.*` messages from the page, stores settings, (re)plans alarms and
 * asks for the notification permission on Android 13+ when the user turns a reminder on.
 */
class ReminderController(private val activity: ComponentActivity) {

    // Lazy: the controller is created with the activity, before the activity has a context.
    private val store by lazy { ReminderStore(activity) }
    private val waiting = mutableListOf<() -> Unit>()
    private var requesting = false

    private val permissionLauncher = activity.registerForActivityResult(ActivityResultContracts.RequestPermission()) {
        store.permissionAsked = true
        requesting = false
        val callbacks = waiting.toList()
        waiting.clear()
        callbacks.forEach { it() }
    }

    /** Called on app start: channels exist before the first reminder, alarms are restored after a force stop. */
    fun onAppStart() {
        ReminderNotifications.createChannels(activity)
        ReminderAlarms.rescheduleAll(activity)
    }

    fun handle(message: NativeMessage, reply: (String) -> Unit) {
        when (message) {
            is NativeMessage.GetReminders -> reply(state(message.id))
            is NativeMessage.InvalidReminders -> reply(ReminderProtocol.error(message.id))
            is NativeMessage.SetReminders -> set(message, reply)
            NativeMessage.OpenNotificationSettings -> openNotificationSettings()
            else -> Unit
        }
    }

    private fun set(message: NativeMessage.SetReminders, reply: (String) -> Unit) {
        val settings = message.settings
        store.save(settings)
        val now = ZonedDateTime.now()
        ReminderKind.entries.forEach { ReminderAlarms.schedule(activity, it, settings, now) }
        if (settings.anyEnabled && needsPermission()) {
            waiting += { reply(state(message.id)) }
            if (!requesting) {
                requesting = true
                permissionLauncher.launch(Manifest.permission.POST_NOTIFICATIONS)
            }
        } else {
            reply(state(message.id))
        }
    }

    private fun needsPermission(): Boolean =
        Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU &&
            ContextCompat.checkSelfPermission(activity, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED

    private fun state(id: String?): String {
        val settings = store.settings()
        return ReminderProtocol.state(id, settings, ReminderNotifications.permissionState(activity, settings, store.permissionAsked))
    }

    private fun openNotificationSettings() {
        val notifications = Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS)
            .putExtra(Settings.EXTRA_APP_PACKAGE, activity.packageName)
        val details = Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.fromParts("package", activity.packageName, null))
        for (intent in listOf(notifications, details)) {
            try {
                activity.startActivity(intent)
                return
            } catch (_: ActivityNotFoundException) {
                // Try the next, more generic settings screen.
            }
        }
    }
}
