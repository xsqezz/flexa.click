package click.flexa.app.update

import com.sun.net.httpserver.HttpExchange
import com.sun.net.httpserver.HttpServer
import java.net.InetAddress
import java.net.InetSocketAddress
import java.security.MessageDigest

/** A throw-away HTTP server on a random local port for network tests. */
class TestServer : AutoCloseable {
    private val server = HttpServer.create(InetSocketAddress(InetAddress.getLoopbackAddress(), 0), 0)

    val base: String get() = "http://127.0.0.1:${server.address.port}"

    init {
        server.executor = java.util.concurrent.Executors.newCachedThreadPool()
    }

    fun route(path: String, handler: (HttpExchange) -> Unit) {
        server.createContext(path) { exchange ->
            try {
                handler(exchange)
            } finally {
                exchange.close()
            }
        }
    }

    fun bytes(path: String, body: ByteArray, status: Int = 200) = route(path) { exchange ->
        exchange.sendResponseHeaders(status, if (body.isEmpty()) -1 else body.size.toLong())
        if (body.isNotEmpty()) exchange.responseBody.write(body)
    }

    fun redirect(path: String, target: String) = route(path) { exchange ->
        exchange.responseHeaders.add("Location", target)
        exchange.sendResponseHeaders(302, -1)
    }

    fun start(): TestServer {
        server.start()
        return this
    }

    override fun close() {
        server.stop(0)
        (server.executor as java.util.concurrent.ExecutorService).shutdownNow()
    }
}

fun sha256Hex(bytes: ByteArray): String =
    MessageDigest.getInstance("SHA-256").digest(bytes).joinToString("") { "%02x".format(it) }
