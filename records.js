'use strict';

// Tabla de records local (localStorage). API global: Records.
const Records = (() => {
  const KEY = 'tetris-records';
  const MAX = 5;
  let data = { top: [], bestCombo: 0, maxLines: 0 };

  try {
    const raw = JSON.parse(localStorage.getItem(KEY));
    if (raw && Array.isArray(raw.top)) {
      data.top = raw.top
        .filter(e => e && Number.isFinite(e.score))
        .map(e => ({ name: String(e.name || 'ANON').slice(0, 12), score: e.score, lines: e.lines | 0, combo: e.combo | 0 }))
        .sort((a, b) => b.score - a.score)
        .slice(0, MAX);
      data.bestCombo = raw.bestCombo | 0;
      data.maxLines = raw.maxLines | 0;
    }
  } catch (e) {}

  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(data)); } catch (e) {}
  }

  function qualifies(score) {
    return score > 0 && (data.top.length < MAX || score > data.top[data.top.length - 1].score);
  }

  // Actualiza records globales; devuelve qué se superó.
  function noteGame(lines, combo) {
    const res = { combo: combo > data.bestCombo, lines: lines > data.maxLines };
    if (res.combo) data.bestCombo = combo;
    if (res.lines) data.maxLines = lines;
    save();
    return res;
  }

  // Inserta (a igualdad, tras los existentes). Devuelve posición o -1.
  function add(name, score, lines, combo) {
    if (!qualifies(score)) return -1;
    const entry = { name: (name || '').trim().slice(0, 12) || 'ANON', score, lines, combo };
    let i = data.top.findIndex(e => score > e.score);
    if (i < 0) i = data.top.length;
    data.top.splice(i, 0, entry);
    data.top.length = Math.min(data.top.length, MAX);
    save();
    return i;
  }

  function reset() {
    data = { top: [], bestCombo: 0, maxLines: 0 };
    save();
  }

  function el(tag, cls, text) {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text !== undefined) n.textContent = text;
    return n;
  }

  // Dibuja tabla + stats en `host`. `hi` = índice a resaltar (-1 ninguno).
  function render(host, hi = -1) {
    host.textContent = '';
    const table = el('table', 'rec-table');
    const head = el('tr');
    ['#', 'Nombre', 'Puntos', 'Líneas', 'Combo'].forEach(t => head.appendChild(el('th', '', t)));
    table.appendChild(head);
    if (!data.top.length) {
      const tr = el('tr');
      const td = el('td', 'rec-empty', 'Sin records todavía');
      td.colSpan = 5;
      tr.appendChild(td);
      table.appendChild(tr);
    }
    data.top.forEach((e, i) => {
      const tr = el('tr', i === hi ? 'rec-hi' : '');
      [i + 1, e.name, e.score.toLocaleString(), e.lines, e.combo ? 'x' + e.combo : '-']
        .forEach(v => tr.appendChild(el('td', '', String(v))));
      table.appendChild(tr);
    });
    host.appendChild(table);
    host.appendChild(el('p', 'rec-stats',
      `Mejor combo: ${data.bestCombo ? 'x' + data.bestCombo : '-'} · Líneas máx: ${data.maxLines}`));
  }

  return { qualifies, noteGame, add, reset, render };
})();
