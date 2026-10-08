package click.flexa.app.update

import org.junit.Assert.assertEquals
import org.junit.Assert.assertThrows
import org.junit.Test
import java.io.IOException

class UpdateCheckerTest {
    private fun manifestJson(base: String, versionCode: Int = 1000001) = """
        {"schema":1,"versionName":"1.0.1","versionCode":$versionCode,"minSupportedVersionCode":1000000,
         "apkUrl":"$base/dl/flexa.apk","sha256":"${"b".repeat(64)}","sizeBytes":1234,"notes":["Poprawki"]}
    """.trimIndent()

    private fun checker(server: TestServer, path: String) =
        UpdateChecker("${server.base}$path", "${server.base}/dl/", "FlexaAndroid/test")

    @Test
    fun `fetches and validates the manifest`() {
        TestServer().start().use { server ->
            server.bytes("/update.json", manifestJson(server.base).toByteArray())
            val manifest = checker(server, "/update.json").fetch()
            assertEquals(1000001, manifest.versionCode)
            assertEquals(listOf("Poprawki"), manifest.notes)
            assertEquals("${server.base}/dl/flexa.apk", manifest.apkUrl)
        }
    }

    @Test
    fun `follows redirects like the release download address does`() {
        TestServer().start().use { server ->
            server.redirect("/latest/update.json", "${server.base}/real/update.json")
            server.bytes("/real/update.json", manifestJson(server.base).toByteArray())
            assertEquals("1.0.1", checker(server, "/latest/update.json").fetch().versionName)
        }
    }

    @Test
    fun `reports a server error as an IO problem`() {
        TestServer().start().use { server ->
            server.bytes("/missing.json", "nope".toByteArray(), status = 404)
            assertThrows(IOException::class.java) { checker(server, "/missing.json").fetch() }
        }
    }

    @Test
    fun `rejects an oversized response`() {
        TestServer().start().use { server ->
            server.bytes("/big.json", ByteArray(200_000) { '{'.code.toByte() })
            assertThrows(IOException::class.java) { checker(server, "/big.json").fetch() }
        }
    }

    @Test
    fun `rejects a manifest that points outside the release downloads`() {
        TestServer().start().use { server ->
            server.bytes("/update.json", manifestJson("http://evil.example").toByteArray())
            assertThrows(ManifestException::class.java) { checker(server, "/update.json").fetch() }
        }
    }
}
