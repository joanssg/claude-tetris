'use strict';

// Cada skin define su paleta (indices 1-8 como COLORS) y su drawBlock.
// WILD (8) se dibuja como gradiente arcoiris con wildStops de la skin.

function skinFill(context, skin, x, y, colorIndex, size) {
  if (colorIndex === WILD) {
    const g = context.createLinearGradient(x * size, y * size, (x + 1) * size, (y + 1) * size);
    skin.wildStops.forEach((c, i, a) => g.addColorStop(i / (a.length - 1), c));
    return g;
  }
  return skin.colors[colorIndex];
}

function skinRoundRect(context, x, y, w, h, r) {
  context.beginPath();
  context.moveTo(x + r, y);
  context.arcTo(x + w, y, x + w, y + h, r);
  context.arcTo(x + w, y + h, x, y + h, r);
  context.arcTo(x, y + h, x, y, r);
  context.arcTo(x, y, x + w, y, r);
  context.closePath();
}

const SKINS = {
  retro: {
    label: 'Retro',
    colors: [null, '#4dd0e1', '#ffd54f', '#ba68c8', '#81c784', '#e57373', '#90caf9', '#ffb74d', '#b0bec5'],
    wildStops: ['#ef5350', '#ffd54f', '#81c784', '#4fc3f7', '#ba68c8'],
    drawBlock(context, x, y, colorIndex, size, alpha) {
      context.globalAlpha = alpha ?? 1;
      context.fillStyle = skinFill(context, this, x, y, colorIndex, size);
      context.fillRect(x * size + 1, y * size + 1, size - 2, size - 2);
      context.fillStyle = 'rgba(255,255,255,0.12)';
      context.fillRect(x * size + 1, y * size + 1, size - 2, 4);
      context.globalAlpha = 1;
    },
  },

  neon: {
    label: 'Neon',
    glow: true,
    colors: [null, '#00f0ff', '#ffff00', '#d500f9', '#39ff14', '#ff1744', '#448aff', '#ff9100', '#ffffff'],
    wildStops: ['#ff1744', '#ffff00', '#39ff14', '#00f0ff', '#d500f9'],
    drawBlock(context, x, y, colorIndex, size, alpha) {
      const fill = skinFill(context, this, x, y, colorIndex, size);
      const glow = colorIndex === WILD ? '#ffffff' : fill;
      context.globalAlpha = alpha ?? 1;
      context.shadowColor = glow;
      context.shadowBlur = size * 0.5;
      context.fillStyle = '#000';
      context.fillRect(x * size + 3, y * size + 3, size - 6, size - 6);
      context.strokeStyle = fill;
      context.lineWidth = 2;
      context.strokeRect(x * size + 3, y * size + 3, size - 6, size - 6);
      context.shadowBlur = 0;
      context.shadowColor = 'transparent';
      context.fillStyle = fill;
      context.globalAlpha = (alpha ?? 1) * 0.55;
      context.fillRect(x * size + 6, y * size + 6, size - 12, size - 12);
      context.globalAlpha = 1;
    },
  },

  pastel: {
    label: 'Pastel',
    colors: [null, '#a8e6ef', '#fff3b0', '#d7b8f3', '#bfe8c3', '#f5b7b1', '#bcd9f7', '#fbd3a3', '#d9dfe3'],
    wildStops: ['#f5b7b1', '#fff3b0', '#bfe8c3', '#a8e6ef', '#d7b8f3'],
    drawBlock(context, x, y, colorIndex, size, alpha) {
      context.globalAlpha = alpha ?? 1;
      context.fillStyle = skinFill(context, this, x, y, colorIndex, size);
      skinRoundRect(context, x * size + 2, y * size + 2, size - 4, size - 4, size * 0.3);
      context.fill();
      context.fillStyle = 'rgba(255,255,255,0.45)';
      skinRoundRect(context, x * size + 5, y * size + 5, size * 0.4, size * 0.18, size * 0.09);
      context.fill();
      context.globalAlpha = 1;
    },
  },

  pixel: {
    label: 'Pixel art',
    colors: [null, '#29b6f6', '#fbc02d', '#8e24aa', '#43a047', '#e53935', '#3f51b5', '#fb8c00', '#9e9e9e'],
    wildStops: ['#e53935', '#fbc02d', '#43a047', '#29b6f6', '#8e24aa'],
    drawBlock(context, x, y, colorIndex, size, alpha) {
      const px = Math.max(1, Math.floor(size / 6));
      const x0 = x * size + 1, y0 = y * size + 1, s = size - 2;
      context.globalAlpha = alpha ?? 1;
      context.fillStyle = skinFill(context, this, x, y, colorIndex, size);
      context.fillRect(x0, y0, s, s);
      // borde claro arriba/izq, oscuro abajo/der
      context.fillStyle = 'rgba(255,255,255,0.35)';
      context.fillRect(x0, y0, s, px);
      context.fillRect(x0, y0, px, s);
      context.fillStyle = 'rgba(0,0,0,0.35)';
      context.fillRect(x0, y0 + s - px, s, px);
      context.fillRect(x0 + s - px, y0, px, s);
      // textura tipo damero
      context.fillStyle = 'rgba(0,0,0,0.15)';
      for (let i = 1; i * px < s - px; i++)
        for (let j = 1; j * px < s - px; j++)
          if ((i + j) % 2 === 0) context.fillRect(x0 + i * px, y0 + j * px, px, px);
      context.globalAlpha = 1;
    },
  },
};

const SKIN_ORDER = ['retro', 'neon', 'pastel', 'pixel'];
