import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import * as THREE from 'three';
import StratosCanvas from './components/StratosCanvas';
import type { PhysicsState, SnapParticle, ActiveBurst } from './components/StratosCanvas';
import HUD from './components/HUD';
import { useTelemetry } from './hooks/useTelemetry';

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
  const [dragNode, setDragNode] = useState<{ id: string | null; position: THREE.Vector3 | null }>({ id: null, position: null });
  const [snapParticles, setSnapParticles] = useState<SnapParticle[]>([]);
  const [notification, setNotification] = useState<string | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [showSplash, setShowSplash] = useState(true);
  const [activeBursts, setActiveBursts] = useState<ActiveBurst[]>([]);
  const notifTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  
  // Get route IDs for telemetry
  const routeIds = useMemo(() => physicsState.tethers.map(t => t.id), [physicsState.tethers]);

  useEffect(() => {
    // Simulate loading
    const timer = setTimeout(() => {
      setIsLoaded(true);
      setTimeout(() => setShowSplash(false), 1500);
    }, 2000);
    return () => clearTimeout(timer);
  }, []);

  // Add a particle burst at a position
  const addBurst = useCallback((position: [number, number, number], color: string) => {
    const id = `burst-${Date.now()}-${Math.random()}`;
    setActiveBursts(prev => [...prev, { id, position, color, active: true }]);
    // Remove burst after animation completes
    setTimeout(() => {
      setActiveBursts(prev => prev.filter(b => b.id !== id));
    }, 3000);
  }, []);

  // Handle telemetry route snap events
  const handleTelemetryRouteSnap = useCallback((routeId: string) => {
    // Trigger the break via the existing handleBreakTether logic
    setPhysicsState(prev => {
      const tether = prev.tethers.find(t => t.id === routeId);
      if (!tether || tether.broken) return prev;
      
      const newTethers = prev.tethers.map(t => 
        t.id === routeId ? { ...t, broken: true } : t
      );
      
      // Apply impulse to connected nodes
      const newNodes = prev.nodes.map(node => {
        if (node.id === tether.from || node.id === tether.to) {
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
      
      // Create particle burst at midpoint
      const nodeA = prev.nodes.find(n => n.id === tether.from);
      const nodeB = prev.nodes.find(n => n.id === tether.to);
      if (nodeA && nodeB) {
        const midPoint = new THREE.Vector3().addVectors(nodeA.position, nodeB.position).multiplyScalar(0.5);
        addBurst([midPoint.x, midPoint.y, midPoint.z], '#00ffcc');
        
        // Also create snap particles
        const particles: SnapParticle[] = [];
        for (let i = 0; i < 30; i++) {
          particles.push({
            id: `p-${Date.now()}-${i}`,
            position: midPoint.clone(),
            velocity: new THREE.Vector3(
              (Math.random() - 0.5) * 8,
              (Math.random() - 0.5) * 8,
              (Math.random() - 0.5) * 8
            ),
            life: 1,
            color: '#ff0055'
          });
        }
        setSnapParticles(prev => [...prev, ...particles]);
        setTimeout(() => {
          setSnapParticles(prev => prev.filter(p => !particles.includes(p)));
        }, 2000);
      }
      
      return { nodes: newNodes, tethers: newTethers };
    });
    
    showNotification('⚡ LIVE TELEMETRY: Route failure detected — network rebalancing');
    
    // Auto-rebalance after 6 seconds
    setTimeout(() => {
      setPhysicsState(prev => {
        const newTethers = prev.tethers.map(t => 
          t.id === routeId ? { ...t, broken: false, tension: 0 } : t
        );
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
      showNotification('✓ Auto-rebalance complete — route restored');
    }, 6000);
  }, [addBurst, showNotification]);

  // Initialize telemetry
  const { events, isSimulating, toggleSimulation, eventCount, routeSnapCount } = useTelemetry(
    routeIds,
    handleTelemetryRouteSnap
  );

  const showNotification = useCallback((msg: string) => {
    setNotification(msg);
    if (notifTimeout.current) clearTimeout(notifTimeout.current);
    notifTimeout.current = setTimeout(() => setNotification(null), 3000);
  }, []);

  const createSnapParticles = useCallback((position: THREE.Vector3, color: string) => {
    const particles: SnapParticle[] = [];
    for (let i = 0; i < 30; i++) {
      particles.push({
        id: `p-${Date.now()}-${i}`,
        position: position.clone(),
        velocity: new THREE.Vector3(
          (Math.random() - 0.5) * 8,
          (Math.random() - 0.5) * 8,
          (Math.random() - 0.5) * 8
        ),
        life: 1,
        color
      });
    }
    setSnapParticles(prev => [...prev, ...particles]);
    
    // Clean up after animation
    setTimeout(() => {
      setSnapParticles(prev => prev.filter(p => !particles.includes(p)));
    }, 2000);
  }, []);

  // Break a tether (route disruption)
  const handleBreakTether = useCallback((tetherId: string) => {
    setPhysicsState(prev => {
      const tether = prev.tethers.find(t => t.id === tetherId);
      if (!tether || tether.broken) return prev;
      
      const newTethers = prev.tethers.map(t => {
        if (t.id === tetherId) {
          return { ...t, broken: true };
        }
        return t;
      });
      
      // Apply impulse to the nodes that were connected
      const newNodes = prev.nodes.map(node => {
        if (node.id === tether.from || node.id === tether.to) {
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
      
      // Create snap particles at midpoint
      const nodeA = prev.nodes.find(n => n.id === tether.from);
      const nodeB = prev.nodes.find(n => n.id === tether.to);
      if (nodeA && nodeB) {
        const midPoint = new THREE.Vector3().addVectors(nodeA.position, nodeB.position).multiplyScalar(0.5);
        createSnapParticles(midPoint, '#ff0055');
      }
      
      return { nodes: newNodes, tethers: newTethers };
    });
    
    showNotification('⚠ Route disrupted — Network rebalancing...');
  }, [createSnapParticles, showNotification]);

  // Simulate a random disruption
  const handleSimulateDisruption = useCallback(() => {
    setPhysicsState(prev => {
      const activeTethers = prev.tethers.filter(t => !t.broken);
      if (activeTethers.length === 0) {
        showNotification('All routes already disrupted. Rebalance to restore.');
        return prev;
      }
      
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
            (Math.random() - 0.5) * 5,
            (Math.random() - 0.5) * 5,
            (Math.random() - 0.5) * 5
          );
          return {
            ...node,
            position: node.position.clone(),
            velocity: node.velocity.clone().add(impulse)
          };
        }
        return { ...node, position: node.position.clone(), velocity: node.velocity.clone() };
      });
      
      // Create snap particles
      const nodeA = prev.nodes.find(n => n.id === randomTether.from);
      const nodeB = prev.nodes.find(n => n.id === randomTether.to);
      if (nodeA && nodeB) {
        const midPoint = new THREE.Vector3().addVectors(nodeA.position, nodeB.position).multiplyScalar(0.5);
        createSnapParticles(midPoint, '#ff0055');
      }
      
      const nodeAData = prev.nodes.find(n => n.id === randomTether.from);
      const nodeBData = prev.nodes.find(n => n.id === randomTether.to);
      showNotification(`⚡ DISRUPTION: ${nodeAData?.label} ↔ ${nodeBData?.label} route severed!`);
      
      return { nodes: newNodes, tethers: newTethers };
    });
  }, [createSnapParticles, showNotification]);

  // Rebalance the network (restore all broken routes and reset positions)
  const handleRebalance = useCallback(() => {
    setPhysicsState(prev => {
      const brokenCount = prev.tethers.filter(t => t.broken).length;
      if (brokenCount === 0) {
        showNotification('Network already nominal. No rebalancing needed.');
        return prev;
      }
      
      const newTethers = prev.tethers.map(t => ({ ...t, broken: false, tension: 0 }));
      
      // Apply gentle centering force
      const newNodes = prev.nodes.map(node => {
        const toCenter = new THREE.Vector3().sub(node.position).multiplyScalar(0.4);
        return {
          ...node,
          position: node.position.clone(),
          velocity: node.velocity.clone().add(toCenter)
        };
      });
      
      showNotification(`✓ Network rebalanced — ${brokenCount} route(s) restored`);
      
      return { nodes: newNodes, tethers: newTethers };
    });
  }, [showNotification]);

  return (
    <main className="relative h-screen w-screen overflow-hidden bg-[#030308]">
      {/* Splash Screen */}
      <AnimatePresence>
        {showSplash && (
          <motion.div
            initial={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1 }}
            className="absolute inset-0 z-[100] bg-[#030308] flex flex-col items-center justify-center"
          >
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.8 }}
              className="text-center"
            >
              <div className="relative mb-6">
                <div className="w-16 h-16 mx-auto rounded-full border-2 border-cyan-400/30 flex items-center justify-center">
                  <div className="w-8 h-8 rounded-full bg-cyan-400/20 animate-pulse-glow" />
                </div>
                <div className="absolute inset-0 w-16 h-16 mx-auto rounded-full border border-cyan-400/10 animate-ping" />
              </div>
              <h1 className="text-white text-4xl font-bold mb-2">
                STRATOS
              </h1>
              <p className="text-cyan-400/60 text-sm font-mono uppercase tracking-[0.3em]">
                Initializing Digital Twin
              </p>
              <div className="mt-8 flex items-center justify-center gap-1">
                {[0, 1, 2].map(i => (
                  <motion.div
                    key={i}
                    className="w-1.5 h-1.5 rounded-full bg-cyan-400"
                    animate={{ opacity: [0.3, 1, 0.3] }}
                    transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.2 }}
                  />
                ))}
              </div>
              <p className="text-gray-600 text-[10px] font-mono mt-6">
                Zero-Gravity Physics Engine • WebGL 2.0 • Real-time Simulation
              </p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 3D Canvas */}
      <div className="absolute inset-0">
        <StratosCanvas 
          physicsState={physicsState}
          setPhysicsState={setPhysicsState}
          selectedNode={selectedNode}
          setSelectedNode={setSelectedNode}
          dragNode={dragNode}
          setDragNode={setDragNode}
          snapParticles={snapParticles}
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
      
      {/* Notification Toast */}
      {notification && (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 pointer-events-none">
          <div className="glass-panel rounded-xl px-6 py-3 text-white text-sm font-mono animate-pulse-glow">
            {notification}
          </div>
        </div>
      )}
      
      {/* Vignette overlay */}
      <div 
        className="absolute inset-0 pointer-events-none"
        style={{
          background: 'radial-gradient(ellipse at center, transparent 30%, rgba(0,0,0,0.7) 100%)'
        }}
      />
      
      {/* Corner decorations */}
      <div className="absolute top-4 left-4 w-8 h-8 border-t border-l border-cyan-400/30 pointer-events-none" />
      <div className="absolute top-4 right-4 w-8 h-8 border-t border-r border-cyan-400/30 pointer-events-none" />
      <div className="absolute bottom-4 left-4 w-8 h-8 border-b border-l border-cyan-400/30 pointer-events-none" />
      <div className="absolute bottom-4 right-4 w-8 h-8 border-b border-r border-cyan-400/30 pointer-events-none" />
    </main>
  );
}

export default App;
