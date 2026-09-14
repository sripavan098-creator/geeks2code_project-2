import { useState, useCallback } from 'react';
import * as THREE from 'three';
import StratosCanvas from './components/StratosCanvas';
import type { PhysicsState } from './components/StratosCanvas';
import HUD from './components/HUD';

// Initial supply chain network data
function createInitialState(): PhysicsState {
  const nodes = [
    {
      id: 'shanghai-port',
      position: new THREE.Vector3(-5, 1, -2),
      velocity: new THREE.Vector3(0, 0, 0),
      mass: 5,
      color: '#00ffcc',
      label: 'Shanghai Port',
      type: 'port' as const,
      cargo: 4200
    },
    {
      id: 'rotterdam-hub',
      position: new THREE.Vector3(4, -1, 1),
      velocity: new THREE.Vector3(0, 0, 0),
      mass: 4,
      color: '#8b5cf6',
      label: 'Rotterdam Hub',
      type: 'hub' as const,
      cargo: 3100
    },
    {
      id: 'singapore-port',
      position: new THREE.Vector3(-3, -3, 3),
      velocity: new THREE.Vector3(0, 0, 0),
      mass: 4.5,
      color: '#f59e0b',
      label: 'Singapore Port',
      type: 'port' as const,
      cargo: 3800
    },
    {
      id: 'la-warehouse',
      position: new THREE.Vector3(6, 2, -3),
      velocity: new THREE.Vector3(0, 0, 0),
      mass: 3,
      color: '#ff0055',
      label: 'LA Distribution',
      type: 'warehouse' as const,
      cargo: 2100
    },
    {
      id: 'dubai-hub',
      position: new THREE.Vector3(0, 4, -1),
      velocity: new THREE.Vector3(0, 0, 0),
      mass: 3.5,
      color: '#06b6d4',
      label: 'Dubai Hub',
      type: 'hub' as const,
      cargo: 2800
    },
    {
      id: 'hamburg-port',
      position: new THREE.Vector3(2, -4, 2),
      velocity: new THREE.Vector3(0, 0, 0),
      mass: 3.8,
      color: '#ec4899',
      label: 'Hamburg Port',
      type: 'port' as const,
      cargo: 2600
    },
    {
      id: 'mumbai-warehouse',
      position: new THREE.Vector3(-6, -1, 4),
      velocity: new THREE.Vector3(0, 0, 0),
      mass: 2.8,
      color: '#10b981',
      label: 'Mumbai Warehouse',
      type: 'warehouse' as const,
      cargo: 1900
    },
    {
      id: 'tokyo-port',
      position: new THREE.Vector3(-2, 3, -5),
      velocity: new THREE.Vector3(0, 0, 0),
      mass: 4.2,
      color: '#f97316',
      label: 'Tokyo Port',
      type: 'port' as const,
      cargo: 3500
    },
  ];

  const tethers = [
    { id: 't1', from: 'shanghai-port', to: 'rotterdam-hub', tension: 0, broken: false, cargoFlow: 1.2 },
    { id: 't2', from: 'shanghai-port', to: 'singapore-port', tension: 0, broken: false, cargoFlow: 1.5 },
    { id: 't3', from: 'singapore-port', to: 'dubai-hub', tension: 0, broken: false, cargoFlow: 0.8 },
    { id: 't4', from: 'dubai-hub', to: 'rotterdam-hub', tension: 0, broken: false, cargoFlow: 1.0 },
    { id: 't5', from: 'rotterdam-hub', to: 'la-warehouse', tension: 0, broken: false, cargoFlow: 0.9 },
    { id: 't6', from: 'rotterdam-hub', to: 'hamburg-port', tension: 0, broken: false, cargoFlow: 1.3 },
    { id: 't7', from: 'shanghai-port', to: 'tokyo-port', tension: 0, broken: false, cargoFlow: 1.1 },
    { id: 't8', from: 'singapore-port', to: 'mumbai-warehouse', tension: 0, broken: false, cargoFlow: 0.7 },
    { id: 't9', from: 'mumbai-warehouse', to: 'dubai-hub', tension: 0, broken: false, cargoFlow: 0.6 },
    { id: 't10', from: 'la-warehouse', to: 'tokyo-port', tension: 0, broken: false, cargoFlow: 0.5 },
    { id: 't11', from: 'hamburg-port', to: 'dubai-hub', tension: 0, broken: false, cargoFlow: 0.8 },
  ];

  return { nodes, tethers };
}

function App() {
  const [physicsState, setPhysicsState] = useState<PhysicsState>(createInitialState);
  const [selectedNode, setSelectedNode] = useState<string | null>(null);

  // Break a tether (route disruption)
  const handleBreakTether = useCallback((tetherId: string) => {
    setPhysicsState(prev => {
      const newTethers = prev.tethers.map(t => {
        if (t.id === tetherId) {
          return { ...t, broken: true };
        }
        return t;
      });
      
      // Apply impulse to the nodes that were connected
      const tether = prev.tethers.find(t => t.id === tetherId);
      if (!tether) return prev;
      
      const newNodes = prev.nodes.map(node => {
        if (node.id === tether.from || node.id === tether.to) {
          // Apply random impulse to simulate the "snap"
          const impulse = new THREE.Vector3(
            (Math.random() - 0.5) * 3,
            (Math.random() - 0.5) * 3,
            (Math.random() - 0.5) * 3
          );
          return {
            ...node,
            position: node.position.clone(),
            velocity: node.velocity.clone().add(impulse)
          };
        }
        return { ...node, position: node.position.clone(), velocity: node.velocity.clone() };
      });
      
      return { nodes: newNodes, tethers: newTethers };
    });
  }, []);

  // Simulate a random disruption
  const handleSimulateDisruption = useCallback(() => {
    setPhysicsState(prev => {
      const activeTethers = prev.tethers.filter(t => !t.broken);
      if (activeTethers.length === 0) return prev;
      
      const randomTether = activeTethers[Math.floor(Math.random() * activeTethers.length)];
      
      const newTethers = prev.tethers.map(t => {
        if (t.id === randomTether.id) {
          return { ...t, broken: true };
        }
        return t;
      });
      
      // Apply impulse
      const newNodes = prev.nodes.map(node => {
        if (node.id === randomTether.from || node.id === randomTether.to) {
          const impulse = new THREE.Vector3(
            (Math.random() - 0.5) * 4,
            (Math.random() - 0.5) * 4,
            (Math.random() - 0.5) * 4
          );
          return {
            ...node,
            position: node.position.clone(),
            velocity: node.velocity.clone().add(impulse)
          };
        }
        return { ...node, position: node.position.clone(), velocity: node.velocity.clone() };
      });
      
      return { nodes: newNodes, tethers: newTethers };
    });
  }, []);

  // Rebalance the network (restore all broken routes and reset positions)
  const handleRebalance = useCallback(() => {
    setPhysicsState(prev => {
      const newTethers = prev.tethers.map(t => ({ ...t, broken: false, tension: 0 }));
      
      // Apply gentle centering force
      const newNodes = prev.nodes.map(node => {
        const toCenter = new THREE.Vector3().sub(node.position).multiplyScalar(0.3);
        return {
          ...node,
          position: node.position.clone(),
          velocity: node.velocity.clone().add(toCenter)
        };
      });
      
      return { nodes: newNodes, tethers: newTethers };
    });
  }, []);

  return (
    <main className="relative h-screen w-screen overflow-hidden bg-[#050505]">
      {/* 3D Canvas */}
      <div className="absolute inset-0">
        <StratosCanvas 
          physicsState={physicsState}
          setPhysicsState={setPhysicsState}
          selectedNode={selectedNode}
          setSelectedNode={setSelectedNode}
        />
      </div>
      
      {/* HUD Overlay */}
      <HUD 
        physicsState={physicsState}
        selectedNode={selectedNode}
        onBreakTether={handleBreakTether}
        onRebalance={handleRebalance}
        onSimulateDisruption={handleSimulateDisruption}
      />
      
      {/* Vignette overlay */}
      <div 
        className="absolute inset-0 pointer-events-none z-5"
        style={{
          background: 'radial-gradient(ellipse at center, transparent 40%, rgba(0,0,0,0.6) 100%)'
        }}
      />
    </main>
  );
}

export default App;
