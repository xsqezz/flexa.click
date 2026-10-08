package click.flexa.app.reminders

import android.app.AlarmManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import java.time.ZonedDateTime

/**
 * Plans the next reminder of each kind with inexact alarms (no exact-alarm permission). Each slot gets two alarms
 * with the same time: a 15-minute window alarm that is punctual while the phone is in use, and an
 * allow-while-idle alarm that still arrives (a bit later) when the phone sleeps in Doze. Whichever fires first shows
 * the notification and replaces both alarms with the next slot; [ReminderSchedule.shouldNotify] drops duplicates.
 */
object ReminderAlarms {

    const val EXTRA_SLOT = "click.flexa.app.reminders.SLOT"
    private const val ACTION_PREFIX = "click.flexa.app.reminders.FIRE."
    private const val WINDOW_MS = 15 * 60 * 1000L

    fun rescheduleAll(context: Context) {
        val settings = ReminderStore(context).settings()
        val now = ZonedDateTime.now()
        ReminderKind.entries.forEach { schedule(context, it, settings, now) }
    }

    fun schedule(context: Context, kind: ReminderKind, settings: ReminderSettings, now: ZonedDateTime) {
        val alarms = context.getSystemService(AlarmManager::class.java) ?: return
        val next = ReminderSchedule.next(kind, settings, now)
        if (next == null) {
            alarms.cancel(pending(context, kind, WINDOW, 0L))
            alarms.cancel(pending(context, kind, IDLE, 0L))
            return
        }
        val at = next.toInstant().toEpochMilli()
        alarms.setWindow(AlarmManager.RTC_WAKEUP, at, WINDOW_MS, pending(context, kind, WINDOW, at))
        alarms.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, pending(context, kind, IDLE, at))
    }

    fun kindOf(intent: Intent): ReminderKind? =
        intent.action?.takeIf { it.startsWith(ACTION_PREFIX) }?.let { ReminderKind.fromKey(it.removePrefix(ACTION_PREFIX)) }

    private fun pending(context: Context, kind: ReminderKind, variant: Int, slot: Long): PendingIntent {
        val intent = Intent(context, ReminderReceiver::class.java)
            .setAction(ACTION_PREFIX + kind.key)
            .putExtra(EXTRA_SLOT, slot)
        return PendingIntent.getBroadcast(
            context, kind.ordinal * 2 + variant, intent,
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT,
        )
    }

    private const val WINDOW = 0
    private const val IDLE = 1
}
