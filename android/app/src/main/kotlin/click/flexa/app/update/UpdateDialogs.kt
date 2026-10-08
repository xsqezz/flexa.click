package click.flexa.app.update

import android.app.Activity
import android.app.AlertDialog
import android.content.res.ColorStateList
import android.view.ViewGroup
import android.widget.LinearLayout
import android.widget.ProgressBar
import android.widget.TextView
import click.flexa.app.BuildConfig
import click.flexa.app.R
import java.util.Locale

/** The few native dialogs of the update flow. Only one is visible at a time. */
internal class UpdateDialogs(private val activity: Activity) {
    private var dialog: AlertDialog? = null
    private var bar: ProgressBar? = null
    private var label: TextView? = null

    fun prompt(manifest: UpdateManifest, mandatory: Boolean, onInstall: () -> Unit, onLater: () -> Unit, onClose: () -> Unit) {
        val builder = AlertDialog.Builder(activity)
            .setTitle(R.string.update_title)
            .setMessage(promptText(manifest, mandatory))
            .setCancelable(!mandatory)
            .setPositiveButton(R.string.update_action_install) { _, _ -> onInstall() }
        if (mandatory) {
            builder.setNegativeButton(R.string.update_action_close_app) { _, _ -> onClose() }
        } else {
            builder.setNegativeButton(R.string.update_action_later) { _, _ -> onLater() }
            builder.setOnCancelListener { onLater() }
        }
        show(builder)
    }

    fun permission(onOpenSettings: () -> Unit, onCancel: () -> Unit) {
        show(
            AlertDialog.Builder(activity)
                .setTitle(R.string.update_permission_title)
                .setMessage(R.string.update_permission_message)
                .setPositiveButton(R.string.update_action_settings) { _, _ -> onOpenSettings() }
                .setNegativeButton(R.string.update_action_cancel) { _, _ -> onCancel() }
                .setOnCancelListener { onCancel() },
        )
    }

    fun progress(onCancel: () -> Unit) {
        val density = activity.resources.displayMetrics.density
        val padding = (24 * density).toInt()
        val text = TextView(activity).apply {
            setTextColor(activity.getColor(R.color.flexa_text))
            text = activity.getString(R.string.update_downloading)
        }
        val progress = ProgressBar(activity, null, android.R.attr.progressBarStyleHorizontal).apply {
            max = PROGRESS_STEPS
            isIndeterminate = true
            progressTintList = ColorStateList.valueOf(activity.getColor(R.color.flexa_pine))
            indeterminateTintList = ColorStateList.valueOf(activity.getColor(R.color.flexa_pine))
        }
        val column = LinearLayout(activity).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(padding, padding / 2, padding, 0)
            addView(text)
            addView(
                progress,
                LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT)
                    .apply { topMargin = (12 * density).toInt() },
            )
        }
        show(
            AlertDialog.Builder(activity)
                .setTitle(R.string.update_title)
                .setView(column)
                .setCancelable(false)
                .setNegativeButton(R.string.update_action_cancel) { _, _ -> onCancel() },
        )
        bar = progress
        label = text
    }

    fun updateProgress(done: Long, total: Long) {
        val progress = bar ?: return
        if (total <= 0) return
        progress.isIndeterminate = false
        progress.progress = (done * PROGRESS_STEPS / total).toInt().coerceIn(0, PROGRESS_STEPS)
        label?.text = activity.getString(R.string.update_download_progress, formatSize(done), formatSize(total))
    }

    fun error(message: String, onRetry: (() -> Unit)?, onManual: () -> Unit) {
        val builder = AlertDialog.Builder(activity)
            .setTitle(R.string.update_title)
            .setMessage(message)
            .setNegativeButton(R.string.update_action_manual) { _, _ -> onManual() }
        if (onRetry != null) builder.setPositiveButton(R.string.update_action_retry) { _, _ -> onRetry() }
        else builder.setPositiveButton(R.string.update_action_ok, null)
        show(builder)
    }

    fun dismiss() {
        dialog?.setOnDismissListener(null)
        dialog?.setOnCancelListener(null)
        dialog?.dismiss()
        dialog = null
        bar = null
        label = null
    }

    private fun show(builder: AlertDialog.Builder) {
        dismiss()
        if (activity.isFinishing || activity.isDestroyed) return
        dialog = builder.create().also { it.show() }
    }

    private fun promptText(manifest: UpdateManifest, mandatory: Boolean): String = buildString {
        append(
            if (mandatory) activity.getString(R.string.update_message_mandatory, manifest.versionName)
            else activity.getString(R.string.update_message, manifest.versionName, BuildConfig.VERSION_NAME),
        )
        if (manifest.notes.isNotEmpty()) {
            append("\n\n").append(activity.getString(R.string.update_whats_new))
            manifest.notes.forEach { append("\n• ").append(it) }
        }
        append("\n\n").append(activity.getString(R.string.update_size, formatSize(manifest.sizeBytes)))
    }

    private companion object {
        const val PROGRESS_STEPS = 1000

        fun formatSize(bytes: Long): String = String.format(Locale.getDefault(), "%.1f MB", bytes / 1_048_576.0)
    }
}
