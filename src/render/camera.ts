// Fixed orthographic world camera (architecture.md 7.1). LP.
// Pitch asin(0.625): 1 u = 16 px along x, exactly 10 px of floor depth, 12.49 px of height.
// The frustum is sized in virtual pixels so the 640 x 360 reference frame lands on whole pixels.

import { OrthographicCamera } from 'three';
import {
  CAMERA_PITCH_SIN,
  CAMERA_TARGET,
  PX_PER_U,
  REF_FRAME_H,
  REF_FRAME_W,
} from '../core/index.ts';
import type { VirtualFrame } from '../core/index.ts';

const PITCH_RAD = Math.asin(CAMERA_PITCH_SIN);
/** Camera distance from the target along the view direction (any value inside near/far works for ortho). */
const CAMERA_DISTANCE_U = 100;

export function createWorldCamera(): OrthographicCamera {
  const cam = new OrthographicCamera(-1, 1, 1, -1, 0.1, 1000);
  // Sim (x, y) floor -> three (x, 0, y); height h -> three y. Camera sits toward +z (screen bottom) and up.
  cam.position.set(
    CAMERA_TARGET.x,
    CAMERA_TARGET.h + Math.sin(PITCH_RAD) * CAMERA_DISTANCE_U,
    CAMERA_TARGET.y + Math.cos(PITCH_RAD) * CAMERA_DISTANCE_U,
  );
  cam.up.set(0, 1, 0);
  cam.lookAt(CAMERA_TARGET.x, CAMERA_TARGET.h, CAMERA_TARGET.y);
  return cam;
}

/**
 * Fit the frustum to a virtual frame. The camera target maps to reference px (320, 180), offset by
 * the integer frame origin, so odd virtual sizes stay pixel exact.
 */
export function fitWorldCamera(cam: OrthographicCamera, frame: VirtualFrame): void {
  const cx = frame.originX + REF_FRAME_W / 2;
  const cy = frame.originY + REF_FRAME_H / 2;
  cam.left = -cx / PX_PER_U;
  cam.right = (frame.width - cx) / PX_PER_U;
  cam.top = cy / PX_PER_U;
  cam.bottom = -(frame.height - cy) / PX_PER_U;
  cam.updateProjectionMatrix();
}

/** Billboard tilt: quads face the camera so sprite pixels map 1:1 to virtual pixels. */
export const BILLBOARD_TILT_RAD = -PITCH_RAD;
