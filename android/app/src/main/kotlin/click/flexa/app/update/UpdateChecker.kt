package click.flexa.app.update

import java.io.ByteArrayOutputStream
import java.io.IOException
import java.io.InputStream
import java.net.HttpURLConnection
import java.net.URL

/** Downloads and validates the release manifest. Blocking: call it from a background thread. */
class UpdateChecker(
    private val manifestUrl: String,
    private val allowedUrlPrefix: String,
    private val userAgent: String,
) {
    @Throws(IOException::class, ManifestException::class)
    fun fetch(): UpdateManifest {
        val connection = URL(manifestUrl).openConnection() as HttpURLConnection
        connection.connectTimeout = CONNECT_TIMEOUT_MS
        connection.readTimeout = READ_TIMEOUT_MS
        connection.instanceFollowRedirects = true
        connection.setRequestProperty("User-Agent", userAgent)
        connection.setRequestProperty("Accept", "application/json")
        connection.setRequestProperty("Cache-Control", "no-cache")
        try {
            val status = connection.responseCode
            if (status != HttpURLConnection.HTTP_OK) throw IOException("Serwer odpowiedział kodem $status.")
            val body = connection.inputStream.use { readLimited(it, MAX_MANIFEST_BYTES) }
            return UpdateManifest.parse(body, allowedUrlPrefix)
        } finally {
            connection.disconnect()
        }
    }

    private fun readLimited(input: InputStream, limit: Int): String {
        val buffer = ByteArray(8 * 1024)
        val out = ByteArrayOutputStream()
        while (true) {
            val read = input.read(buffer)
            if (read < 0) break
            out.write(buffer, 0, read)
            if (out.size() > limit) throw IOException("Manifest jest zbyt duży.")
        }
        return out.toString(Charsets.UTF_8.name())
    }

    private companion object {
        const val CONNECT_TIMEOUT_MS = 10_000
        const val READ_TIMEOUT_MS = 15_000
        const val MAX_MANIFEST_BYTES = 64 * 1024
    }
}
