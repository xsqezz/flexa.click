package click.flexa.app.update

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Assert.fail
import org.junit.Test

class UpdateManifestTest {
    private val prefix = "https://github.com/xsqezz/flexa.click/releases/download/"
    private val sha = "a".repeat(64)

    private fun manifest(
        versionName: String = "1.2.3",
        versionCode: String = "1002003",
        min: String = "1000000",
        url: String = "${prefix}android-v1.2.3/flexa.apk",
        sha256: String = sha,
        size: String = "2400000",
        extra: String = "",
        schema: String = "1",
    ) = """{"schema":$schema,"versionName":"$versionName","versionCode":$versionCode,"minSupportedVersionCode":$min,
        "apkUrl":"$url","sha256":"$sha256","sizeBytes":$size $extra}"""

    private fun rejected(json: String): String = try {
        UpdateManifest.parse(json, prefix)
        fail("Manifest powinien zostać odrzucony")
        ""
    } catch (e: ManifestException) {
        e.message.orEmpty()
    }

    @Test
    fun `parses a valid manifest`() {
        val parsed = UpdateManifest.parse(manifest(extra = ""","minSdk":26,"notes":["Pierwsza"," Druga ","",7]"""), prefix)
        assertEquals("1.2.3", parsed.versionName)
        assertEquals(1002003, parsed.versionCode)
        assertEquals(1000000, parsed.minSupportedVersionCode)
        assertEquals(26, parsed.minSdk)
        assertEquals(2_400_000L, parsed.sizeBytes)
        assertEquals(sha, parsed.sha256)
        assertEquals(listOf("Pierwsza", "Druga", "7"), parsed.notes)
    }

    @Test
    fun `defaults optional fields and ignores unknown ones`() {
        val parsed = UpdateManifest.parse(manifest(min = "1", extra = ""","future":{"x":1}"""), prefix)
        assertEquals(1, parsed.minSupportedVersionCode)
        assertEquals(1, parsed.minSdk)
        assertTrue(parsed.notes.isEmpty())
    }

    @Test
    fun `compares versions by code`() {
        val parsed = UpdateManifest.parse(manifest(), prefix)
        assertTrue(parsed.isNewerThan(1000000))
        assertFalse(parsed.isNewerThan(1002003))
        assertFalse(parsed.isNewerThan(1002004))
        assertTrue(parsed.isMandatoryFor(999999))
        assertFalse(parsed.isMandatoryFor(1000000))
    }

    @Test
    fun `limits notes`() {
        val many = (1..20).joinToString(",") { "\"n$it\"" }
        val long = "x".repeat(500)
        val parsed = UpdateManifest.parse(manifest(extra = ""","notes":[$many]"""), prefix)
        assertEquals(8, parsed.notes.size)
        assertEquals(200, UpdateManifest.parse(manifest(extra = ""","notes":["$long"]"""), prefix).notes.single().length)
    }

    @Test
    fun `rejects broken or foreign manifests`() {
        rejected("not json")
        rejected("{}")
        rejected(manifest(schema = "2"))
        rejected(manifest(versionName = "latest"))
        rejected(manifest(versionName = "1.2"))
        rejected(manifest(versionCode = "0"))
        rejected(manifest(versionCode = "9999999999"))
        rejected(manifest(min = "2000000"))
        rejected(manifest(sha256 = "A".repeat(64)))
        rejected(manifest(sha256 = "abc"))
        rejected(manifest(size = "0"))
        rejected(manifest(size = "${UpdateManifest.MAX_APK_BYTES + 1}"))
    }

    @Test
    fun `accepts only apk addresses from the official releases`() {
        rejected(manifest(url = "https://evil.example/flexa.apk"))
        rejected(manifest(url = "http://github.com/xsqezz/flexa.click/releases/download/android-v1/flexa.apk"))
        rejected(manifest(url = "https://github.com/someone-else/flexa.click/releases/download/android-v1/flexa.apk"))
        rejected(manifest(url = "${prefix}android-v1/flexa .apk"))
        rejected(manifest(url = "https://github.com.evil.example/xsqezz/flexa.click/releases/download/x/flexa.apk"))
    }
}
