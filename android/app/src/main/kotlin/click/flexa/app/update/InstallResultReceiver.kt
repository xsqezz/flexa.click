package click.flexa.app.update

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.pm.PackageInstaller
import android.os.Build

class InstallResultReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        val status = intent.getIntExtra(PackageInstaller.EXTRA_STATUS, PackageInstaller.STATUS_FAILURE)
        val message = intent.getStringExtra(PackageInstaller.EXTRA_STATUS_MESSAGE)
        when (status) {
            PackageInstaller.STATUS_PENDING_USER_ACTION -> askUser(context, intent, status, message)
            PackageInstaller.STATUS_SUCCESS -> InstallEvents.publish(InstallEvent.Succeeded)
            PackageInstaller.STATUS_FAILURE_ABORTED -> InstallEvents.publish(InstallEvent.Cancelled)
            else -> InstallEvents.publish(InstallEvent.Failed(status, message))
        }
    }

    private fun askUser(context: Context, intent: Intent, status: Int, message: String?) {
        val confirmation = confirmationIntent(intent)
        if (confirmation == null) {
            InstallEvents.publish(InstallEvent.Failed(status, message))
            return
        }
        confirmation.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        try {
            context.startActivity(confirmation)
            InstallEvents.publish(InstallEvent.AwaitingConfirmation)
        } catch (_: Exception) {
            InstallEvents.publish(InstallEvent.Failed(status, message))
        }
    }

    @Suppress("DEPRECATION")
    private fun confirmationIntent(intent: Intent): Intent? =
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            intent.getParcelableExtra(Intent.EXTRA_INTENT, Intent::class.java)
        } else {
            intent.getParcelableExtra(Intent.EXTRA_INTENT)
        }

    companion object {
        const val ACTION = "click.flexa.app.INSTALL_RESULT"
    }
}
