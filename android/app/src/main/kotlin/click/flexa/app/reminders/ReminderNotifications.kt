package click.flexa.app.reminders

import android.Manifest
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import androidx.core.app.NotificationChannelCompat
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.core.content.ContextCompat
import click.flexa.app.MainActivity
import click.flexa.app.R
import click.flexa.app.web.AppPaths
import java.time.Duration
import java.time.ZonedDateTime

/** Notification channels and the reminder notifications themselves. */
object ReminderNotifications {

    const val CHANNEL_TRAINING = "reminders.training"
    const val CHANNEL_WATER = "reminders.water"

    fun createChannels(context: Context) {
        NotificationManagerCompat.from(context).createNotificationChannelsCompat(
            listOf(
                NotificationChannelCompat.Builder(CHANNEL_TRAINING, NotificationManagerCompat.IMPORTANCE_DEFAULT)
                    .setName(context.getString(R.string.reminder_channel_training))
                    .setDescription(context.getString(R.string.reminder_channel_training_description))
                    .build(),
                NotificationChannelCompat.Builder(CHANNEL_WATER, NotificationManagerCompat.IMPORTANCE_DEFAULT)
                    .setName(context.getString(R.string.reminder_channel_water))
                    .setDescription(context.getString(R.string.reminder_channel_water_description))
                    .build(),
            ),
        )
    }

    /**
     * Web-style permission state: `granted`, `default` (Android 13+ and not asked yet) or `denied`
     * (refused, notifications switched off for the app, or the needed channel turned off).
     */
    fun permissionState(context: Context, settings: ReminderSettings, asked: Boolean): String {
        val manager = NotificationManagerCompat.from(context)
        if (!manager.areNotificationsEnabled()) {
            return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU && !asked) "default" else "denied"
        }
        val needed = buildList {
            if (settings.training.enabled) add(CHANNEL_TRAINING)
            if (settings.water.enabled) add(CHANNEL_WATER)
        }
        val blocked = needed.any { manager.getNotificationChannelCompat(it)?.importance == NotificationManagerCompat.IMPORTANCE_NONE }
        return if (blocked) "denied" else "granted"
    }

    fun show(context: Context, kind: ReminderKind, settings: ReminderSettings, slot: ZonedDateTime) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU &&
            ContextCompat.checkSelfPermission(context, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED
        ) return
        createChannels(context)
        val builder = when (kind) {
            ReminderKind.TRAINING -> {
                val text = when (val content = ReminderSchedule.trainingText(settings.training, ReminderSchedule.weekdayIndex(slot.toLocalDate()))) {
                    is ReminderSchedule.TrainingText.Session -> context.getString(R.string.reminder_training_session, content.name, content.minutes)
                    is ReminderSchedule.TrainingText.Title -> context.getString(R.string.reminder_training_title, content.title)
                    ReminderSchedule.TrainingText.Generic -> context.getString(R.string.reminder_training_generic)
                }
                val endOfDay = slot.toLocalDate().plusDays(1).atStartOfDay(slot.zone)
                NotificationCompat.Builder(context, CHANNEL_TRAINING)
                    .setContentTitle(context.getString(R.string.reminder_training_heading))
                    .setContentText(text)
                    .setStyle(NotificationCompat.BigTextStyle().bigText(text))
                    .setTimeoutAfter(Duration.between(ZonedDateTime.now(slot.zone), endOfDay).toMillis().coerceAtLeast(MIN_TIMEOUT_MS))
            }
            ReminderKind.WATER -> NotificationCompat.Builder(context, CHANNEL_WATER)
                .setContentTitle(context.getString(R.string.reminder_water_heading))
                .setContentText(context.getString(R.string.reminder_water_text))
                .setTimeoutAfter(Duration.ofHours(settings.water.everyHours.toLong()).toMillis())
        }
        val notification = builder
            .setSmallIcon(R.drawable.ic_notification)
            .setColor(ContextCompat.getColor(context, R.color.flexa_pine))
            .setCategory(NotificationCompat.CATEGORY_REMINDER)
            .setPriority(NotificationCompat.PRIORITY_DEFAULT)
            .setAutoCancel(true)
            .setContentIntent(openApp(context, kind))
            .build()
        NotificationManagerCompat.from(context).notify(NOTIFICATION_BASE_ID + kind.ordinal, notification)
    }

    private fun openApp(context: Context, kind: ReminderKind): PendingIntent {
        val intent = Intent(context, MainActivity::class.java)
            .setAction(ACTION_OPEN + kind.key)
            .putExtra(AppPaths.EXTRA_PATH, kind.path)
            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        return PendingIntent.getActivity(
            context, kind.ordinal, intent,
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT,
        )
    }

    private const val ACTION_OPEN = "click.flexa.app.reminders.OPEN."
    private const val NOTIFICATION_BASE_ID = 4100
    private const val MIN_TIMEOUT_MS = 60 * 60 * 1000L
}
