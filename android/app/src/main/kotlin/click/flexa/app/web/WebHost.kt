package click.flexa.app.web

import android.net.Uri
import android.view.View
import android.webkit.JsResult
import android.webkit.PermissionRequest
import android.webkit.ValueCallback
import android.webkit.WebChromeClient

/** What the web clients need from the activity that hosts the WebView. */
interface WebHost {
    val policy: NavigationPolicy

    fun openExternal(url: String)
    fun onPageStarted(url: String)
    fun onContentVisible()
    fun onMainFrameFailed(url: String)
    fun onRenderProcessGone()
    fun onProgress(percent: Int)

    fun chooseFiles(callback: ValueCallback<Array<Uri>>, params: WebChromeClient.FileChooserParams): Boolean
    fun webPermissionRequested(request: PermissionRequest)
    fun webPermissionCanceled(request: PermissionRequest)
    fun showCustomView(view: View, callback: WebChromeClient.CustomViewCallback)
    fun hideCustomView()
    fun showJsDialog(message: String, confirmable: Boolean, result: JsResult)
}
