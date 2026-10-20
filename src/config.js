import * as THREE from 'three';

export const CONFIG = {
  // Typing & Page Layout (46 columns on desktop, 36 columns on portrait phones)
  maxCols: 46,
  portraitCols: 36,
  maxLinesPerPage: 28,
  bellOffset: 8,            // Bell rings 8 chars before active right margin
  charStepWorld: 0.195,     // World units carriage translates LEFT per character
  lineStepWorld: 0.28,      // World units paper rolls UP per line feed

  // Platen & Paper Dimensions (Olivetti Lettera 32 proportions)
  platenRadius: 0.56,
  platenLength: 9.8,
  paperWidth: 9.4,          // 46 cols * 0.195 = 8.97 world units + clean margins
  paperSheetHeight: 3.1,    // ~55% visible height above platen

  // High-Resolution Paper CanvasTexture (2048 x 2048)
  paperCanvasW: 2048,
  paperCanvasH: 2048,
  // Exact 1:1 horizontal alignment between world carriage step and canvas pixel step:
  // (0.195 / 9.4) * 2048 = 42.4851 px per character column
  paperCharPxX: (0.195 / 9.4) * 2048,
  paperLinePxY: 72,
  // Column 0 local X on paper is -22.5 * 0.195 = -4.3875 world units from paper center.
  // Mapped to canvas X pixels: (0.5 - 4.3875 / 9.4) * 2048 = 68.09 px
  paperCol0PxX: (0.5 - (22.5 * 0.195) / 9.4) * 2048,
  paperLine0CanvasY: 1850,

  // Printing Point in World Coordinates (center of typebasket & ribbon vibrator)
  strikePoint: new THREE.Vector3(0, 2.72, -0.58),
  typebarRadius: 1.46,

  // Typebar Kinematics Timings (seconds)
  barAnticipationTime: 0.014,
  barSwingUpTime: 0.052,
  barImpactHoldTime: 0.075, // >60ms hold right against the paper at the printing point
  barReboundTime: 0.145,

  // Exact 3D Bounding Box of the Olivetti Lettera 32 (width:depth:height ~ 1.0 : 0.85 : 0.32 for body + paper & knobs)
  machineBoundsMin: new THREE.Vector3(-6.85, 0.0, -3.40),
  machineBoundsMax: new THREE.Vector3( 6.75, 5.95,  5.10)
};

// 44-key staggered manual typewriter layout (4 rows)
export const KEY_ROWS = [
  {
    row: 0, y: 1.44, z: 2.08, xOffset: -3.96,
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
    row: 1, y: 1.22, z: 2.74, xOffset: -3.62,
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
    row: 2, y: 1.00, z: 3.40, xOffset: -3.78,
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
    row: 3, y: 0.78, z: 4.06, xOffset: -3.48,
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
  { code: 'ShiftLeft',  label: 'SHIFT', x: -4.38, y: 0.78, z: 4.06, radius: 0.38, isWide: true },
  { code: 'ShiftRight', label: 'SHIFT', x:  4.22, y: 0.78, z: 4.06, radius: 0.38, isWide: true },
  { code: 'Backspace',  label: 'BACK',  x:  4.58, y: 1.44, z: 2.08, radius: 0.33, isWide: false },
  { code: 'Enter',      label: 'RET',   x:  4.40, y: 1.22, z: 2.74, radius: 0.35, isWide: false },
  { code: 'Tab',        label: 'RIB',   x: -4.55, y: 1.22, z: 2.74, radius: 0.33, isWide: false }
];
