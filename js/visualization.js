const VisualizationEngine = (() => {
  
  let scene, camera, renderer, controls;
  let earthMesh, orbitLine, satelliteMesh;
  let animationFrameId = null;
  let isAnimating = false;
  let animationProgress = 0;
  let currentTrajectoryData = null;
  
  const init = (canvasId) => {
    const canvas = document.getElementById(canvasId);
    if (!canvas) {
      console.error('Canvas element not found');
      return false;
    }
    
    setupScene(canvas);
    setupCamera(canvas);
    setupRenderer(canvas);
    setupLights();
    setupEarth();
    setupControls();
    
    window.addEventListener('resize', handleResize);
    
    animate();
    
    return true;
  };

  const setupScene = (canvas) => {
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0a0e27);
    
    const ambientLight = new THREE.AmbientLight(0x404040, 0.5);
    scene.add(ambientLight);
  };

  const setupCamera = (canvas) => {
    const aspect = canvas.clientWidth / canvas.clientHeight;
    camera = new THREE.PerspectiveCamera(45, aspect, 100, 100000);
    camera.position.set(20000, 10000, 20000);
    camera.lookAt(0, 0, 0);
  };

  const setupRenderer = (canvas) => {
    renderer = new THREE.WebGLRenderer({
      canvas: canvas,
      antialias: true,
      alpha: true,
      preserveDrawingBuffer: true
    });
    
    renderer.setSize(canvas.clientWidth, canvas.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  };

  const setupLights = () => {
    const sunLight = new THREE.DirectionalLight(0xffffff, 1.5);
    sunLight.position.set(50000, 0, 0);
    scene.add(sunLight);
    
    const fillLight = new THREE.DirectionalLight(0x8888ff, 0.3);
    fillLight.position.set(-50000, 0, 0);
    scene.add(fillLight);
  };

  const setupEarth = () => {
    const geometry = new THREE.SphereGeometry(6371, 64, 64);
    
    const textureLoader = new THREE.TextureLoader();
    const earthTexture = textureLoader.load(
      'https://unpkg.com/three-globe/example/img/earth-blue-marble.jpg',
      () => {
        console.log('Earth texture loaded');
      },
      undefined,
      (error) => {
        console.error('Earth texture load failed:', error);
        earthMesh.material = new THREE.MeshPhongMaterial({ color: 0x2233ff });
      }
    );
    
    const material = new THREE.MeshPhongMaterial({
      map: earthTexture,
      shininess: 5
    });
    
    earthMesh = new THREE.Mesh(geometry, material);
    scene.add(earthMesh);
    
    const axesHelper = new THREE.AxesHelper(10000);
    scene.add(axesHelper);
    
    const gridHelper = new THREE.PolarGridHelper(20000, 16, 8, 64, 0x444444, 0x222222);
    gridHelper.rotation.x = Math.PI / 2;
    scene.add(gridHelper);
  };

  const setupControls = () => {
    controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.1;
    controls.minDistance = 7000;
    controls.maxDistance = 80000;
    controls.enablePan = true;
    controls.rotateSpeed = 0.5;
    controls.zoomSpeed = 1.2;
  };

  const renderOrbit = (elements, trajectory) => {
    clearOrbit();
    
    currentTrajectoryData = trajectory;
    
    const points = trajectory.map(point => 
      new THREE.Vector3(point.position.x, point.position.y, point.position.z)
    );
    
    const { perigee } = OrbitalMath.calculateApogeePerigee(elements.a, elements.e);
    const stability = OrbitalMath.getOrbitStability(perigee);
    
    const colors = {
      stable: 0x00ff88,
      marginal: 0xffbe0b,
      decay: 0xff006e
    };
    
    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    const material = new THREE.LineBasicMaterial({
      color: colors[stability] || 0x00d9ff,
      linewidth: 2
    });
    
    orbitLine = new THREE.Line(geometry, material);
    scene.add(orbitLine);
    
    if (!satelliteMesh) {
      const satGeometry = new THREE.ConeGeometry(100, 300, 8);
      const satMaterial = new THREE.MeshPhongMaterial({ color: 0xffffff });
      satelliteMesh = new THREE.Mesh(satGeometry, satMaterial);
      scene.add(satelliteMesh);
    }
    
    const firstPoint = trajectory[0].position;
    satelliteMesh.position.set(firstPoint.x, firstPoint.y, firstPoint.z);
    
    const direction = new THREE.Vector3(
      trajectory[0].velocity.x,
      trajectory[0].velocity.y,
      trajectory[0].velocity.z
    ).normalize();
    satelliteMesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction);
  };

  const updateOrbitPreview = (elements) => {
    const validation = OrbitalMath.validateOrbitalElements(elements);
    if (!validation.valid) return;
    
    const period = OrbitalMath.calculateOrbitalPeriod(elements.a);
    const trajectory = OrbitalMath.propagateOrbitRK4(elements, period, period / 50);
    
    renderOrbit(elements, trajectory);
  };

  const animateOrbit = (trajectory, speed = 1) => {
    if (isAnimating) {
      isAnimating = false;
      return;
    }
    
    if (!trajectory || trajectory.length === 0) return;
    
    isAnimating = true;
    animationProgress = 0;
    
    const animateStep = () => {
      if (!isAnimating) return;
      
      const index = Math.floor(animationProgress);
      if (index >= trajectory.length - 1) {
        animationProgress = 0;
      }
      
      const point = trajectory[index].position;
      const nextPoint = trajectory[Math.min(index + 1, trajectory.length - 1)].position;
      
      const t = animationProgress - index;
      satelliteMesh.position.set(
        point.x + (nextPoint.x - point.x) * t,
        point.y + (nextPoint.y - point.y) * t,
        point.z + (nextPoint.z - point.z) * t
      );
      
      const direction = new THREE.Vector3(
        nextPoint.x - point.x,
        nextPoint.y - point.y,
        nextPoint.z - point.z
      ).normalize();
      satelliteMesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction);
      
      animationProgress += speed * 0.5;
      
      requestAnimationFrame(animateStep);
    };
    
    animateStep();
  };

  const clearOrbit = () => {
    if (orbitLine) {
      scene.remove(orbitLine);
      orbitLine.geometry.dispose();
      orbitLine.material.dispose();
      orbitLine = null;
    }
  };

  const exportScreenshot = (width = 1280, height = 720) => {
    const originalWidth = renderer.domElement.width;
    const originalHeight = renderer.domElement.height;
    
    renderer.setSize(width, height);
    renderer.render(scene, camera);
    
    const dataURL = renderer.domElement.toDataURL('image/png');
    
    const link = document.createElement('a');
    link.download = `orbit_visualization_${Date.now()}.png`;
    link.href = dataURL;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    renderer.setSize(originalWidth, originalHeight);
  };

  const animate = () => {
    animationFrameId = requestAnimationFrame(animate);
    
    if (controls) {
      controls.update();
    }
    
    if (earthMesh) {
      earthMesh.rotation.y += 0.001;
    }
    
    renderer.render(scene, camera);
  };

  const handleResize = () => {
    const canvas = renderer.domElement;
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    
    renderer.setSize(width, height);
  };

  const dispose = () => {
    if (animationFrameId) {
      cancelAnimationFrame(animationFrameId);
    }
    
    window.removeEventListener('resize', handleResize);
    
    if (controls) {
      controls.dispose();
    }
    
    if (renderer) {
      renderer.dispose();
    }
    
    clearOrbit();
    
    if (scene) {
      scene.traverse(object => {
        if (object.geometry) object.geometry.dispose();
        if (object.material) {
          if (Array.isArray(object.material)) {
            object.material.forEach(material => material.dispose());
          } else {
            object.material.dispose();
          }
        }
      });
    }
  };

  return {
    init,
    renderOrbit,
    updateOrbitPreview,
    animateOrbit,
    exportScreenshot,
    dispose
  };
})();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = VisualizationEngine;
}