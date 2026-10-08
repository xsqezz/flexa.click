package click.flexa.app.web

import android.Manifest
import android.content.pm.PackageManager
import android.webkit.PermissionRequest
import androidx.activity.ComponentActivity
import androidx.activity.result.contract.ActivityResultContracts
import androidx.core.content.ContextCompat

/** Lets the app's own pages use the camera (barcode scanner) after the Android runtime permission. */
class WebCameraAccess(private val activity: ComponentActivity, private val policy: NavigationPolicy) {

    private var pending: PermissionRequest? = null

    private val launcher = activity.registerForActivityResult(ActivityResultContracts.RequestPermission()) { granted ->
        val request = pending ?: return@registerForActivityResult
        pending = null
        if (granted) request.grant(CAMERA_ONLY) else request.deny()
    }

    fun handle(request: PermissionRequest) {
        val onlyCamera = request.resources.isNotEmpty() && request.resources.all { it == PermissionRequest.RESOURCE_VIDEO_CAPTURE }
        if (!onlyCamera || !policy.isAppUrl(request.origin.toString())) {
            request.deny()
            return
        }
        if (ContextCompat.checkSelfPermission(activity, Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED) {
            request.grant(CAMERA_ONLY)
            return
        }
        pending?.deny()
        pending = request
        launcher.launch(Manifest.permission.CAMERA)
    }

    fun cancel(request: PermissionRequest) {
        if (pending == request) pending = null
    }

    private companion object {
        val CAMERA_ONLY = arrayOf(PermissionRequest.RESOURCE_VIDEO_CAPTURE)
    }
}
