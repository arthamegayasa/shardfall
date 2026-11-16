// Keyboard and mouse to InputFrame (architecture.md 6.2). LP.
// Movement keys give the desired SCREEN direction in [-127, 127]; sim normalises and compensates (7.1).
// Rite presses are latched so a press between two ticks is never lost. Gamepad: M4.

import { Button, INPUT_AXIS_MAX, quantizeAim } from '../../core/index.ts';
import type { ActionId, InputFrame, Settings } from '../../core/index.ts';
import type { Projector } from '../../core/dom.ts';

export interface InputSource {
  /** Fill out with the input for the next tick and clear latched presses. */
  sample(out: InputFrame): void;
  /** Ignore gameplay keys (menus, pause, e2e driving). */
  setEnabled(enabled: boolean): void;
  dispose(): void;
}

export interface InputDeps {
  readonly target: Window;
  readonly canvas: HTMLCanvasElement;
  readonly settings: () => Settings;
  readonly projector: () => Projector;
  /** World position of the player, for the default aim when the mouse never moved. */
  readonly playerPos: () => { readonly x: number; readonly y: number };
}

export function createInputSource(deps: InputDeps): InputSource {
  const held = new Set<string>();
  let pressedLatch = 0;
  let enabled = true;
  let mouseCss: { x: number; y: number } | null = null;
  const aim = { x: 0, y: 0 };

  const boundTo = (action: ActionId, code: string): boolean => {
    const b = deps.settings().keybinds[action];
    return b[0] === code || b[1] === code;
  };
  const isDown = (action: ActionId): boolean => {
    const b = deps.settings().keybinds[action];
    return (b[0] !== null && held.has(b[0])) || (b[1] !== null && held.has(b[1]));
  };

  const onKeyDown = (e: KeyboardEvent): void => {
    if (!e.repeat && enabled && boundTo('rite', e.code)) pressedLatch |= Button.Rite;
    held.add(e.code);
  };
  const onKeyUp = (e: KeyboardEvent): void => {
    held.delete(e.code);
  };
  const onBlur = (): void => {
    held.clear();
  };
  const onMouseMove = (e: MouseEvent): void => {
    const r = deps.canvas.getBoundingClientRect();
    mouseCss = { x: e.clientX - r.left, y: e.clientY - r.top };
  };
  const onMouseDown = (e: MouseEvent): void => {
    // ui-spec 8.1 [Asumsi]: right click casts the Rite.
    if (enabled && e.button === 2) pressedLatch |= Button.Rite;
  };
  const onContextMenu = (e: Event): void => {
    e.preventDefault();
  };

  deps.target.addEventListener('keydown', onKeyDown);
  deps.target.addEventListener('keyup', onKeyUp);
  deps.target.addEventListener('blur', onBlur);
  deps.canvas.addEventListener('mousemove', onMouseMove);
  deps.canvas.addEventListener('mousedown', onMouseDown);
  deps.canvas.addEventListener('contextmenu', onContextMenu);

  return {
    sample(out) {
      if (!enabled) {
        out.moveX = 0;
        out.moveY = 0;
        out.held = 0;
        out.pressed = 0;
        return;
      }
      const x = (isDown('moveRight') ? 1 : 0) - (isDown('moveLeft') ? 1 : 0);
      const y = (isDown('moveDown') ? 1 : 0) - (isDown('moveUp') ? 1 : 0);
      out.moveX = x * INPUT_AXIS_MAX;
      out.moveY = y * INPUT_AXIS_MAX;
      out.held = isDown('rite') ? Button.Rite : 0;
      out.pressed = pressedLatch;
      pressedLatch = 0;
      if (mouseCss !== null) {
        deps.projector().cssToWorld(mouseCss.x, mouseCss.y, aim);
      } else {
        const p = deps.playerPos();
        aim.x = p.x;
        aim.y = p.y;
      }
      out.aimX = quantizeAim(aim.x);
      out.aimY = quantizeAim(aim.y);
    },
    setEnabled(v) {
      enabled = v;
      if (!v) pressedLatch = 0;
    },
    dispose() {
      deps.target.removeEventListener('keydown', onKeyDown);
      deps.target.removeEventListener('keyup', onKeyUp);
      deps.target.removeEventListener('blur', onBlur);
      deps.canvas.removeEventListener('mousemove', onMouseMove);
      deps.canvas.removeEventListener('mousedown', onMouseDown);
      deps.canvas.removeEventListener('contextmenu', onContextMenu);
    },
  };
}
