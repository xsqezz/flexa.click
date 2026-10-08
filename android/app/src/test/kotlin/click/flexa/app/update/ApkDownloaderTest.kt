package click.flexa.app.update

import org.junit.Assert.assertArrayEquals
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertThrows
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.rules.TemporaryFolder
import java.io.IOException
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit
import kotlin.random.Random

class ApkDownloaderTest {
    @get:Rule
    val folder = TemporaryFolder()

    private val payload = Random(7).nextBytes(300_000)

    private fun manifest(
        server: TestServer,
        path: String = "/dl/flexa.apk",
        bytes: ByteArray = payload,
        sha: String = sha256Hex(bytes),
        size: Long = bytes.size.toLong(),
    ) = UpdateManifest(
        versionName = "1.0.1", versionCode = 1000001, minSupportedVersionCode = 1000000, minSdk = 26,
        apkUrl = server.base + path, sha256 = sha, sizeBytes = size, notes = emptyList(),
    )

    private fun leftovers() = folder.root.list().orEmpty().toList()

    @Test
    fun `downloads, verifies and reports progress`() {
        TestServer().start().use { server ->
            server.bytes("/dl/flexa.apk", payload)
            val target = folder.root.resolve("updates/flexa.apk")
            val reports = mutableListOf<Pair<Long, Long>>()
            ApkDownloader("FlexaAndroid/test").download(manifest(server), target) { done, total -> reports += done to total }
            assertArrayEquals(payload, target.readBytes())
            assertEquals(payload.size.toLong() to payload.size.toLong(), reports.last())
            assertTrue(reports.zipWithNext().all { (a, b) -> a.first <= b.first })
            assertEquals(listOf("flexa.apk"), target.parentFile.list().orEmpty().toList())
        }
    }

    @Test
    fun `follows the redirect to the release asset`() {
        TestServer().start().use { server ->
            server.redirect("/dl/flexa.apk", "${server.base}/cdn/asset")
            server.bytes("/cdn/asset", payload)
            val target = folder.newFile("flexa.apk")
            ApkDownloader("FlexaAndroid/test").download(manifest(server), target) { _, _ -> }
            assertArrayEquals(payload, target.readBytes())
        }
    }

    @Test
    fun `refuses a file whose hash does not match`() {
        TestServer().start().use { server ->
            server.bytes("/dl/flexa.apk", payload)
            val target = folder.root.resolve("flexa.apk")
            assertThrows(VerificationException::class.java) {
                ApkDownloader("FlexaAndroid/test").download(manifest(server, sha = "0".repeat(64)), target) { _, _ -> }
            }
            assertFalse(target.exists())
            assertEquals(emptyList<String>(), leftovers())
        }
    }

    @Test
    fun `refuses a truncated or oversized file`() {
        TestServer().start().use { server ->
            server.bytes("/dl/flexa.apk", payload)
            val target = folder.root.resolve("flexa.apk")
            assertThrows(VerificationException::class.java) {
                ApkDownloader("FlexaAndroid/test").download(manifest(server, size = payload.size + 10L, sha = sha256Hex(payload)), target) { _, _ -> }
            }
            assertThrows(VerificationException::class.java) {
                ApkDownloader("FlexaAndroid/test").download(manifest(server, size = payload.size - 10L), target) { _, _ -> }
            }
            assertEquals(emptyList<String>(), leftovers())
        }
    }

    @Test
    fun `reports a missing file as an IO error, not as corruption`() {
        TestServer().start().use { server ->
            server.bytes("/dl/flexa.apk", ByteArray(0), status = 404)
            val error = assertThrows(IOException::class.java) {
                ApkDownloader("FlexaAndroid/test").download(manifest(server), folder.root.resolve("flexa.apk")) { _, _ -> }
            }
            assertFalse(error is VerificationException)
        }
    }

    @Test
    fun `can be cancelled while downloading`() {
        val started = CountDownLatch(1)
        TestServer().start().use { server ->
            server.route("/dl/flexa.apk") { exchange ->
                exchange.sendResponseHeaders(200, payload.size.toLong())
                val out = exchange.responseBody
                try {
                    out.write(payload, 0, 50_000)
                    out.flush()
                    started.countDown()
                    Thread.sleep(5_000)
                } catch (_: Exception) {
                    // The client went away, which is exactly what this test provokes.
                }
            }
            val downloader = ApkDownloader("FlexaAndroid/test")
            val target = folder.root.resolve("flexa.apk")
            val canceller = Thread {
                started.await(5, TimeUnit.SECONDS)
                downloader.cancel()
            }.also { it.start() }
            assertThrows(DownloadCancelledException::class.java) { downloader.download(manifest(server), target) { _, _ -> } }
            canceller.join()
            assertEquals(emptyList<String>(), leftovers())
        }
    }
}
