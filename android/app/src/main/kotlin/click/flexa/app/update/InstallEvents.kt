package click.flexa.app.update

import android.os.Handler
import android.os.Looper

sealed interface InstallEvent {
    data object AwaitingConfirmation : InstallEvent
    data object Succeeded : InstallEvent
    data object Cancelled : InstallEvent
    data class Failed(val status: Int, val message: String?) : InstallEvent
}

/** Hands the installer's asynchronous result from the broadcast receiver to whoever is listening in this process. */
object InstallEvents {
    private val main = Handler(Looper.getMainLooper())

    @Volatile
    var listener: ((InstallEvent) -> Unit)? = null

    fun publish(event: InstallEvent) {
        main.post { listener?.invoke(event) }
    }
}
