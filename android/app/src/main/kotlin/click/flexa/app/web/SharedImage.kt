package click.flexa.app.web

import android.content.ContentResolver
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.net.Uri
import java.io.ByteArrayOutputStream
import java.io.IOException

/**
 * A photo another app shared with Flexa ("Share" > Flexa). It is decoded, scaled down and re-encoded as JPEG here, which
 * also drops all EXIF data (location included). It lives only in memory until the page takes it once; nothing is stored.
 */
object SharedImage {

    const val MIME = "image/jpeg"
    const val MAX_SIDE = 1600
    private const val MAX_SOURCE_BYTES = 40L * 1024 * 1024
    private const val QUALITY = 85

    @Volatile
    private var pending: ByteArray? = null

    /** Returns the waiting photo once; later calls return `null` until another one is shared. */
    fun take(): ByteArray? = synchronized(this) { pending.also { pending = null } }

    fun store(bytes: ByteArray) = synchronized(this) { pending = bytes }

    /** Largest power-of-two sample size that keeps the longer side at or above [max] (never below 1). */
    fun sampleSize(width: Int, height: Int, max: Int = MAX_SIDE): Int {
        if (width <= 0 || height <= 0 || max <= 0) return 1
        var size = 1
        while (maxOf(width, height) / (size * 2) >= max) size *= 2
        return size
    }

    /** Final dimensions when the longer side is limited to [max]; smaller images keep their size. */
    fun scaledSize(width: Int, height: Int, max: Int = MAX_SIDE): Pair<Int, Int> {
        val longest = maxOf(width, height)
        if (longest <= max || longest <= 0) return width to height
        val ratio = max.toDouble() / longest
        return maxOf(1, Math.round(width * ratio).toInt()) to maxOf(1, Math.round(height * ratio).toInt())
    }

    /** Reads, scales and re-encodes the image behind [uri]; `null` when it is not a readable image. */
    fun prepare(resolver: ContentResolver, uri: Uri): ByteArray? {
        try {
            val bounds = BitmapFactory.Options().apply { inJustDecodeBounds = true }
            resolver.openInputStream(uri)?.use { BitmapFactory.decodeStream(it, null, bounds) } ?: return null
            if (bounds.outWidth <= 0 || bounds.outHeight <= 0) return null
            if (bounds.outWidth.toLong() * bounds.outHeight > MAX_SOURCE_BYTES) return null
            val options = BitmapFactory.Options().apply { inSampleSize = sampleSize(bounds.outWidth, bounds.outHeight) }
            val decoded = resolver.openInputStream(uri)?.use { BitmapFactory.decodeStream(it, null, options) } ?: return null
            val (width, height) = scaledSize(decoded.width, decoded.height)
            val scaled = if (width == decoded.width && height == decoded.height) decoded
            else Bitmap.createScaledBitmap(decoded, width, height, true).also { if (it !== decoded) decoded.recycle() }
            val out = ByteArrayOutputStream()
            scaled.compress(Bitmap.CompressFormat.JPEG, QUALITY, out)
            scaled.recycle()
            return out.toByteArray()
        } catch (_: IOException) {
            return null
        } catch (_: SecurityException) {
            return null
        } catch (_: OutOfMemoryError) {
            return null
        }
    }
}