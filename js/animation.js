/* ── Animation System: Polyline path-following ── */

const Animation = (() => {
  let activeAnimation = null;
  let locked = false;

  // X coordinate of the tunnel mouth — meshes past this disappear during victory
  const tunnelMouthX = Tracks.getTrackEnd('A').x;

  function isLocked() {
    return locked;
  }

  // Animate loco + coupled cars along a route of waypoints
  function animateMove(fromTrack, toTrack, onComplete) {
    locked = true;

    const locoMesh = Entities.getLocoMesh();
    const coupledMeshes = GameState.state.coupled.map((id) => Entities.getCarMesh(id));
    const allMeshes = [locoMesh, ...coupledMeshes];

    // Get routing waypoints (throat → switch points → throat)
    const waypoints = Tracks.getRouteWaypoints(fromTrack, toTrack);

    // Prepend loco's actual position and append destination loco position
    // so the path goes: locoPos → throat → switches → throat → destLocoPos
    waypoints.unshift(new THREE.Vector3(locoMesh.position.x, 0, locoMesh.position.z));
    // Stop position accounts for siding cars / buffer contact on B/C/D
    const numCoupled = GameState.state.coupled.length;
    const numSiding = GameState.state.sidings[toTrack].length;
    waypoints.push(Tracks.getLocoStopPosition(toTrack, numCoupled, numSiding));

    // Build polyline path with cumulative distances
    const path = [{ point: waypoints[0].clone(), dist: 0 }];
    let totalDist = 0;
    for (let i = 1; i < waypoints.length; i++) {
      totalDist += waypoints[i].distanceTo(waypoints[i - 1]);
      path.push({ point: waypoints[i].clone(), dist: totalDist });
    }

    // Overall direction: is loco moving rightward or leftward?
    const movingRight = waypoints[waypoints.length - 1].x > waypoints[0].x;

    // Extend path beyond both ends so trailing cars always have valid positions
    const maxTrail = allMeshes.length * CONFIG.slotSpacing + 2;

    const firstDir = waypoints[1].clone().sub(waypoints[0]).normalize();
    const extBefore = waypoints[0].clone().sub(firstDir.clone().multiplyScalar(maxTrail));
    path.unshift({ point: extBefore, dist: -maxTrail });

    const lastIdx = waypoints.length - 1;
    const lastDir = waypoints[lastIdx].clone().sub(waypoints[lastIdx - 1]).normalize();
    const extAfter = waypoints[lastIdx].clone().add(lastDir.clone().multiplyScalar(maxTrail));
    path.push({ point: extAfter, dist: totalDist + maxTrail });

    const numSegments = waypoints.length - 1;

    // Capture each mesh's starting rotation so we can avoid 180° flips
    const startRotations = allMeshes.map((m) => m.rotation.y);

    activeAnimation = {
      meshes: allMeshes,
      path,
      totalDist,
      movingRight,
      startRotations,
      elapsed: 0,
      duration: numSegments * CONFIG.moveSpeed,
      onComplete: () => {
        Entities.positionAllEntities();
        locked = false;
        if (onComplete) onComplete();
      },
    };
  }

  // Interpolate position and tangent at a given distance along the polyline path
  function getPointOnPath(path, d) {
    // Clamp to path bounds
    if (d <= path[0].dist) {
      const tangent = path[1].point.clone().sub(path[0].point).normalize();
      return { pos: path[0].point.clone(), tangent };
    }
    const last = path.length - 1;
    if (d >= path[last].dist) {
      const tangent = path[last].point.clone().sub(path[last - 1].point).normalize();
      return { pos: path[last].point.clone(), tangent };
    }

    // Find the segment containing this distance
    for (let i = 1; i < path.length; i++) {
      if (d <= path[i].dist) {
        const segLen = path[i].dist - path[i - 1].dist;
        const t = segLen > 0 ? (d - path[i - 1].dist) / segLen : 0;
        const pos = path[i - 1].point.clone().lerp(path[i].point, t);
        const tangent = path[i].point.clone().sub(path[i - 1].point).normalize();
        return { pos, tangent };
      }
    }

    // Fallback
    const tangent = path[last].point.clone().sub(path[last - 1].point).normalize();
    return { pos: path[last].point.clone(), tangent };
  }

  function update(delta) {
    if (!activeAnimation) return;

    const anim = activeAnimation;
    anim.elapsed += delta;

    let t = anim.elapsed / anim.duration;
    if (t >= 1) {
      const cb = anim.onComplete;
      activeAnimation = null;
      cb();
      return;
    }

    // Smooth the overall progress
    t = smoothStep(t);

    // Loco's distance along the original path
    const locoDist = t * anim.totalDist;

    // Position loco on the path
    const locoData = getPointOnPath(anim.path, locoDist);
    anim.meshes[0].position.x = locoData.pos.x;
    anim.meshes[0].position.z = locoData.pos.z;
    anim.meshes[0].rotation.y = noFlipAngle(
      Math.atan2(-locoData.tangent.z, locoData.tangent.x),
      anim.startRotations[0]
    );

    // Position coupled cars: always to the RIGHT of loco along the path.
    // Moving right: cars are AHEAD on the path (greater distance = more rightward)
    // Moving left:  cars are BEHIND on the path (lesser distance = more rightward)
    for (let i = 1; i < anim.meshes.length; i++) {
      const carDist = anim.movingRight
        ? locoDist + i * CONFIG.slotSpacing
        : locoDist - i * CONFIG.slotSpacing;
      const carData = getPointOnPath(anim.path, carDist);
      anim.meshes[i].position.x = carData.pos.x;
      anim.meshes[i].position.z = carData.pos.z;
      anim.meshes[i].rotation.y = noFlipAngle(
        Math.atan2(-carData.tangent.z, carData.tangent.x),
        anim.startRotations[i]
      );
    }

    // During victory drive-off, hide meshes as they enter the tunnel
    if (anim.isVictory) {
      for (let i = 0; i < anim.meshes.length; i++) {
        if (anim.meshes[i].position.x < tunnelMouthX) {
          anim.meshes[i].visible = false;
        }
      }
    }
  }

  // Victory animation: train drives off the left side of siding A
  function animateVictoryDriveOff() {
    locked = true;

    const locoMesh = Entities.getLocoMesh();
    const coupledMeshes = GameState.state.coupled.map((id) => Entities.getCarMesh(id));
    const allMeshes = [locoMesh, ...coupledMeshes];

    const currentTrack = GameState.state.locoTrack;

    // Build waypoints: current position → (route to A if needed) → far off-screen left
    let waypoints;
    if (currentTrack === 'A') {
      waypoints = [
        new THREE.Vector3(locoMesh.position.x, 0, locoMesh.position.z),
      ];
    } else {
      // Route to A first via switch points
      const routeToA = Tracks.getRouteWaypoints(currentTrack, 'A');
      waypoints = [
        new THREE.Vector3(locoMesh.position.x, 0, locoMesh.position.z),
        ...routeToA,
        Tracks.getLocoPosition('A'),
      ];
    }

    // Drive off-screen to the left (well past the left edge of track A)
    const offScreenX = -30;
    const trackZ = Tracks.definitions.A.throatZ;
    waypoints.push(new THREE.Vector3(offScreenX, 0, trackZ));

    // Build polyline path with cumulative distances
    const path = [{ point: waypoints[0].clone(), dist: 0 }];
    let totalDist = 0;
    for (let i = 1; i < waypoints.length; i++) {
      totalDist += waypoints[i].distanceTo(waypoints[i - 1]);
      path.push({ point: waypoints[i].clone(), dist: totalDist });
    }

    // Moving left (off-screen)
    const movingRight = false;

    // Extend path at both ends for car trailing
    const maxTrail = allMeshes.length * CONFIG.slotSpacing + 2;

    const firstDir = waypoints[1].clone().sub(waypoints[0]).normalize();
    const extBefore = waypoints[0].clone().sub(firstDir.clone().multiplyScalar(maxTrail));
    path.unshift({ point: extBefore, dist: -maxTrail });

    const lastIdx = waypoints.length - 1;
    const lastDir = waypoints[lastIdx].clone().sub(waypoints[lastIdx - 1]).normalize();
    const extAfter = waypoints[lastIdx].clone().add(lastDir.clone().multiplyScalar(maxTrail));
    path.push({ point: extAfter, dist: totalDist + maxTrail });

    const numSegments = waypoints.length - 1;

    const startRotations = allMeshes.map((m) => m.rotation.y);

    activeAnimation = {
      meshes: allMeshes,
      path,
      totalDist,
      movingRight,
      startRotations,
      isVictory: true,
      elapsed: 0,
      duration: numSegments * CONFIG.moveSpeed,
      onComplete: () => {
        locked = false;
        // Leave meshes hidden inside the tunnel — game is won
      },
    };
  }

  // Given a tangent-derived angle and a reference starting angle,
  // pick whichever of angle or angle±π is closest to the reference.
  // This lets cars follow curves without flipping 180°.
  function noFlipAngle(angle, ref) {
    let delta = angle - ref;
    // Normalize delta to [-π, π]
    delta = ((delta + Math.PI) % (2 * Math.PI)) - Math.PI;
    if (delta < -Math.PI) delta += 2 * Math.PI;

    if (Math.abs(delta) > Math.PI / 2) {
      // The tangent-based angle is >90° away from our reference — use the π-offset
      angle += angle > ref ? -Math.PI : Math.PI;
    }
    return angle;
  }

  function smoothStep(t) {
    return t * t * (3 - 2 * t);
  }

  return { update, animateMove, animateVictoryDriveOff, isLocked };
})();
