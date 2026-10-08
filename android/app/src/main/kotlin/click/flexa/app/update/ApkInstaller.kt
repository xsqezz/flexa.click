package click.flexa.app.update

import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.content.IntentSender
import android.content.pm.PackageInfo
import android.content.pm.PackageInstaller
import android.content.pm.PackageManager
import android.os.Build
import android.provider.Settings
import androidx.core.content.pm.PackageInfoCompat
import androidx.core.net.toUri
import java.io.File

/** Installs a downloaded APK over the running app through the system package installer. */
class ApkInstaller(private val context: Context) {

    enum class Problem { NOT_AN_APK, WRONG_PACKAGE, WRONG_VERSION, WRONG_SIGNATURE }

    fun canInstall(): Boolean = context.packageManager.canRequestPackageInstalls()

    fun permissionSettingsIntent(): Intent =
        Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES, "package:${context.packageName}".toUri())

    /** Checks the file before the system installer sees it, so a wrong download fails with a clear message. */
    fun inspect(apk: File, manifest: UpdateManifest): Problem? {
        val archive = archiveInfo(apk) ?: return Problem.NOT_AN_APK
        if (archive.packageName != context.packageName) return Problem.WRONG_PACKAGE
        if (PackageInfoCompat.getLongVersionCode(archive) != manifest.versionCode.toLong()) return Problem.WRONG_VERSION
        if (!signedByUs(archive)) return Problem.WRONG_SIGNATURE
        return null
    }

    fun install(apk: File) {
        val installer = context.packageManager.packageInstaller
        installer.mySessions.forEach { runCatching { installer.abandonSession(it.sessionId) } }
        val params = PackageInstaller.SessionParams(PackageInstaller.SessionParams.MODE_FULL_INSTALL).apply {
            setAppPackageName(context.packageName)
            setSize(apk.length())
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                setRequireUserAction(PackageInstaller.SessionParams.USER_ACTION_REQUIRED)
            }
        }
        val sessionId = installer.createSession(params)
        try {
            installer.openSession(sessionId).use { session ->
                apk.inputStream().use { input ->
                    session.openWrite(SESSION_FILE, 0, apk.length()).use { output ->
                        input.copyTo(output)
                        session.fsync(output)
                    }
                }
                session.commit(resultSender(sessionId))
            }
        } catch (e: Exception) {
            runCatching { installer.abandonSession(sessionId) }
            throw e
        }
    }

    private fun resultSender(sessionId: Int): IntentSender {
        val intent = Intent(context, InstallResultReceiver::class.java).setAction(InstallResultReceiver.ACTION)
        val flags = PendingIntent.FLAG_UPDATE_CURRENT or
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) PendingIntent.FLAG_MUTABLE else 0
        return PendingIntent.getBroadcast(context, sessionId, intent, flags).intentSender
    }

    @Suppress("DEPRECATION")
    private fun archiveInfo(apk: File): PackageInfo? {
        val manager = context.packageManager
        return when {
            Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU ->
                manager.getPackageArchiveInfo(apk.path, PackageManager.PackageInfoFlags.of(SIGNING_FLAGS.toLong()))
            else -> manager.getPackageArchiveInfo(apk.path, SIGNING_FLAGS)
        }
    }

    @Suppress("DEPRECATION")
    private fun signedByUs(archive: PackageInfo): Boolean {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.P) return true
        val manager = context.packageManager
        val installed = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            manager.getPackageInfo(context.packageName, PackageManager.PackageInfoFlags.of(SIGNING_FLAGS.toLong()))
        } else {
            manager.getPackageInfo(context.packageName, SIGNING_FLAGS)
        }
        val ours = installed.signingInfo?.apkContentsSigners?.toSet() ?: return true
        val theirs = archive.signingInfo?.apkContentsSigners?.toSet() ?: return true
        return ours == theirs
    }

    private companion object {
        const val SESSION_FILE = "flexa.apk"

        @Suppress("DEPRECATION")
        val SIGNING_FLAGS: Int =
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) PackageManager.GET_SIGNING_CERTIFICATES
            else PackageManager.GET_SIGNATURES
    }
}
