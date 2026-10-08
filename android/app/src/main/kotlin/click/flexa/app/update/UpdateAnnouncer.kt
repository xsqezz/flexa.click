package click.flexa.app.update

import android.content.Context
import android.content.pm.PackageManager
import android.os.Build
import android.widget.Toast
import click.flexa.app.BuildConfig
import click.flexa.app.R

/**
 * Android closes the app while it is being replaced, so the user reopens it by hand. This confirms, once,
 * that what they just opened is the new version.
 */
object UpdateAnnouncer {
    private const val PREFS = "flexa_update"
    private const val KEY_SEEN_UPDATE_TIME = "seen_update_time"

    /** A fresh install has equal times; every replacement of the package moves lastUpdateTime past firstInstallTime. */
    internal fun shouldAnnounce(firstInstallTime: Long, lastUpdateTime: Long, seenUpdateTime: Long): Boolean =
        lastUpdateTime > firstInstallTime && lastUpdateTime != seenUpdateTime

    fun announceIfUpdated(context: Context) {
        val times = installTimes(context) ?: return
        val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        val seen = prefs.getLong(KEY_SEEN_UPDATE_TIME, 0L)
        if (times.second == seen) return
        prefs.edit().putLong(KEY_SEEN_UPDATE_TIME, times.second).apply()
        if (shouldAnnounce(times.first, times.second, seen)) {
            Toast.makeText(context, context.getString(R.string.update_installed, BuildConfig.VERSION_NAME), Toast.LENGTH_LONG).show()
        }
    }

    @Suppress("DEPRECATION")
    private fun installTimes(context: Context): Pair<Long, Long>? = try {
        val info = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            context.packageManager.getPackageInfo(context.packageName, PackageManager.PackageInfoFlags.of(0))
        } else {
            context.packageManager.getPackageInfo(context.packageName, 0)
        }
        info.firstInstallTime to info.lastUpdateTime
    } catch (_: PackageManager.NameNotFoundException) {
        null
    }
}
