package click.flexa.app.web

import android.net.Uri
import android.webkit.WebView
import androidx.webkit.JavaScriptReplyProxy
import androidx.webkit.WebMessageCompat
import androidx.webkit.WebViewCompat

/**
 * Receives messages from `window.flexaNative.postMessage(...)`. The listener is registered only for the
 * app's own origin, so embedded third-party frames (video) can never reach it.
 */
class NativeBridge(
    private val onSaveFile: (name: String, text: String) -> Unit,
    private val onCheckUpdate: () -> Unit,
) : WebViewCompat.WebMessageListener {

    override fun onPostMessage(
        view: WebView,
        message: WebMessageCompat,
        sourceOrigin: Uri,
        isMainFrame: Boolean,
        replyProxy: JavaScriptReplyProxy,
    ) {
        if (!isMainFrame) return
        when (val parsed = NativeMessage.parse(message.data)) {
            is NativeMessage.SaveFile -> onSaveFile(parsed.name, parsed.text)
            NativeMessage.CheckUpdate -> onCheckUpdate()
            null -> Unit
        }
    }

    companion object {
        const val NAME = "flexaNative"
    }
}
