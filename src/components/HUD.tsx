import { motion, AnimatePresence } from 'framer-motion';
import { useState, useEffect } from 'react';
import type { PhysicsState, NodeData } from './StratosCanvas';

interface HUDProps {
  physicsState: PhysicsState;
  selectedNode: string | null;
  onBreakTether: (tetherId: string) => void;
  onRebalance: () => void;
  onSimulateDisruption: () => void;
}

function formatNumber(n: number): string {
  return n.toLocaleString();
}

export default function HUD({ 
  physicsState, 
  selectedNode, 
  onBreakTether, 
  onRebalance, 
  onSimulateDisruption 
}: HUDProps) {
  const [time, setTime] = useState(new Date());
  const [showMetrics, setShowMetrics] = useState(true);
  
  useEffect(() => {
    const interval = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  const totalTension = physicsState.tethers.reduce((sum, t) => sum + t.tension, 0);
  const avgTension = physicsState.tethers.length > 0 ? totalTension / physicsState.tethers.length : 0;
  const criticalRoutes = physicsState.tethers.filter(t => t.tension > 15 && !t.broken).length;
  const totalCargo = physicsState.nodes.reduce((sum, n) => sum + n.cargo, 0);
  const activeRoutes = physicsState.tethers.filter(t => !t.broken).length;
  const brokenRoutes = physicsState.tethers.filter(t => t.broken).length;
  
  const selectedNodeData = selectedNode ? physicsState.nodes.find(n => n.id === selectedNode) : null;
  const selectedNodeTethers = selectedNode 
    ? physicsState.tethers.filter(t => t.from === selectedNode || t.to === selectedNode)
    : [];

  return (
    <div className="absolute inset-0 pointer-events-none flex flex-col justify-between p-4 md:p-6 z-10">
      {/* Top Bar */}
      <div className="flex justify-between items-start">
        {/* System Status Panel */}
        <motion.div 
          initial={{ opacity: 0, x: -30 }} 
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="pointer-events-auto glass-panel rounded-2xl p-5 max-w-xs"
        >
          <div className="flex items-center gap-2 mb-3">
            <div className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse-glow" />
            <h2 className="text-cyan-400 text-[10px] font-mono uppercase tracking-[0.2em]">
              System Online
            </h2>
          </div>
          <h1 className="text-white text-2xl md:text-3xl font-bold mb-1">
            Stratos <span className="text-cyan-400 text-glow-cyan">Twin</span>
          </h1>
          <p className="text-gray-500 text-xs font-mono mb-4">
            Zero-Gravity Supply Chain Intelligence
          </p>
          
          <div className="space-y-2.5 text-sm">
            <div className="flex justify-between items-center">
              <span className="text-gray-400 text-xs">Active Nodes</span>
              <span className="text-cyan-400 font-mono text-sm">{physicsState.nodes.length}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-400 text-xs">Active Routes</span>
              <span className="text-green-400 font-mono text-sm">{activeRoutes}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-400 text-xs">Disrupted</span>
              <span className={`font-mono text-sm ${brokenRoutes > 0 ? 'text-red-400 text-glow-red' : 'text-gray-500'}`}>
                {brokenRoutes}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-400 text-xs">Avg Tension</span>
              <span className={`font-mono text-sm ${avgTension > 10 ? 'text-amber-400' : 'text-cyan-400'}`}>
                {avgTension.toFixed(1)}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-400 text-xs">Total Cargo</span>
              <span className="text-purple-400 font-mono text-sm">{formatNumber(totalCargo)} TEU</span>
            </div>
          </div>
        </motion.div>

        {/* Time & Status */}
        <motion.div 
          initial={{ opacity: 0, x: 30 }} 
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="pointer-events-auto glass-panel rounded-2xl p-4 text-right"
        >
          <div className="text-gray-500 text-[10px] font-mono uppercase tracking-wider mb-1">
            UTC Time
          </div>
          <div className="text-white font-mono text-lg">
            {time.toUTCString().split(' ').slice(4, 5).join(' ')}
          </div>
          <div className="text-gray-500 text-[10px] font-mono mt-2">
            Physics Engine: <span className="text-cyan-400">ACTIVE</span>
          </div>
          <div className="text-gray-500 text-[10px] font-mono">
            Gravity: <span className="text-green-400">0.0 m/s²</span>
          </div>
        </motion.div>
      </div>

      {/* Selected Node Panel */}
      <AnimatePresence>
        {selectedNodeData && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            className="pointer-events-auto glass-panel-bright rounded-2xl p-5 max-w-sm absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
          >
            <div className="flex items-center gap-3 mb-4">
              <div 
                className="w-4 h-4 rounded-full"
                style={{ backgroundColor: selectedNodeData.color, boxShadow: `0 0 10px ${selectedNodeData.color}` }}
              />
              <div>
                <h3 className="text-white text-lg font-bold">{selectedNodeData.label}</h3>
                <p className="text-gray-400 text-xs font-mono uppercase">
                  {selectedNodeData.type} • {selectedNodeData.id}
                </p>
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div className="bg-white/5 rounded-lg p-3">
                <div className="text-gray-500 text-[10px] font-mono uppercase">Cargo</div>
                <div className="text-white font-mono text-lg">{selectedNodeData.cargo} TEU</div>
              </div>
              <div className="bg-white/5 rounded-lg p-3">
                <div className="text-gray-500 text-[10px] font-mono uppercase">Mass</div>
                <div className="text-white font-mono text-lg">{selectedNodeData.mass.toFixed(1)}k</div>
              </div>
              <div className="bg-white/5 rounded-lg p-3">
                <div className="text-gray-500 text-[10px] font-mono uppercase">Connections</div>
                <div className="text-white font-mono text-lg">{selectedNodeTethers.length}</div>
              </div>
              <div className="bg-white/5 rounded-lg p-3">
                <div className="text-gray-500 text-[10px] font-mono uppercase">Velocity</div>
                <div className="text-white font-mono text-lg">
                  {selectedNodeData.velocity.length().toFixed(2)}
                </div>
              </div>
            </div>
            
            <div className="space-y-2">
              {selectedNodeTethers.map(tether => {
                const otherNodeId = tether.from === selectedNode ? tether.to : tether.from;
                const otherNode = physicsState.nodes.find(n => n.id === otherNodeId);
                return (
                  <div key={tether.id} className="flex items-center justify-between bg-white/5 rounded-lg px-3 py-2">
                    <div className="flex items-center gap-2">
                      <div 
                        className="w-2 h-2 rounded-full"
                        style={{ backgroundColor: otherNode?.color }}
                      />
                      <span className="text-gray-300 text-xs">{otherNode?.label}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`font-mono text-xs ${tether.tension > 15 ? 'text-red-400' : tether.tension > 8 ? 'text-amber-400' : 'text-cyan-400'}`}>
                        {tether.tension.toFixed(1)}
                      </span>
                      {!tether.broken && (
                        <button 
                          onClick={() => onBreakTether(tether.id)}
                          className="text-red-400/60 hover:text-red-400 text-xs transition-colors"
                          title="Break route"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Bottom Controls */}
      <div className="flex justify-between items-end">
        {/* Metrics Toggle */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.5 }}
          className="pointer-events-auto"
        >
          <button 
            onClick={() => setShowMetrics(!showMetrics)}
            className="glass-panel rounded-xl px-4 py-2 text-gray-400 text-xs font-mono hover:text-white transition-colors"
          >
            {showMetrics ? '◉ METRICS ON' : '○ METRICS OFF'}
          </button>
        </motion.div>

        {/* Action Buttons */}
        <motion.div 
          initial={{ opacity: 0, y: 30 }} 
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.4 }}
          className="pointer-events-auto flex gap-3"
        >
          <button 
            onClick={onSimulateDisruption}
            className="px-4 md:px-6 py-3 bg-white/5 backdrop-blur-md border border-white/20 rounded-xl text-white font-medium text-sm hover:bg-white/10 transition-all hover:scale-105 active:scale-95 btn-glow-red"
          >
            <span className="hidden md:inline">⚡ </span>Simulate Disruption
          </button>
          <button 
            onClick={onRebalance}
            className="px-4 md:px-6 py-3 bg-cyan-500/10 backdrop-blur-md border border-cyan-400/40 rounded-xl text-cyan-400 font-medium text-sm hover:bg-cyan-500/20 transition-all hover:scale-105 active:scale-95 btn-glow"
          >
            <span className="hidden md:inline">⟳ </span>Rebalance Network
          </button>
        </motion.div>
      </div>

      {/* Network Health Bar */}
      {showMetrics && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="absolute bottom-20 left-4 right-4 md:left-6 md:right-6 pointer-events-none"
        >
          <div className="glass-panel rounded-xl p-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-gray-500 text-[10px] font-mono uppercase tracking-wider">Network Health</span>
              <span className={`font-mono text-xs ${criticalRoutes > 0 ? 'text-red-400' : 'text-green-400'}`}>
                {criticalRoutes > 0 ? `${criticalRoutes} CRITICAL` : 'NOMINAL'}
              </span>
            </div>
            <div className="flex gap-1 h-2">
              {physicsState.tethers.map((tether, i) => (
                <div 
                  key={tether.id}
                  className="flex-1 rounded-full transition-all duration-500"
                  style={{ 
                    backgroundColor: tether.broken 
                      ? '#333' 
                      : tether.tension > 15 
                        ? '#ff0055' 
                        : tether.tension > 8 
                          ? '#f59e0b' 
                          : '#00ffcc',
                    opacity: tether.broken ? 0.3 : 0.8
                  }}
                />
              ))}
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );
}
