package click.flexa.app.web

import android.Manifest
import android.app.Activity
import android.content.ActivityNotFoundException
import android.content.ClipData
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.provider.MediaStore
import android.webkit.MimeTypeMap
import android.webkit.ValueCallback
import android.webkit.WebChromeClient
import androidx.activity.ComponentActivity
import androidx.activity.result.contract.ActivityResultContracts
import androidx.core.content.ContextCompat
import androidx.core.content.FileProvider
import click.flexa.app.R
import java.io.File

/** Serves `<input type="file">`: the system picker, or the camera when the page asks for `capture`. */
class FileChooser(private val activity: ComponentActivity) {

    private class Request(val acceptTypes: List<String>, val multiple: Boolean, val capture: Boolean)

    private var callback: ValueCallback<Array<Uri>>? = null
    private var request: Request? = null
    private var captureFile: File? = null
    private var captureUri: Uri? = null

    private val picker = activity.registerForActivityResult(ActivityResultContracts.StartActivityForResult()) { result ->
        deliver(result.resultCode, result.data)
    }
    private val cameraPermission = activity.registerForActivityResult(ActivityResultContracts.RequestPermission()) { granted ->
        request?.let { launch(it, cameraAllowed = granted) }
    }

    fun show(callback: ValueCallback<Array<Uri>>, params: WebChromeClient.FileChooserParams): Boolean {
        cancel()
        this.callback = callback
        val accept = params.acceptTypes.flatMap { it.split(',') }.map { it.trim().lowercase() }.filter { it.isNotEmpty() }
        val chooser = Request(
            acceptTypes = accept,
            multiple = params.mode == WebChromeClient.FileChooserParams.MODE_OPEN_MULTIPLE,
            capture = params.isCaptureEnabled && accept.isNotEmpty() && accept.all { it.startsWith("image/") },
        )
        request = chooser
        val needsPermission = chooser.capture &&
            ContextCompat.checkSelfPermission(activity, Manifest.permission.CAMERA) != PackageManager.PERMISSION_GRANTED
        if (needsPermission) cameraPermission.launch(Manifest.permission.CAMERA) else launch(chooser, cameraAllowed = true)
        return true
    }

    fun cancel() {
        callback?.onReceiveValue(null)
        callback = null
        request = null
        discardCapture()
    }

    private fun launch(chooser: Request, cameraAllowed: Boolean) {
        val intent = (if (chooser.capture && cameraAllowed) captureIntent() else null) ?: pickerIntent(chooser)
        try {
            picker.launch(intent)
        } catch (_: ActivityNotFoundException) {
            deliver(Activity.RESULT_CANCELED, null)
        }
    }

    private fun captureIntent(): Intent? = try {
        val directory = File(activity.cacheDir, CAPTURE_DIRECTORY).apply { mkdirs() }
        val file = File.createTempFile("flexa-", ".jpg", directory)
        val uri = FileProvider.getUriForFile(activity, "${activity.packageName}.files", file)
        captureFile = file
        captureUri = uri
        Intent(MediaStore.ACTION_IMAGE_CAPTURE).apply {
            putExtra(MediaStore.EXTRA_OUTPUT, uri)
            addFlags(Intent.FLAG_GRANT_WRITE_URI_PERMISSION or Intent.FLAG_GRANT_READ_URI_PERMISSION)
            clipData = ClipData.newRawUri("", uri)
        }
    } catch (_: Exception) {
        null
    }

    private fun pickerIntent(chooser: Request): Intent {
        val types = AcceptTypes.resolve(chooser.acceptTypes) { extension ->
            MimeTypeMap.getSingleton().getMimeTypeFromExtension(extension)
        }
        return Intent(Intent.ACTION_GET_CONTENT).apply {
            addCategory(Intent.CATEGORY_OPENABLE)
            type = types.singleOrNull() ?: "*/*"
            if (types.size > 1) putExtra(Intent.EXTRA_MIME_TYPES, types.toTypedArray())
            putExtra(Intent.EXTRA_ALLOW_MULTIPLE, chooser.multiple)
        }
    }

    private fun deliver(resultCode: Int, data: Intent?) {
        val pending = callback ?: return
        callback = null
        request = null
        var uris: Array<Uri>? = null
        if (resultCode == Activity.RESULT_OK) {
            uris = WebChromeClient.FileChooserParams.parseResult(resultCode, data)
            val file = captureFile
            val uri = captureUri
            if (uris.isNullOrEmpty() && file != null && uri != null && file.length() > 0) uris = arrayOf(uri)
        }
        if (uris.isNullOrEmpty()) discardCapture()
        captureFile = null
        captureUri = null
        pending.onReceiveValue(uris?.takeIf { it.isNotEmpty() })
    }

    private fun discardCapture() {
        captureFile?.delete()
        captureFile = null
        captureUri = null
    }

    companion object {
        private const val CAPTURE_DIRECTORY = "captures"
        private const val CAPTURE_MAX_AGE_MS = 24 * 60 * 60 * 1000L

        fun cleanOldCaptures(activity: Activity) {
            val cutoff = System.currentTimeMillis() - CAPTURE_MAX_AGE_MS
            File(activity.cacheDir, CAPTURE_DIRECTORY).listFiles()?.filter { it.lastModified() < cutoff }?.forEach { it.delete() }
        }
    }
}
