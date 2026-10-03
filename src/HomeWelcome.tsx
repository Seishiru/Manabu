import { useEffect, useRef, type ReactNode } from "react"

export default function HomeWelcome({
  returning,
  description,
  icon,
  onContinue,
  onDismiss,
}: {
  returning: boolean
  description: string
  icon: ReactNode
  onContinue: () => void
  onDismiss: () => void
}) {
  const dialog = useRef<HTMLElement>(null)
  const primaryButton = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    const previousFocus = document.activeElement as HTMLElement | null
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = "hidden"
    primaryButton.current?.focus()

    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onDismiss()
      if (event.key !== "Tab") return
      const buttons = dialog.current?.querySelectorAll<HTMLButtonElement>("button")
      if (!buttons?.length) return
      const first = buttons[0]
      const last = buttons[buttons.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener("keydown", handleKey)
    return () => {
      document.body.style.overflow = previousOverflow
      document.removeEventListener("keydown", handleKey)
      if (previousFocus?.isConnected && previousFocus !== document.body) {
        previousFocus.focus()
      } else {
        document.querySelector<HTMLButtonElement>(".home-learning .continue-card button")?.focus()
      }
    }
  }, [onDismiss])

  return (
    <div
      className="home-welcome-backdrop"
      onClick={event => {
        if (event.target === event.currentTarget) onDismiss()
      }}
    >
      <section
        ref={dialog}
        className="home-welcome-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="home-welcome-title"
        aria-describedby="home-welcome-description"
      >
        <span className="home-welcome-icon" aria-hidden="true">{icon}</span>
        <p className="eyebrow">YOUR NEXT SMALL STEP</p>
        <h2 id="home-welcome-title">
          {returning ? "Let's continue learning." : "Let's practice."}
        </h2>
        <p id="home-welcome-description">{description}</p>
        <button ref={primaryButton} className="primary-button" onClick={onContinue}>
          {returning ? "Continue learning" : "Let's practice"}<span aria-hidden="true">→</span>
        </button>
        <button className="dict-text-button" onClick={onDismiss}>Maybe later</button>
        <small>Click outside to explore Home.</small>
      </section>
    </div>
  )
}
