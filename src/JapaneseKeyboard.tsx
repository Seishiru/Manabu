import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react"
import { useLocation, useNavigate } from "react-router"
import { readKeyboardDraft, writeKeyboardDraft } from "./keyboardDraft"
import Dictionary from "./Dictionary"
import { learningId, practiceItemById } from "./content/catalog"
import { saveItem, useLearning, type Item } from "./learning"
import { convertEdit, deleteSelection, dictionaryKeyboardCandidates, keyboardCandidates, keyboardRows, romajiToKana, toScript, type Candidate, type Script } from "./keyboard"

export default function JapaneseKeyboard({ onPractice }: { onPractice: (item: Item) => void }) {
  const data = useLearning()
  const [initialDraft] = useState(readKeyboardDraft)
  const location = useLocation()
  const navigate = useNavigate()
  const editor = useRef<HTMLTextAreaElement>(null)
  const composing = useRef(false)
  const pendingN = useRef(false)
  const desiredCaret = useRef<number | null>(null)
  const dialog = useRef<HTMLDialogElement>(null)
  const detailsTrigger = useRef<HTMLButtonElement | null>(null)
  const [text, setText] = useState(initialDraft.text)
  const [cursor, setCursor] = useState(initialDraft.text.length)
  const [convertTyping, setConvertTyping] = useState(initialDraft.convertTyping)
  const [boundary, setBoundary] = useState(0)
  const [script, setScript] = useState<Script>(initialDraft.script)
  const [group, setGroup] = useState("Basic")
  const details = new URLSearchParams(location.search).get("entry")
  const setDetails = (id: string | null) => {
    const params = new URLSearchParams(location.search)
    if (id) params.set("entry", id)
    else { dialog.current?.close(); params.delete("entry") }
    navigate({ pathname: "/japanese-keyboard", search: params.toString() }, { replace: !id })
  }
  const [notice, setNotice] = useState("")
  const [pending, setPending] = useState(false)
  const localCandidates = useMemo(() => pending ? [] : keyboardCandidates(text, cursor, boundary, !convertTyping), [text, cursor, boundary, pending, convertTyping])
  const [dictionaryCandidates, setDictionaryCandidates] = useState<Candidate[]>([])
  const [dictionaryQuery, setDictionaryQuery] = useState("")
  const [dictionaryLoading, setDictionaryLoading] = useState(false)
  const [dictionarySearched, setDictionarySearched] = useState(false)
  useEffect(() => {
    let active = true
    if (!dictionaryQuery || pending) { setDictionaryCandidates([]); setDictionaryLoading(false); return }
    setDictionaryLoading(true)
    dictionaryKeyboardCandidates(dictionaryQuery, dictionaryQuery.length, 0, !convertTyping).then(matches => {
      if (active) setDictionaryCandidates(matches.filter(candidate => !practiceItemById(candidate.entry.id)))
    }).catch(() => {
      if (active) setDictionaryCandidates([])
    }).finally(() => { if (active) setDictionaryLoading(false) })
    return () => { active = false }
  }, [dictionaryQuery, pending, convertTyping])
  const triggerDictionarySearch = () => {
    const next = convertTyping ? text.slice(0, cursor).replace(/[a-z']+$/i, value => romajiToKana(value, script, true)) + text.slice(cursor) : text
    if (next !== text) place(next, Math.min(cursor, next.length), true)
    setDictionarySearched(true)
    setDictionaryQuery(next)
  }
  useEffect(() => {
    if (!pendingN.current || !convertTyping) return
    const timer = window.setTimeout(() => commit(), 700)
    return () => window.clearTimeout(timer)
  }, [text, convertTyping])
  const candidates = useMemo(() => {
    const seen = new Set(localCandidates.map(candidate => candidate.entry.id))
    return [...localCandidates, ...dictionaryCandidates.filter(candidate => !seen.has(candidate.entry.id))].slice(0, 12)
  }, [localCandidates, dictionaryCandidates])
  useEffect(() => {
    try { writeKeyboardDraft({ text, script, convertTyping }) }
    catch { setNotice("This draft could not be cached. Copy your text before leaving.") }
  }, [text, script, convertTyping])
  useLayoutEffect(() => {
    if (desiredCaret.current === null || !editor.current) return
    editor.current.focus()
    editor.current.setSelectionRange(desiredCaret.current, desiredCaret.current)
    desiredCaret.current = null
  })
  useEffect(() => {
    if (!details) return
    const nativeDialog = dialog.current
    nativeDialog?.showModal()
    nativeDialog?.querySelector<HTMLButtonElement>("button")?.focus()
    return () => {
      nativeDialog?.close()
      if (detailsTrigger.current?.isConnected) detailsTrigger.current.focus()
    }
  }, [details])
  const place = (next: string, position: number, committed = false) => {
    desiredCaret.current = position
    setText(next)
    setCursor(position)
    if (committed) setBoundary(position)
    editor.current?.focus()
    if (editor.current?.value === next) {
      editor.current.setSelectionRange(position, position)
      desiredCaret.current = null
    }
  }
  const insert = (value: string, commit = false) => {
    pendingN.current = false
    const start = editor.current?.selectionStart ?? cursor
    const end = editor.current?.selectionEnd ?? cursor
    const before = convertTyping ? text.slice(0, start).replace(/[a-z']+$/i, pending => romajiToKana(pending, script, commit || /[^a-z']/i.test(value))) : text.slice(0, start)
    place(before + value + text.slice(end), before.length + value.length, commit)
  }
  const choose = (candidate: Candidate) => {
    pendingN.current = false
    const next = text.slice(0, candidate.start) + candidate.spelling + text.slice(candidate.end)
    place(next, candidate.start + candidate.spelling.length, true)
  }
  const commit = () => {
    pendingN.current = false
    const before = convertTyping ? text.slice(0, cursor).replace(/[a-z']+$/i, value => romajiToKana(value, script, true)) : text.slice(0, cursor)
    place(before + text.slice(cursor), before.length, true)
  }
  const backspace = () => {
    pendingN.current = false
    const start = editor.current?.selectionStart ?? cursor
    const end = editor.current?.selectionEnd ?? cursor
    const deletion = deleteSelection(text, start, end)
    pendingN.current = false
    place(deletion.text, deletion.cursor)
    setBoundary(current => Math.min(current, deletion.cursor))
  }
  const changeScript = (next: Script) => {
    pendingN.current = false
    setScript(next)
  }
  const rows = group === "Basic" ? keyboardRows.slice(0, 10) : group === "Voiced" ? keyboardRows.slice(10) : ["ぁぃぅぇぉ", "ゃゅょっゎ", "ゔゕゖ", "。、？！ー「」"]
  return (
    <>
      <main className="keyboard-page">
        <header className="keyboard-heading">
          <div><p className="eyebrow">YOUR WORDS, IN JAPANESE</p><h1>Japanese Keyboard <span lang="ja">あ</span></h1><p>Type with romaji. Find kanji. Make it yours.</p></div>
          <span className="keyboard-offline">● Offline dictionary</span>
        </header>
        <div className="keyboard-layout">
          <section className="keyboard-workspace" aria-label="Japanese text editor">
            <div className="keyboard-editor-card">
              <div className="keyboard-card-top"><label htmlFor="japanese-editor">Your Japanese</label><div className="dict-tabs" role="group" aria-label="Writing mode">{(["Hiragana", "Katakana"] as Script[]).map(mode => <button key={mode} className={script === mode ? "active" : ""} aria-pressed={script === mode} onClick={() => changeScript(mode)}>{mode}</button>)}</div></div>
              <textarea id="japanese-editor" ref={editor} lang="ja" value={text} placeholder={script === "Hiragana" ? "Type mizu → みず" : "Type mizu → ミズ"} spellCheck={false} autoCapitalize="off" autoCorrect="off" onCompositionStart={() => { composing.current = true; pendingN.current = false; setPending(true) }} onCompositionEnd={event => {
                composing.current = false
                setPending(false)
                setText(event.currentTarget.value)
                setCursor(event.currentTarget.selectionStart)
              }} onChange={event => {
                const value = event.currentTarget.value
                const position = event.currentTarget.selectionStart
                if (composing.current) { setText(value); setCursor(position); return }
                const converted = convertTyping ? convertEdit(text, value, position, script, pendingN.current) : { text: value, cursor: position, pendingN: false }
                pendingN.current = converted.pendingN || (convertTyping && /n$/i.test(value) && !/[aeiouy]$/i.test(value))
                setDictionarySearched(false)
                setDictionaryQuery("")
                place(converted.text, converted.cursor)
                if (position < boundary) setBoundary(0)
              }} onSelect={event => {
                const position = event.currentTarget.selectionStart
                if (position !== cursor) pendingN.current = false
                setCursor(position)
                if (position < boundary) setBoundary(0)
              }} onKeyDown={event => {
                if (composing.current || event.nativeEvent.isComposing) return
                if (event.key === "Control") { event.preventDefault(); triggerDictionarySearch(); return }
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault()
                  insert(event.key === "Enter" ? "\n" : " ", true)
                }
                if (event.key === "Escape") { event.preventDefault(); commit() }
              }} />
              <div className="keyboard-editor-footer"><span>Romaji → kana → your choice of kanji</span><div><button className="dict-text-button" onClick={() => place(toScript(text, script), cursor)} disabled={!text}>Convert to {script}</button><button className="dict-text-button" onClick={async () => {
                try { await navigator.clipboard.writeText(text); setNotice("Copied to clipboard.") } catch { setNotice("Select your text to copy it.") }
              }} disabled={!text}>Copy</button><button className="dict-text-button" onClick={() => { place("", 0, true); setNotice("") }} disabled={!text}>Clear</button></div></div>
              <label className="keyboard-literal-control"><input type="checkbox" checked={convertTyping} onChange={event => { setConvertTyping(event.target.checked); pendingN.current = false }} /> Convert romaji as I type</label>
            </div>
            <section className="keyboard-keys-card" aria-label="Virtual Japanese keyboard">
              <div className="keyboard-card-top"><h2>Kana keyboard</h2><span lang="ja">{script === "Hiragana" ? "ひらがな" : "カタカナ"}</span></div>
              <div className="keyboard-key-tabs" role="group" aria-label="Kana key groups">{["Basic", "Voiced", "Small & punctuation"].map(value => <button className={group === value ? "active" : ""} aria-pressed={group === value} key={value} onClick={() => setGroup(value)}>{value}</button>)}</div>
              <div className="keyboard-kana-grid">{rows.map((row, index) => <div className="keyboard-kana-row" key={row + index}>{[...row].map(character => <button key={character} onMouseDown={event => event.preventDefault()} onClick={() => insert(toScript(character, script))} lang="ja">{toScript(character, script)}</button>)}</div>)}</div>
              <div className="keyboard-special-keys"><button onMouseDown={event => event.preventDefault()} onClick={backspace} aria-label="Backspace">⌫</button><button onMouseDown={event => event.preventDefault()} onClick={() => insert(" ", true)}>Space</button><button onMouseDown={event => event.preventDefault()} onClick={() => insert("\n", true)}>Enter ↵</button><button onClick={() => {
                const first = document.querySelector<HTMLButtonElement>(".keyboard-insert")
                if (first) { first.scrollIntoView({ behavior: "smooth", block: "nearest" }); first.focus() } else setNotice("No matching kanji yet. Keep typing or keep your kana.")
              }}>Convert</button><button className="keyboard-commit" onMouseDown={event => event.preventDefault()} onClick={commit}>Keep kana</button></div>
              <p className="keyboard-help">Double a consonant for っ. Use n′ for ん, and xya for ゃ. Keep kana to start a new word.</p>
            </section>
          </section>
          <aside className="keyboard-candidates" aria-label="Dictionary candidates">
            <div className="keyboard-card-top"><div><p className="eyebrow">KANA → KANJI</p><h2>Dictionary candidates</h2></div><span>{dictionaryLoading ? "…" : candidates.length || "—"}</span></div>
            <p className="keyboard-candidate-hint">Choose a word to insert it. Your kana stays until you choose.</p>
            {dictionaryLoading ? <div className="keyboard-empty" role="status" aria-live="polite"><span className="keyboard-loading-spinner" aria-hidden="true">◌</span><h3>Searching dictionary…</h3><p>Checking the full JMdict database.</p></div> : !dictionarySearched ? <div className="keyboard-empty"><span lang="ja">言</span><h3>Search when you’re ready</h3><p>Press Ctrl to search the full dictionary.</p><small>Your kana stays unchanged until you choose a candidate.</small></div> : !candidates.length ? <div className="keyboard-empty"><span lang="ja">言</span><h3>{text ? "No matching dictionary entry." : "Start with a word"}</h3><p>{text ? "Try another reading, or keep your kana as it is." : "Type mizu to explore みず and 水."}</p><small>Searches the full JMdict dictionary on demand.</small></div> : <div className="keyboard-candidate-list">{candidates.map(candidate => {
              const entry = candidate.entry
              const id = learningId(entry)
              const saved = !!data.progress[id]?.saved
              const senses = entry.kind === "Words" && entry.senses?.length ? entry.senses.filter(sense => (!sense.readingRestrictions.length || sense.readingRestrictions.includes(candidate.kana)) && (!sense.spellingRestrictions.length || sense.spellingRestrictions.includes(candidate.spelling))).map(sense => sense.meanings) : [entry.englishMeanings]
              return <article className="keyboard-candidate" key={entry.id}>
                <button className="keyboard-insert" onClick={() => choose(candidate)} aria-label={`Insert ${candidate.spelling}`}><div><strong lang="ja">{candidate.spelling}</strong><span className="keyboard-entry-kind">{entry.kind === "Kanji" ? "Kanji" : "Word"}</span></div><span className="keyboard-reading" lang="ja">{candidate.kana} <small>· {candidate.romaji}</small></span>{senses.map((meanings, index) => <span className="keyboard-meaning" key={index}>{senses.length > 1 ? `${index + 1}. ` : ""}{meanings.join("; ")}</span>)}{entry.japaneseMeanings?.map(meaning => <span className="keyboard-meaning" lang="ja" key={meaning}>{meaning}</span>)}<span className="keyboard-insert-label">Insert ↗</span></button>
                <div className="keyboard-candidate-actions"><button className="dict-text-button" onClick={event => { detailsTrigger.current = event.currentTarget; setDetails(entry.id) }}>Details</button><button className="dict-text-button" aria-pressed={saved} onClick={() => saveItem(id, !saved)}>{saved ? "★ Saved" : "☆ Save"}</button>{practiceItemById(entry.id) && <button className="dict-text-button" onClick={() => { const item = practiceItemById(entry.id); if (item) onPractice(item) }}>Practice</button>}</div>
              </article>
            })}</div>}
          </aside>
        </div>
        <p className="keyboard-status" role="status">{notice}</p>
      </main>
      {details && <dialog ref={dialog} className="keyboard-detail-dialog" aria-label="Dictionary entry" onCancel={() => setDetails(null)} onKeyDown={event => { if (event.key === "Escape") { event.preventDefault(); setDetails(null) } }} onClick={event => { if (event.target === event.currentTarget) { const rect = event.currentTarget.getBoundingClientRect(); if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) setDetails(null) } }}><Dictionary key={details} initialEntryId={details} onBack={() => setDetails(null)} onPractice={onPractice} /></dialog>}
    </>
  )
}
