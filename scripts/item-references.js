const HEADERS = /^(Umiejętności|Skills|Języki|Languages|Walka|Ataki|Combat|Broń|Weapons|Zaklęcia|Spells)(?:\s*:\s*(.*)|\s*)$/iu;

function splitList(text) {
  // A comma inside a specialization or weapon model is not a list separator.
  const parts = [];
  let depth = 0, start = 0, quoted = false;
  for (let i = 0; i < text.length; i++) {
    if (text[i] === '"') { quoted = !quoted; continue; }
    if (quoted) continue;
    if (text[i] === '(') depth++;
    if (text[i] === ')') depth = Math.max(0, depth - 1);
    if ((text[i] === ',' || text[i] === ';' || text[i] === '\n') && depth === 0) {
      parts.push(text.slice(start, i)); start = i + 1;
    }
  }
  parts.push(text.slice(start));
  return parts.map(p => p.trim().replace(/^"(.*)"$/s, '$1')).filter(Boolean);
}

export function extractItemReferences(text) {
  const sections = [];
  const statLines = [];
  const warnings = [];
  let current = null;
  for (const line of text.split(/\r?\n/)) {
    const header = line.trim().match(HEADERS);
    if (header) {
      const name = header[1].toLowerCase();
      current = { type: /zaklęcia|spells/.test(name) ? 'spell' : /umiejętności|skills|języki|languages/.test(name) ? 'skill' : 'weapon', text: header[2] ?? '' };
      sections.push(current);
    } else if (current) current.text += '\n' + line;
    else statLines.push(line);
  }
  const requests = [];
  for (const section of sections) {
    if (section.type === 'spell') {
      for (const name of splitList(section.text)) requests.push({ type: 'spell', name: name.replace(/\.$/, '') });
      continue;
    }
    if (section.type === 'skill') {
      for (const raw of splitList(section.text)) {
        const match = raw.match(/^(.+?)\s+(\d+)\s*%(?:\s*\(\d+\s*\/\s*\d+\))?\.?$/u);
        if (match) requests.push({ type: 'skill', name: match[1].trim(), value: Number(match[2]) });
        else warnings.push(`Nie odczytano umiejętności: „${raw}”. Użyj formatu Nazwa 50%.`);
      }
      continue;
    }
    // One attack per line; retain damage and qualifiers in keeper notes.
    for (const raw of section.text.split(/[\n;]/).map(t => t.trim()).filter(Boolean)) {
      const match = raw.match(/^(.+?)\s+(\d+)\s*%(.*)$/u);
      if (match) {
        const name = match[1].trim();
        requests.push({ type: /^(unik|dodge)$/iu.test(name) ? 'skill' : 'weapon', name, value: Number(match[2]) });
      } else if (!/^(obrażenia|damage|ataki w rundzie|attacks per round)\b/iu.test(raw)) {
        requests.push({ type: 'weapon', name: raw.replace(/\.$/, '') });
      }
    }
  }
  return { requests: requests.map((r, index) => ({ ...r, key: String(index) })), statText: statLines.join('\n'), warnings };
}
