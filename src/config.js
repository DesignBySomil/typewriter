import * as THREE from 'three';

export const CONFIG = {
  // Typing & Page Layout (46 columns on desktop, 36 columns on portrait phones)
  maxCols: 46,
  portraitCols: 36,
  maxLinesPerPage: 25,      // 25 lines per page (0..24)
  MAX_LINE: 10,
  LINE0_Y: 250,             // Line 0 drawn near the top of the paper texture (y = 250px)
  bellOffset: 8,            // Bell rings 8 chars before active right margin
  charStepWorld: 0.185,     // World units carriage translates LEFT per character
  lineStepWorld: 0.28,      // World units paper rolls UP per line feed

  // Platen & Paper Dimensions (Olivetti Lettera 32 proportions)
  platenRadius: 0.55,
  platenLength: 9.5,
  paperWidth: 9.0,          // 46 cols * 0.185 = 8.51 world units + clean margins
  paperSheetHeight: 2.95,   // ~55% visible height above platen

  // High-Resolution Paper CanvasTexture (2048 x 2048)
  paperCanvasW: 2048,
  paperCanvasH: 2048,
  paperCharPxX: (0.185 / 9.0) * 2048,
  paperLinePxY: 70,         // Line spacing down the page
  paperCol0PxX: (0.5 - (22.5 * 0.185) / 9.0) * 2048,
  paperLine0CanvasY: 250,

  // Printing Point in World Coordinates (center of typebasket & ribbon vibrator)
  strikePoint: new THREE.Vector3(0, 2.70, -0.58),
  typebarRadius: 1.44,

  // Typebar Kinematics Timings (seconds)
  barAnticipationTime: 0.014,
  barSwingUpTime: 0.052,
  barImpactHoldTime: 0.075,
  barReboundTime: 0.145,

  // Exact 3D Bounding Box of the Olivetti Lettera 32
  machineBoundsMin: new THREE.Vector3(-6.60, 0.0, -3.35),
  machineBoundsMax: new THREE.Vector3( 6.60, 5.82,  5.05)
};

export const KEY_ROWS = [
  {
    row: 0, y: 1.42, z: 2.08, spacing: 0.64, xOffset: -3.52,
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
    row: 1, y: 1.20, z: 2.72, spacing: 0.64, xOffset: -3.12,
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
    row: 2, y: 0.98, z: 3.36, spacing: 0.64, xOffset: -3.28,
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
    row: 3, y: 0.76, z: 4.00, spacing: 0.64, xOffset: -2.96,
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
  { code: 'ShiftLeft',  label: 'SHIFT', x: -3.84, y: 0.76, z: 4.00, radius: 0.33, isWide: true },
  { code: 'ShiftRight', label: 'SHIFT', x:  3.80, y: 0.76, z: 4.00, radius: 0.33, isWide: true },
  { code: 'Backspace',  label: 'BACK',  x:  4.14, y: 1.42, z: 2.08, radius: 0.29, isWide: false },
  { code: 'Enter',      label: 'RET',   x:  3.92, y: 1.20, z: 2.72, radius: 0.31, isWide: false },
  { code: 'Tab',        label: 'RIB',   x: -3.88, y: 1.20, z: 2.72, radius: 0.29, isWide: false }
];
