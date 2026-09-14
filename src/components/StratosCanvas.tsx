import { useRef, useMemo, useCallback, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Stars, Line, OrbitControls } from '@react-three/drei';
import { EffectComposer, Bloom, Vignette } from '@react-three/postprocessing';
import * as THREE from 'three';

// Types
interface NodeData {
  id: string;
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  mass: number;
  color: string;
  label: string;
  type: 'port' | 'warehouse' | 'hub';
  cargo: number;
}

interface TetherData {
  id: string;
  from: string;
  to: string;
  tension: number;
  broken: boolean;
  cargoFlow: number;
}

interface PhysicsState {
  nodes: NodeData[];
  tethers: TetherData[];
}

interface SnapParticle {
  id: string;
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  life: number;
  color: string;
}

// Custom Physics Engine (Zero-Gravity Spring System)
function usePhysics(
  state: PhysicsState, 
  setState: React.Dispatch<React.SetStateAction<PhysicsState>>,
  dragNode: { id: string | null; position: THREE.Vector3 | null }
) {
  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.05);
    
    setState(prev => {
      const newNodes = prev.nodes.map(node => ({
        ...node,
        position: node.position.clone(),
        velocity: node.velocity.clone()
      }));
      
      // Apply drag force if a node is being dragged
      if (dragNode.id && dragNode.position) {
        const node = newNodes.find(n => n.id === dragNode.id);
        if (node) {
          const toTarget = new THREE.Vector3().subVectors(dragNode.position, node.position);
          node.velocity.add(toTarget.multiplyScalar(8 * dt));
          node.velocity.multiplyScalar(0.85); // Heavy damping while dragging
        }
      }
      
      // Apply spring forces from tethers
      prev.tethers.forEach(tether => {
        if (tether.broken) return;
        
        const nodeA = newNodes.find(n => n.id === tether.from);
        const nodeB = newNodes.find(n => n.id === tether.to);
        if (!nodeA || !nodeB) return;
        
        const direction = new THREE.Vector3().subVectors(nodeB.position, nodeA.position);
        const distance = direction.length();
        const restLength = 5.5;
        const displacement = distance - restLength;
        
        // Spring force
        const springForce = displacement * 0.4;
        direction.normalize();
        
        const forceA = direction.clone().multiplyScalar(springForce / nodeA.mass);
        const forceB = direction.clone().multiplyScalar(-springForce / nodeB.mass);
        
        nodeA.velocity.add(forceA.multiplyScalar(dt));
        nodeB.velocity.add(forceB.multiplyScalar(dt));
        
        // Update tension
        tether.tension = Math.abs(displacement) * 12;
      });
      
      // Apply velocity and damping (space friction)
      newNodes.forEach(node => {
        node.velocity.multiplyScalar(0.985); // Damping
        node.position.add(node.velocity.clone().multiplyScalar(dt));
        
        // Boundary containment (soft walls)
        const boundary = 11;
        ['x', 'y', 'z'].forEach(axis => {
          const key = axis as 'x' | 'y' | 'z';
          if (Math.abs(node.position[key]) > boundary) {
            node.velocity[key] *= -0.6;
            node.position[key] = Math.sign(node.position[key]) * boundary;
          }
        });
      });
      
      return { nodes: newNodes, tethers: [...prev.tethers] };
    });
  });
}

// Supply Node Component with Drag Support
function SupplyNode({ 
  node, 
  onPointerDown,
  onDragStart,
  onDragEnd,
  isSelected,
  isDragging
}: { 
  node: NodeData; 
  onPointerDown: (id: string) => void;
  onDragStart: (id: string) => void;
  onDragEnd: () => void;
  isSelected: boolean;
  isDragging: boolean;
}) {
  const meshRef = useRef<THREE.Mesh>(null);
  const glowRef = useRef<THREE.Mesh>(null);
  const ringRef = useRef<THREE.Mesh>(null);
  const ring2Ref = useRef<THREE.Mesh>(null);
  const { camera, gl } = useThree();
  const dragPlane = useRef(new THREE.Plane());
  const intersection = useRef(new THREE.Vector3());
  
  useFrame((state) => {
    if (meshRef.current) {
      const pulse = Math.sin(state.clock.elapsedTime * 2 + node.position.x) * 0.3 + 0.7;
      (meshRef.current.material as THREE.MeshStandardMaterial).emissiveIntensity = 
        isDragging ? 2.5 : isSelected ? 1.8 : pulse;
    }
    if (glowRef.current) {
      const scale = isDragging ? 1.6 : 1.3 + Math.sin(state.clock.elapsedTime * 1.5) * 0.1;
      glowRef.current.scale.setScalar(scale);
      (glowRef.current.material as THREE.MeshBasicMaterial).opacity = isDragging ? 0.2 : 0.08;
    }
    if (ringRef.current) {
      ringRef.current.rotation.z += isDragging ? 0.04 : 0.01;
      ringRef.current.rotation.x += 0.005;
    }
    if (ring2Ref.current) {
      ring2Ref.current.rotation.z -= 0.008;
      ring2Ref.current.rotation.y += 0.003;
    }
  });

  const size = node.type === 'hub' ? 0.7 : node.type === 'port' ? 0.55 : 0.45;

  const handlePointerDown = (e: any) => {
    e.stopPropagation();
    onDragStart(node.id);
    
    // Set up drag plane facing camera
    const cameraDir = new THREE.Vector3();
    camera.getWorldDirection(cameraDir);
    dragPlane.current.setFromNormalAndCoplanarPoint(cameraDir.negate(), node.position);
    
    gl.domElement.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: any) => {
    if (!isDragging) return;
    e.stopPropagation();
    
    // Raycast to drag plane
    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2(
      (e.clientX / window.innerWidth) * 2 - 1,
      -(e.clientY / window.innerHeight) * 2 + 1
    );
    raycaster.setFromCamera(pointer, camera);
    raycaster.ray.intersectPlane(dragPlane.current, intersection.current);
    
    // Update node position directly
    node.position.copy(intersection.current);
    node.velocity.set(0, 0, 0);
  };

  const handlePointerUp = (e: any) => {
    if (isDragging) {
      onDragEnd();
      gl.domElement.releasePointerCapture(e.pointerId);
    }
  };

  return (
    <group 
      position={node.position}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerOver={(e) => { e.stopPropagation(); document.body.style.cursor = 'grab'; }}
      onPointerOut={() => { if (!isDragging) document.body.style.cursor = 'default'; }}
    >
      {/* Core sphere */}
      <mesh ref={meshRef} castShadow>
        <sphereGeometry args={[size, 32, 32]} />
        <meshStandardMaterial 
          color={node.color}
          emissive={node.color}
          emissiveIntensity={0.7}
          roughness={0.1}
          metalness={0.95}
        />
      </mesh>
      
      {/* Inner glow core */}
      <mesh scale={0.6}>
        <sphereGeometry args={[size, 16, 16]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={0.15} />
      </mesh>
      
      {/* Outer glow */}
      <mesh ref={glowRef}>
        <sphereGeometry args={[size, 16, 16]} />
        <meshBasicMaterial color={node.color} transparent opacity={0.08} />
      </mesh>
      
      {/* Orbit ring 1 */}
      <mesh ref={ringRef}>
        <torusGeometry args={[size * 1.6, 0.015, 8, 64]} />
        <meshBasicMaterial color={node.color} transparent opacity={isSelected || isDragging ? 0.9 : 0.3} />
      </mesh>
      
      {/* Orbit ring 2 */}
      <mesh ref={ring2Ref} rotation={[Math.PI / 3, 0, 0]}>
        <torusGeometry args={[size * 1.9, 0.01, 8, 64]} />
        <meshBasicMaterial color={node.color} transparent opacity={0.15} />
      </mesh>
      
      {/* Selection indicator */}
      {isSelected && (
        <mesh>
          <torusGeometry args={[size * 2.3, 0.025, 8, 64]} />
          <meshBasicMaterial color="#ffffff" transparent opacity={0.4} />
        </mesh>
      )}
      
      {/* Drag indicator */}
      {isDragging && (
        <mesh>
          <torusGeometry args={[size * 2.6, 0.02, 8, 64]} />
          <meshBasicMaterial color="#ffffff" transparent opacity={0.6} />
        </mesh>
      )}
    </group>
  );
}

// Tether (Shipping Route) Component
function Tether({ 
  fromPos, 
  toPos, 
  tension, 
  broken,
  cargoFlow 
}: { 
  fromPos: THREE.Vector3; 
  toPos: THREE.Vector3; 
  tension: number;
  broken: boolean;
  cargoFlow: number;
}) {
  const particlesRef = useRef<THREE.Points>(null);
  const groupRef = useRef<THREE.Group>(null);
  
  const linePoints = useMemo(() => {
    const points: [number, number, number][] = [];
    const segments = 32;
    for (let i = 0; i <= segments; i++) {
      const t = i / segments;
      const x = fromPos.x + (toPos.x - fromPos.x) * t;
      const y = fromPos.y + (toPos.y - fromPos.y) * t;
      const z = fromPos.z + (toPos.z - fromPos.z) * t;
      const curve = Math.sin(t * Math.PI) * 0.4;
      points.push([x, y + curve, z]);
    }
    return points;
  }, [fromPos.x, fromPos.y, fromPos.z, toPos.x, toPos.y, toPos.z]);

  const particlePositions = useMemo(() => {
    const count = 12;
    return new Float32Array(count * 3);
  }, []);

  useFrame((state) => {
    if (broken) return;
    
    if (particlesRef.current) {
      const pPositions = particlesRef.current.geometry.attributes.position.array as Float32Array;
      const count = 12;
      for (let i = 0; i < count; i++) {
        const t = ((i / count + state.clock.elapsedTime * 0.15 * cargoFlow) % 1);
        pPositions[i * 3] = fromPos.x + (toPos.x - fromPos.x) * t;
        pPositions[i * 3 + 1] = fromPos.y + (toPos.y - fromPos.y) * t + Math.sin(t * Math.PI) * 0.4;
        pPositions[i * 3 + 2] = fromPos.z + (toPos.z - fromPos.z) * t;
      }
      particlesRef.current.geometry.attributes.position.needsUpdate = true;
    }
  });

  if (broken) return null;

  const tensionColor = tension > 15 ? '#ff0055' : tension > 8 ? '#f59e0b' : '#00ffcc';
  const lineWidth = tension > 15 ? 3 : tension > 8 ? 2.5 : 2;
  
  return (
    <group ref={groupRef}>
      <Line 
        points={linePoints}
        color={tensionColor}
        lineWidth={lineWidth}
        transparent
        opacity={0.7}
      />
      {/* Secondary glow line */}
      <Line 
        points={linePoints}
        color={tensionColor}
        lineWidth={lineWidth + 3}
        transparent
        opacity={0.15}
      />
      <points ref={particlesRef}>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            args={[particlePositions, 3]}
            count={12}
          />
        </bufferGeometry>
        <pointsMaterial 
          color={tensionColor} 
          size={0.12} 
          transparent 
          opacity={0.9}
          sizeAttenuation
        />
      </points>
    </group>
  );
}

// Snap Explosion Particles
function SnapExplosion({ particles }: { particles: SnapParticle[] }) {
  const ref = useRef<THREE.Points>(null);
  
  const positions = useMemo(() => new Float32Array(particles.length * 3), [particles.length]);
  const colors = useMemo(() => new Float32Array(particles.length * 3), [particles.length]);

  useFrame((_, delta) => {
    if (!ref.current) return;
    const posAttr = ref.current.geometry.attributes.position.array as Float32Array;
    
    particles.forEach((p, i) => {
      p.position.add(p.velocity.clone().multiplyScalar(delta));
      p.velocity.multiplyScalar(0.96);
      p.life -= delta * 1.5;
      
      posAttr[i * 3] = p.position.x;
      posAttr[i * 3 + 1] = p.position.y;
      posAttr[i * 3 + 2] = p.position.z;
    });
    
    ref.current.geometry.attributes.position.needsUpdate = true;
  });

  if (particles.length === 0) return null;

  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          args={[positions, 3]}
          count={particles.length}
        />
      </bufferGeometry>
      <pointsMaterial 
        color="#ff0055" 
        size={0.15} 
        transparent 
        opacity={0.9}
        sizeAttenuation
      />
    </points>
  );
}

// Floating ambient particles
function AmbientParticles() {
  const ref = useRef<THREE.Points>(null);
  
  const positions = useMemo(() => {
    const count = 300;
    const pos = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 35;
      pos[i * 3 + 1] = (Math.random() - 0.5) * 35;
      pos[i * 3 + 2] = (Math.random() - 0.5) * 35;
    }
    return pos;
  }, []);

  useFrame((state) => {
    if (ref.current) {
      ref.current.rotation.y = state.clock.elapsedTime * 0.015;
      ref.current.rotation.x = Math.sin(state.clock.elapsedTime * 0.008) * 0.1;
    }
  });

  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          args={[positions, 3]}
          count={300}
        />
      </bufferGeometry>
      <pointsMaterial 
        color="#00ffcc" 
        size={0.04} 
        transparent 
        opacity={0.3}
        sizeAttenuation
      />
    </points>
  );
}

// Grid floor
function GridFloor() {
  return (
    <group position={[0, -8, 0]} rotation={[-Math.PI / 2, 0, 0]}>
      <gridHelper args={[40, 40, '#0a2a2a', '#061515']} rotation={[Math.PI / 2, 0, 0]} />
    </group>
  );
}

// Camera controller with OrbitControls
function CameraController() {
  return (
    <OrbitControls 
      enableDamping 
      dampingFactor={0.05}
      minDistance={8}
      maxDistance={30}
      enablePan={false}
      autoRotate
      autoRotateSpeed={0.3}
      maxPolarAngle={Math.PI * 0.75}
      minPolarAngle={Math.PI * 0.25}
    />
  );
}

// Main Scene
function Scene({ 
  physicsState, 
  setPhysicsState, 
  selectedNode, 
  setSelectedNode,
  dragNode,
  setDragNode,
  snapParticles,
}: { 
  physicsState: PhysicsState;
  setPhysicsState: React.Dispatch<React.SetStateAction<PhysicsState>>;
  selectedNode: string | null;
  setSelectedNode: (id: string | null) => void;
  dragNode: { id: string | null; position: THREE.Vector3 | null };
  setDragNode: (d: { id: string | null; position: THREE.Vector3 | null }) => void;
  snapParticles: SnapParticle[];
}) {
  usePhysics(physicsState, setPhysicsState, dragNode);
  
  const handleNodeClick = useCallback((id: string) => {
    if (dragNode.id !== id) {
      setSelectedNode(selectedNode === id ? null : id);
    }
  }, [selectedNode, setSelectedNode, dragNode.id]);

  const handleDragStart = useCallback((id: string) => {
    setDragNode({ id, position: null });
    document.body.style.cursor = 'grabbing';
  }, [setDragNode]);

  const handleDragEnd = useCallback(() => {
    setDragNode({ id: null, position: null });
    document.body.style.cursor = 'default';
  }, [setDragNode]);

  return (
    <>
      <CameraController />
      
      {/* Lighting */}
      <ambientLight intensity={0.1} />
      <pointLight position={[10, 10, 10]} intensity={1} color="#00ffcc" />
      <pointLight position={[-10, -5, -10]} intensity={0.5} color="#ff0055" />
      <pointLight position={[0, 15, 0]} intensity={0.4} color="#8b5cf6" />
      <pointLight position={[5, -10, 5]} intensity={0.3} color="#f59e0b" />
      
      {/* Stars background */}
      <Stars radius={100} depth={60} count={4000} factor={4} fade speed={0.3} />
      
      {/* Ambient particles */}
      <AmbientParticles />
      
      {/* Grid floor */}
      <GridFloor />
      
      {/* Supply Nodes */}
      {physicsState.nodes.map(node => (
        <SupplyNode 
          key={node.id} 
          node={node} 
          onPointerDown={handleNodeClick}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
          isSelected={selectedNode === node.id}
          isDragging={dragNode.id === node.id}
        />
      ))}
      
      {/* Tethers */}
      {physicsState.tethers.map(tether => {
        const nodeA = physicsState.nodes.find(n => n.id === tether.from);
        const nodeB = physicsState.nodes.find(n => n.id === tether.to);
        if (!nodeA || !nodeB) return null;
        
        return (
          <Tether 
            key={tether.id}
            fromPos={nodeA.position}
            toPos={nodeB.position}
            tension={tether.tension}
            broken={tether.broken}
            cargoFlow={tether.cargoFlow}
          />
        );
      })}
      
      {/* Snap explosion particles */}
      <SnapExplosion particles={snapParticles} />
      
      {/* Post-processing */}
      <EffectComposer>
        <Bloom 
          intensity={1.2}
          luminanceThreshold={0.2}
          luminanceSmoothing={0.9}
          mipmapBlur
        />
        <Vignette eskil={false} offset={0.2} darkness={0.8} />
      </EffectComposer>
    </>
  );
}

// Export types
export type { NodeData, TetherData, PhysicsState, SnapParticle };

// Main Canvas Component
export default function StratosCanvas({ 
  physicsState, 
  setPhysicsState, 
  selectedNode, 
  setSelectedNode,
  dragNode,
  setDragNode,
  snapParticles,
}: { 
  physicsState: PhysicsState;
  setPhysicsState: React.Dispatch<React.SetStateAction<PhysicsState>>;
  selectedNode: string | null;
  setSelectedNode: (id: string | null) => void;
  dragNode: { id: string | null; position: THREE.Vector3 | null };
  setDragNode: (d: { id: string | null; position: THREE.Vector3 | null }) => void;
  snapParticles: SnapParticle[];
}) {
  return (
    <Canvas 
      shadows 
      camera={{ position: [0, 4, 16], fov: 50 }}
      gl={{ antialias: true, alpha: false, powerPreference: 'high-performance' }}
      style={{ background: '#030308' }}
      dpr={[1, 2]}
    >
      <Scene 
        physicsState={physicsState}
        setPhysicsState={setPhysicsState}
        selectedNode={selectedNode}
        setSelectedNode={setSelectedNode}
        dragNode={dragNode}
        setDragNode={setDragNode}
        snapParticles={snapParticles}
      />
    </Canvas>
  );
}
