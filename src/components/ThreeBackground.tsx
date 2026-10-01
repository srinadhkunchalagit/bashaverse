import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';

interface ThreeBackgroundProps {
  intensity?: 'vibrant' | 'subtle' | 'off';
  theme?: 'cosmos' | 'cyber' | 'aurora';
}

export const ThreeBackground: React.FC<ThreeBackgroundProps> = ({
  intensity = 'vibrant',
}) => {
  const mountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (typeof window === 'undefined' || intensity === 'off' || !mountRef.current) return;

    const container = mountRef.current;
    let animationFrameId: number;

    // Scene, Camera, Renderer
    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x070d1e, 0.0015);

    const camera = new THREE.PerspectiveCamera(
      55,
      window.innerWidth / window.innerHeight,
      0.1,
      2000
    );
    camera.position.z = 320;
    camera.position.y = 40;

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance',
    });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    // Group for entire interactive world
    const worldGroup = new THREE.Group();
    scene.add(worldGroup);

    // 1. Core Rotating Wireframe Globe
    const globeRadius = 110;
    const sphereGeo = new THREE.SphereGeometry(globeRadius, 36, 36);
    const wireframeMat = new THREE.MeshBasicMaterial({
      color: 0x224c85,
      wireframe: true,
      transparent: true,
      opacity: 0.16,
    });
    const globeMesh = new THREE.Mesh(sphereGeo, wireframeMat);
    worldGroup.add(globeMesh);

    // 2. Inner glowing core
    const innerCoreGeo = new THREE.SphereGeometry(globeRadius * 0.96, 24, 24);
    const innerCoreMat = new THREE.MeshBasicMaterial({
      color: 0x091c36,
      transparent: true,
      opacity: 0.45,
    });
    const innerCore = new THREE.Mesh(innerCoreGeo, innerCoreMat);
    worldGroup.add(innerCore);

    // 3. Globe Node Points (Major linguistic and cultural hubs)
    const hubCoords = [
      { name: 'Delhi', lat: 28.61, lon: 77.2 },
      { name: 'Mumbai', lat: 19.07, lon: 72.87 },
      { name: 'Hyderabad', lat: 17.38, lon: 78.48 },
      { name: 'Chennai', lat: 13.08, lon: 80.27 },
      { name: 'Kolkata', lat: 22.57, lon: 88.36 },
      { name: 'Tokyo', lat: 35.67, lon: 139.65 },
      { name: 'London', lat: 51.5, lon: -0.12 },
      { name: 'Paris', lat: 48.85, lon: 2.35 },
      { name: 'New York', lat: 40.71, lon: -74.0 },
      { name: 'Dubai', lat: 25.2, lon: 55.27 },
      { name: 'São Paulo', lat: -23.55, lon: -46.63 },
      { name: 'Cairo', lat: 30.04, lon: 31.23 },
      { name: 'Nairobi', lat: -1.29, lon: 36.82 },
      { name: 'Sydney', lat: -33.86, lon: 151.2 },
      { name: 'Singapore', lat: 1.35, lon: 103.81 },
      { name: 'Seoul', lat: 37.56, lon: 126.97 },
      { name: 'Berlin', lat: 52.52, lon: 13.4 },
      { name: 'Madrid', lat: 40.41, lon: -3.7 },
      { name: 'Toronto', lat: 43.65, lon: -79.38 },
      { name: 'Buenos Aires', lat: -34.6, lon: -58.38 },
    ];

    function latLonToVector3(lat: number, lon: number, radius: number): THREE.Vector3 {
      const phi = (90 - lat) * (Math.PI / 180);
      const theta = (lon + 180) * (Math.PI / 180);
      const x = -(radius * Math.sin(phi) * Math.cos(theta));
      const z = radius * Math.sin(phi) * Math.sin(theta);
      const y = radius * Math.cos(phi);
      return new THREE.Vector3(x, y, z);
    }

    // Add glowing beacon for each hub
    const nodeGeometry = new THREE.SphereGeometry(1.8, 12, 12);
    const nodeMaterial = new THREE.MeshBasicMaterial({ color: 0x38bdf8 });
    const indianNodeMaterial = new THREE.MeshBasicMaterial({ color: 0xf59e0b });

    const hubPositions: THREE.Vector3[] = [];

    hubCoords.forEach((hub, index) => {
      const pos = latLonToVector3(hub.lat, hub.lon, globeRadius + 1.2);
      hubPositions.push(pos);
      const node = new THREE.Mesh(nodeGeometry, index < 5 ? indianNodeMaterial : nodeMaterial);
      node.position.copy(pos);
      worldGroup.add(node);

      // Node subtle halo
      const haloGeo = new THREE.RingGeometry(2.5, 3.8, 16);
      const haloMat = new THREE.MeshBasicMaterial({
        color: index < 5 ? 0xf59e0b : 0x06b6d4,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.4,
      });
      const halo = new THREE.Mesh(haloGeo, haloMat);
      halo.position.copy(pos);
      halo.lookAt(new THREE.Vector3(0, 0, 0));
      worldGroup.add(halo);
    });

    // 4. Arc curves connecting hubs (Translation flow pathways)
    const arcCurves: THREE.CatmullRomCurve3[] = [];
    const arcMaterials: THREE.LineBasicMaterial[] = [];

    const connections = [
      [0, 5], // Delhi -> Tokyo
      [0, 6], // Delhi -> London
      [0, 9], // Delhi -> Dubai
      [1, 8], // Mumbai -> New York
      [2, 14], // Hyderabad -> Singapore
      [3, 13], // Chennai -> Sydney
      [4, 11], // Kolkata -> Cairo
      [6, 8], // London -> New York
      [7, 10], // Paris -> São Paulo
      [9, 12], // Dubai -> Nairobi
      [8, 19], // New York -> Buenos Aires
      [5, 15], // Tokyo -> Seoul
      [0, 1], // Delhi -> Mumbai
      [0, 2], // Delhi -> Hyderabad
    ];

    connections.forEach(([fromIdx, toIdx], i) => {
      const start = hubPositions[fromIdx];
      const end = hubPositions[toIdx];
      if (!start || !end) return;

      const mid = new THREE.Vector3()
        .addVectors(start, end)
        .multiplyScalar(0.5);
      const distance = start.distanceTo(end);
      const elevation = Math.min(distance * 0.35, 45);
      mid.normalize().multiplyScalar(globeRadius + elevation);

      const curve = new THREE.CatmullRomCurve3([start, mid, end]);
      arcCurves.push(curve);

      const points = curve.getPoints(40);
      const lineGeometry = new THREE.BufferGeometry().setFromPoints(points);
      const lineMaterial = new THREE.LineBasicMaterial({
        color: i % 2 === 0 ? 0x00f0ff : 0xec4899,
        transparent: true,
        opacity: 0.35,
      });
      arcMaterials.push(lineMaterial);
      const line = new THREE.Line(lineGeometry, lineMaterial);
      worldGroup.add(line);
    });

    // 5. Traveling pulse photons along the curves
    const pulseCount = arcCurves.length;
    const pulseMeshes: THREE.Mesh[] = [];
    const pulseGeometry = new THREE.SphereGeometry(1.6, 8, 8);
    const pulseMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff });

    for (let i = 0; i < pulseCount; i++) {
      const p = new THREE.Mesh(pulseGeometry, pulseMaterial);
      worldGroup.add(p);
      pulseMeshes.push(p);
    }

    // 6. Orbiting Language Equatorial Rings
    const ringGeo = new THREE.TorusGeometry(globeRadius * 1.3, 0.4, 8, 80);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0x3b82f6,
      transparent: true,
      opacity: 0.22,
    });
    const ring1 = new THREE.Mesh(ringGeo, ringMat);
    ring1.rotation.x = Math.PI / 3;
    worldGroup.add(ring1);

    const ring2 = new THREE.Mesh(
      new THREE.TorusGeometry(globeRadius * 1.5, 0.3, 8, 80),
      new THREE.MeshBasicMaterial({
        color: 0xa855f7,
        transparent: true,
        opacity: 0.18,
      })
    );
    ring2.rotation.y = Math.PI / 4;
    ring2.rotation.x = -Math.PI / 6;
    worldGroup.add(ring2);

    // 7. Ambient Particle Starfield
    const starCount = 650;
    const starGeometry = new THREE.BufferGeometry();
    const starPositions = new Float32Array(starCount * 3);
    const starColors = new Float32Array(starCount * 3);

    for (let i = 0; i < starCount; i++) {
      const i3 = i * 3;
      const dist = 180 + Math.random() * 450;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(Math.random() * 2 - 1);

      starPositions[i3] = dist * Math.sin(phi) * Math.cos(theta);
      starPositions[i3 + 1] = dist * Math.sin(phi) * Math.sin(theta);
      starPositions[i3 + 2] = dist * Math.cos(phi);

      // Palette of cyan, soft purple, gold, and white
      const randColor = Math.random();
      if (randColor < 0.4) {
        starColors[i3] = 0.22;
        starColors[i3 + 1] = 0.74;
        starColors[i3 + 2] = 0.97;
      } else if (randColor < 0.7) {
        starColors[i3] = 0.65;
        starColors[i3 + 1] = 0.33;
        starColors[i3 + 2] = 0.96;
      } else {
        starColors[i3] = 0.96;
        starColors[i3 + 1] = 0.62;
        starColors[i3 + 2] = 0.07;
      }
    }

    starGeometry.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
    starGeometry.setAttribute('color', new THREE.BufferAttribute(starColors, 3));

    const starMaterial = new THREE.PointsMaterial({
      size: 2.2,
      vertexColors: true,
      transparent: true,
      opacity: 0.75,
      sizeAttenuation: true,
    });
    const starField = new THREE.Points(starGeometry, starMaterial);
    scene.add(starField);

    // Mouse Parallax
    let mouseX = 0;
    let mouseY = 0;
    let targetX = 0;
    let targetY = 0;

    const handleMouseMove = (e: MouseEvent) => {
      const windowHalfX = window.innerWidth / 2;
      const windowHalfY = window.innerHeight / 2;
      mouseX = (e.clientX - windowHalfX) * 0.0008;
      mouseY = (e.clientY - windowHalfY) * 0.0008;
    };

    window.addEventListener('mousemove', handleMouseMove, { passive: true });

    const handleResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    };

    window.addEventListener('resize', handleResize);

    // Animation Loop
    let clock = new THREE.Clock();

    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);
      const elapsedTime = clock.getElapsedTime();

      // Smooth camera parallax
      targetX += (mouseX - targetX) * 0.05;
      targetY += (mouseY - targetY) * 0.05;
      camera.position.x = targetX * 120;
      camera.position.y = 40 - targetY * 100;
      camera.lookAt(0, 0, 0);

      // Rotate Globe & Rings
      worldGroup.rotation.y = elapsedTime * 0.08;
      globeMesh.rotation.x = Math.sin(elapsedTime * 0.1) * 0.04;
      ring1.rotation.z = elapsedTime * 0.04;
      ring2.rotation.z = -elapsedTime * 0.05;
      starField.rotation.y = elapsedTime * 0.012;

      // Animate pulses along curves
      for (let i = 0; i < pulseCount; i++) {
        const curve = arcCurves[i];
        const pulse = pulseMeshes[i];
        if (curve && pulse) {
          const t = ((elapsedTime * 0.45 + i * 0.18) % 1);
          const point = curve.getPoint(t);
          pulse.position.copy(point);
        }
      }

      renderer.render(scene, camera);
    };

    animate();

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('resize', handleResize);
      renderer.dispose();
      globeGeoDispose(sphereGeo, wireframeMat, starGeometry, starMaterial);
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, [intensity]);

  function globeGeoDispose(
    geo: THREE.BufferGeometry,
    mat: THREE.Material,
    starsGeo: THREE.BufferGeometry,
    starsMat: THREE.Material
  ) {
    geo.dispose();
    mat.dispose();
    starsGeo.dispose();
    starsMat.dispose();
  }

  return (
    <div
      ref={mountRef}
      className="fixed inset-0 pointer-events-none -z-10 overflow-hidden select-none bg-gradient-to-b from-[#070c1b] via-[#0c1429] to-[#060a17]"
      aria-hidden="true"
    />
  );
};
