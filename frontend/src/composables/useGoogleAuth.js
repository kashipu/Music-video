const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID

export function useGoogleAuth() {
  function loadGoogle() {
    if (window.google?.accounts?.id) return Promise.resolve()
    return new Promise((resolve, reject) => {
      const script = document.createElement('script')
      script.src = 'https://accounts.google.com/gsi/client'
      script.async = true
      script.onload = resolve
      script.onerror = () => reject(new Error('No pudimos cargar Google'))
      document.head.appendChild(script)
    })
  }

  async function startGoogleAuth(onCredential) {
    if (!GOOGLE_CLIENT_ID) {
      throw new Error('Google Sign-In no esta configurado')
    }
    await loadGoogle()
    window.google.accounts.id.initialize({
      client_id: GOOGLE_CLIENT_ID,
      callback: ({ credential }) => onCredential(credential),
    })
    window.google.accounts.id.prompt()
  }

  return {
    GOOGLE_CLIENT_ID,
    loadGoogle,
    startGoogleAuth,
  }
}
