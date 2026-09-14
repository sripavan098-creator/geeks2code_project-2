import { useRef, useMemo, useEffect, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

interface Particle {
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  life: number;
  maxLife: number;
  size: number;
  color: THREE.Color;
}

interface ParticleBurstProps {
  position: [number, number, number];
  active: boolean;
  color?: string;
  count?: number;
  onComplete?: () => void;
}

export default function ParticleBurst({ 
  position, 
  active, 
  color = '#00ffcc', 
  count = 60,
  onComplete 
}: ParticleBurstProps) {
  const pointsRef = useRef<THREE.Points>(null);
  const [particles, setParticles] = useState<Particle[]>([]);
  const startTime = useRef(0);
  
  // Generate particles when burst activates
  useEffect(() => {
    if (active) {
      startTime.current = Date.now();
      const newParticles: Particle[] = [];
      const baseColor = new THREE.Color(color);
      
      for (let i = 0; i < count; i++) {
        // Spherical distribution with bias
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos(2 * Math.random() - 1);
        const speed = 0.02 + Math.random() * 0.08;
        
        const direction = new THREE.Vector3(
          Math.sin(phi) * Math.cos(theta),
          Math.sin(phi) * Math.sin(theta),
          Math.cos(phi)
        ).multiplyScalar(speed);
        
        // Vary colors slightly for bioluminescent effect
        const colorVariation = new THREE.Color().copy(baseColor);
        colorVariation.offsetHSL(
          (Math.random() - 0.5) * 0.1,
          (Math.random() - 0.5) * 0.2,
          (Math.random() - 0.5) * 0.2
        );
        
        newParticles.push({
          position: new THREE.Vector3(0, 0, 0),
          velocity: direction,
          life: 1.0,
          maxLife: 1.0,
          size: 0.03 + Math.random() * 0.07,
          color: colorVariation,
        });
      }
      
      setParticles(newParticles);
    } else {
      setParticles([]);
    }
  }, [active, color, count]);

  // Animate particles
  useFrame((_, delta) => {
    if (!pointsRef.current || particles.length === 0) return;
    
    const positions = pointsRef.current.geometry.attributes.position.array as Float32Array;
    const colors = pointsRef.current.geometry.attributes.color.array as Float32Array;
    const sizes = pointsRef.current.geometry.attributes.size.array as Float32Array;
    
    let allDead = true;
    
    particles.forEach((particle, i) => {
      if (particle.life > 0) {
        allDead = false;
        
        // Update position
        particle.position.add(particle.velocity.clone().multiplyScalar(delta * 60));
        
        // Apply drag (space friction)
        particle.velocity.multiplyScalar(0.96);
        
        // Decay life
        particle.life -= delta * 0.8;
        
        // Update buffers
        positions[i * 3] = particle.position.x;
        positions[i * 3 + 1] = particle.position.y;
        positions[i * 3 + 2] = particle.position.z;
        
        // Fade color based on life
        const alpha = particle.life / particle.maxLife;
        colors[i * 3] = particle.color.r * alpha;
        colors[i * 3 + 1] = particle.color.g * alpha;
        colors[i * 3 + 2] = particle.color.b * alpha;
        
        // Shrink size
        sizes[i] = particle.size * alpha;
      } else {
        // Move dead particles far away
        positions[i * 3] = 0;
        positions[i * 3 + 1] = -1000;
        positions[i * 3 + 2] = 0;
        sizes[i] = 0;
      }
    });
    
    pointsRef.current.geometry.attributes.position.needsUpdate = true;
    pointsRef.current.geometry.attributes.color.needsUpdate = true;
    pointsRef.current.geometry.attributes.size.needsUpdate = true;
    
    // Trigger completion when all particles are dead
    if (allDead && particles.length > 0) {
      onComplete?.();
    }
  });

  if (!active || particles.length === 0) return null;

  // Initialize buffers
  const positions = useMemo(() => new Float32Array(count * 3), [count]);
  const colors = useMemo(() => new Float32Array(count * 3), [count]);
  const sizes = useMemo(() => new Float32Array(count), [count]);

  return (
    <group position={position}>
      <points ref={pointsRef}>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            args={[positions, 3]}
            count={count}
          />
          <bufferAttribute
            attach="attributes-color"
            args={[colors, 3]}
            count={count}
          />
          <bufferAttribute
            attach="attributes-size"
            args={[sizes, 1]}
            count={count}
          />
        </bufferGeometry>
        <pointsMaterial 
          size={0.1}
          vertexColors
          transparent
          opacity={0.9}
          sizeAttenuation
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </points>
      
      {/* Central flash */}
      <mesh>
        <sphereGeometry args={[0.3, 16, 16]} />
        <meshBasicMaterial 
          color={color} 
          transparent 
          opacity={0.6}
          blending={THREE.AdditiveBlending}
        />
      </mesh>
    </group>
  );
}
