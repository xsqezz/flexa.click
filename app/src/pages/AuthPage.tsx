import { useState, type FormEvent } from 'react'
import { ArrowRight, Check, Eye, EyeOff, Leaf } from 'lucide-react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { CONSENT_VERSION } from '../../../shared/domain'
import { useAuth } from '../lib/Auth'
import { configurationError, registrationConfigured, supabase } from '../lib/supabase'
import { Brand, Button, Field, Notice } from '../components/ui'

export function AuthPage() {
  const auth = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const signup = location.pathname === '/signup'
  const recovery = location.pathname === '/reset-password'
  const [forgot, setForgot] = useState(false)
  const [passwordVisible, setPasswordVisible] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  if (auth.mode !== 'guest' && !recovery) return <Navigate to="/" replace />

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!supabase) { setError('Konta wymagają konfiguracji Supabase. Możesz teraz wypróbować osobne demo.'); return }
    setBusy(true); setError(null); setMessage(null)
    const values = new FormData(event.currentTarget)
    const email = String(values.get('email') ?? '').trim()
    const password = String(values.get('password') ?? '')
    try {
      if (recovery) {
        if (!auth.session) throw new Error('Otwórz link odzyskiwania z wiadomości e-mail w tej przeglądarce.')
        const { error: responseError } = await supabase.auth.updateUser({ password })
        if (responseError) throw new Error('Nie udało się ustawić hasła. Otwórz świeży link odzyskiwania.')
        navigate('/'); return
      }
      if (forgot) {
        const { error: responseError } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${locationOrigin()}/reset-password`,
        })
        if (responseError) throw new Error('Nie udało się wysłać wiadomości. Sprawdź połączenie i konfigurację poczty.')
        setMessage('Jeśli taki adres jest zarejestrowany, otrzymasz link do ustawienia nowego hasła.')
      } else if (signup) {
        if (!registrationConfigured) throw new Error('Administrator musi najpierw skonfigurować usługę kont i informacje o prywatności.')
        const { data, error: responseError } = await supabase.auth.signUp({
          email, password, options: {
            emailRedirectTo: locationOrigin(),
            data: {
              display_name: String(values.get('name')).trim(),
              adult_confirmed: values.get('adult') === 'on',
              privacy_consent: values.get('consent') === 'on',
              consent_version: CONSENT_VERSION,
            },
          },
        })
        if (responseError) throw new Error('Nie udało się utworzyć konta. Sprawdź dane, limit poczty i ustawienia rejestracji.')
        if (!data.session) setMessage('Sprawdź pocztę i potwierdź adres, aby aktywować konto. Wiadomość może trafić do spamu.')
      } else {
        const { error: responseError } = await supabase.auth.signInWithPassword({ email, password })
        if (responseError) throw new Error('Nie udało się zalogować. Sprawdź adres i hasło oraz potwierdzenie konta w e-mailu.')
      }
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Operacja nie powiodła się. Spróbuj ponownie.') }
    finally { setBusy(false) }
  }

  return <div className="auth-layout">
    <section className="auth-story">
      <Brand />
      <div className="auth-story-content">
        <h1>Twój rytm.<br />Jedno miejsce.</h1>
        <p>Darmowy dziennik jedzenia, treningów i postępów. Jedz świadomie, ruszaj się po swojemu i zobacz, jak małe kroki układają się w całość.</p>
        <div className="auth-preview" aria-label="Ilustracja dziennika">
          <div className="auth-preview-title"><Leaf size={20} aria-hidden="true" /><span>Plan na dobry dzień</span></div>
          <div className="preview-line"><Check size={17} /><span>Jedzenie bez zgadywania</span></div>
          <div className="preview-line"><Check size={17} /><span>Trening w Twoim tempie</span></div>
          <div className="preview-line"><Check size={17} /><span>Postęp, który ma znaczenie</span></div>
        </div>
      </div>
      <span className="auth-story-footer">Bez abonamentu. Bez porównywania się z innymi.</span>
    </section>
    <main className="auth-main">
      <div className="auth-form-wrapper">
        <h2>{recovery ? 'Ustaw nowe hasło' : forgot ? 'Odzyskaj dostęp' : signup ? 'Zacznij swój rytm' : 'Dobrze Cię widzieć'}</h2>
        <p>{signup ? 'Jedno konto na jedzenie, ruch i postępy.' : forgot ? 'Wyślemy Ci link do ustawienia nowego hasła.' : recovery ? 'Wybierz hasło, którego nie używasz w innych usługach.' : 'Twój dziennik czeka. Wracamy do dobrych nawyków?'}</p>
        {!supabase && <Notice>{configurationError ?? 'Usługa kont nie jest jeszcze podłączona. Demo działa niezależnie, bez konta i bez synchronizacji.'}</Notice>}
        {signup && supabase && !registrationConfigured && <Notice>Rejestracja jest wyłączona do uzupełnienia informacji o administratorze i kontakcie prywatności.</Notice>}
        {auth.error && <Notice tone="error">{auth.error}</Notice>}
        {error && <Notice tone="error">{error}</Notice>}
        {message && <Notice tone="success">{message}</Notice>}
        <form className="form-stack" onSubmit={(event) => { void submit(event) }}>
          {signup && <Field label="Jak mamy się do Ciebie zwracać?"><input name="name" autoComplete="nickname" maxLength={60} required /></Field>}
          {!recovery && <Field label="Adres e-mail"><input name="email" type="email" autoComplete="email" required /></Field>}
          {!forgot && <Field label={recovery ? 'Nowe hasło' : 'Hasło'} hint={signup || recovery ? 'Od 10 do 72 znaków.' : undefined}
            action={<button type="button" className="icon-button" onClick={() => setPasswordVisible(!passwordVisible)}
              aria-label={passwordVisible ? 'Ukryj hasło' : 'Pokaż hasło'}>{passwordVisible ? <EyeOff size={18} /> : <Eye size={18} />}</button>}>
            <input name="password" type={passwordVisible ? 'text' : 'password'}
              minLength={signup || recovery ? 10 : undefined} maxLength={signup || recovery ? 72 : 256}
              autoComplete={signup || recovery ? 'new-password' : 'current-password'} required />
          </Field>}
          {signup && <>
            <label className="checkbox-label"><input type="checkbox" name="adult" required /><span>Mam ukończone 18 lat.</span></label>
            <label className="checkbox-label"><input type="checkbox" name="consent" required /><span>Zgadzam się na przechowywanie danych o żywieniu, aktywności i pomiarach na potrzeby dziennika, zgodnie z <Link to="/privacy">polityką prywatności</Link>. Zgodę mogę wycofać, usuwając konto.</span></label>
          </>}
          <Button type="submit" busy={busy} disabled={!supabase || (signup && !registrationConfigured) || (recovery && !auth.session)}>
            {recovery ? 'Zapisz hasło' : forgot ? 'Wyślij link' : signup ? 'Utwórz darmowe konto' : 'Zaloguj się'}<ArrowRight size={17} aria-hidden="true" />
          </Button>
        </form>
        {!signup && !recovery && <button className="text-link auth-forgot" onClick={() => { setForgot(!forgot); setError(null); setMessage(null) }}>
          {forgot ? 'Wróć do logowania' : 'Nie pamiętam hasła'}
        </button>}
        {!recovery && <div className="auth-secondary">
          <p>{signup ? 'Masz już konto?' : 'Pierwszy raz?'} <Link to={signup ? '/login' : '/signup'} onClick={() => { setForgot(false); setMessage(null); setError(null) }}>
            {signup ? 'Zaloguj się' : 'Utwórz konto'}</Link></p>
          <div className="divider-text">lub zajrzyj bez konta</div>
          <Button variant="secondary" className="full-width" onClick={auth.enterDemo}>Wypróbuj demo</Button>
          <small>Dane demonstracyjne zostają tylko w tej przeglądarce.</small>
        </div>}
        <div className="auth-legal"><Link to="/about">O Flexa</Link><Link to="/privacy">Prywatność</Link><Link to="/sources">Źródła danych</Link>
          <a href="https://flexa.best/" target="_blank" rel="noreferrer">Strona projektu</a></div>
      </div>
    </main>
  </div>
}

function locationOrigin() { return window.location.origin }
