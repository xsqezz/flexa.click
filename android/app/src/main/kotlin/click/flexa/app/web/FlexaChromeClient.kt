package click.flexa.app.web

import android.net.Uri
import android.util.Log
import android.view.View
import android.webkit.ConsoleMessage
import android.webkit.JsResult
import android.webkit.PermissionRequest
import android.webkit.ValueCallback
import android.webkit.WebChromeClient
import android.webkit.WebView
import click.flexa.app.BuildConfig

class FlexaChromeClient(private val host: WebHost) : WebChromeClient() {

    override fun onProgressChanged(view: WebView, newProgress: Int) = host.onProgress(newProgress)

    override fun onShowFileChooser(
        webView: WebView,
        filePathCallback: ValueCallback<Array<Uri>>,
        fileChooserParams: FileChooserParams,
    ): Boolean = host.chooseFiles(filePathCallback, fileChooserParams)

    override fun onPermissionRequest(request: PermissionRequest) = host.webPermissionRequested(request)

    override fun onPermissionRequestCanceled(request: PermissionRequest) = host.webPermissionCanceled(request)

    override fun onShowCustomView(view: View, callback: CustomViewCallback) = host.showCustomView(view, callback)

    override fun onHideCustomView() = host.hideCustomView()

    override fun onJsAlert(view: WebView, url: String, message: String, result: JsResult): Boolean =
        dialog(url, message, confirmable = false, result)

    override fun onJsConfirm(view: WebView, url: String, message: String, result: JsResult): Boolean =
        dialog(url, message, confirmable = true, result)

    override fun onJsPrompt(view: WebView, url: String, message: String, defaultValue: String?, result: android.webkit.JsPromptResult): Boolean {
        result.cancel()
        return true
    }

    override fun onConsoleMessage(message: ConsoleMessage): Boolean {
        if (BuildConfig.DEBUG) Log.d("FlexaWeb", "${message.message()} (${message.sourceId()}:${message.lineNumber()})")
        return true
    }

    private fun dialog(url: String, message: String, confirmable: Boolean, result: JsResult): Boolean {
        if (!host.policy.isAppUrl(url)) {
            result.cancel()
            return true
        }
        host.showJsDialog(message, confirmable, result)
        return true
    }
}
