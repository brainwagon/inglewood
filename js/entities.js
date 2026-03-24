/* ── Entity Creation: Locomotive, Cars, Rails ── */

const Entities = (() => {
  let locoMesh = null;
  const carMeshes = {}; // keyed by car ID (1-8)
  const clickZones = []; // invisible planes for raycasting
  let scene = null;

  function init(sceneRef) {
    scene = sceneRef;
    createRails();
    createClickZones();
    createLocomotive();
    createAllCars();
    positionAllEntities();
    createTunnel();
    createDecorations();
  }

  // ── Rails ──
  function createRails() {
    const railMaterial = new THREE.MeshStandardMaterial({
      color: 0x888888,
      metalness: 0.6,
      roughness: 0.4,
    });
    const sleeperMat = new THREE.MeshStandardMaterial({
      color: 0x5d4037,
      roughness: 0.9,
    });

    // Draw the four parallel sidings
    ['A', 'B', 'C', 'D'].forEach((trackId) => {
      const start = Tracks.getTrackStart(trackId);
      const end = Tracks.getTrackEnd(trackId);
      drawRailSegment(start, end, railMaterial, sleeperMat);
      createTrackLabel(trackId, end);
    });

    // Draw the diagonal connector segments (switch throat)
    Tracks.connectors.forEach((seg) => {
      drawRailSegment(seg.from, seg.to, railMaterial, sleeperMat);
    });

    // Buffer stops at the end of sidings B, C, D
    const bufferMat = new THREE.MeshStandardMaterial({
      color: 0xcc2222,
      roughness: 0.6,
      metalness: 0.3,
    });
    const bufferWoodMat = new THREE.MeshStandardMaterial({
      color: 0x5d4037,
      roughness: 0.9,
    });
    ['B', 'C', 'D'].forEach((trackId) => {
      createBufferStop(trackId, railMaterial, bufferMat, bufferWoodMat);
    });
  }

  function createBufferStop(trackId, railMat, bufferMat, woodMat) {
    const end = Tracks.getTrackEnd(trackId);
    const t = Tracks.definitions[trackId];
    // Track direction (from throat toward buffer)
    const dirX = t.dirX;
    const dirZ = t.dirZ;
    // Perpendicular (to the left when facing along track direction)
    const perpX = -dirZ;
    const perpZ = dirX;
    const angle = Math.atan2(dirX, dirZ);

    const group = new THREE.Group();
    group.position.copy(end);

    // Cross-beam (horizontal bar across both rails)
    const beamGeo = new THREE.BoxGeometry(0.12, 0.3, 0.8);
    const beam = new THREE.Mesh(beamGeo, bufferMat);
    beam.position.y = 0.25;
    beam.rotation.y = angle;
    beam.castShadow = true;
    group.add(beam);

    // Two buffer pads on the cross-beam (facing the approaching train)
    for (let side = -1; side <= 1; side += 2) {
      const padGeo = new THREE.BoxGeometry(0.15, 0.2, 0.15);
      const pad = new THREE.Mesh(padGeo, bufferMat);
      pad.position.set(
        -dirX * 0.08 + perpX * side * 0.25,
        0.25,
        -dirZ * 0.08 + perpZ * side * 0.25
      );
      pad.rotation.y = angle;
      pad.castShadow = true;
      group.add(pad);
    }

    // Two diagonal braces from ground to cross-beam
    for (let side = -1; side <= 1; side += 2) {
      const braceGeo = new THREE.BoxGeometry(0.06, 0.45, 0.06);
      const brace = new THREE.Mesh(braceGeo, woodMat);
      brace.position.set(
        dirX * 0.15 + perpX * side * 0.25,
        0.18,
        dirZ * 0.15 + perpZ * side * 0.25
      );
      // Tilt backward (away from approaching train)
      const tiltAxis = new THREE.Vector3(perpX, 0, perpZ).normalize();
      brace.rotation.y = angle;
      brace.rotateOnWorldAxis(tiltAxis, 0.3);
      brace.castShadow = true;
      group.add(brace);
    }

    scene.add(group);
  }

  function drawRailSegment(start, end, railMaterial, sleeperMat) {
    const dir = end.clone().sub(start);
    const length = dir.length();
    if (length < 0.1) return;
    const mid = start.clone().add(end).multiplyScalar(0.5);
    const angle = Math.atan2(dir.x, dir.z);

    // Perpendicular offset for two rails
    const perp = new THREE.Vector3(-dir.z, 0, dir.x).normalize().multiplyScalar(0.3);

    for (let side = -1; side <= 1; side += 2) {
      const railGeo = new THREE.BoxGeometry(0.08, 0.08, length);
      const rail = new THREE.Mesh(railGeo, railMaterial);
      rail.position.copy(mid).add(perp.clone().multiplyScalar(side));
      rail.position.y = 0.04;
      rail.rotation.y = angle;
      rail.receiveShadow = true;
      scene.add(rail);
    }

    // Sleepers (cross-ties)
    const sleeperCount = Math.max(1, Math.floor(length / 1.2));
    for (let i = 0; i < sleeperCount; i++) {
      const t = (i + 0.5) / sleeperCount;
      const pos = start.clone().lerp(end, t);
      const sleeperGeo = new THREE.BoxGeometry(0.12, 0.04, 0.9);
      const sleeper = new THREE.Mesh(sleeperGeo, sleeperMat);
      sleeper.position.copy(pos);
      sleeper.position.y = 0.02;
      sleeper.rotation.y = angle;
      sleeper.receiveShadow = true;
      scene.add(sleeper);
    }
  }

  function createTrackLabel(trackId, position) {
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 48px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(trackId, 32, 32);

    const texture = new THREE.CanvasTexture(canvas);
    const spriteMat = new THREE.SpriteMaterial({ map: texture });
    const sprite = new THREE.Sprite(spriteMat);
    sprite.position.copy(position);
    sprite.position.y = 1.5;
    sprite.scale.set(1.5, 1.5, 1);
    scene.add(sprite);
  }

  // ── Click Zones (invisible planes over each track for raycasting) ──
  function createClickZones() {
    ['A', 'B', 'C', 'D'].forEach((trackId) => {
      const start = Tracks.getTrackStart(trackId);
      const end = Tracks.getTrackEnd(trackId);
      const dir = end.clone().sub(start);
      const length = dir.length();
      const mid = start.clone().add(end).multiplyScalar(0.5);
      const angle = Math.atan2(dir.x, dir.z);

      const zoneGeo = new THREE.PlaneGeometry(2.0, length);
      const zoneMat = new THREE.MeshBasicMaterial({
        visible: false,
        side: THREE.DoubleSide,
      });
      const zone = new THREE.Mesh(zoneGeo, zoneMat);
      zone.position.copy(mid);
      zone.position.y = 0.5;
      zone.rotation.y = angle;
      zone.rotation.x = -Math.PI / 2;
      zone.userData.trackId = trackId;
      zone.userData.isClickZone = true;
      scene.add(zone);
      clickZones.push(zone);
    });
  }

  // ── Locomotive ──
  function createLocomotive() {
    const geo = new THREE.BoxGeometry(
      CONFIG.locoSize.x,
      CONFIG.locoSize.y,
      CONFIG.locoSize.z
    );
    const mat = new THREE.MeshStandardMaterial({
      color: CONFIG.locoColor,
      roughness: 0.4,
      metalness: 0.2,
    });
    locoMesh = new THREE.Mesh(geo, mat);
    locoMesh.castShadow = true;
    locoMesh.receiveShadow = true;
    locoMesh.position.y = CONFIG.locoSize.y / 2 + 0.08;
    locoMesh.userData.isLoco = true;
    scene.add(locoMesh);

    // Cab bump on top
    const cabGeo = new THREE.BoxGeometry(0.6, 0.4, CONFIG.locoSize.z * 0.8);
    const cabMat = new THREE.MeshStandardMaterial({
      color: 0xdd9900,
      roughness: 0.5,
    });
    const cab = new THREE.Mesh(cabGeo, cabMat);
    cab.position.y = CONFIG.locoSize.y / 2 + 0.2;
    cab.position.x = -0.4;
    cab.castShadow = true;
    locoMesh.add(cab);
  }

  // ── Cars ──
  function createAllCars() {
    for (let id = 1; id <= CONFIG.totalCars; id++) {
      const color = CONFIG.carColors[id - 1];
      const mesh = createCar(id, color);
      carMeshes[id] = mesh;
      scene.add(mesh);
    }
  }

  function createCar(id, color) {
    // Create materials array: colored sides + numbered ends
    const sideMat = new THREE.MeshStandardMaterial({
      color: color,
      roughness: 0.5,
      metalness: 0.1,
    });

    const labelTexture = createNumberTexture(id, color);
    const labelMat = new THREE.MeshStandardMaterial({
      map: labelTexture,
      roughness: 0.5,
    });

    const topTexture = createNumberTexture(id, color);
    const topMat = new THREE.MeshStandardMaterial({
      map: topTexture,
      roughness: 0.5,
    });

    // BoxGeometry face order: +x, -x, +y, -y, +z, -z
    const materials = [
      labelMat,  // +x (right end)
      labelMat,  // -x (left end)
      topMat,    // +y (top) -- numbered for god-view visibility
      sideMat,   // -y (bottom)
      sideMat,   // +z (front side)
      sideMat,   // -z (back side)
    ];

    const geo = new THREE.BoxGeometry(
      CONFIG.carSize.x,
      CONFIG.carSize.y,
      CONFIG.carSize.z
    );
    const mesh = new THREE.Mesh(geo, materials);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.position.y = CONFIG.carSize.y / 2 + 0.08;
    mesh.userData.carId = id;
    mesh.userData.isCar = true;
    return mesh;
  }

  function createNumberTexture(id, bgColor) {
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');

    // Background
    const c = new THREE.Color(bgColor);
    ctx.fillStyle = `rgb(${Math.floor(c.r * 255)},${Math.floor(c.g * 255)},${Math.floor(c.b * 255)})`;
    ctx.fillRect(0, 0, 128, 128);

    // White circle
    ctx.beginPath();
    ctx.arc(64, 64, 40, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.fill();

    // Number
    ctx.fillStyle = '#000000';
    ctx.font = 'bold 52px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(id), 64, 66);

    return new THREE.CanvasTexture(canvas);
  }

  // ── Tunnel entrance at the far-left end of track A ──
  function createTunnel() {
    const trackEnd = Tracks.getTrackEnd('A');
    // Place the tunnel portal just beyond the end of track A
    const tunnelX = trackEnd.x - 1.0;
    const tunnelZ = trackEnd.z;

    const group = new THREE.Group();
    group.position.set(tunnelX, 0, tunnelZ);

    const stoneMat = new THREE.MeshStandardMaterial({
      color: 0x6b6b6b,
      roughness: 0.95,
      flatShading: true,
    });
    const darkStoneMat = new THREE.MeshStandardMaterial({
      color: 0x4a4a4a,
      roughness: 0.95,
      flatShading: true,
    });
    const portalMat = new THREE.MeshStandardMaterial({
      color: 0x0a0a0a,
      roughness: 1.0,
    });

    // Dark portal interior (recessed box behind the arch)
    const portalGeo = new THREE.BoxGeometry(2.0, 3.5, 2.5);
    const portal = new THREE.Mesh(portalGeo, portalMat);
    portal.position.set(-0.5, 1.75, 0);
    group.add(portal);

    // Arch: build from a semicircle of stone blocks
    const archRadius = 1.6;
    const archSegments = 9;
    for (let i = 0; i <= archSegments; i++) {
      const angle = (Math.PI * i) / archSegments;
      const bx = 0;
      const by = 1.6 + Math.sin(angle) * archRadius;
      const bz = Math.cos(angle) * archRadius;
      const blockGeo = new THREE.BoxGeometry(1.2, 0.45, 0.45);
      const block = new THREE.Mesh(blockGeo, stoneMat);
      block.position.set(bx, by, bz);
      block.rotation.x = angle - Math.PI / 2;
      block.castShadow = true;
      block.receiveShadow = true;
      group.add(block);
    }

    // Keystone at the top of the arch
    const keystoneGeo = new THREE.BoxGeometry(1.3, 0.55, 0.55);
    const keystone = new THREE.Mesh(keystoneGeo, darkStoneMat);
    keystone.position.set(0, 1.6 + archRadius, 0);
    keystone.castShadow = true;
    group.add(keystone);

    // Stone walls on either side of the arch
    for (const side of [-1, 1]) {
      const wallGeo = new THREE.BoxGeometry(1.2, 3.2, 0.6);
      const wall = new THREE.Mesh(wallGeo, stoneMat);
      wall.position.set(0, 1.6, side * (archRadius + 0.2));
      wall.castShadow = true;
      wall.receiveShadow = true;
      group.add(wall);
    }

    // Green embankment around the tunnel — shaped as a thick arch, not a dome
    // Built with an extruded half-ring cross-section running along X (into the hillside)
    const hillMat = new THREE.MeshStandardMaterial({
      color: 0x3d5c2e,
      roughness: 0.95,
      flatShading: true,
    });

    const outerR = 7.6;
    const innerR = 0.8;
    const depth = 5.0; // how far back the embankment extends
    const segments = 10;

    // Build a half-ring shape (arch cross-section) and extrude along -X.
    // After rotation.y = -π/2, shape coord 1 → world Z, coord 2 → world Y.
    // Sweep from angle 0 to π so the arch spans both sides of the track (±Z).
    const shape = new THREE.Shape();
    // Outer arc: bottom-near → top → bottom-far
    for (let i = 0; i <= segments; i++) {
      const angle = Math.PI * i / segments;
      const sz = -Math.cos(angle) * outerR; // world Z: -R → 0 → +R
      const sy = Math.sin(angle) * outerR;  // world Y: 0 → +R → 0
      if (i === 0) shape.moveTo(sz, sy);
      else shape.lineTo(sz, sy);
    }
    // Inner arc back: bottom-far → top → bottom-near
    for (let i = segments; i >= 0; i--) {
      const angle = Math.PI * i / segments;
      const sz = -Math.cos(angle) * innerR;
      const sy = Math.sin(angle) * innerR;
      shape.lineTo(sz, sy);
    }
    shape.closePath();

    const extrudeSettings = { depth: depth, bevelEnabled: false };
    const hillGeo = new THREE.ExtrudeGeometry(shape, extrudeSettings);
    const hill = new THREE.Mesh(hillGeo, hillMat);
    // Rotate so extrusion runs along -X (to the left, into the hillside)
    hill.rotation.y = -Math.PI / 2;
    hill.position.set(0, 0, 0);
    hill.receiveShadow = true;
    hill.castShadow = true;
    group.add(hill);

    scene.add(group);
  }

  // ── Scenery: boulders and pine trees ──
  function createDecorations() {
    // Seed-able pseudo-random so scenery is stable across reloads
    let seed = 12345;
    function rand() {
      seed = (seed * 16807 + 0) % 2147483647;
      return (seed - 1) / 2147483646;
    }

    // Track area roughly: x ∈ [-15, 21], z ∈ [-1, 6]
    // Place decorations outside a padded version of that box
    const placements = [
      // Behind the A/B line (negative z)
      { x: -10, z: -4 }, { x: -4, z: -5.5 }, { x: 3, z: -4.5 },
      { x: 8, z: -3.5 }, { x: 14, z: -4 }, { x: 19, z: -3 },
      { x: -7, z: -7 }, { x: 1, z: -8 }, { x: 10, z: -7 },
      { x: 17, z: -6.5 }, { x: 24, z: -5 },
      // Beyond track D / below the layout (large positive z)
      { x: -5, z: 8 }, { x: 2, z: 9 }, { x: 8, z: 8.5 },
      { x: 14, z: 9 }, { x: 20, z: 8 }, { x: 25, z: 7 },
      { x: -2, z: 11 }, { x: 6, z: 12 }, { x: 16, z: 11 },
      // Far left of track A (around the tunnel hill)
      { x: -20, z: -4 }, { x: -22, z: 2 }, { x: -20, z: 6 },
      // Far right of tracks B/C
      { x: 23, z: -1 }, { x: 24, z: 3 }, { x: 22, z: 6 },
    ];

    placements.forEach((p) => {
      // Add slight random jitter
      const jx = p.x + (rand() - 0.5) * 2;
      const jz = p.z + (rand() - 0.5) * 2;

      if (rand() < 0.45) {
        createBoulder(jx, jz, rand);
      } else {
        createPineTree(jx, jz, rand);
      }
    });
  }

  function createBoulder(x, z, rand) {
    const size = 0.4 + rand() * 0.8;
    const geo = new THREE.DodecahedronGeometry(size, 0);
    const mat = new THREE.MeshStandardMaterial({
      color: new THREE.Color().setHSL(0.08, 0.05 + rand() * 0.1, 0.35 + rand() * 0.15),
      roughness: 0.9,
      flatShading: true,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(x, size * 0.4, z);
    mesh.rotation.set(rand() * Math.PI, rand() * Math.PI, rand() * Math.PI);
    // Squash slightly for a natural look
    mesh.scale.set(1 + rand() * 0.3, 0.6 + rand() * 0.4, 1 + rand() * 0.3);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    scene.add(mesh);
  }

  function createPineTree(x, z, rand) {
    const group = new THREE.Group();
    group.position.set(x, 0, z);
    group.rotation.y = rand() * Math.PI * 2;

    const height = 1.8 + rand() * 2.0;
    const trunkRadius = 0.08 + rand() * 0.04;

    // Trunk
    const trunkGeo = new THREE.CylinderGeometry(trunkRadius * 0.6, trunkRadius, height * 0.4, 6);
    const trunkMat = new THREE.MeshStandardMaterial({
      color: 0x5d4037,
      roughness: 0.9,
    });
    const trunk = new THREE.Mesh(trunkGeo, trunkMat);
    trunk.position.y = height * 0.2;
    trunk.castShadow = true;
    group.add(trunk);

    // Foliage: 3 stacked cones, largest at bottom
    const foliageMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color().setHSL(0.28 + rand() * 0.06, 0.6 + rand() * 0.2, 0.25 + rand() * 0.1),
      roughness: 0.8,
      flatShading: true,
    });

    const tiers = 3;
    for (let i = 0; i < tiers; i++) {
      const t = i / tiers;
      const coneRadius = (0.5 + rand() * 0.3) * (1 - t * 0.35);
      const coneHeight = height * (0.3 + rand() * 0.1);
      const coneGeo = new THREE.ConeGeometry(coneRadius, coneHeight, 7);
      const cone = new THREE.Mesh(coneGeo, foliageMat);
      cone.position.y = height * (0.35 + t * 0.22);
      cone.castShadow = true;
      cone.receiveShadow = true;
      group.add(cone);
    }

    scene.add(group);
  }

  // ── Positioning ──
  function positionAllEntities() {
    const locoTrack = GameState.state.locoTrack;
    const coupled = GameState.state.coupled;

    // Restore visibility (meshes may have been hidden by tunnel during victory)
    locoMesh.visible = true;
    for (let id = 1; id <= CONFIG.totalCars; id++) {
      carMeshes[id].visible = true;
    }

    // Position locomotive — on B/C/D, stop so consist contacts siding cars / buffer
    const numSiding = GameState.state.sidings[locoTrack].length;
    const locoPos = Tracks.getLocoStopPosition(locoTrack, coupled.length, numSiding);
    locoMesh.position.x = locoPos.x;
    locoMesh.position.z = locoPos.z;
    locoMesh.rotation.y = Tracks.getTrackRotation(locoTrack);

    // Position coupled cars relative to the loco stop position
    const fillDir = locoTrack === 'A'
      ? new THREE.Vector3(1, 0, 0)
      : (() => { const t = Tracks.definitions[locoTrack]; return new THREE.Vector3(t.dirX, 0, t.dirZ); })();
    coupled.forEach((carId, idx) => {
      const offset = (idx + 1) * CONFIG.slotSpacing;
      const mesh = carMeshes[carId];
      mesh.position.x = locoPos.x + fillDir.x * offset;
      mesh.position.z = locoPos.z + fillDir.z * offset;
      mesh.rotation.y = Tracks.getTrackRotation(locoTrack);
    });

    // Position siding cars
    // B/C/D: pack against buffer stops. A: fill from the far (left) end.
    ['A', 'B', 'C', 'D'].forEach((trackId) => {
      const cars = GameState.state.sidings[trackId];
      cars.forEach((carId, slotIndex) => {
        let pos;
        if (trackId === 'A') {
          const extraOffset = (trackId === locoTrack) ? coupled.length + 1 : 0;
          pos = Tracks.getCarPosition(trackId, slotIndex + extraOffset);
        } else {
          pos = Tracks.getBufferPackedPosition(trackId, slotIndex, cars.length);
        }
        const mesh = carMeshes[carId];
        mesh.position.x = pos.x;
        mesh.position.z = pos.z;
        mesh.rotation.y = Tracks.getTrackRotation(trackId);
      });
    });
  }

  function getLocoMesh() { return locoMesh; }
  function getCarMesh(id) { return carMeshes[id]; }
  function getAllCarMeshes() { return carMeshes; }
  function getClickZones() { return clickZones; }

  return {
    init,
    positionAllEntities,
    getLocoMesh,
    getCarMesh,
    getAllCarMeshes,
    getClickZones,
  };
})();
