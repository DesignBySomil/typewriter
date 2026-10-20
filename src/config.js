import * as THREE from 'three';

export const CONFIG = {
  // Typing & Page Layout (~46 large legible columns across the hero paper sheet)
  maxCols: 46,
  maxLinesPerPage: 28,
  bellOffset: 8,            // Bell rings at col 38 (8 chars before right margin)
  charStepWorld: 0.195,     // World units carriage translates LEFT per character
  lineStepWorld: 0.30,      // World units paper rolls UP per line feed

  // Platen & Paper Dimensions
  platenRadius: 0.62,
  platenLength: 10.6,
  paperWidth: 9.8,          // 46 cols * 0.195 = 8.97 world units + clean left/right margins
  paperSheetHeight: 5.4,    // Tall hero paper sheet rising prominently above the platen

  // High-Resolution Paper CanvasTexture (2048 x 2048)
  paperCanvasW: 2048,
  paperCanvasH: 2048,
  // Exact 1:1 horizontal alignment between world carriage step and canvas pixel step:
  // (charStepWorld / paperWidth) * paperCanvasW = (0.195 / 9.8) * 2048 = 40.75102 px per column
  paperCharPxX: (0.195 / 9.8) * 2048,
  paperLinePxY: 74,         // Generous line spacing so 11-12 lines are clearly readable above platen
  // Column 0 local X on paper is -22.5 * 0.195 = -4.3875 world units from paper center.
  // Mapped to canvas X pixels: (0.5 - 4.3875 / 9.8) * 2048 = 109.29 px
  paperCol0PxX: (0.5 - (22.5 * 0.195) / 9.8) * 2048,
  // Active typing line baseline on the 2048px canvas
  paperActiveLineCanvasY: 1850,

  // Printing Point in World Coordinates (center of typebasket & ribbon vibrator)
  strikePoint: new THREE.Vector3(0, 3.18, -0.58),
  typebarRadius: 1.48,

  // Typebar Kinematics Timings (seconds)
  barAnticipationTime: 0.015,
  barSwingUpTime: 0.055,
  barImpactHoldTime: 0.085, // 85ms hold at platen so still frames & eyes unmistakably catch the bar + flash
  barReboundTime: 0.145,    // Slightly slower return with platen rebound

  // Full Machine Bounding Box (including carriage travel, platen knobs, full paper height, and spacebar)
  machineBoundsMin: new THREE.Vector3(-6.85, 0.0, -3.50),
  machineBoundsMax: new THREE.Vector3( 6.85, 8.20,  5.25)
};

// 44-key classic desktop manual typewriter layout (4 rows)
export const KEY_ROWS = [
  {
    row: 0, y: 1.56, z: 2.38, xOffset: -3.96,
    keys: [
      { code: 'Digit1', lower: '1', upper: '!' },
      { code: 'Digit2', lower: '2', upper: '"' },
      { code: 'Digit3', lower: '3', upper: '#' },
      { code: 'Digit4', lower: '4', upper: '$' },
      { code: 'Digit5', lower: '5', upper: '%' },
      { code: 'Digit6', lower: '6', upper: '&' },
      { code: 'Digit7', lower: '7', upper: "'" },
      { code: 'Digit8', lower: '8', upper: '(' },
      { code: 'Digit9', lower: '9', upper: ')' },
      { code: 'Digit0', lower: '0', upper: '_' },
      { code: 'Minus',  lower: '-', upper: '=' },
      { code: 'Equal',  lower: '=', upper: '+' }
    ]
  },
  {
    row: 1, y: 1.32, z: 3.02, xOffset: -3.65,
    keys: [
      { code: 'KeyQ', lower: 'q', upper: 'Q' },
      { code: 'KeyW', lower: 'w', upper: 'W' },
      { code: 'KeyE', lower: 'e', upper: 'E' },
      { code: 'KeyR', lower: 'r', upper: 'R' },
      { code: 'KeyT', lower: 't', upper: 'T' },
      { code: 'KeyY', lower: 'y', upper: 'Y' },
      { code: 'KeyU', lower: 'u', upper: 'U' },
      { code: 'KeyI', lower: 'i', upper: 'I' },
      { code: 'KeyO', lower: 'o', upper: 'O' },
      { code: 'KeyP', lower: 'p', upper: 'P' }
    ]
  },
  {
    row: 2, y: 1.08, z: 3.66, xOffset: -3.82,
    keys: [
      { code: 'KeyA', lower: 'a', upper: 'A' },
      { code: 'KeyS', lower: 's', upper: 'S' },
      { code: 'KeyD', lower: 'd', upper: 'D' },
      { code: 'KeyF', lower: 'f', upper: 'F' },
      { code: 'KeyG', lower: 'g', upper: 'G' },
      { code: 'KeyH', lower: 'h', upper: 'H' },
      { code: 'KeyJ', lower: 'j', upper: 'J' },
      { code: 'KeyK', lower: 'k', upper: 'K' },
      { code: 'KeyL', lower: 'l', upper: 'L' },
      { code: 'Semicolon', lower: ';', upper: ':' },
      { code: 'Quote', lower: "'", upper: '"' }
    ]
  },
  {
    row: 3, y: 0.84, z: 4.30, xOffset: -3.55,
    keys: [
      { code: 'KeyZ', lower: 'z', upper: 'Z' },
      { code: 'KeyX', lower: 'x', upper: 'X' },
      { code: 'KeyC', lower: 'c', upper: 'C' },
      { code: 'KeyV', lower: 'v', upper: 'V' },
      { code: 'KeyB', lower: 'b', upper: 'B' },
      { code: 'KeyN', lower: 'n', upper: 'N' },
      { code: 'KeyM', lower: 'm', upper: 'M' },
      { code: 'Comma', lower: ',', upper: '<' },
      { code: 'Period', lower: '.', upper: '>' },
      { code: 'Slash', lower: '/', upper: '?' }
    ]
  }
];

export const SPECIAL_KEYS = [
  { code: 'ShiftLeft',  label: 'SHIFT', x: -4.42, y: 0.84, z: 4.30, radius: 0.35 },
  { code: 'ShiftRight', label: 'SHIFT', x:  4.25, y: 0.84, z: 4.30, radius: 0.35 },
  { code: 'Backspace',  label: 'BACK',  x:  4.62, y: 1.56, z: 2.38, radius: 0.34 },
  { code: 'Enter',      label: 'RET',   x:  4.45, y: 1.32, z: 3.02, radius: 0.35 },
  { code: 'Tab',        label: 'RIBBON',x: -4.68, y: 1.32, z: 3.02, radius: 0.34 }
];
