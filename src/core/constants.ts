// Technical constants only, never balance numbers (architecture.md 6.1, 7.1). [Frozen M1]

/** Simulation ticks per second. Not data: config.csv must not carry a tick rate. */
export const TICK_RATE = 60;
export const TICK_MS = 1000 / TICK_RATE;
/** Max sim steps per rendered frame; the rest of the accumulator is dropped (game slows, no spiral). */
export const MAX_TICKS_PER_FRAME = 4;
/** e2e builds allow more for setTimeScale up to 16. */
export const MAX_TICKS_PER_FRAME_E2E = 16;
/** Frame delta clamp before it enters the accumulator. */
export const MAX_FRAME_DELTA_MS = 250;

// World units and camera (architecture 7.1).
/** Screen px per world unit along x (1 u = 16 sprite px). */
export const PX_PER_U = 16;
/** Camera pitch = asin(0.625) = 38.682 deg from horizontal. */
export const CAMERA_PITCH_SIN = 0.625;
/** Floor depth px per world unit: PX_PER_U * CAMERA_PITCH_SIN, exact integer. */
export const DEPTH_PX_PER_U = 10;
/** Vertical meshes only: px per unit of height h. cos(pitch) * 16 = 12.49. */
export const HEIGHT_PX_PER_U = 16 * Math.sqrt(1 - CAMERA_PITCH_SIN * CAMERA_PITCH_SIN);
/** Reference frame (virtual px) that the layout is designed in. */
export const REF_FRAME_W = 640;
export const REF_FRAME_H = 360;
/** Box that must always be visible, in reference frame px (arena-design, LD). */
export const REQUIRED_BOX = { x0: 16, y0: 32, x1: 624, y1: 328 } as const;
/** Width and height of REQUIRED_BOX, used by the world pixel scale formula (architecture 7.3). */
export const REQUIRED_BOX_W = REQUIRED_BOX.x1 - REQUIRED_BOX.x0;
export const REQUIRED_BOX_H = REQUIRED_BOX.y1 - REQUIRED_BOX.y0;
/** Camera target in world u (y = floor depth, h = height). */
export const CAMERA_TARGET = { x: 0, h: 0, y: -2 } as const;
/** Reference frame x and y of the camera target. 320 = REF_FRAME_W / 2; 200 = 180 + 10 * 2 (target y -2). */
export const REF_ORIGIN_X = REF_FRAME_W / 2 - PX_PER_U * CAMERA_TARGET.x;
export const REF_ORIGIN_Y = REF_FRAME_H / 2 - DEPTH_PX_PER_U * CAMERA_TARGET.y;
/** Depth of field: blur only above / below these reference frame y values. */
export const DOF_SHARP_TOP_PX = 54;
export const DOF_SHARP_BOTTOM_PX = 324;
/** Final arena bounds in world u (architecture 7.3). Arenas larger than this need LP, CD, LD approval. */
export const ARENA_MAX_HALF_W_U = 16;
export const ARENA_MAX_HALF_D_U = 10;
