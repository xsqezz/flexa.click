package click.flexa.app.web

sealed interface Navigation {
    data object Allow : Navigation
    data object Block : Navigation
    data class External(val url: String) : Navigation
}

internal data class Origin(val scheme: String, val host: String?, val port: Int, val hasUserInfo: Boolean) {
    val effectivePort: Int
        get() = if (port != -1) port else when (scheme) {
            "https" -> 443
            "http" -> 80
            else -> -1
        }

    companion object {
        private val pattern = Regex("^([A-Za-z][A-Za-z0-9+.-]*):(?://([^/?#]*))?")

        fun parse(url: String): Origin? {
            val match = pattern.find(url.trim()) ?: return null
            val scheme = match.groupValues[1].lowercase()
            val authority = match.groupValues[2]
            if (authority.isEmpty()) return Origin(scheme, null, -1, false)
            val at = authority.lastIndexOf('@')
            val hostAndPort = if (at >= 0) authority.substring(at + 1) else authority
            val colon = hostAndPort.lastIndexOf(':')
            val hasPort = colon > hostAndPort.lastIndexOf(']')
            val host = (if (hasPort) hostAndPort.substring(0, colon) else hostAndPort).lowercase()
            val port = if (hasPort) hostAndPort.substring(colon + 1).toIntOrNull() ?: return null else -1
            return Origin(scheme, host.ifEmpty { null }, port, at >= 0)
        }
    }
}

/** Decides which addresses may load inside the app; everything else goes to the system browser or is dropped. */
class NavigationPolicy(appUrl: String) {
    private val app = Origin.parse(appUrl)?.takeIf { it.host != null }
        ?: throw IllegalArgumentException("Nieprawidłowy adres aplikacji: $appUrl")

    fun isAppUrl(url: String): Boolean = Origin.parse(url)?.let(::isAppOrigin) ?: false

    fun decide(url: String, isMainFrame: Boolean): Navigation {
        val origin = Origin.parse(url) ?: return Navigation.Block
        if (!isMainFrame) {
            return if (origin.scheme == "https" || url == "about:blank") Navigation.Allow else Navigation.Block
        }
        return when {
            isAppOrigin(origin) -> Navigation.Allow
            origin.scheme == "about" -> if (url == "about:blank") Navigation.Allow else Navigation.Block
            origin.scheme in externalSchemes -> Navigation.External(url)
            else -> Navigation.Block
        }
    }

    private fun isAppOrigin(origin: Origin): Boolean =
        origin.scheme == app.scheme && origin.host == app.host && origin.effectivePort == app.effectivePort && !origin.hasUserInfo

    private companion object {
        val externalSchemes = setOf("https", "http", "mailto", "tel", "sms")
    }
}
