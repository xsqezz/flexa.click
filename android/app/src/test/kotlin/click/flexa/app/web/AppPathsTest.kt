package click.flexa.app.web

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class AppPathsTest {
    private val app = "https://flexa-click.pages.dev"

    @Test
    fun `opens plain app paths`() {
        assertEquals("https://flexa-click.pages.dev/plan", AppPaths.resolve(app, "/plan"))
        assertEquals("https://flexa-click.pages.dev/", AppPaths.resolve("$app/", "/"))
        assertEquals("https://flexa-click.pages.dev/plan/full-a", AppPaths.resolve(app, "/plan/full-a"))
    }

    @Test
    fun `refuses anything that could leave the app`() {
        assertNull(AppPaths.resolve(app, null))
        assertNull(AppPaths.resolve(app, ""))
        assertNull(AppPaths.resolve(app, "plan"))
        assertNull(AppPaths.resolve(app, "//evil.example/x"))
        assertNull(AppPaths.resolve(app, "/@evil.example"))
        assertNull(AppPaths.resolve(app, "https://evil.example"))
        assertNull(AppPaths.resolve(app, "/../etc"))
        assertNull(AppPaths.resolve(app, "/plan?x=1"))
        assertNull(AppPaths.resolve(app, "/plan#x"))
        assertNull(AppPaths.resolve(app, "/plan/"))
        assertNull(AppPaths.resolve(app, "/" + "a".repeat(200)))
    }
}
