"use client";

import { useRef, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Stars, Line } from '@react-three/drei';
import * as THREE from 'three';

function VectorClockNetwork() {
  const group = useRef<THREE.Group>(null);

  // Generate some deterministic "nodes" for our services
  const nodes = useMemo(() => {
    return [
      new THREE.Vector3(-2, 1, -1),
      new THREE.Vector3(2, 0.5, 1),
      new THREE.Vector3(0, -1, 2),
      new THREE.Vector3(-1, -2, -1.5),
      new THREE.Vector3(1.5, -1.5, -0.5),
    ];
  }, []);

  // Generate connecting lines
  const lines = useMemo(() => {
    const l = [];
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        // Only connect some nodes
        if (Math.random() > 0.3) {
          l.push([nodes[i], nodes[j]]);
        }
      }
    }
    return l;
  }, [nodes]);

  useFrame((state) => {
    if (group.current) {
      group.current.rotation.y = state.clock.elapsedTime * 0.05;
      group.current.rotation.x = Math.sin(state.clock.elapsedTime * 0.1) * 0.1;
    }
  });

  return (
    <group ref={group}>
      {nodes.map((pos, i) => (
        <mesh key={i} position={pos}>
          <sphereGeometry args={[0.08, 16, 16]} />
          <meshStandardMaterial color={i % 2 === 0 ? "#00f0ff" : "#b026ff"} emissive={i % 2 === 0 ? "#00f0ff" : "#b026ff"} emissiveIntensity={2} toneMapped={false} />
        </mesh>
      ))}
      
      {lines.map((line, i) => (
        <Line 
          key={i} 
          points={line} 
          color="#2f2f33" 
          lineWidth={1}
          transparent
          opacity={0.3}
        />
      ))}
    </group>
  );
}

export default function ThreeScene() {
  return (
    <div className="absolute inset-0 z-0 pointer-events-none">
      <Canvas camera={{ position: [0, 0, 8], fov: 45 }}>
        <color attach="background" args={["#050505"]} />
        <ambientLight intensity={0.2} />
        <Stars radius={100} depth={50} count={2000} factor={4} saturation={0} fade speed={0.5} />
        <VectorClockNetwork />
        {/* Subtle bloom/post processing could be added here, but keeping it performant */}
      </Canvas>
    </div>
  );
}
