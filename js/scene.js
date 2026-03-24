/* ── Three.js Scene Setup ── */

const SceneManager = (() => {
  let scene, camera, renderer, controls;

  function init() {
    const canvas = document.getElementById('gameCanvas');

    // Renderer
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.setClearColor(0x1a1a2e);

    // Scene
    scene = new THREE.Scene();
    scene.fog = new THREE.Fog(0x87ceeb, 20, 180);

    // Camera
    camera = new THREE.PerspectiveCamera(
      45,
      window.innerWidth / window.innerHeight,
      0.1,
      200
    );
    camera.position.set(
      CONFIG.cameraPosition.x,
      CONFIG.cameraPosition.y,
      CONFIG.cameraPosition.z
    );
    camera.lookAt(
      CONFIG.cameraLookAt.x,
      CONFIG.cameraLookAt.y,
      CONFIG.cameraLookAt.z
    );

    // OrbitControls
    controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.1;
    controls.minPolarAngle = 0.3;
    controls.maxPolarAngle = Math.PI / 2.2;
    controls.minDistance = 8;
    controls.maxDistance = 50;
    controls.target.set(
      CONFIG.cameraLookAt.x,
      CONFIG.cameraLookAt.y,
      CONFIG.cameraLookAt.z
    );

    // Lighting
    const ambient = new THREE.AmbientLight(0xffffff, 0.4);
    scene.add(ambient);

    const sunPos = new THREE.Vector3(20, 40, 15);
    const directional = new THREE.DirectionalLight(0xffffff, 1.0);
    directional.position.copy(sunPos);
    directional.castShadow = true;
    directional.shadow.mapSize.set(2048, 2048);
    directional.shadow.camera.left = -30;
    directional.shadow.camera.right = 30;
    directional.shadow.camera.top = 30;
    directional.shadow.camera.bottom = -30;
    scene.add(directional);

    // Sky Dome
    createSkyDome(sunPos);

    // Ground plane
    const groundGeo = new THREE.PlaneGeometry(CONFIG.groundSize, CONFIG.groundSize);
    const groundTexture = createGroundTexture();
    const groundMat = new THREE.MeshStandardMaterial({
      map: groundTexture,
      roughness: 0.9,
    });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.05;
    ground.receiveShadow = true;
    scene.add(ground);

    // Handle resize
    window.addEventListener('resize', onResize);

    return { scene, camera, renderer, controls };
  }

  function createSkyDome(sunPos) {
    const geo = new THREE.SphereGeometry(90, 32, 32);
    const mat = new THREE.MeshBasicMaterial({
      side: THREE.BackSide,
      map: createSkyTexture(sunPos),
      fog: false,
    });
    const sky = new THREE.Mesh(geo, mat);
    scene.add(sky);

    // Sun mesh (visual only, light is separate)
    const sunGeo = new THREE.SphereGeometry(3, 16, 16);
    const sunMat = new THREE.MeshBasicMaterial({ color: 0xffffee });
    const sunMesh = new THREE.Mesh(sunGeo, sunMat);
    sunMesh.position.copy(sunPos);
    scene.add(sunMesh);

    // Glow for sun
    const glowGeo = new THREE.SphereGeometry(6, 16, 16);
    const glowMat = new THREE.MeshBasicMaterial({
      color: 0xffffaa,
      transparent: true,
      opacity: 0.3,
    });
    const glow = new THREE.Mesh(glowGeo, glowMat);
    glow.position.copy(sunPos);
    scene.add(glow);
  }

  function createSkyTexture(sunPos) {
    const res = 1024;
    const canvas = document.createElement('canvas');
    canvas.width = res * 2;
    canvas.height = res;
    const ctx = canvas.getContext('2d');

    // Sky gradient (Blue to light blue)
    const grad = ctx.createLinearGradient(0, res, 0, 0);
    grad.addColorStop(0, '#ffffff');   // Horizon
    grad.addColorStop(0.3, '#87ceeb'); // Mid-sky
    grad.addColorStop(1, '#1e90ff');   // Top
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, res * 2, res);

    // Clouds
    for (let i = 0; i < 80; i++) {
      const x = Math.random() * res * 2;
      const y = Math.random() * res * 0.5;
      const w = 100 + Math.random() * 200;
      const h = w * (0.2 + Math.random() * 0.2);
      
      const opacity = 0.4 + Math.random() * 0.5;
      ctx.fillStyle = `rgba(255, 255, 255, ${opacity})`;

      const puffs = 4 + Math.floor(Math.random() * 4);
      for (let j = 0; j < puffs; j++) {
        const ox = (Math.random() - 0.5) * (w * 0.6);
        const oy = (Math.random() - 0.5) * (h * 0.4);
        const sw = w * (0.4 + Math.random() * 0.4);
        const sh = h * (0.4 + Math.random() * 0.4);
        ctx.beginPath();
        ctx.ellipse(x + ox, y + oy, sw / 2, sh / 2, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Bloom around sun in the texture
    const sunPhi = Math.atan2(sunPos.z, sunPos.x);
    const sunTheta = Math.acos(sunPos.y / sunPos.length());
    const sunU = 1 - (sunPhi / (Math.PI * 2) + 0.5);
    const sunV = 1 - (sunTheta / Math.PI);
    const sunX = sunU * res * 2;
    const sunY = (1 - sunV) * res;

    const sunGrad = ctx.createRadialGradient(
      sunX, sunY, 0,
      sunX, sunY, 400
    );
    sunGrad.addColorStop(0, 'rgba(255, 255, 224, 0.5)');
    sunGrad.addColorStop(1, 'rgba(255, 255, 224, 0)');
    ctx.fillStyle = sunGrad;
    ctx.fillRect(0, 0, res * 2, res);

    const texture = new THREE.CanvasTexture(canvas);
    return texture;
  }

  function createGroundTexture() {
    const res = 1024;
    const canvas = document.createElement('canvas');
    canvas.width = res;
    canvas.height = res;
    const ctx = canvas.getContext('2d');

    const worldToCanvas = (x, z) => {
      // Map world coords [-30, 30] to canvas coords [0, 1024]
      const u = ((x + CONFIG.groundSize / 2) / CONFIG.groundSize) * res;
      const v = ((z + CONFIG.groundSize / 2) / CONFIG.groundSize) * res;
      return { u, v };
    };

    // 1. Fill with Grass
    ctx.fillStyle = '#3d5c2e';
    ctx.fillRect(0, 0, res, res);

    // Grassy variation
    for (let i = 0; i < 4000; i++) {
      const x = Math.random() * res;
      const y = Math.random() * res;
      const size = 1 + Math.random() * 3;
      ctx.fillStyle = Math.random() > 0.5 ? '#4a6b3a' : '#324d25';
      ctx.fillRect(x, y, size, size);
    }

    // 2. Draw Gravel Path
    // Draw twice: a wider, softer base and a sharper inner path
    const drawPath = (width, color, blur) => {
      ctx.strokeStyle = color;
      ctx.lineWidth = (width / CONFIG.groundSize) * res;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.shadowBlur = blur ? (blur / CONFIG.groundSize) * res : 0;
      ctx.shadowColor = color;

      ctx.beginPath();
      ['A', 'B', 'C', 'D'].forEach((id) => {
        const s = Tracks.getTrackStart(id);
        const e = Tracks.getTrackEnd(id);
        const c1 = worldToCanvas(s.x, s.z);
        const c2 = worldToCanvas(e.x, e.z);
        ctx.moveTo(c1.u, c1.v);
        ctx.lineTo(c2.u, c2.v);
      });
      Tracks.connectors.forEach((seg) => {
        const c1 = worldToCanvas(seg.from.x, seg.from.z);
        const c2 = worldToCanvas(seg.to.x, seg.to.z);
        ctx.moveTo(c1.u, c1.v);
        ctx.lineTo(c2.u, c2.v);
      });
      ctx.stroke();
    };

    // Soft transition gravel
    drawPath(4.5, '#4a4a4a', 2.0);
    // Main gravel bed
    drawPath(2.8, '#666666', 0.5);

    // 3. Texture noise for gravel
    ctx.shadowBlur = 0;
    for (let i = 0; i < 8000; i++) {
      // Very simple: just sprinkle some dots everywhere, 
      // but we'll use a blend mode to make them only show up well on the gray
      ctx.globalCompositeOperation = 'overlay';
      const x = Math.random() * res;
      const y = Math.random() * res;
      ctx.fillStyle = Math.random() > 0.5 ? '#ffffff' : '#000000';
      ctx.fillRect(x, y, 1, 1);
    }
    ctx.globalCompositeOperation = 'source-over';

    const texture = new THREE.CanvasTexture(canvas);
    texture.anisotropy = 8;
    return texture;
  }

  function onResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  }

  function render() {
    controls.update();
    renderer.render(scene, camera);
  }

  return { init, render, getScene: () => scene, getCamera: () => camera, getRenderer: () => renderer };
})();
