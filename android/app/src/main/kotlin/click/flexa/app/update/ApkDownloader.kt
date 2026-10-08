package click.flexa.app.update

import java.io.File
import java.io.FileOutputStream
import java.io.IOException
import java.net.HttpURLConnection
import java.net.URL
import java.security.MessageDigest

class DownloadCancelledException : IOException("Pobieranie anulowano.")

/** The file arrived intact from the network but is not the release the manifest promised. */
class VerificationException(message: String) : IOException(message)

/** Streams the APK to disk while hashing it. Blocking: call it from a background thread. */
class ApkDownloader(private val userAgent: String) {
    @Volatile private var cancelled = false
    @Volatile private var connection: HttpURLConnection? = null

    fun cancel() {
        cancelled = true
        connection?.disconnect()
    }

    @Throws(IOException::class)
    fun download(manifest: UpdateManifest, target: File, onProgress: (done: Long, total: Long) -> Unit) {
        target.parentFile?.mkdirs()
        val partial = File(target.parentFile, target.name + ".part")
        partial.delete()
        target.delete()

        val conn = URL(manifest.apkUrl).openConnection() as HttpURLConnection
        connection = conn
        conn.connectTimeout = CONNECT_TIMEOUT_MS
        conn.readTimeout = READ_TIMEOUT_MS
        conn.instanceFollowRedirects = true
        conn.setRequestProperty("User-Agent", userAgent)
        conn.setRequestProperty("Accept-Encoding", "identity")
        try {
            if (cancelled) throw DownloadCancelledException()
            val status = conn.responseCode
            if (status != HttpURLConnection.HTTP_OK) throw IOException("Serwer odpowiedział kodem $status.")
            val total = manifest.sizeBytes
            val digest = MessageDigest.getInstance("SHA-256")
            var done = 0L
            var reportedAt = 0L
            conn.inputStream.use { input ->
                FileOutputStream(partial).use { output ->
                    val buffer = ByteArray(BUFFER_BYTES)
                    while (true) {
                        if (cancelled) throw DownloadCancelledException()
                        val read = input.read(buffer)
                        if (read < 0) break
                        done += read
                        if (done > total) throw VerificationException("Plik jest większy, niż zapowiada manifest.")
                        output.write(buffer, 0, read)
                        digest.update(buffer, 0, read)
                        val now = System.nanoTime()
                        if (now - reportedAt > REPORT_INTERVAL_NANOS) {
                            reportedAt = now
                            onProgress(done, total)
                        }
                    }
                    output.fd.sync()
                }
            }
            onProgress(done, total)
            if (done != total) throw VerificationException("Pobrano $done z $total bajtów.")
            if (digest.digest().toHex() != manifest.sha256) throw VerificationException("Suma SHA-256 nie zgadza się z manifestem.")
            if (!partial.renameTo(target)) throw IOException("Nie można zapisać pobranego pliku.")
        } catch (e: IOException) {
            partial.delete()
            if (cancelled) throw DownloadCancelledException()
            throw e
        } finally {
            conn.disconnect()
            connection = null
        }
    }

    private fun ByteArray.toHex(): String = joinToString("") { "%02x".format(it) }

    private companion object {
        const val CONNECT_TIMEOUT_MS = 15_000
        const val READ_TIMEOUT_MS = 30_000
        const val BUFFER_BYTES = 64 * 1024
        const val REPORT_INTERVAL_NANOS = 100_000_000L
    }
}
