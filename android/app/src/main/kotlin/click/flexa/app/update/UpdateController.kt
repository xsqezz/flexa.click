package click.flexa.app.update

import android.app.Activity
import android.content.ActivityNotFoundException
import android.content.Intent
import android.content.pm.PackageInstaller
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.os.SystemClock
import android.widget.Toast
import androidx.core.net.toUri
import click.flexa.app.BuildConfig
import click.flexa.app.R
import java.io.File
import java.io.IOException
import java.util.concurrent.Executors

/**
 * Finds a newer release, asks the user, downloads it and hands it to the system installer.
 * All state lives on the main thread; only network and disk work runs on the single worker thread.
 */
class UpdateController(private val activity: Activity) {

    private enum class State { IDLE, CHECKING, PROMPT, PERMISSION_DIALOG, AWAITING_PERMISSION, DOWNLOADING, INSTALLING }
    private enum class DownloadFailure { CANCELLED, CORRUPT, NETWORK }

    private val main = Handler(Looper.getMainLooper())
    private val worker = Executors.newSingleThreadExecutor()
    private val dialogs = UpdateDialogs(activity)
    private val installer = ApkInstaller(activity)
    private val userAgent = "FlexaAndroid/${BuildConfig.VERSION_NAME}"
    private val checker = UpdateChecker(BuildConfig.UPDATE_MANIFEST_URL, BuildConfig.UPDATE_URL_PREFIX, userAgent)
    private val storage = File(activity.cacheDir, "updates")

    private var state = State.IDLE
    private var pending: UpdateManifest? = null
    private var downloader: ApkDownloader? = null
    private var lastCheckAt = 0L
    private var declined = false
    private var destroyed = false

    init {
        InstallEvents.listener = ::onInstallEvent
        worker.execute { storage.listFiles()?.forEach { it.delete() } }
    }

    fun checkOnLaunch() = check(interactive = false)

    fun checkInteractively() = check(interactive = true)

    fun onResume() {
        if (destroyed) return
        when (state) {
            State.AWAITING_PERMISSION -> {
                val manifest = pending
                if (manifest != null && installer.canInstall()) {
                    download(manifest)
                } else {
                    reset()
                    toast(R.string.update_permission_denied)
                }
            }
            State.IDLE -> if (SystemClock.elapsedRealtime() - lastCheckAt > RECHECK_INTERVAL_MS && lastCheckAt != 0L) check(false)
            else -> Unit
        }
    }

    fun onDestroy() {
        destroyed = true
        downloader?.cancel()
        dialogs.dismiss()
        if (InstallEvents.listener != null) InstallEvents.listener = null
        worker.shutdownNow()
    }

    private fun check(interactive: Boolean) {
        if (destroyed) return
        if (state != State.IDLE) {
            if (interactive) toast(R.string.update_busy)
            return
        }
        state = State.CHECKING
        lastCheckAt = SystemClock.elapsedRealtime()
        if (interactive) toast(R.string.update_checking)
        worker.execute {
            val result = runCatching { checker.fetch() }
            main.post { if (!destroyed) onChecked(result, interactive) }
        }
    }

    private fun onChecked(result: Result<UpdateManifest>, interactive: Boolean) {
        state = State.IDLE
        val manifest = result.getOrElse {
            if (interactive) toast(R.string.update_check_failed)
            return
        }
        if (!manifest.isNewerThan(BuildConfig.VERSION_CODE)) {
            if (interactive) toast(R.string.update_up_to_date, BuildConfig.VERSION_NAME)
            return
        }
        if (manifest.minSdk > Build.VERSION.SDK_INT) {
            if (interactive) toast(R.string.update_needs_newer_android, BuildConfig.VERSION_NAME)
            return
        }
        val mandatory = manifest.isMandatoryFor(BuildConfig.VERSION_CODE)
        if (!interactive && declined && !mandatory) return
        state = State.PROMPT
        dialogs.prompt(
            manifest, mandatory,
            onInstall = { begin(manifest) },
            onLater = { declined = true; reset() },
            onClose = { activity.finish() },
        )
    }

    private fun begin(manifest: UpdateManifest) {
        pending = manifest
        if (installer.canInstall()) {
            download(manifest)
            return
        }
        state = State.PERMISSION_DIALOG
        dialogs.permission(
            onOpenSettings = {
                state = State.AWAITING_PERMISSION
                try {
                    activity.startActivity(installer.permissionSettingsIntent())
                } catch (_: ActivityNotFoundException) {
                    reset()
                    toast(R.string.update_permission_denied)
                }
            },
            onCancel = { reset() },
        )
    }

    private fun download(manifest: UpdateManifest) {
        state = State.DOWNLOADING
        val loader = ApkDownloader(userAgent)
        downloader = loader
        val target = File(storage, "flexa-${manifest.versionCode}.apk")
        dialogs.progress(onCancel = { loader.cancel() })
        worker.execute {
            val failure = try {
                loader.download(manifest, target) { done, total ->
                    main.post { if (!destroyed && state == State.DOWNLOADING) dialogs.updateProgress(done, total) }
                }
                null
            } catch (_: DownloadCancelledException) {
                DownloadFailure.CANCELLED
            } catch (_: VerificationException) {
                DownloadFailure.CORRUPT
            } catch (_: IOException) {
                DownloadFailure.NETWORK
            }
            main.post { if (!destroyed) onDownloaded(manifest, target, failure) }
        }
    }

    private fun onDownloaded(manifest: UpdateManifest, apk: File, failure: DownloadFailure?) {
        downloader = null
        when (failure) {
            null -> verifyAndInstall(manifest, apk)
            DownloadFailure.CANCELLED -> { dialogs.dismiss(); reset() }
            DownloadFailure.CORRUPT -> fail(activity.getString(R.string.update_verify_failed), retry = true)
            DownloadFailure.NETWORK -> fail(activity.getString(R.string.update_download_failed), retry = true)
        }
    }

    private fun verifyAndInstall(manifest: UpdateManifest, apk: File) {
        val problem = installer.inspect(apk, manifest)
        if (problem != null) {
            apk.delete()
            val signature = problem == ApkInstaller.Problem.WRONG_SIGNATURE
            fail(activity.getString(if (signature) R.string.update_wrong_signature else R.string.update_verify_failed), retry = !signature)
            return
        }
        state = State.INSTALLING
        dialogs.dismiss()
        try {
            installer.install(apk)
            toast(R.string.update_confirm_hint)
        } catch (e: Exception) {
            fail(activity.getString(R.string.update_install_failed, e.message ?: activity.getString(R.string.update_failed_generic)), retry = true)
        }
    }

    private fun onInstallEvent(event: InstallEvent) {
        if (destroyed) return
        when (event) {
            InstallEvent.AwaitingConfirmation -> state = State.INSTALLING
            InstallEvent.Cancelled, InstallEvent.Succeeded -> reset()
            is InstallEvent.Failed -> {
                val reason = when (event.status) {
                    PackageInstaller.STATUS_FAILURE_STORAGE -> R.string.update_failed_storage
                    PackageInstaller.STATUS_FAILURE_BLOCKED -> R.string.update_failed_blocked
                    PackageInstaller.STATUS_FAILURE_INCOMPATIBLE, PackageInstaller.STATUS_FAILURE_CONFLICT -> R.string.update_failed_incompatible
                    else -> R.string.update_failed_generic
                }
                val incompatible = reason == R.string.update_failed_incompatible
                fail(activity.getString(R.string.update_install_failed, activity.getString(reason)), retry = !incompatible)
            }
        }
    }

    private fun fail(message: String, retry: Boolean) {
        val manifest = pending
        state = State.IDLE
        dialogs.error(
            message,
            onRetry = if (retry && manifest != null) ({ begin(manifest) }) else null,
            onManual = ::openDownloadPage,
        )
    }

    private fun reset() {
        state = State.IDLE
        pending = null
    }

    private fun openDownloadPage() {
        try {
            activity.startActivity(Intent(Intent.ACTION_VIEW, BuildConfig.DOWNLOAD_PAGE_URL.toUri()))
        } catch (_: ActivityNotFoundException) {
            toast(R.string.cannot_open_link)
        }
    }

    private fun toast(resource: Int, vararg args: Any) {
        Toast.makeText(activity, activity.getString(resource, *args), Toast.LENGTH_LONG).show()
    }

    private companion object {
        const val RECHECK_INTERVAL_MS = 30 * 60 * 1000L
    }
}
