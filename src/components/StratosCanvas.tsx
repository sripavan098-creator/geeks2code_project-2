import { useRef, useMemo, useCallback } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Stars, Line } from '@react-three/drei';
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

// Custom Physics Engine (Zero-Gravity Spring System)
function usePhysics(state: PhysicsState, setState: React.Dispatch<React.SetStateAction<PhysicsState>>) {
  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.05);
    
    setState(prev => {
      const newNodes = prev.nodes.map(node => ({
        ...node,
        position: node.position.clone(),
        velocity: node.velocity.clone()
      }));
      
      // Apply spring forces from tethers
      prev.tethers.forEach(tether => {
        if (tether.broken) return;
        
        const nodeA = newNodes.find(n => n.id === tether.from);
        const nodeB = newNodes.find(n => n.id === tether.to);
        if (!nodeA || !nodeB) return;
        
        const direction = new THREE.Vector3().subVectors(nodeB.position, nodeA.position);
        const distance = direction.length();
        const restLength = 6;
        const displacement = distance - restLength;
        
        // Spring force
        const springForce = displacement * 0.3;
        direction.normalize();
        
        const forceA = direction.clone().multiplyScalar(springForce / nodeA.mass);
        const forceB = direction.clone().multiplyScalar(-springForce / nodeB.mass);
        
        nodeA.velocity.add(forceA.multiplyScalar(dt));
        nodeB.velocity.add(forceB.multiplyScalar(dt));
        
        // Update tension
        tether.tension = Math.abs(displacement) * 10;
      });
      
      // Apply velocity and damping (space friction)
      newNodes.forEach(node => {
        node.velocity.multiplyScalar(0.98); // Damping
        node.position.add(node.velocity.clone().multiplyScalar(dt));
        
        // Boundary containment (soft walls)
        const boundary = 12;
        ['x', 'y', 'z'].forEach(axis => {
          const key = axis as 'x' | 'y' | 'z';
          if (Math.abs(node.position[key]) > boundary) {
            node.velocity[key] *= -0.5;
            node.position[key] = Math.sign(node.position[key]) * boundary;
          }
        });
      });
      
      return { nodes: newNodes, tethers: [...prev.tethers] };
    });
  });
}

// Supply Node Component
function SupplyNode({ 
  node, 
  onPointerDown,
  isSelected 
}: { 
  node: NodeData; 
  onPointerDown: (id: string) => void;
  isSelected: boolean;
}) {
  const meshRef = useRef<THREE.Mesh>(null);
  const glowRef = useRef<THREE.Mesh>(null);
  const ringRef = useRef<THREE.Mesh>(null);
  
  useFrame((state) => {
    if (meshRef.current) {
      // Pulsing emissive
      const pulse = Math.sin(state.clock.elapsedTime * 2 + node.position.x) * 0.3 + 0.7;
      (meshRef.current.material as THREE.MeshStandardMaterial).emissiveIntensity = isSelected ? 2.0 : pulse;
    }
    if (glowRef.current) {
      const scale = 1.3 + Math.sin(state.clock.elapsedTime * 1.5) * 0.1;
      glowRef.current.scale.setScalar(scale);
    }
    if (ringRef.current) {
      ringRef.current.rotation.z += 0.01;
      ringRef.current.rotation.x += 0.005;
    }
  });

  const size = node.type === 'hub' ? 0.7 : node.type === 'port' ? 0.55 : 0.45;

  return (
    <group position={node.position}>
      {/* Core sphere */}
      <mesh 
        ref={meshRef} 
        castShadow
        onPointerDown={(e) => { e.stopPropagation(); onPointerDown(node.id); }}
        onPointerOver={(e) => { e.stopPropagation(); document.body.style.cursor = 'pointer'; }}
        onPointerOut={() => { document.body.style.cursor = 'default'; }}
      >
        <sphereGeometry args={[size, 32, 32]} />
        <meshStandardMaterial 
          color={node.color}
          emissive={node.color}
          emissiveIntensity={0.7}
          roughness={0.15}
          metalness={0.9}
        />
      </mesh>
      
      {/* Outer glow */}
      <mesh ref={glowRef}>
        <sphereGeometry args={[size, 16, 16]} />
        <meshBasicMaterial color={node.color} transparent opacity={0.08} />
      </mesh>
      
      {/* Orbit ring */}
      <mesh ref={ringRef}>
        <torusGeometry args={[size * 1.6, 0.02, 8, 64]} />
        <meshBasicMaterial color={node.color} transparent opacity={isSelected ? 0.8 : 0.3} />
      </mesh>
      
      {/* Selection indicator */}
      {isSelected && (
        <mesh>
          <torusGeometry args={[size * 2, 0.03, 8, 64]} />
          <meshBasicMaterial color="#ffffff" transparent opacity={0.5} />
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
  
  // Generate curved points between nodes
  const linePoints = useMemo(() => {
    const points: [number, number, number][] = [];
    const segments = 30;
    for (let i = 0; i <= segments; i++) {
      const t = i / segments;
      const x = fromPos.x + (toPos.x - fromPos.x) * t;
      const y = fromPos.y + (toPos.y - fromPos.y) * t;
      const z = fromPos.z + (toPos.z - fromPos.z) * t;
      // Add slight curve
      const curve = Math.sin(t * Math.PI) * 0.5;
      points.push([x, y + curve, z]);
    }
    return points;
  }, [fromPos.x, fromPos.y, fromPos.z, toPos.x, toPos.y, toPos.z]);

  const particlePositions = useMemo(() => {
    const count = 15;
    const positions = new Float32Array(count * 3);
    return positions;
  }, []);

  useFrame((state) => {
    if (broken) return;
    
    // Animate cargo particles along the tether
    if (particlesRef.current) {
      const pPositions = particlesRef.current.geometry.attributes.position.array as Float32Array;
      const count = 15;
      for (let i = 0; i < count; i++) {
        const t = ((i / count + state.clock.elapsedTime * 0.15 * cargoFlow) % 1);
        pPositions[i * 3] = fromPos.x + (toPos.x - fromPos.x) * t;
        pPositions[i * 3 + 1] = fromPos.y + (toPos.y - fromPos.y) * t + Math.sin(t * Math.PI) * 0.5;
        pPositions[i * 3 + 2] = fromPos.z + (toPos.z - fromPos.z) * t;
      }
      particlesRef.current.geometry.attributes.position.needsUpdate = true;
    }
  });

  if (broken) return null;

  const tensionColor = tension > 15 ? '#ff0055' : tension > 8 ? '#f59e0b' : '#00ffcc';
  
  return (
    <group ref={groupRef}>
      <Line 
        points={linePoints}
        color={tensionColor}
        lineWidth={2}
        transparent
        opacity={0.7}
      />
      <points ref={particlesRef}>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            args={[particlePositions, 3]}
            count={15}
          />
        </bufferGeometry>
        <pointsMaterial 
          color={tensionColor} 
          size={0.1} 
          transparent 
          opacity={0.9}
          sizeAttenuation
        />
      </points>
    </group>
  );
}

// Floating cargo particles in the background
function AmbientParticles() {
  const ref = useRef<THREE.Points>(null);
  
  const positions = useMemo(() => {
    const count = 200;
    const pos = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 30;
      pos[i * 3 + 1] = (Math.random() - 0.5) * 30;
      pos[i * 3 + 2] = (Math.random() - 0.5) * 30;
    }
    return pos;
  }, []);

  useFrame((state) => {
    if (ref.current) {
      ref.current.rotation.y = state.clock.elapsedTime * 0.02;
      ref.current.rotation.x = Math.sin(state.clock.elapsedTime * 0.01) * 0.1;
    }
  });

  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          args={[positions, 3]}
          count={200}
        />
      </bufferGeometry>
      <pointsMaterial 
        color="#00ffcc" 
        size={0.03} 
        transparent 
        opacity={0.4}
        sizeAttenuation
      />
    </points>
  );
}

// Camera controller
function CameraController({ selectedNode }: { selectedNode: string | null }) {
  const { camera } = useThree();
  const targetPos = useRef(new THREE.Vector3(0, 3, 18));
  
  useFrame(() => {
    camera.position.lerp(targetPos.current, 0.02);
    camera.lookAt(0, 0, 0);
  });

  return null;
}

// Main Scene
function Scene({ 
  physicsState, 
  setPhysicsState, 
  selectedNode, 
  setSelectedNode 
}: { 
  physicsState: PhysicsState;
  setPhysicsState: React.Dispatch<React.SetStateAction<PhysicsState>>;
  selectedNode: string | null;
  setSelectedNode: (id: string | null) => void;
}) {
  usePhysics(physicsState, setPhysicsState);
  
  const handleNodeClick = useCallback((id: string) => {
    setSelectedNode(selectedNode === id ? null : id);
  }, [selectedNode, setSelectedNode]);

  return (
    <>
      <CameraController selectedNode={selectedNode} />
      
      {/* Lighting */}
      <ambientLight intensity={0.15} />
      <pointLight position={[10, 10, 10]} intensity={0.8} color="#00ffcc" />
      <pointLight position={[-10, -5, -10]} intensity={0.4} color="#ff0055" />
      <pointLight position={[0, 15, 0]} intensity={0.3} color="#8b5cf6" />
      
      {/* Stars background */}
      <Stars radius={80} depth={60} count={3000} factor={4} fade speed={0.5} />
      
      {/* Ambient particles */}
      <AmbientParticles />
      
      {/* Supply Nodes */}
      {physicsState.nodes.map(node => (
        <SupplyNode 
          key={node.id} 
          node={node} 
          onPointerDown={handleNodeClick}
          isSelected={selectedNode === node.id}
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
    </>
  );
}

// Export types
export type { NodeData, TetherData, PhysicsState };

// Main Canvas Component
export default function StratosCanvas({ 
  physicsState, 
  setPhysicsState, 
  selectedNode, 
  setSelectedNode 
}: { 
  physicsState: PhysicsState;
  setPhysicsState: React.Dispatch<React.SetStateAction<PhysicsState>>;
  selectedNode: string | null;
  setSelectedNode: (id: string | null) => void;
}) {
  return (
    <Canvas 
      shadows 
      camera={{ position: [0, 3, 18], fov: 50 }}
      gl={{ antialias: true, alpha: false }}
      style={{ background: '#050505' }}
    >
      <Scene 
        physicsState={physicsState}
        setPhysicsState={setPhysicsState}
        selectedNode={selectedNode}
        setSelectedNode={setSelectedNode}
      />
    </Canvas>
  );
}
