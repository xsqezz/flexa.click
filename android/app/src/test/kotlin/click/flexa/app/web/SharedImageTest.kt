package click.flexa.app.web

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class SharedImageTest {
    @Test
    fun `keeps small images at full size`() {
        assertEquals(1, SharedImage.sampleSize(1200, 800))
        assertEquals(1200 to 800, SharedImage.scaledSize(1200, 800))
    }

    @Test
    fun `halves large photos only while they stay above the limit`() {
        assertEquals(2, SharedImage.sampleSize(4000, 3000))
        assertEquals(4, SharedImage.sampleSize(6400, 4800))
        assertEquals(1, SharedImage.sampleSize(3100, 2000))
    }

    @Test
    fun `scales the longer side down to the limit and keeps the ratio`() {
        assertEquals(1600 to 1200, SharedImage.scaledSize(4000, 3000))
        assertEquals(900 to 1600, SharedImage.scaledSize(1800, 3200))
    }

    @Test
    fun `survives nonsense sizes`() {
        assertEquals(1, SharedImage.sampleSize(0, 0))
        assertEquals(0 to 0, SharedImage.scaledSize(0, 0))
    }

    @Test
    fun `hands a photo over exactly once`() {
        SharedImage.store(byteArrayOf(1, 2, 3))
        assertEquals(3, SharedImage.take()?.size)
        assertNull(SharedImage.take())
    }
}