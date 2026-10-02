// ---- Menú de pausa ----
// Se carga antes que game.js; usa togglePause()/init() de game.js en tiempo de ejecución.
let startLevel = 1;

const pauseOverlay = document.getElementById('pause-overlay');
const pauseControls = document.getElementById('pause-controls');
const pauseLevelSel = document.getElementById('pause-level');

for (let i = 1; i <= 10; i++) pauseLevelSel.add(new Option(i, i));

function showPauseMenu() {
  pauseControls.classList.add('hidden');
  pauseLevelSel.value = startLevel;
  pauseOverlay.classList.remove('hidden');
}

function hidePauseMenu() {
  pauseOverlay.classList.add('hidden');
  if (document.activeElement) document.activeElement.blur();
}

document.getElementById('pause-resume').addEventListener('click', () => togglePause());
document.getElementById('pause-restart').addEventListener('click', () => init());
document.getElementById('pause-controls-btn').addEventListener('click', () => {
  pauseControls.classList.toggle('hidden');
});
pauseLevelSel.addEventListener('change', () => {
  startLevel = parseInt(pauseLevelSel.value, 10) || 1;
});
