import { useEffect, useId, useRef } from "react"

export default function ConfirmationDialog({ title, description, onConfirm, onCancel, confirmLabel = "Yes", cancelLabel = "No" }: {
  title: string
  description: string
  onConfirm: () => void
  onCancel: () => void
  confirmLabel?: string
  cancelLabel?: string
}) {
  const dialog = useRef<HTMLDialogElement>(null)
  const cancel = useRef<HTMLButtonElement>(null)
  const heading = useId()
  const copy = useId()
  const actions = useRef({ onConfirm, onCancel })
  actions.current = { onConfirm, onCancel }
  useEffect(() => {
    const focus = document.activeElement as HTMLElement | null
    const overflow = document.body.style.overflow
    document.body.style.overflow = "hidden"
    dialog.current?.showModal()
    cancel.current?.focus()
    const keyDown = (event: KeyboardEvent) => {
      event.stopImmediatePropagation()
      if (event.repeat || event.isComposing || event.ctrlKey || event.metaKey || event.altKey) return
      const key = event.key.toLowerCase()
      if (key === "a" || key === "s" || key === "escape") {
        event.preventDefault()
        if (key === "a") actions.current.onConfirm()
        else actions.current.onCancel()
      }
    }
    window.addEventListener("keydown", keyDown, true)
    return () => {
      window.removeEventListener("keydown", keyDown, true)
      dialog.current?.close()
      document.body.style.overflow = overflow
      if (focus?.isConnected) focus.focus({ preventScroll: true })
    }
  }, [])
  return <dialog ref={dialog} className="confirmation-dialog" aria-labelledby={heading} aria-describedby={copy}
    onCancel={event => { event.preventDefault(); onCancel() }}
    onClick={event => {
      if (event.target !== event.currentTarget) return
      const bounds = event.currentTarget.getBoundingClientRect()
      if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) onCancel()
    }}>
    <h2 id={heading}>{title}</h2><p id={copy}>{description}</p>
    <div className="confirmation-actions">
      <button className="confirmation-yes" onClick={onConfirm} aria-keyshortcuts="A">{confirmLabel} <kbd>A</kbd></button>
      <button ref={cancel} className="confirmation-no" onClick={onCancel} aria-keyshortcuts="S">{cancelLabel} <kbd>S</kbd></button>
    </div>
  </dialog>
}
