import { useEffect, useId, useRef, useState } from "react"
import { useNavigate } from "react-router"
import { tutorialShortcut, tutorialSteps } from "./tutorial"

type Bounds = { x: number; y: number; width: number; height: number }
export default function SpotlightTour({ onClose }: { onClose: () => void }) {
  const navigate = useNavigate()
  const [step, setStep] = useState(0)
  const [bounds, setBounds] = useState<Bounds | null>(null)
  const [viewport, setViewport] = useState({ width: innerWidth, height: innerHeight })
  const dialog = useRef<HTMLDialogElement>(null)
  const card = useRef<HTMLElement>(null)
  const nextButton = useRef<HTMLButtonElement>(null)
  const maskId = useId()
  const titleId = useId()
  const descriptionId = useId()
  const current = tutorialSteps[step]
  const closeRef = useRef(onClose)
  closeRef.current = onClose
  const next = () => step === tutorialSteps.length - 1 ? onClose() : setStep(value => value + 1)
  useEffect(() => {
    const previousFocus = document.activeElement as HTMLElement | null
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = "hidden"
    dialog.current?.showModal()
    nextButton.current?.focus()
    const closeOnBack = () => closeRef.current()
    window.addEventListener("popstate", closeOnBack)
    return () => {
      dialog.current?.close()
      document.body.style.overflow = previousOverflow
      window.removeEventListener("popstate", closeOnBack)
      if (previousFocus?.isConnected) previousFocus.focus({ preventScroll: true })
      else document.querySelector<HTMLButtonElement>(".home-tutorial-button")?.focus({ preventScroll: true })
    }
  }, [])
  useEffect(() => {
    setBounds(null)
    navigate(current.path, { replace: true })
    window.scrollTo(0, 0)
    let frame = 0
    let attempts = 0
    let disposed = false
    let observed: Element | null = null
    const measure = () => {
      if (disposed) return
      setViewport({ width: innerWidth, height: innerHeight })
      const target = [...document.querySelectorAll(current.target)].find(element => { const rect = element.getBoundingClientRect(); return element.getAttribute("data-tour-route") === current.path && rect.width > 0 && rect.height > 0 })
      if (target) {
        if (observed !== target) { observed = target; target.scrollIntoView({ block: "center", behavior: "instant" }); observer.observe(target) }
        const rect = target.getBoundingClientRect()
        const x = Math.max(10, rect.left - 4)
        const y = Math.max(10, rect.top - 4)
        setBounds({ x, y, width: Math.max(0, Math.min(rect.right + 4, innerWidth - 10) - x), height: Math.max(0, Math.min(rect.bottom + 4, innerHeight - 10) - y) })
      }
    }
    const settle = () => { if (disposed) return; measure(); if (++attempts < 35) frame = requestAnimationFrame(settle) }
    const observer = new ResizeObserver(measure)
    frame = requestAnimationFrame(settle)
    window.addEventListener("resize", measure)
    window.addEventListener("scroll", measure, true)
    nextButton.current?.focus({ preventScroll: true })
    return () => { disposed = true; cancelAnimationFrame(frame); observer.disconnect(); window.removeEventListener("resize", measure); window.removeEventListener("scroll", measure, true) }
  }, [step, navigate, current])
  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Tab") return
      event.stopImmediatePropagation()
      if (event.repeat || event.isComposing || event.ctrlKey || event.altKey || event.metaKey || event.shiftKey) return
      const action = tutorialShortcut(event.key)
      if (!action) return
      event.preventDefault()
      if (action === "previous") setStep(value => Math.max(0, value - 1))
      else if (action === "next") next()
      else onClose()
    }
    window.addEventListener("keydown", handleKey, true)
    return () => window.removeEventListener("keydown", handleKey, true)
  })
  const width = Math.min(370, viewport.width - 32)
  const height = card.current?.offsetHeight || 285
  const besideSidebar = !!bounds && viewport.width >= 900 && bounds.width < 270
  const left = Math.max(16, Math.min(viewport.width - width - 16, bounds ? besideSidebar ? bounds.x + bounds.width + 20 : bounds.x + bounds.width / 2 - width / 2 : (viewport.width - width) / 2))
  const below = bounds ? bounds.y + bounds.height + 16 : 24
  const top = besideSidebar && bounds ? Math.max(16, Math.min(bounds.y, viewport.height - height - 16)) : below + height < viewport.height - 16 ? below : bounds && bounds.y - height - 16 >= 16 ? bounds.y - height - 16 : Math.max(16, viewport.height - height - 16)
  return <dialog ref={dialog} className="spotlight-dialog" aria-labelledby={titleId} aria-describedby={descriptionId} onCancel={event => { event.preventDefault(); onClose() }}>
    <svg className="spotlight-shade" aria-hidden="true" width="100%" height="100%"><defs><mask id={maskId}><rect width="100%" height="100%" fill="white" />{bounds && <rect {...bounds} rx="18" fill="black" />}</mask></defs><rect width="100%" height="100%" className="spotlight-dim" mask={`url(#${maskId})`} />{bounds && <rect {...bounds} rx="18" className="spotlight-outline" />}</svg>
    <section ref={card} className="spotlight-card learn-panel" style={{ left, top, width }}>
      <div className="spotlight-top"><span className="spotlight-number">{step + 1}</span><span className="eyebrow">A QUICK LOOK · {step + 1} / {tutorialSteps.length}</span><button className="dict-text-button" onClick={onClose}>Skip tour</button></div>
      <h2 id={titleId}>{current.title}</h2><p id={descriptionId}>{current.description}</p>
      <div className="spotlight-dots" aria-hidden="true">{tutorialSteps.map((_, index) => <span key={index} className={index === step ? "active" : ""} />)}</div>
      <div className="spotlight-actions"><button className="secondary-button" disabled={step === 0} aria-keyshortcuts="a" onClick={() => setStep(value => Math.max(0, value - 1))}>Previous <kbd>A</kbd></button><button ref={nextButton} className="dict-primary" aria-keyshortcuts="d Enter" onClick={next}>{step === tutorialSteps.length - 1 ? "Done" : "Next"} <kbd>D / Enter</kbd></button></div>
      <small>Press Escape to close. Replay anytime with ? on Home.</small>
    </section>
  </dialog>
}
