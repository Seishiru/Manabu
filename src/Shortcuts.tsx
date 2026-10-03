const groups = [
  { title: "Practice", rows: [
    ["Ctrl", "Show hint · tap Control, even while typing"],
    ["`", "Quit test · asks for confirmation"],
    ["Q / W / A / S", "Choose upper left / upper right / lower left / lower right"],
    ["Q / W / A / S", "Self Check: Forgotten / Hesitated / Aware / Obvious"],
    ["Space", "Next card after answering"],
    ["R", "Try again after an incorrect answer; practice again on results"],
    ["Hold T", "Reveal the answer after an incorrect answer or Self Check"],
    ["T", "Review mistakes on the results page"],
  ] },
  { title: "Writing System", rows: [
    ["1 / 2", "Study / Write"], ["A / D", "Previous / next character"],
    ["Space", "Study: play or pause · Write: toggle guides"], ["R", "Replay stroke animation in Study"],
    ["Z / X / C", "Clear / undo / redo in Write"],
    ["Right click", "Character: open writing page · writing grid: Done Self-check"],
    ["Left click", "Hear a character’s pronunciation"],
    ["Shift + F10", "Open a focused character’s writing page"],
  ] },
  { title: "Dialogs & tutorial", rows: [
    ["A / S", "Confirmation: Yes (red) / No (green)"],
    ["Escape", "Cancel confirmation or close a dismissible dialog or tutorial"],
    ["A / D / Enter", "Tutorial: previous / next / next"],
  ] },
  { title: "Japanese Keyboard & navigation", rows: [
    ["Escape", "Keep the active kana composition"],
    ["Space / Enter", "Commit composition and insert a space / new line"],
    ["Backspace", "Delete at the cursor"],
    ["Tab / Shift + Tab", "Move between controls"],
    ["← / → / Home / End", "Navigate supported tab groups"],
  ] },
]

export default function Shortcuts() {
  return <main className="workspace-page learning-page shortcuts-page">
    <header className="learn-heading"><div><p className="eyebrow">YOUR QUICK REFERENCE</p><h1>Shortcuts</h1><p>Less clicking, more learning.</p></div></header>
    <p className="learn-panel-copy">Shortcuts apply to the screen you’re using. While typing, letter shortcuts stay out of your way; Control for hints and the quit key still work in a test. Q/W/A/S colors indicate position, not correctness.</p>
    {groups.map(group => <section className="learn-panel" key={group.title}><h2>{group.title}</h2><dl className="shortcut-list">
      {group.rows.map(([keys, description]) => <div key={description}><dt><kbd>{keys}</kbd></dt><dd>{description}</dd></div>)}
    </dl></section>)}
  </main>
}
