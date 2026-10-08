package click.flexa.app.web

/** Pages of the app that native code (e.g. a notification) may open. Only plain same-origin paths are accepted. */
object AppPaths {
    const val EXTRA_PATH = "click.flexa.app.extra.PATH"

    private val SAFE_PATH = Regex("^/(?:[A-Za-z0-9_-]+(?:/[A-Za-z0-9_-]+)*)?$")

    /** `APP_URL + path` for a safe absolute path such as `/plan`, otherwise `null`. */
    fun resolve(appUrl: String, path: String?): String? {
        if (path == null || path.length > MAX_PATH_CHARS || !SAFE_PATH.matches(path)) return null
        return appUrl.trimEnd('/') + path
    }

    private const val MAX_PATH_CHARS = 100
}
