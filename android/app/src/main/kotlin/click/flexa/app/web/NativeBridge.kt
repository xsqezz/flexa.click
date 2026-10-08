package click.flexa.app.web

import android.net.Uri
import android.webkit.WebView
import androidx.webkit.JavaScriptReplyProxy
import androidx.webkit.WebMessageCompat
import androidx.webkit.WebViewCompat
import androidx.webkit.WebViewFeature

/**
 * Receives messages from `window.flexaNative.postMessage(...)`. The listener is registered only for the
 * app's own origin, so embedded third-party frames (video) can never reach it. Replies go back to the same page
 * through [JavaScriptReplyProxy] and arrive there as `message` events on `window.flexaNative`.
 */
class NativeBridge(
    private val onSaveFile: (name: String, text: String, mime: String) -> Unit,
    private val onCheckUpdate: () -> Unit,
    private val onReminders: (message: NativeMessage, reply: (String) -> Unit) -> Unit,
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
            is NativeMessage.SaveFile -> onSaveFile(parsed.name, parsed.text, parsed.mime)
            NativeMessage.CheckUpdate -> onCheckUpdate()
            is NativeMessage.GetReminders, is NativeMessage.SetReminders, is NativeMessage.InvalidReminders,
            NativeMessage.OpenNotificationSettings -> onReminders(parsed) { reply ->
                try {
                    if (WebViewFeature.isFeatureSupported(WebViewFeature.WEB_MESSAGE_LISTENER)) replyProxy.postMessage(reply)
                } catch (_: RuntimeException) {
                    // The page that asked is gone (navigated away or the WebView was destroyed).
                }
            }
            null -> Unit
        }
    }

    companion object {
        const val NAME = "flexaNative"
    }
}
