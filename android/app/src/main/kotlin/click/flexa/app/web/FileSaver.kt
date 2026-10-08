package click.flexa.app.web

import android.net.Uri
import android.widget.Toast
import androidx.activity.ComponentActivity
import androidx.activity.result.ActivityResultLauncher
import androidx.activity.result.contract.ActivityResultContracts
import click.flexa.app.R
import java.io.IOException

/**
 * Writes an export (JSON or CSV) where the user chooses, through the system "Save as" screen (no storage permission
 * needed). `CreateDocument` takes its MIME type at registration, so there is one launcher per supported type.
 */
class FileSaver(private val activity: ComponentActivity) {

    private var pending: ByteArray? = null

    private val launchers: Map<String, ActivityResultLauncher<String>> =
        listOf(NativeMessage.MIME_JSON, NativeMessage.MIME_CSV).associateWith { mime ->
            activity.registerForActivityResult(ActivityResultContracts.CreateDocument(mime)) { uri ->
                val bytes = pending
                pending = null
                if (uri != null && bytes != null) write(uri, bytes)
            }
        }

    fun save(name: String, text: String, mime: String) {
        val launcher = launchers[mime] ?: return
        pending = text.toByteArray(Charsets.UTF_8)
        launcher.launch(name)
    }

    private fun write(uri: Uri, bytes: ByteArray) {
        val message = try {
            val stream = activity.contentResolver.openOutputStream(uri, "wt") ?: throw IOException("Brak strumienia.")
            stream.use { it.write(bytes) }
            R.string.save_done
        } catch (_: IOException) {
            R.string.save_failed
        } catch (_: SecurityException) {
            R.string.save_failed
        }
        Toast.makeText(activity, message, Toast.LENGTH_LONG).show()
    }
}
