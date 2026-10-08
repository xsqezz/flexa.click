package click.flexa.app.reminders

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import java.time.Instant
import java.time.ZoneId
import java.time.ZonedDateTime

/** A reminder alarm fired: show the notification (unless it is a duplicate or too late) and plan the next one. */
class ReminderReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        val kind = ReminderAlarms.kindOf(intent) ?: return
        val slot = intent.getLongExtra(ReminderAlarms.EXTRA_SLOT, 0L)
        val store = ReminderStore(context)
        val settings = store.settings()
        val enabled = when (kind) {
            ReminderKind.TRAINING -> settings.training.enabled
            ReminderKind.WATER -> settings.water.enabled
        }
        if (enabled && ReminderSchedule.shouldNotify(slot, System.currentTimeMillis(), store.lastNotified(kind))) {
            store.markNotified(kind, slot)
            ReminderNotifications.show(context, kind, settings, Instant.ofEpochMilli(slot).atZone(ZoneId.systemDefault()))
        }
        ReminderAlarms.schedule(context, kind, settings, ZonedDateTime.now())
    }
}

/** Alarms do not survive a reboot, and wall-clock times must be recomputed after a time zone or clock change or an update. */
class ReminderRescheduleReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action in ACTIONS) ReminderAlarms.rescheduleAll(context)
    }

    private companion object {
        val ACTIONS = setOf(
            Intent.ACTION_BOOT_COMPLETED,
            Intent.ACTION_TIMEZONE_CHANGED,
            Intent.ACTION_TIME_CHANGED,
            Intent.ACTION_MY_PACKAGE_REPLACED,
        )
    }
}
