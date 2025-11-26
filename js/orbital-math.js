const OrbitalMath = (() => {
  
  const CONSTANTS = {
    EARTH_RADIUS: 6371.0,
    EARTH_MU: 398600.4418,
    J2: 0.00108263,
    EARTH_ROTATION_RATE: 7.2921159e-5,
    TWO_PI: 2 * Math.PI,
    DEG_TO_RAD: Math.PI / 180,
    RAD_TO_DEG: 180 / Math.PI,
    EPSILON: 1e-12,
    MAX_ITERATIONS: 50
  };

  const Vector3 = {
    magnitude: (v) => Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z),
    
    dot: (a, b) => a.x * b.x + a.y * b.y + a.z * b.z,
    
    cross: (a, b) => ({
      x: a.y * b.z - a.z * b.y,
      y: a.z * b.x - a.x * b.z,
      z: a.x * b.y - a.y * b.x
    }),
    
    normalize: (v) => {
      const mag = Vector3.magnitude(v);
      return mag > 0 ? { x: v.x / mag, y: v.y / mag, z: v.z / mag } : { x: 0, y: 0, z: 0 };
    },
    
    scale: (v, s) => ({ x: v.x * s, y: v.y * s, z: v.z * s }),
    
    add: (a, b) => ({ x: a.x + b.x, y: a.y + b.y, z: a.z + b.z }),
    
    subtract: (a, b) => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z })
  };

  const solveKeplersEquation = (meanAnomaly, eccentricity, tolerance = CONSTANTS.EPSILON) => {
    const M = meanAnomaly % CONSTANTS.TWO_PI;
    
    if (eccentricity < 1.0) {
      let E = M < Math.PI ? M + eccentricity / 2 : M - eccentricity / 2;
      
      for (let i = 0; i < CONSTANTS.MAX_ITERATIONS; i++) {
        const f = E - eccentricity * Math.sin(E) - M;
        const fPrime = 1 - eccentricity * Math.cos(E);
        const delta = f / fPrime;
        E -= delta;
        
        if (Math.abs(delta) < tolerance) {
          return E;
        }
      }
      
      return E;
    } else if (eccentricity > 1.0) {
      let H = Math.log(2 * M / eccentricity + 1.8);
      
      for (let i = 0; i < CONSTANTS.MAX_ITERATIONS; i++) {
        const f = eccentricity * Math.sinh(H) - H - M;
        const fPrime = eccentricity * Math.cosh(H) - 1;
        const delta = f / fPrime;
        H -= delta;
        
        if (Math.abs(delta) < tolerance) {
          return H;
        }
      }
      
      return H;
    } else {
      const B = Math.cbrt(3 * M + Math.sqrt(9 * M * M + 1));
      return B - 1 / B;
    }
  };

  const keplerianToCartesian = (elements) => {
    const { a, e, i, raan, argPe, trueAnomaly } = elements;
    
    const iRad = i * CONSTANTS.DEG_TO_RAD;
    const raanRad = raan * CONSTANTS.DEG_TO_RAD;
    const argPeRad = argPe * CONSTANTS.DEG_TO_RAD;
    const nuRad = trueAnomaly * CONSTANTS.DEG_TO_RAD;
    
    const p = a * (1 - e * e);
    const r = p / (1 + e * Math.cos(nuRad));
    
    const cosNu = Math.cos(nuRad);
    const sinNu = Math.sin(nuRad);
    
    const xPerifocal = r * cosNu;
    const yPerifocal = r * sinNu;
    
    const vxPerifocal = -Math.sqrt(CONSTANTS.EARTH_MU / p) * sinNu;
    const vyPerifocal = Math.sqrt(CONSTANTS.EARTH_MU / p) * (e + cosNu);
    
    const cosRaan = Math.cos(raanRad);
    const sinRaan = Math.sin(raanRad);
    const cosI = Math.cos(iRad);
    const sinI = Math.sin(iRad);
    const cosArgPe = Math.cos(argPeRad);
    const sinArgPe = Math.sin(argPeRad);
    
    const R11 = cosRaan * cosArgPe - sinRaan * sinArgPe * cosI;
    const R12 = -cosRaan * sinArgPe - sinRaan * cosArgPe * cosI;
    const R21 = sinRaan * cosArgPe + cosRaan * sinArgPe * cosI;
    const R22 = -sinRaan * sinArgPe + cosRaan * cosArgPe * cosI;
    const R31 = sinArgPe * sinI;
    const R32 = cosArgPe * sinI;
    
    const position = {
      x: R11 * xPerifocal + R12 * yPerifocal,
      y: R21 * xPerifocal + R22 * yPerifocal,
      z: R31 * xPerifocal + R32 * yPerifocal
    };
    
    const velocity = {
      x: R11 * vxPerifocal + R12 * vyPerifocal,
      y: R21 * vxPerifocal + R22 * vyPerifocal,
      z: R31 * vxPerifocal + R32 * vyPerifocal
    };
    
    return { position, velocity };
  };

  const cartesianToKeplerian = (position, velocity) => {
    const r = Vector3.magnitude(position);
    const v = Vector3.magnitude(velocity);
    
    const h = Vector3.cross(position, velocity);
    const hMag = Vector3.magnitude(h);
    
    const n = Vector3.cross({ x: 0, y: 0, z: 1 }, h);
    const nMag = Vector3.magnitude(n);
    
    const eVec = Vector3.subtract(
      Vector3.scale(Vector3.cross(velocity, h), 1 / CONSTANTS.EARTH_MU),
      Vector3.normalize(position)
    );
    const e = Vector3.magnitude(eVec);
    
    const energy = (v * v) / 2 - CONSTANTS.EARTH_MU / r;
    const a = -CONSTANTS.EARTH_MU / (2 * energy);
    
    const i = Math.acos(h.z / hMag) * CONSTANTS.RAD_TO_DEG;
    
    let raan = 0;
    if (nMag > CONSTANTS.EPSILON) {
      raan = Math.acos(n.x / nMag) * CONSTANTS.RAD_TO_DEG;
      if (n.y < 0) raan = 360 - raan;
    }
    
    let argPe = 0;
    if (nMag > CONSTANTS.EPSILON && e > CONSTANTS.EPSILON) {
      argPe = Math.acos(Vector3.dot(n, eVec) / (nMag * e)) * CONSTANTS.RAD_TO_DEG;
      if (eVec.z < 0) argPe = 360 - argPe;
    }
    
    let trueAnomaly = 0;
    if (e > CONSTANTS.EPSILON) {
      trueAnomaly = Math.acos(Vector3.dot(eVec, position) / (e * r)) * CONSTANTS.RAD_TO_DEG;
      if (Vector3.dot(position, velocity) < 0) trueAnomaly = 360 - trueAnomaly;
    }
    
    return { a, e, i, raan, argPe, trueAnomaly };
  };

  const propagateOrbitRK4 = (elements, timeSeconds, stepSize = 60) => {
    let state = keplerianToCartesian(elements);
    const steps = Math.ceil(timeSeconds / stepSize);
    const dt = timeSeconds / steps;
    const trajectory = [];
    
    trajectory.push({
      time: 0,
      position: { ...state.position },
      velocity: { ...state.velocity }
    });
    
    for (let i = 0; i < steps; i++) {
      const k1v = acceleration(state.position);
      const k1r = state.velocity;
      
      const r2 = Vector3.add(state.position, Vector3.scale(k1r, dt / 2));
      const v2 = Vector3.add(state.velocity, Vector3.scale(k1v, dt / 2));
      const k2v = acceleration(r2);
      const k2r = v2;
      
      const r3 = Vector3.add(state.position, Vector3.scale(k2r, dt / 2));
      const v3 = Vector3.add(state.velocity, Vector3.scale(k2v, dt / 2));
      const k3v = acceleration(r3);
      const k3r = v3;
      
      const r4 = Vector3.add(state.position, Vector3.scale(k3r, dt));
      const v4 = Vector3.add(state.velocity, Vector3.scale(k3v, dt));
      const k4v = acceleration(r4);
      const k4r = v4;
      
      state.position = Vector3.add(
        state.position,
        Vector3.scale(
          Vector3.add(
            Vector3.add(k1r, Vector3.scale(k2r, 2)),
            Vector3.add(Vector3.scale(k3r, 2), k4r)
          ),
          dt / 6
        )
      );
      
      state.velocity = Vector3.add(
        state.velocity,
        Vector3.scale(
          Vector3.add(
            Vector3.add(k1v, Vector3.scale(k2v, 2)),
            Vector3.add(Vector3.scale(k3v, 2), k4v)
          ),
          dt / 6
        )
      );
      
      trajectory.push({
        time: (i + 1) * dt,
        position: { ...state.position },
        velocity: { ...state.velocity }
      });
    }
    
    return trajectory;
  };

  const acceleration = (position) => {
    const r = Vector3.magnitude(position);
    const factor = -CONSTANTS.EARTH_MU / (r * r * r);
    return Vector3.scale(position, factor);
  };

  const calculateOrbitalPeriod = (semiMajorAxis) => {
    return CONSTANTS.TWO_PI * Math.sqrt(Math.pow(semiMajorAxis, 3) / CONSTANTS.EARTH_MU);
  };

  const calculateApogeePerigee = (semiMajorAxis, eccentricity) => {
    const apogee = semiMajorAxis * (1 + eccentricity) - CONSTANTS.EARTH_RADIUS;
    const perigee = semiMajorAxis * (1 - eccentricity) - CONSTANTS.EARTH_RADIUS;
    return { apogee, perigee };
  };

  const calculateVelocities = (semiMajorAxis, eccentricity) => {
    const rApogee = semiMajorAxis * (1 + eccentricity);
    const rPerigee = semiMajorAxis * (1 - eccentricity);
    
    const vApogee = Math.sqrt(CONSTANTS.EARTH_MU * (2 / rApogee - 1 / semiMajorAxis));
    const vPerigee = Math.sqrt(CONSTANTS.EARTH_MU * (2 / rPerigee - 1 / semiMajorAxis));
    
    return { vApogee, vPerigee };
  };

  const calculateHohmannTransfer = (r1, r2) => {
    const a_transfer = (r1 + r2) / 2;
    
    const v1 = Math.sqrt(CONSTANTS.EARTH_MU / r1);
    const v2 = Math.sqrt(CONSTANTS.EARTH_MU / r2);
    
    const v_transfer_periapsis = Math.sqrt(CONSTANTS.EARTH_MU * (2 / r1 - 1 / a_transfer));
    const v_transfer_apoapsis = Math.sqrt(CONSTANTS.EARTH_MU * (2 / r2 - 1 / a_transfer));
    
    const deltaV1 = Math.abs(v_transfer_periapsis - v1);
    const deltaV2 = Math.abs(v2 - v_transfer_apoapsis);
    const totalDeltaV = deltaV1 + deltaV2;
    
    const transferTime = Math.PI * Math.sqrt(Math.pow(a_transfer, 3) / CONSTANTS.EARTH_MU);
    
    return {
      deltaV1,
      deltaV2,
      totalDeltaV,
      transferTime,
      transferOrbit: { a: a_transfer, e: Math.abs(r2 - r1) / (r1 + r2) }
    };
  };

  const calculateLaunchWindows = (launchSiteLat, launchSiteLon, targetInclination, targetRaan, numWindows = 10) => {
    const windows = [];
    const latRad = launchSiteLat * CONSTANTS.DEG_TO_RAD;
    const incRad = targetInclination * CONSTANTS.DEG_TO_RAD;
    
    if (Math.abs(launchSiteLat) > targetInclination) {
      return { error: "Launch site latitude exceeds target inclination. Orbit not achievable." };
    }
    
    const beta = Math.asin(Math.cos(incRad) / Math.cos(latRad));
    const azimuthAscending = beta * CONSTANTS.RAD_TO_DEG;
    const azimuthDescending = 180 - azimuthAscending;
    
    const now = new Date();
    const startTime = now.getTime();
    
    for (let i = 0; i < numWindows * 2; i++) {
      const timeOffset = i * 5400000;
      const launchTime = new Date(startTime + timeOffset);
      
      const gmst = calculateGMST(launchTime);
      const lst = gmst + launchSiteLon;
      const raanDiff = (targetRaan - lst + 360) % 360;
      
      if (raanDiff < 1 || raanDiff > 359) {
        windows.push({
          time: launchTime.toISOString(),
          azimuth: i % 2 === 0 ? azimuthAscending : azimuthDescending,
          type: i % 2 === 0 ? 'Ascending' : 'Descending'
        });
        
        if (windows.length >= numWindows) break;
      }
    }
    
    return windows;
  };

  const calculateGMST = (date) => {
    const J2000 = new Date('2000-01-01T12:00:00Z');
    const D = (date - J2000) / 86400000;
    const gmst = 280.46061837 + 360.98564736629 * D;
    return gmst % 360;
  };

  const calculateGroundTrack = (elements, numPoints = 100) => {
    const period = calculateOrbitalPeriod(elements.a);
    const trajectory = propagateOrbitRK4(elements, period, period / numPoints);
    
    return trajectory.map(point => {
      const r = Vector3.magnitude(point.position);
      const lat = Math.asin(point.position.z / r) * CONSTANTS.RAD_TO_DEG;
      
      const gmst = calculateGMST(new Date());
      const lon = (Math.atan2(point.position.y, point.position.x) * CONSTANTS.RAD_TO_DEG - gmst) % 360;
      const adjustedLon = lon > 180 ? lon - 360 : lon < -180 ? lon + 360 : lon;
      
      return { lat, lon: adjustedLon, altitude: r - CONSTANTS.EARTH_RADIUS };
    });
  };

  const validateOrbitalElements = (elements) => {
    const errors = [];
    
    if (elements.a <= CONSTANTS.EARTH_RADIUS) {
      errors.push("Semi-major axis must be greater than Earth's radius (6371 km)");
    }
    
    if (elements.e < 0 || elements.e >= 1) {
      errors.push("Eccentricity must be between 0 (inclusive) and 1 (exclusive) for closed orbits");
    }
    
    const perigee = elements.a * (1 - elements.e);
    if (perigee < CONSTANTS.EARTH_RADIUS) {
      errors.push(`Perigee altitude (${(perigee - CONSTANTS.EARTH_RADIUS).toFixed(1)} km) is below Earth's surface`);
    }
    
    if (elements.i < 0 || elements.i > 180) {
      errors.push("Inclination must be between 0° and 180°");
    }
    
    return { valid: errors.length === 0, errors };
  };

  const getOrbitStability = (perigeeAltitude) => {
    if (perigeeAltitude > 200) return 'stable';
    if (perigeeAltitude > 150) return 'marginal';
    return 'decay';
  };

  return {
    CONSTANTS,
    Vector3,
    solveKeplersEquation,
    keplerianToCartesian,
    cartesianToKeplerian,
    propagateOrbitRK4,
    calculateOrbitalPeriod,
    calculateApogeePerigee,
    calculateVelocities,
    calculateHohmannTransfer,
    calculateLaunchWindows,
    calculateGroundTrack,
    validateOrbitalElements,
    getOrbitStability
  };
})();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = OrbitalMath;
}