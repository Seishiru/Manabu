import { APP_VERSION } from "./version"

export default function Updates() {
  return (
    <main className="workspace-page learning-page">
      <header className="learn-heading">
        <div>
          <p className="eyebrow">WHAT'S NEW</p>
          <h1>Updates</h1>
          <p>Small improvements to make learning feel smoother.</p>
        </div>
        <span className="dict-badge">Version {APP_VERSION}</span>
      </header>
      <section className="learn-panel">
        <h2>Version {APP_VERSION}</h2>
        <ul className="learn-panel-copy">
          <li>Switch between Hiragana and Katakana while writing.</li>
          <li>Choose sentence length with accessible range sliders.</li>
          <li>Practice drawing kana with a clean, self-check workflow.</li>
        </ul>
      </section>
    </main>
  )
}
