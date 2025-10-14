import React, { useMemo, useState } from 'react'

const Contact: React.FC = () => {
  // Minimal controlled state for validation and UX
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState('')
  const [result, setResult] = useState('')
  const [submitting, setSubmitting] = useState(false)

  // Basic client-side checks; HTML required attributes enforce at submit as well
  const emailValid = useMemo(() => /.+@.+\..+/.test(email), [email])
  const nameValid = name.trim().length > 1
  const msgValid = message.trim().length > 0
  const formValid = nameValid && emailValid && msgValid

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    // Avoid duplicate requests and prevent sending invalid data
    if (!formValid || submitting) return
    try {
      setSubmitting(true)
      setResult('Sending...')
      const formEl = e.currentTarget
      // Build payload directly from form fields
      const fd = new FormData(formEl)

      // Web3Forms key (env can override); subject for email title
      const ACCESS_KEY = import.meta.env.VITE_WEB3FORMS_KEY || 'd69f0bdd-f02d-4b1b-a5ff-f011000d59da'
      fd.append('access_key', ACCESS_KEY)
      fd.append('subject', `Portfolio contact from ${name}`)

      const resp = await fetch('https://api.web3forms.com/submit', {
        method: 'POST',
        body: fd,
      })
      const data = await resp.json()
      if (data.success) {
        setResult('Form submitted successfully!')
        // Reset form & local state
        formEl.reset()
        setName('')
        setEmail('')
        setMessage('')
      } else {
        console.error('Web3Forms error:', data)
        setResult(data.message || 'Something went wrong. Please try again.')
      }
    } catch (err) {
      console.error(err)
      setResult('Network error. Please try again later.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <section id="contact" className="w-full bg-white">
      <div className="max-w-3xl mx-auto px-6 py-16 md:py-24">
        <h2 className="text-3xl md:text-4xl font-semibold tracking-tight mb-6">Contact me</h2>
        <p className="text-slate-600 mb-10">
          Feel free to send me whatever shenanigans you want!
        </p>

        {/* Bitwarden suppressed; standard field names for Web3Forms */}
        <form
          onSubmit={handleSubmit}
          noValidate
          autoComplete="off"
          data-bwignore="true"
          className="space-y-6"
        >
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-slate-800 mb-2">
              Name
            </label>
            <input
              id="name"
              name="name"
              type="text"
              autoComplete="off"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-4 py-2.5 outline-none focus:ring-2 focus:ring-slate-400"
              placeholder="Your name"
              required
              data-bwignore="true"
            />
          </div>

          <div>
            <label htmlFor="email" className="block text-sm font-medium text-slate-800 mb-2">
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="off"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-4 py-2.5 outline-none focus:ring-2 focus:ring-slate-400"
              placeholder="you@example.com"
              required
              data-bwignore="true"
            />
          </div>

          <div>
            <label htmlFor="message" className="block text-sm font-medium text-slate-800 mb-2">
              Message
            </label>
            <textarea
              id="message"
              name="message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={6}
              className="w-full rounded-lg border border-slate-300 px-4 py-2.5 outline-none focus:ring-2 focus:ring-slate-400 resize-none"
              placeholder="Say hello!"
              required
              autoComplete="off"
              data-bwignore="true"
            />
          </div>

          <div className="flex items-center gap-4">
            <button
              type="submit"
              disabled={!formValid || submitting}
              className="inline-flex items-center justify-center rounded-lg bg-slate-900 px-5 py-2.5 text-white font-medium shadow-sm transition disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
            >
              {submitting ? 'Sending...' : 'Send message'}
            </button>
            {result && <span className="text-sm text-slate-600">{result}</span>}
          </div>
        </form>
      </div>
    </section>
  )
}

export default Contact
