import type { Wire, PlacedComponent, ComponentDefinition } from '../types/components';

const POSITIVE_RAIL_NETS = new Set(['power-top-plus', 'power-bottom-plus']);
const NEGATIVE_RAIL_NETS = new Set(['power-top-minus', 'power-bottom-minus']);
const ARDUINO_GND_PINS = new Set(['GND1', 'GND2', 'GND3']);

/**
 * True when the user has (non-instructional) wires:
 * - Uno 5V ↔ any breadboard + rail hole (top or bottom red strip)
 * - Uno GND ↔ any breadboard − rail hole (top or bottom blue strip)
 */
export function isLedButtonPowerRailsWired(
  wires: Wire[],
  placedComponents: PlacedComponent[],
  getDefinition: (instanceId: string) => ComponentDefinition | undefined
): boolean {
  const bb = placedComponents.find((c) => c.definitionId === 'breadboard');
  const uno = placedComponents.find((c) => c.definitionId === 'arduino-uno');
  if (!bb || !uno) return false;

  const bbDef = getDefinition(bb.instanceId);
  if (!bbDef?.pins) return false;

  const plusPins = new Set(
    bbDef.pins.filter((p) => p.net && POSITIVE_RAIL_NETS.has(p.net)).map((p) => p.id)
  );
  const minusPins = new Set(
    bbDef.pins.filter((p) => p.net && NEGATIVE_RAIL_NETS.has(p.net)).map((p) => p.id)
  );

  let has5vToPlus = false;
  let hasGndToMinus = false;

  for (const w of wires) {
    if (w.overlayAboveComponents) continue;

    const pairs: Array<[{ cid: string; pid: string }, { cid: string; pid: string }]> = [
      [
        { cid: w.startComponentId, pid: w.startPinId },
        { cid: w.endComponentId, pid: w.endPinId },
      ],
      [
        { cid: w.endComponentId, pid: w.endPinId },
        { cid: w.startComponentId, pid: w.startPinId },
      ],
    ];

    for (const [unoEnd, bbEnd] of pairs) {
      if (unoEnd.cid !== uno.instanceId || bbEnd.cid !== bb.instanceId) continue;
      if (unoEnd.pid === '5V' && plusPins.has(bbEnd.pid)) has5vToPlus = true;
      if (ARDUINO_GND_PINS.has(unoEnd.pid) && minusPins.has(bbEnd.pid)) hasGndToMinus = true;
    }
  }

  return has5vToPlus && hasGndToMinus;
}

/** Bottom breadboard + rail holes: `PWR_BOTTOM_PLUS_1` … `PWR_BOTTOM_PLUS_30` */
const PWR_BOTTOM_PLUS_PREFIX = 'PWR_BOTTOM_PLUS_';

/**
 * True when a non-overlay wire connects breadboard **D19** to any **bottom** (+) rail hole.
 */
export function isLedButtonD19ToBottomPlusRailWired(
  wires: Wire[],
  placedComponents: PlacedComponent[]
): boolean {
  const bb = placedComponents.find((c) => c.definitionId === 'breadboard');
  if (!bb) return false;

  for (const w of wires) {
    if (w.overlayAboveComponents) continue;

    const a = { cid: w.startComponentId, pid: w.startPinId };
    const b = { cid: w.endComponentId, pid: w.endPinId };

    const touchesD19AndBottomPlus = (x: typeof a, y: typeof a) =>
      x.cid === bb.instanceId &&
      y.cid === bb.instanceId &&
      ((x.pid === 'D19' && y.pid.startsWith(PWR_BOTTOM_PLUS_PREFIX)) ||
        (y.pid === 'D19' && x.pid.startsWith(PWR_BOTTOM_PLUS_PREFIX)));

    if (touchesD19AndBottomPlus(a, b)) return true;
  }

  return false;
}

/** Bottom breadboard − rail holes: `PWR_BOTTOM_MINUS_1` … `PWR_BOTTOM_MINUS_30` */
const PWR_BOTTOM_MINUS_PREFIX = 'PWR_BOTTOM_MINUS_';

/**
 * True when a non-overlay wire connects breadboard **H12** to any **bottom** (−) rail hole.
 */
export function isLedButtonH12ToBottomMinusRailWired(
  wires: Wire[],
  placedComponents: PlacedComponent[]
): boolean {
  const bb = placedComponents.find((c) => c.definitionId === 'breadboard');
  if (!bb) return false;

  for (const w of wires) {
    if (w.overlayAboveComponents) continue;

    const a = { cid: w.startComponentId, pid: w.startPinId };
    const b = { cid: w.endComponentId, pid: w.endPinId };

    const touchesH12AndBottomMinus = (x: typeof a, y: typeof a) =>
      x.cid === bb.instanceId &&
      y.cid === bb.instanceId &&
      ((x.pid === 'H12' && y.pid.startsWith(PWR_BOTTOM_MINUS_PREFIX)) ||
        (y.pid === 'H12' && x.pid.startsWith(PWR_BOTTOM_MINUS_PREFIX)));

    if (touchesH12AndBottomMinus(a, b)) return true;
  }

  return false;
}
