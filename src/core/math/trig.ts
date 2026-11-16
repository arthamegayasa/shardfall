// Deterministic trigonometry using only + - * / and Math.floor (architecture.md 4.2).
// IEEE-754 basic operations give identical results on every JS engine, unlike Math.sin and friends.
// Angles in the sim are stored in turns (1 turn = 360 deg). Max error below 1e-7 for sin and cos.

export const TAU = 6.283185307179586;
const TURNS_PER_RAD = 1 / TAU;

/** sin(x) for x in [-pi/2, pi/2], odd Taylor polynomial to x^15 (Horner form). Error below 1e-11. */
function sinCore(x: number): number {
  const x2 = x * x;
  return (
    x *
    (1 +
      x2 *
        (-1 / 6 +
          x2 *
            (1 / 120 +
              x2 *
                (-1 / 5040 +
                  x2 *
                    (1 / 362880 +
                      x2 * (-1 / 39916800 + x2 * (1 / 6227020800 + x2 * (-1 / 1307674368000))))))))
  );
}

/** Sine of an angle in turns. */
export function sinTurns(t: number): number {
  // Reduce to [-0.5, 0.5), then fold into [-0.25, 0.25] where sin is monotonic.
  let x = t - Math.floor(t + 0.5);
  if (x > 0.25) x = 0.5 - x;
  else if (x < -0.25) x = -0.5 - x;
  return sinCore(x * TAU);
}

/** Cosine of an angle in turns. */
export function cosTurns(t: number): number {
  return sinTurns(t + 0.25);
}

/** atan(u) for |u| <= tan(pi/8) ~ 0.4142, odd Taylor polynomial to u^17. */
function atanCore(u: number): number {
  const u2 = u * u;
  return (
    u *
    (1 +
      u2 *
        (-1 / 3 +
          u2 *
            (1 / 5 +
              u2 *
                (-1 / 7 +
                  u2 * (1 / 9 + u2 * (-1 / 11 + u2 * (1 / 13 + u2 * (-1 / 15 + u2 * (1 / 17)))))))))
  );
}

const TAN_PI_8 = 0.41421356237309503;
const QUARTER_PI = 0.7853981633974483;
const HALF_PI = 1.5707963267948966;
const PI = 3.141592653589793;

/** atan(z) for z >= 0, in radians. */
function atanPositive(z: number): number {
  if (z > 1) return HALF_PI - atanPositive(1 / z);
  if (z > TAN_PI_8) return QUARTER_PI + atanCore((z - 1) / (z + 1));
  return atanCore(z);
}

/** atan2(y, x) in turns, range (-0.5, 0.5]. atan2Turns(0, 0) = 0. */
export function atan2Turns(y: number, x: number): number {
  if (x === 0 && y === 0) return 0;
  const ax = x < 0 ? -x : x;
  const ay = y < 0 ? -y : y;
  let r: number;
  if (ax >= ay) {
    r = atanPositive(ay / ax);
  } else {
    r = HALF_PI - atanPositive(ax / ay);
  }
  if (x < 0) r = PI - r;
  if (y < 0) r = -r;
  return r * TURNS_PER_RAD;
}

/** Degrees to turns, used once at data load. */
export function degToTurns(deg: number): number {
  return deg / 360;
}
