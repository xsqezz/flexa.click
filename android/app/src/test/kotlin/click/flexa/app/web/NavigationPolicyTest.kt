package click.flexa.app.web

import org.junit.Assert.assertEquals
import org.junit.Test

class NavigationPolicyTest {
    private val policy = NavigationPolicy("https://flexa-click.pages.dev")

    private fun main(url: String) = policy.decide(url, isMainFrame = true)
    private fun frame(url: String) = policy.decide(url, isMainFrame = false)

    @Test
    fun `keeps the app's own pages inside the app`() {
        assertEquals(Navigation.Allow, main("https://flexa-click.pages.dev/"))
        assertEquals(Navigation.Allow, main("https://flexa-click.pages.dev/kitchen?x=1#a"))
        assertEquals(Navigation.Allow, main("HTTPS://FLEXA-CLICK.PAGES.DEV:443/plan"))
    }

    @Test
    fun `sends other sites to the system browser`() {
        val url = "https://world.openfoodfacts.org/product/1"
        assertEquals(Navigation.External(url), main(url))
        assertEquals(Navigation.External("http://example.com/"), main("http://example.com/"))
        assertEquals(Navigation.External("mailto:a@b.pl"), main("mailto:a@b.pl"))
        assertEquals(Navigation.External("tel:+48123456789"), main("tel:+48123456789"))
    }

    @Test
    fun `does not treat look-alike hosts as the app`() {
        assertEquals(Navigation.External("https://flexa-click.pages.dev.evil.example/"), main("https://flexa-click.pages.dev.evil.example/"))
        assertEquals(Navigation.External("https://evil.example/flexa-click.pages.dev"), main("https://evil.example/flexa-click.pages.dev"))
        assertEquals(Navigation.External("https://flexa-click.pages.dev@evil.example/"), main("https://flexa-click.pages.dev@evil.example/"))
        assertEquals(Navigation.External("https://evil.example@flexa-click.pages.dev/"), main("https://evil.example@flexa-click.pages.dev/"))
        assertEquals(Navigation.External("https://flexa-click.pages.dev:8443/"), main("https://flexa-click.pages.dev:8443/"))
        assertEquals(Navigation.External("http://flexa-click.pages.dev/"), main("http://flexa-click.pages.dev/"))
    }

    @Test
    fun `blocks schemes that could run code or read local data`() {
        for (url in listOf(
            "javascript:alert(1)", "intent://scan/#Intent;scheme=zxing;end", "file:///data/data/click.flexa.app/x",
            "content://media/external/images/1", "data:text/html,<script>1</script>", "blob:https://flexa-click.pages.dev/abc",
            "market://details?id=x", "about:srcdoc", "not a url", "",
        )) assertEquals(url, Navigation.Block, main(url))
    }

    @Test
    fun `allows blank pages and only secure addresses in frames`() {
        assertEquals(Navigation.Allow, main("about:blank"))
        assertEquals(Navigation.Allow, frame("about:blank"))
        assertEquals(Navigation.Allow, frame("https://www.youtube-nocookie.com/embed/abc"))
        assertEquals(Navigation.Block, frame("http://www.youtube-nocookie.com/embed/abc"))
        assertEquals(Navigation.Block, frame("intent://x#Intent;end"))
        assertEquals(Navigation.Block, frame("javascript:void(0)"))
    }

    @Test
    fun `recognises app urls for permission checks`() {
        assertEquals(true, policy.isAppUrl("https://flexa-click.pages.dev"))
        assertEquals(true, policy.isAppUrl("https://flexa-click.pages.dev/kitchen"))
        assertEquals(false, policy.isAppUrl("https://www.youtube-nocookie.com/"))
        assertEquals(false, policy.isAppUrl(""))
    }

    @Test
    fun `supports a local development server`() {
        val dev = NavigationPolicy("http://10.0.2.2:5173")
        assertEquals(Navigation.Allow, dev.decide("http://10.0.2.2:5173/kitchen", true))
        assertEquals(Navigation.External("http://10.0.2.2:5174/"), dev.decide("http://10.0.2.2:5174/", true))
    }

    @Test(expected = IllegalArgumentException::class)
    fun `refuses a configuration without a host`() {
        NavigationPolicy("not-a-url")
    }
}
