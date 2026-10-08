package click.flexa.app.update

import org.json.JSONException
import org.json.JSONObject

class ManifestException(message: String) : Exception(message)

/** Description of the newest release, published as `update.json` next to every APK. */
data class UpdateManifest(
    val versionName: String,
    val versionCode: Int,
    val minSupportedVersionCode: Int,
    val minSdk: Int,
    val apkUrl: String,
    val sha256: String,
    val sizeBytes: Long,
    val notes: List<String>,
) {
    fun isNewerThan(installedVersionCode: Int): Boolean = versionCode > installedVersionCode

    fun isMandatoryFor(installedVersionCode: Int): Boolean = installedVersionCode < minSupportedVersionCode

    companion object {
        const val SCHEMA = 1
        const val MAX_APK_BYTES = 150L * 1024 * 1024
        private const val MAX_NOTES = 8
        private const val MAX_NOTE_CHARS = 200
        private val versionNamePattern = Regex("""^\d{1,4}\.\d{1,4}\.\d{1,4}(?:[-+][0-9A-Za-z.-]{1,32})?$""")
        private val sha256Pattern = Regex("^[0-9a-f]{64}$")

        /** Rejects anything that does not point at the project's own release downloads. */
        fun parse(json: String, allowedUrlPrefix: String): UpdateManifest {
            val root = try {
                JSONObject(json)
            } catch (_: JSONException) {
                throw ManifestException("Manifest nie jest poprawnym JSON-em.")
            }
            try {
                if (root.getInt("schema") != SCHEMA) throw ManifestException("Nieobsługiwana wersja manifestu.")
                val versionName = root.getString("versionName")
                if (!versionNamePattern.matches(versionName)) throw ManifestException("Nieprawidłowa nazwa wersji.")
                val versionCode = root.getLong("versionCode")
                if (versionCode !in 1..Int.MAX_VALUE) throw ManifestException("Nieprawidłowy kod wersji.")
                val minSupported = root.optLong("minSupportedVersionCode", 1)
                if (minSupported !in 1..versionCode) throw ManifestException("Nieprawidłowy minimalny kod wersji.")
                val minSdk = root.optInt("minSdk", 1)
                if (minSdk !in 1..100) throw ManifestException("Nieprawidłowy minimalny Android.")
                val apkUrl = root.getString("apkUrl")
                if (!apkUrl.startsWith(allowedUrlPrefix) || apkUrl.any { it.isWhitespace() }) {
                    throw ManifestException("Adres APK spoza oficjalnych wydań.")
                }
                val sha256 = root.getString("sha256")
                if (!sha256Pattern.matches(sha256)) throw ManifestException("Nieprawidłowa suma SHA-256.")
                val size = root.getLong("sizeBytes")
                if (size !in 1..MAX_APK_BYTES) throw ManifestException("Nieprawidłowy rozmiar APK.")
                return UpdateManifest(
                    versionName = versionName,
                    versionCode = versionCode.toInt(),
                    minSupportedVersionCode = minSupported.toInt(),
                    minSdk = minSdk,
                    apkUrl = apkUrl,
                    sha256 = sha256,
                    sizeBytes = size,
                    notes = notes(root),
                )
            } catch (e: JSONException) {
                throw ManifestException("Brakuje pola w manifeście: ${e.message}")
            }
        }

        private fun notes(root: JSONObject): List<String> {
            val array = root.optJSONArray("notes") ?: return emptyList()
            return (0 until minOf(array.length(), MAX_NOTES))
                .map { array.optString(it, "").trim().take(MAX_NOTE_CHARS) }
                .filter { it.isNotEmpty() }
        }
    }
}
