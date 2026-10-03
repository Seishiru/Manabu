export function toKanaScript(text: string, script: "Hiragana" | "Katakana") {
  return [...text].map(character => script === "Katakana" && character >= "ぁ" && character <= "ゖ" ? String.fromCharCode(character.charCodeAt(0) + 96) : script === "Hiragana" && character >= "ァ" && character <= "ヶ" ? String.fromCharCode(character.charCodeAt(0) - 96) : character).join("")
}
const rows = [
  ["あいうえお", "a i u e o"], ["かきくけこ", "ka ki ku ke ko"], ["さしすせそ", "sa shi su se so"],
  ["たちつてと", "ta chi tsu te to"], ["なにぬねの", "na ni nu ne no"], ["はひふへほ", "ha hi fu he ho"],
  ["まみむめも", "ma mi mu me mo"], ["やゆよ", "ya yu yo"], ["らりるれろ", "ra ri ru re ro"],
  ["わゐゑをん", "wa wi we wo n"], ["がぎぐげご", "ga gi gu ge go"], ["ざじずぜぞ", "za ji zu ze zo"],
  ["だぢづでど", "da ji zu de do"], ["ばびぶべぼ", "ba bi bu be bo"], ["ぱぴぷぺぽ", "pa pi pu pe po"],
  ["ぁぃぅぇぉゔゕゖ", "a i u e o vu ka ke"],
]
const sounds = new Map(rows.flatMap(([kana, romaji]) => [...kana].map((character, index) => [character, romaji.split(" ")[index]] as const)))
const digraphs: Record<string, string> = { き: "ky", ぎ: "gy", し: "sh", じ: "j", ち: "ch", ぢ: "j", に: "ny", ひ: "hy", び: "by", ぴ: "py", み: "my", り: "ry" }
const foreign: Record<string, string> = { うぃ: "wi", うぇ: "we", うぉ: "wo", しぇ: "she", じぇ: "je", ちぇ: "che", てぃ: "ti", でぃ: "di", とぅ: "tu", どぅ: "du", てゅ: "tyu", でゅ: "dyu", ふぁ: "fa", ふぃ: "fi", ふぇ: "fe", ふぉ: "fo", ふゅ: "fyu", ゔぁ: "va", ゔぃ: "vi", ゔぇ: "ve", ゔぉ: "vo", つぁ: "tsa", つぃ: "tsi", つぇ: "tse", つぉ: "tso", くぁ: "kwa", くぃ: "kwi", くぇ: "kwe", くぉ: "kwo", ぐぁ: "gwa", ぐぃ: "gwi", ぐぇ: "gwe", ぐぉ: "gwo" }
export function kanaToRomaji(original: string): string {
  const kana = toKanaScript(original.normalize("NFKC"), "Hiragana")
  let result = "", doubled = false
  for (let index = 0; index < kana.length; index++) {
    const character = kana[index]
    if (character === "っ") { if (doubled) throw new Error(`Ambiguous gemination: ${original}`); doubled = true; continue }
    if (character === "ー") { const vowel = result.match(/[aeiou][^aeiou]*$/)?.[0][0]; if (!vowel || doubled) throw new Error(`Unsupported long vowel: ${original}`); result += vowel; continue }
    if (".-・".includes(character)) { if (doubled) throw new Error(`Unsupported gemination: ${original}`); continue }
    let sound = foreign[kana.slice(index, index + 2)]
    if (sound) index++
    else if (digraphs[character] && "ゃゅょ".includes(kana[index + 1] || "!")) { sound = digraphs[character] + ({ ゃ: "a", ゅ: "u", ょ: "o" } as Record<string, string>)[kana[++index]] }
    else sound = sounds.get(character) || ""
    if (!sound) throw new Error(`Unsupported kana: ${original}`)
    if (doubled) { if (!/^[bcdfghjklmpqrstvwxyz]/.test(sound) || /^[nyw]/.test(sound)) throw new Error(`Unsupported gemination: ${original}`); result += sound.startsWith("ch") ? "t" : sound[0]; doubled = false }
    if (result.endsWith("n") && /^[aeiouy]/.test(sound) && kana[index - 1] === "ん") result += "'"
    result += sound
  }
  if (doubled || !result) throw new Error(`Incomplete kana: ${original}`)
  return result
}
