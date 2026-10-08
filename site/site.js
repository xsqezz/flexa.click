// Progressive enhancement for the public landing: without this file the menu stays a visible list
// and every install option is shown in its default order.
document.documentElement.classList.add('js')

document.addEventListener('DOMContentLoaded', () => {
  const toggle = document.querySelector('[data-menu-toggle]')
  const menu = toggle && document.getElementById(toggle.getAttribute('aria-controls'))
  if (toggle && menu) {
    const setOpen = (open) => {
      toggle.setAttribute('aria-expanded', String(open))
      menu.classList.toggle('is-open', open)
    }
    toggle.hidden = false
    setOpen(false)
    toggle.addEventListener('click', () => setOpen(toggle.getAttribute('aria-expanded') !== 'true'))
    menu.addEventListener('click', (event) => {
      if (event.target instanceof Element && event.target.closest('a')) setOpen(false)
    })
    document.addEventListener('keydown', (event) => {
      if (event.key !== 'Escape' || toggle.getAttribute('aria-expanded') !== 'true') return
      setOpen(false)
      toggle.focus()
    })
    document.addEventListener('click', (event) => {
      if (event.target instanceof Node && !menu.contains(event.target) && !toggle.contains(event.target)) setOpen(false)
    })
  }

  const options = document.querySelector('[data-install-options]')
  if (!options) return
  const agent = navigator.userAgent
  const insideApp = /FlexaAndroid\//.test(agent)
  const platform = insideApp || /Android/i.test(agent) ? 'android'
    : /iPhone|iPad|iPod/.test(agent) || (/Macintosh/.test(agent) && navigator.maxTouchPoints > 1) ? 'ios'
      : 'desktop'
  const match = options.querySelector(`[data-platform="${platform}"]`)
  if (match) {
    options.prepend(match)
    match.classList.add('is-match')
    const badge = document.createElement('p')
    badge.className = 'install-match'
    badge.textContent = insideApp ? 'Korzystasz z tej aplikacji' : 'Pasuje do Twojego urządzenia'
    match.querySelector('h3')?.after(badge)
  }
  if (insideApp) {
    for (const element of document.querySelectorAll('[data-apk-only]')) element.hidden = true
    for (const element of document.querySelectorAll('[data-in-app]')) element.hidden = false
  }
})
