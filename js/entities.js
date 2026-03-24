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
    
    // Water tower on the opposite side of track A, further from the tunnel entrance
    createWaterTower(-12.0, -2.8);

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

    // Arch: build from a semicircle of stone blocks
    // Internal radius is kept at 1.375 units; new center at 1.645 with 0.54 size
    const archRadius = 1.645;
    const archSegments = 9;
    for (let i = 0; i <= archSegments; i++) {
      const angle = (Math.PI * i) / archSegments;
      const bx = 0;
      const by = 1.6 + Math.sin(angle) * archRadius;
      const bz = Math.cos(angle) * archRadius;
      const blockGeo = new THREE.BoxGeometry(1.2, 0.54, 0.54);
      const block = new THREE.Mesh(blockGeo, stoneMat);
      block.position.set(bx, by, bz);
      block.rotation.x = angle - Math.PI / 2;
      block.castShadow = true;
      block.receiveShadow = true;
      group.add(block);
    }

    // Keystone at the top of the arch
    const keystoneGeo = new THREE.BoxGeometry(1.3, 0.66, 0.66);
    const keystone = new THREE.Mesh(keystoneGeo, darkStoneMat);
    keystone.position.set(0, 3.255, 0);
    keystone.castShadow = true;
    group.add(keystone);

    // Stone walls on either side of the arch
    for (const side of [-1, 1]) {
      const wallGeo = new THREE.BoxGeometry(1.2, 3.2, 0.72);
      const wall = new THREE.Mesh(wallGeo, stoneMat);
      wall.position.set(0, 1.6, side * 1.86);
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
    const holeR = 1.9; // Reduced as requested
    const wallH = 1.6; // Height of the vertical stone walls
    const depth = 5.0;
    const segments = 10;

    const shape = new THREE.Shape();
    // 1. Outer shell: from Z = -outerR to Z = +outerR
    for (let i = 0; i <= segments; i++) {
      const angle = (Math.PI * i) / segments;
      const sz = -Math.cos(angle) * outerR;
      const sy = Math.sin(angle) * outerR;
      if (i === 0) shape.moveTo(sz, sy);
      else shape.lineTo(sz, sy);
    }
    
    // 2. Inner "cutout" hole: from Z = +holeR back to Z = -holeR
    // This part is drawn in reverse (clockwise) to create a hole
    shape.lineTo(holeR, 0); // Ground right
    shape.lineTo(holeR, wallH); // Wall up
    for (let i = 0; i <= segments; i++) {
      const angle = (Math.PI * i) / segments;
      const sz = Math.cos(angle) * holeR;
      const sy = wallH + Math.sin(angle) * holeR;
      shape.lineTo(sz, sy);
    }
    shape.lineTo(-holeR, 0); // Wall down to ground left
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

  function createWaterTower(x, z) {
    const group = new THREE.Group();
    group.position.set(x, 0, z);

    const woodMat = new THREE.MeshStandardMaterial({
      color: 0x7d5c42,
      roughness: 0.9,
    });
    const metalMat = new THREE.MeshStandardMaterial({
      color: 0x444444,
      metalness: 0.5,
      roughness: 0.5,
    });
    const roofMat = new THREE.MeshStandardMaterial({
      color: 0x222222,
      roughness: 0.8,
    });

    // 4 Support Legs
    const legGeo = new THREE.BoxGeometry(0.2, 3.2, 0.2);
    for (let lx = -0.8; lx <= 0.8; lx += 1.6) {
      for (let lz = -0.8; lz <= 0.8; lz += 1.6) {
        const leg = new THREE.Mesh(legGeo, woodMat);
        leg.position.set(lx, 1.6, lz);
        leg.castShadow = true;
        leg.receiveShadow = true;
        group.add(leg);
      }
    }

    // Cross braces
    const braceGeo = new THREE.BoxGeometry(1.8, 0.1, 0.1);
    for (let i = 0; i < 2; i++) {
      const brace = new THREE.Mesh(braceGeo, woodMat);
      brace.position.y = 1.0 + i * 1.2;
      brace.rotation.y = Math.PI / 4;
      group.add(brace);
      const brace2 = brace.clone();
      brace2.rotation.y = -Math.PI / 4;
      group.add(brace2);
    }

    // Platform
    const platGeo = new THREE.BoxGeometry(2.2, 0.2, 2.2);
    const plat = new THREE.Mesh(platGeo, woodMat);
    plat.position.y = 3.3;
    plat.castShadow = true;
    plat.receiveShadow = true;
    group.add(plat);

    // Cylindrical Tank (Wooden slats)
    const tankGeo = new THREE.CylinderGeometry(1.3, 1.3, 2.8, 16);
    const tank = new THREE.Mesh(tankGeo, woodMat);
    tank.position.y = 3.4 + 1.4;
    tank.castShadow = true;
    tank.receiveShadow = true;
    group.add(tank);

    // Metal Hoops around the tank
    for (let h = 0; h < 3; h++) {
      const hoopGeo = new THREE.TorusGeometry(1.31, 0.04, 8, 24);
      const hoop = new THREE.Mesh(hoopGeo, metalMat);
      hoop.position.y = 3.4 + 0.5 + h * 0.9;
      hoop.rotation.x = Math.PI / 2;
      group.add(hoop);
    }

    // Conical Roof
    const roofGeo = new THREE.ConeGeometry(1.6, 1.2, 16);
    const roof = new THREE.Mesh(roofGeo, roofMat);
    roof.position.y = 3.4 + 2.8 + 0.6;
    roof.castShadow = true;
    group.add(roof);

    // Spout / Pipe assembly
    const spoutGroup = new THREE.Group();
    spoutGroup.position.set(0, 4.2, -1.3);
    
    // Horizontal pivot pipe
    const pivotGeo = new THREE.CylinderGeometry(0.15, 0.15, 0.6, 8);
    const pivot = new THREE.Mesh(pivotGeo, metalMat);
    pivot.rotation.z = Math.PI / 2;
    spoutGroup.add(pivot);

    // Diagonally angled spout
    const spoutGeo = new THREE.CylinderGeometry(0.18, 0.12, 2.2, 8);
    const spout = new THREE.Mesh(spoutGeo, metalMat);
    spout.position.set(0, -0.6, -0.8);
    spout.rotation.x = -Math.PI / 3;
    spout.castShadow = true;
    spoutGroup.add(spout);

    group.add(spoutGroup);

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
      { x: -4, z: -5.5 }, { x: 3, z: -4.5 }, { x: -1, z: -6 }, { x: 6, z: -5.5 },
      { x: 8, z: -3.5 }, { x: 14, z: -4 }, { x: 19, z: -3 }, { x: 11, z: -4.5 },
      { x: -7, z: -7 }, { x: 1, z: -8 }, { x: 10, z: -7 }, { x: 4, z: -9 },
      { x: 17, z: -6.5 }, { x: 24, z: -5 }, { x: 21, z: -7.5 }, { x: 13, z: -8.5 },
      { x: -10, z: -8 }, { x: -15, z: -7 },
      // Beyond track D / below the layout (large positive z)
      { x: -5, z: 8 }, { x: 2, z: 9 }, { x: 8, z: 8.5 }, { x: -1, z: 10 },
      { x: 14, z: 9 }, { x: 20, z: 8 }, { x: 25, z: 7 }, { x: 11, z: 11 },
      { x: -2, z: 11 }, { x: 6, z: 12 }, { x: 16, z: 11 }, { x: 22, z: 10.5 },
      { x: -8, z: 12 }, { x: 1, z: 14 }, { x: 12, z: 13.5 },
      // Far left of track A (around the tunnel hill)
      { x: -20, z: -4 }, { x: -22, z: 2 }, { x: -20, z: 6 }, { x: -24, z: -2 },
      { x: -25, z: 4 }, { x: -23, z: 8 }, { x: -18, z: 9 },
      // Hillside trees (elevated)
      { x: -17, z: -4, y: 3.5 }, { x: -17, z: 4, y: 3.5 }, { x: -18, z: 0, y: 5.5 },
      // Far right of tracks B/C
      { x: 23, z: -1 }, { x: 24, z: 3 }, { x: 22, z: 6 }, { x: 26, z: 1 },
      { x: 27, z: 5 }, { x: 25, z: -3 },
    ];

    placements.forEach((p) => {
      // Add slight random jitter
      const jx = p.x + (rand() - 0.5) * 2;
      const jz = p.z + (rand() - 0.5) * 2;
      const jy = p.y || 0; // Use explicit elevation or 0

      if (rand() < 0.35) { // Adjusted to keep tree density higher
        createBoulder(jx, jz, rand, jy);
      } else {
        createPineTree(jx, jz, rand, jy);
      }
    });
  }

  function createBoulder(x, z, rand, yOffset = 0) {
    const size = 0.4 + rand() * 0.8;
    const geo = new THREE.DodecahedronGeometry(size, 0);
    const mat = new THREE.MeshStandardMaterial({
      color: new THREE.Color().setHSL(0.08, 0.05 + rand() * 0.1, 0.35 + rand() * 0.15),
      roughness: 0.9,
      flatShading: true,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(x, size * 0.4 + yOffset, z);
    mesh.rotation.set(rand() * Math.PI, rand() * Math.PI, rand() * Math.PI);
    // Squash slightly for a natural look
    mesh.scale.set(1 + rand() * 0.3, 0.6 + rand() * 0.4, 1 + rand() * 0.3);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    scene.add(mesh);
  }

  function createPineTree(x, z, rand, yOffset = 0) {
    const group = new THREE.Group();
    group.position.set(x, yOffset, z);
    group.rotation.y = rand() * Math.PI * 2;

    const height = 1.8 + rand() * 9.6; // From 1.8 up to ~11.4 (3x current max)
    const widthScale = 0.5 + (height / 11.4) * 0.5; // Wider base for taller trees
    const trunkRadius = (0.08 + rand() * 0.04) * widthScale * (height / 3.8);

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
      const coneRadius = (0.5 + rand() * 0.3) * widthScale * (height / 3.8) * (1 - t * 0.35);
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
