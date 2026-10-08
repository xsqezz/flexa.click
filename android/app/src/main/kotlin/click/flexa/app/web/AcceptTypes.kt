package click.flexa.app.web

/** Turns the `accept` attribute of a file input into MIME types for the system picker. */
object AcceptTypes {
    /**
     * An unknown file extension means "any file": the page validates the name itself, which is more
     * reliable than guessing a MIME type the picker may not know.
     */
    fun resolve(accept: List<String>, mimeForExtension: (extension: String) -> String?): List<String> {
        if (accept.isEmpty()) return emptyList()
        val resolved = accept.map { token ->
            when {
                token.contains('/') -> token
                token.startsWith('.') -> mimeForExtension(token.removePrefix(".")) ?: return emptyList()
                else -> return emptyList()
            }
        }.distinct()
        return if ("*/*" in resolved) emptyList() else resolved
    }
}
