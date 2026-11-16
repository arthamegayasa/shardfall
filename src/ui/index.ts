// Public API of src/ui (UI Programmer). Other modules import only from here (architecture.md 5).
// DOM overlay per ui-spec 2: title, class select, HUD, Temper, Warden reward, Glazier, pause,
// settings, run end. All player text through the string table (ui-spec 11).

import type { CreateUi } from '../core/dom.ts';
import { createUiWith } from './ui-root.ts';

export const createUi: CreateUi = createUiWith({ devStrings: __DEV_TOOLS__ });
