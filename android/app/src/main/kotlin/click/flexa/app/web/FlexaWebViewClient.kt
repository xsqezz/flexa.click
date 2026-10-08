package click.flexa.app.web

import android.graphics.Bitmap
import android.net.http.SslError
import android.webkit.RenderProcessGoneDetail
import android.webkit.SslErrorHandler
import android.webkit.WebResourceError
import android.webkit.WebResourceRequest
import android.webkit.WebView
import android.webkit.WebViewClient

@Suppress("MissingOnRenderProcessGone") // onRenderProcessGone is implemented below; the check only knows the androidx variant.
class FlexaWebViewClient(private val host: WebHost) : WebViewClient() {

    override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean =
        when (val decision = host.policy.decide(request.url.toString(), request.isForMainFrame)) {
            Navigation.Allow -> false
            Navigation.Block -> true
            is Navigation.External -> {
                if (request.isForMainFrame) host.openExternal(decision.url)
                true
            }
        }

    override fun onPageStarted(view: WebView, url: String, favicon: Bitmap?) = host.onPageStarted(url)

    override fun onPageCommitVisible(view: WebView, url: String) = host.onContentVisible()

    override fun onReceivedError(view: WebView, request: WebResourceRequest, error: WebResourceError) {
        if (request.isForMainFrame) host.onMainFrameFailed(request.url.toString())
    }

    override fun onReceivedSslError(view: WebView, handler: SslErrorHandler, error: SslError) {
        handler.cancel()
        host.onMainFrameFailed(error.url.orEmpty())
    }

    override fun onRenderProcessGone(view: WebView, detail: RenderProcessGoneDetail): Boolean {
        host.onRenderProcessGone()
        return true
    }
}
