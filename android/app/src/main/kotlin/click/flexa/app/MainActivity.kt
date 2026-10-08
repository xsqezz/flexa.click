package click.flexa.app

import android.annotation.SuppressLint
import android.app.AlertDialog
import android.content.ActivityNotFoundException
import android.content.Intent
import android.content.res.ColorStateList
import android.graphics.Color
import android.net.ConnectivityManager
import android.net.Network
import android.net.Uri
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.os.SystemClock
import android.view.Gravity
import android.view.View
import android.view.ViewGroup
import android.webkit.CookieManager
import android.webkit.JsResult
import android.webkit.PermissionRequest
import android.webkit.ValueCallback
import android.webkit.WebChromeClient
import android.webkit.WebSettings
import android.webkit.WebView
import android.widget.FrameLayout
import android.widget.ProgressBar
import android.widget.Toast
import androidx.activity.ComponentActivity
import androidx.activity.OnBackPressedCallback
import androidx.activity.SystemBarStyle
import androidx.activity.enableEdgeToEdge
import androidx.core.splashscreen.SplashScreen.Companion.installSplashScreen
import androidx.core.net.toUri
import androidx.core.view.ViewCompat
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.WindowInsetsControllerCompat
import androidx.webkit.WebViewCompat
import androidx.webkit.WebViewFeature
import click.flexa.app.update.UpdateController
import click.flexa.app.web.FileChooser
import click.flexa.app.web.FileSaver
import click.flexa.app.web.FlexaChromeClient
import click.flexa.app.web.FlexaWebViewClient
import click.flexa.app.web.Navigation
import click.flexa.app.web.NativeBridge
import click.flexa.app.web.NavigationPolicy
import click.flexa.app.web.WebCameraAccess
import click.flexa.app.web.WebHost
import org.json.JSONObject

/** A single full-screen WebView showing the live Flexa site, plus the native pieces the web cannot do itself. */
class MainActivity : ComponentActivity(), WebHost {

    override val policy = NavigationPolicy(BuildConfig.APP_URL)

    private val homeUrl = BuildConfig.APP_URL.trimEnd('/') + "/"
    private val main = Handler(Looper.getMainLooper())
    private val fileChooser = FileChooser(this)
    private val cameraAccess = WebCameraAccess(this, policy)
    private val fileSaver = FileSaver(this)
    private lateinit var updates: UpdateController

    private lateinit var root: FrameLayout
    private lateinit var progressBar: ProgressBar
    private lateinit var fullscreenHost: FrameLayout
    private var webView: WebView? = null
    private var lastInsets: WindowInsetsCompat? = null

    private var contentShown = false
    private var splashExpired = false
    private var launchCheckScheduled = false
    private var offline = false
    private var offlineSince = 0L
    private var lastUrl = homeUrl
    private var customView: View? = null
    private var customViewCallback: WebChromeClient.CustomViewCallback? = null
    private var networkCallback: ConnectivityManager.NetworkCallback? = null

    private val backCallback = object : OnBackPressedCallback(true) {
        override fun handleOnBackPressed() {
            val view = webView
            when {
                customView != null -> hideCustomView()
                offline -> finish()
                view != null && view.canGoBack() -> view.goBack()
                else -> finish()
            }
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        val splash = installSplashScreen()
        super.onCreate(savedInstanceState)
        enableEdgeToEdge(
            statusBarStyle = SystemBarStyle.light(Color.TRANSPARENT, Color.TRANSPARENT),
            navigationBarStyle = SystemBarStyle.light(Color.TRANSPARENT, Color.argb(0x33, 0, 0, 0)),
        )
        splash.setKeepOnScreenCondition { !contentShown && !splashExpired }
        main.postDelayed({ splashExpired = true }, SPLASH_MAX_MS)
        WebView.setWebContentsDebuggingEnabled(BuildConfig.DEBUG)

        buildLayout()
        updates = UpdateController(this)
        FileChooser.cleanOldCaptures(this)
        onBackPressedDispatcher.addCallback(this, backCallback)

        val view = createWebView()
        webView = view
        root.addView(view, 0)
        val restored = savedInstanceState != null && view.restoreState(savedInstanceState) != null
        if (restored) lastUrl = savedInstanceState.getString(STATE_LAST_URL) ?: homeUrl else view.loadUrl(startUrl(intent))
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        val url = startUrl(intent)
        offline = false
        webView?.loadUrl(url)
    }

    override fun onStart() {
        super.onStart()
        registerNetworkCallback()
    }

    override fun onResume() {
        super.onResume()
        webView?.onResume()
        updates.onResume()
    }

    override fun onPause() {
        webView?.onPause()
        CookieManager.getInstance().flush()
        super.onPause()
    }

    override fun onStop() {
        unregisterNetworkCallback()
        super.onStop()
    }

    override fun onSaveInstanceState(outState: Bundle) {
        super.onSaveInstanceState(outState)
        webView?.saveState(outState)
        outState.putString(STATE_LAST_URL, lastUrl)
    }

    override fun onDestroy() {
        main.removeCallbacksAndMessages(null)
        updates.onDestroy()
        fileChooser.cancel()
        webView?.let { destroyWebView(it) }
        webView = null
        super.onDestroy()
    }

    // region WebHost

    override fun openExternal(url: String) {
        try {
            startActivity(Intent(Intent.ACTION_VIEW, url.toUri()).addCategory(Intent.CATEGORY_BROWSABLE))
        } catch (_: ActivityNotFoundException) {
            Toast.makeText(this, R.string.cannot_open_link, Toast.LENGTH_LONG).show()
        }
    }

    override fun onPageStarted(url: String) {
        if (url.startsWith("http")) {
            offline = false
            lastUrl = url
        }
    }

    override fun onContentVisible() {
        contentShown = true
        if (!launchCheckScheduled) {
            launchCheckScheduled = true
            main.postDelayed({ updates.checkOnLaunch() }, LAUNCH_CHECK_DELAY_MS)
        }
    }

    override fun onMainFrameFailed(url: String) {
        showOffline(if (policy.isAppUrl(url)) url else homeUrl)
    }

    override fun onRenderProcessGone() {
        val old = webView ?: return
        destroyWebView(old)
        val fresh = createWebView()
        webView = fresh
        root.addView(fresh, 0)
        fresh.loadUrl(lastUrl)
    }

    override fun onProgress(percent: Int) {
        progressBar.progress = percent
        progressBar.visibility = if (percent in 0..99) View.VISIBLE else View.GONE
    }

    override fun chooseFiles(callback: ValueCallback<Array<Uri>>, params: WebChromeClient.FileChooserParams): Boolean =
        fileChooser.show(callback, params)

    override fun webPermissionRequested(request: PermissionRequest) = cameraAccess.handle(request)

    override fun webPermissionCanceled(request: PermissionRequest) = cameraAccess.cancel(request)

    override fun showCustomView(view: View, callback: WebChromeClient.CustomViewCallback) {
        if (customView != null) {
            callback.onCustomViewHidden()
            return
        }
        customView = view
        customViewCallback = callback
        fullscreenHost.addView(view, ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT)
        fullscreenHost.visibility = View.VISIBLE
        webView?.visibility = View.INVISIBLE
        applyInsets()
        WindowInsetsControllerCompat(window, window.decorView).apply {
            systemBarsBehavior = WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
            hide(WindowInsetsCompat.Type.systemBars())
        }
    }

    override fun hideCustomView() {
        val view = customView ?: return
        fullscreenHost.removeView(view)
        fullscreenHost.visibility = View.GONE
        customView = null
        customViewCallback?.onCustomViewHidden()
        customViewCallback = null
        webView?.visibility = View.VISIBLE
        WindowInsetsControllerCompat(window, window.decorView).show(WindowInsetsCompat.Type.systemBars())
        applyInsets()
    }

    override fun showJsDialog(message: String, confirmable: Boolean, result: JsResult) {
        val builder = AlertDialog.Builder(this)
            .setMessage(message)
            .setPositiveButton(R.string.update_action_ok) { _, _ -> result.confirm() }
            .setOnCancelListener { result.cancel() }
        if (confirmable) builder.setNegativeButton(R.string.update_action_cancel) { _, _ -> result.cancel() }
        if (isFinishing || isDestroyed) result.cancel() else builder.show()
    }

    // endregion

    private fun buildLayout() {
        val surface = getColor(R.color.flexa_surface)
        root = FrameLayout(this).apply { setBackgroundColor(surface) }
        progressBar = ProgressBar(this, null, android.R.attr.progressBarStyleHorizontal).apply {
            max = 100
            visibility = View.GONE
            progressTintList = ColorStateList.valueOf(getColor(R.color.flexa_pine))
            progressBackgroundTintList = ColorStateList.valueOf(Color.TRANSPARENT)
        }
        root.addView(
            progressBar,
            FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, (3 * resources.displayMetrics.density).toInt())
                .apply { gravity = Gravity.TOP },
        )
        fullscreenHost = FrameLayout(this).apply {
            setBackgroundColor(Color.BLACK)
            visibility = View.GONE
        }
        root.addView(fullscreenHost, ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT)
        setContentView(root)
        ViewCompat.setOnApplyWindowInsetsListener(root) { _, insets ->
            lastInsets = insets
            applyInsets()
            WindowInsetsCompat.CONSUMED
        }
    }

    private fun applyInsets() {
        val insets = lastInsets
        if (insets == null || customView != null) {
            root.setPadding(0, 0, 0, 0)
            return
        }
        val bars = insets.getInsets(WindowInsetsCompat.Type.systemBars() or WindowInsetsCompat.Type.displayCutout())
        val keyboard = insets.getInsets(WindowInsetsCompat.Type.ime())
        root.setPadding(bars.left, bars.top, bars.right, maxOf(bars.bottom, keyboard.bottom))
    }

    @SuppressLint("SetJavaScriptEnabled")
    private fun createWebView(): WebView {
        val view = WebView(this)
        view.layoutParams = FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT)
        view.setBackgroundColor(getColor(R.color.flexa_surface))
        view.settings.apply {
            javaScriptEnabled = true
            domStorageEnabled = true
            mediaPlaybackRequiresUserGesture = true
            allowFileAccess = false
            allowContentAccess = false
            mixedContentMode = WebSettings.MIXED_CONTENT_NEVER_ALLOW
            setSupportMultipleWindows(false)
            setGeolocationEnabled(false)
            userAgentString = "$userAgentString $USER_AGENT_TOKEN/${BuildConfig.VERSION_NAME}"
        }
        view.webViewClient = FlexaWebViewClient(this)
        view.webChromeClient = FlexaChromeClient(this)
        view.setDownloadListener { url, _, _, _, _ ->
            if (url.startsWith("http")) openExternal(url) else Toast.makeText(this, R.string.download_unsupported, Toast.LENGTH_LONG).show()
        }
        if (WebViewFeature.isFeatureSupported(WebViewFeature.WEB_MESSAGE_LISTENER)) {
            WebViewCompat.addWebMessageListener(
                view, NativeBridge.NAME, setOf(BuildConfig.APP_URL.trimEnd('/')),
                NativeBridge(onSaveFile = fileSaver::save, onCheckUpdate = updates::checkInteractively),
            )
        }
        return view
    }

    private fun destroyWebView(view: WebView) {
        root.removeView(view)
        view.stopLoading()
        view.destroy()
    }

    private fun startUrl(intent: Intent?): String {
        val data = intent?.takeIf { it.action == Intent.ACTION_VIEW }?.dataString
        return if (data != null && policy.decide(data, isMainFrame = true) == Navigation.Allow) data else homeUrl
    }

    private fun showOffline(retryUrl: String) {
        offline = true
        offlineSince = SystemClock.elapsedRealtime()
        contentShown = true
        val html = assets.open(OFFLINE_PAGE).bufferedReader().use { it.readText() }
            .replace("{{RETRY_URL}}", JSONObject.quote(retryUrl))
        webView?.loadDataWithBaseURL(null, html, "text/html", "UTF-8", null)
    }

    private fun registerNetworkCallback() {
        val manager = getSystemService(ConnectivityManager::class.java) ?: return
        val callback = object : ConnectivityManager.NetworkCallback() {
            override fun onAvailable(network: Network) {
                main.post {
                    if (offline && SystemClock.elapsedRealtime() - offlineSince > RETRY_GRACE_MS) {
                        webView?.loadUrl(lastUrl)
                    }
                }
            }
        }
        try {
            manager.registerDefaultNetworkCallback(callback)
            networkCallback = callback
        } catch (_: Exception) {
            networkCallback = null
        }
    }

    private fun unregisterNetworkCallback() {
        val callback = networkCallback ?: return
        networkCallback = null
        try {
            getSystemService(ConnectivityManager::class.java)?.unregisterNetworkCallback(callback)
        } catch (_: Exception) {
            // The callback was never registered or has been removed already.
        }
    }

    private companion object {
        const val USER_AGENT_TOKEN = "FlexaAndroid"
        const val OFFLINE_PAGE = "offline.html"
        const val STATE_LAST_URL = "lastUrl"
        const val SPLASH_MAX_MS = 4_000L
        const val LAUNCH_CHECK_DELAY_MS = 1_500L
        const val RETRY_GRACE_MS = 1_500L
    }
}
