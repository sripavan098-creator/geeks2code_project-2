import { motion, AnimatePresence } from 'framer-motion';
import { useState, useEffect } from 'react';
import type { PhysicsState } from './StratosCanvas';
import type { TelemetryEvent } from '../hooks/useTelemetry';

interface HUDProps {
  physicsState: PhysicsState;
  selectedNode: string | null;
  onBreakTether: (tetherId: string) => void;
  onRebalance: () => void;
  onSimulateDisruption: () => void;
  telemetryEvents?: TelemetryEvent[];
  isTelemetryActive?: boolean;
  onToggleTelemetry?: () => void;
  telemetryEventCount?: number;
  telemetrySnapCount?: number;
}

function formatNumber(n: number): string {
  return n.toLocaleString();
}

export default function HUD({ 
  physicsState, 
  selectedNode, 
  onBreakTether, 
  onRebalance, 
  onSimulateDisruption,
  telemetryEvents = [],
  isTelemetryActive = true,
  onToggleTelemetry,
  telemetryEventCount = 0,
  telemetrySnapCount = 0,
}: HUDProps) {
  const [time, setTime] = useState(new Date());
  const [showMetrics, setShowMetrics] = useState(true);
  const [fps, setFps] = useState(60);
  
  useEffect(() => {
    const interval = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  // Simple FPS counter
  useEffect(() => {
    let lastTime = performance.now();
    let frames = 0;
    const measure = () => {
      frames++;
      const now = performance.now();
      if (now - lastTime >= 1000) {
        setFps(frames);
        frames = 0;
        lastTime = now;
      }
      requestAnimationFrame(measure);
    };
    const raf = requestAnimationFrame(measure);
    return () => cancelAnimationFrame(raf);
  }, []);

  const totalTension = physicsState.tethers.reduce((sum, t) => sum + t.tension, 0);
  const avgTension = physicsState.tethers.length > 0 ? totalTension / physicsState.tethers.length : 0;
  const maxTension = Math.max(...physicsState.tethers.map(t => t.tension), 0);
  const criticalRoutes = physicsState.tethers.filter(t => t.tension > 15 && !t.broken).length;
  const totalCargo = physicsState.nodes.reduce((sum, n) => sum + n.cargo, 0);
  const activeRoutes = physicsState.tethers.filter(t => !t.broken).length;
  const brokenRoutes = physicsState.tethers.filter(t => t.broken).length;
  const networkHealth = Math.round((activeRoutes / physicsState.tethers.length) * 100);
  
  const selectedNodeData = selectedNode ? physicsState.nodes.find(n => n.id === selectedNode) : null;
  const selectedNodeTethers = selectedNode 
    ? physicsState.tethers.filter(t => t.from === selectedNode || t.to === selectedNode)
    : [];

  return (
    <div className="absolute inset-0 pointer-events-none flex flex-col justify-between p-4 md:p-6 z-10">
      {/* Top Bar */}
      <div className="flex justify-between items-start gap-4">
        {/* System Status Panel */}
        <motion.div 
          initial={{ opacity: 0, x: -30 }} 
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.8, delay: 0.2 }}
          className="pointer-events-auto glass-panel rounded-2xl p-5 max-w-[280px]"
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
          <p className="text-gray-500 text-[10px] font-mono mb-4">
            Zero-Gravity Supply Chain Intelligence
          </p>
          
          <div className="space-y-2.5 text-sm">
            <div className="flex justify-between items-center">
              <span className="text-gray-400 text-xs">Active Nodes</span>
              <span className="text-cyan-400 font-mono text-sm">{physicsState.nodes.length}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-400 text-xs">Active Routes</span>
              <span className="text-green-400 font-mono text-sm">{activeRoutes}/{physicsState.tethers.length}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-400 text-xs">Disrupted</span>
              <span className={`font-mono text-sm ${brokenRoutes > 0 ? 'text-red-400 text-glow-red' : 'text-gray-600'}`}>
                {brokenRoutes > 0 ? `⚠ ${brokenRoutes}` : '— None'}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-400 text-xs">Avg Tension</span>
              <span className={`font-mono text-sm ${avgTension > 10 ? 'text-amber-400' : 'text-cyan-400'}`}>
                {avgTension.toFixed(1)}N
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-400 text-xs">Peak Tension</span>
              <span className={`font-mono text-sm ${maxTension > 15 ? 'text-red-400' : 'text-cyan-400'}`}>
                {maxTension.toFixed(1)}N
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
          transition={{ duration: 0.8, delay: 0.3 }}
          className="pointer-events-auto glass-panel rounded-2xl p-4 text-right"
        >
          <div className="text-gray-500 text-[10px] font-mono uppercase tracking-wider mb-1">
            UTC Time
          </div>
          <div className="text-white font-mono text-lg">
            {time.toUTCString().split(' ').slice(4, 5).join(' ')}
          </div>
          <div className="mt-3 space-y-1">
            <div className="text-gray-500 text-[10px] font-mono">
              Physics: <span className="text-cyan-400">ACTIVE</span>
            </div>
            <div className="text-gray-500 text-[10px] font-mono">
              Gravity: <span className="text-green-400">0.0 m/s²</span>
            </div>
            <div className="text-gray-500 text-[10px] font-mono">
              Render: <span className={fps >= 50 ? 'text-green-400' : fps >= 30 ? 'text-amber-400' : 'text-red-400'}>{fps} FPS</span>
            </div>
            <div className="text-gray-500 text-[10px] font-mono">
              Network: <span className={networkHealth >= 80 ? 'text-green-400' : networkHealth >= 50 ? 'text-amber-400' : 'text-red-400'}>{networkHealth}%</span>
            </div>
            <div className="text-gray-500 text-[10px] font-mono">
              Telemetry: <span className={isTelemetryActive ? 'text-green-400' : 'text-gray-500'}>{isTelemetryActive ? '● LIVE' : '○ PAUSED'}</span>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Live Telemetry Feed */}
      <motion.div
        initial={{ opacity: 0, x: 30 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.8, delay: 0.5 }}
        className="pointer-events-auto glass-panel rounded-2xl p-4 max-w-[280px] absolute right-4 md:right-6 top-40"
      >
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${isTelemetryActive ? 'bg-green-400 animate-pulse' : 'bg-gray-500'}`} />
            <h3 className="text-gray-300 text-[10px] font-mono uppercase tracking-[0.15em]">
              Live Telemetry
            </h3>
          </div>
          {onToggleTelemetry && (
            <button 
              onClick={onToggleTelemetry}
              className="text-[9px] font-mono text-gray-500 hover:text-white transition-colors"
            >
              {isTelemetryActive ? 'PAUSE' : 'RESUME'}
            </button>
          )}
        </div>
        
        <div className="flex gap-4 mb-3 text-[10px] font-mono">
          <div>
            <span className="text-gray-500">Events: </span>
            <span className="text-cyan-400">{telemetryEventCount}</span>
          </div>
          <div>
            <span className="text-gray-500">Snaps: </span>
            <span className="text-red-400">{telemetrySnapCount}</span>
          </div>
        </div>
        
        <div className="space-y-1 max-h-32 overflow-y-auto">
          {telemetryEvents.slice(-5).reverse().map((event, i) => (
            <div 
              key={`${event.timestamp}-${i}`}
              className={`text-[9px] font-mono px-2 py-1 rounded ${
                event.type === 'ROUTE_SNAP' 
                  ? 'bg-red-500/10 text-red-400 border border-red-500/20' 
                  : event.type === 'TENSION_WARNING' && (event.value ?? 0) > 15
                    ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                    : 'bg-white/5 text-gray-400'
              }`}
            >
              {event.message}
            </div>
          ))}
          {telemetryEvents.length === 0 && (
            <div className="text-[9px] font-mono text-gray-600 px-2 py-1">
              Awaiting telemetry data...
            </div>
          )}
        </div>
      </motion.div>

      {/* Selected Node Panel */}
      <AnimatePresence>
        {selectedNodeData && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ duration: 0.3 }}
            className="pointer-events-auto glass-panel-bright rounded-2xl p-5 max-w-sm absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
          >
            <div className="flex items-center gap-3 mb-4">
              <div 
                className="w-4 h-4 rounded-full animate-pulse-glow"
                style={{ backgroundColor: selectedNodeData.color, boxShadow: `0 0 12px ${selectedNodeData.color}` }}
              />
              <div>
                <h3 className="text-white text-lg font-bold">{selectedNodeData.label}</h3>
                <p className="text-gray-400 text-[10px] font-mono uppercase tracking-wider">
                  {selectedNodeData.type} • ID: {selectedNodeData.id}
                </p>
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-2 mb-4">
              <div className="bg-white/5 rounded-lg p-3">
                <div className="text-gray-500 text-[9px] font-mono uppercase">Cargo</div>
                <div className="text-white font-mono text-base">{formatNumber(selectedNodeData.cargo)} TEU</div>
              </div>
              <div className="bg-white/5 rounded-lg p-3">
                <div className="text-gray-500 text-[9px] font-mono uppercase">Mass</div>
                <div className="text-white font-mono text-base">{selectedNodeData.mass.toFixed(1)}×10³</div>
              </div>
              <div className="bg-white/5 rounded-lg p-3">
                <div className="text-gray-500 text-[9px] font-mono uppercase">Links</div>
                <div className="text-white font-mono text-base">{selectedNodeTethers.length}</div>
              </div>
              <div className="bg-white/5 rounded-lg p-3">
                <div className="text-gray-500 text-[9px] font-mono uppercase">Speed</div>
                <div className="text-white font-mono text-base">{selectedNodeData.velocity.length().toFixed(2)} m/s</div>
              </div>
            </div>
            
            <div className="text-gray-500 text-[9px] font-mono uppercase tracking-wider mb-2">Connected Routes</div>
            <div className="space-y-1.5 max-h-40 overflow-y-auto">
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
                      <span className={`font-mono text-[10px] ${tether.broken ? 'text-gray-600 line-through' : tether.tension > 15 ? 'text-red-400' : tether.tension > 8 ? 'text-amber-400' : 'text-cyan-400'}`}>
                        {tether.broken ? 'BROKEN' : `${tether.tension.toFixed(1)}N`}
                      </span>
                      {!tether.broken && (
                        <button 
                          onClick={() => onBreakTether(tether.id)}
                          className="text-red-400/50 hover:text-red-400 text-xs transition-colors w-5 h-5 flex items-center justify-center rounded hover:bg-red-400/10"
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
            
            <p className="text-gray-600 text-[9px] font-mono mt-3 text-center">
              Click outside to deselect • Drag nodes to test tension
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Bottom Controls */}
      <div className="flex justify-between items-end">
        {/* Instructions */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.6 }}
          className="pointer-events-auto hidden md:block"
        >
          <div className="glass-panel rounded-xl px-4 py-3 max-w-[200px]">
            <div className="text-gray-500 text-[9px] font-mono uppercase tracking-wider mb-2">Controls</div>
            <div className="space-y-1 text-[10px] text-gray-400 font-mono">
              <div>🖱️ <span className="text-gray-300">Drag</span> nodes to test</div>
              <div>🎯 <span className="text-gray-300">Click</span> node for details</div>
              <div>🔄 <span className="text-gray-300">Scroll</span> to zoom</div>
              <div>✋ <span className="text-gray-300">Right-drag</span> to orbit</div>
            </div>
          </div>
        </motion.div>

        {/* Action Buttons */}
        <motion.div 
          initial={{ opacity: 0, y: 30 }} 
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.4 }}
          className="pointer-events-auto flex gap-3"
        >
          <button 
            onClick={onSimulateDisruption}
            className="group px-4 md:px-5 py-3 bg-red-500/5 backdrop-blur-md border border-red-400/20 rounded-xl text-red-400 font-medium text-xs md:text-sm hover:bg-red-500/15 hover:border-red-400/40 transition-all hover:scale-105 active:scale-95"
          >
            <span className="group-hover:animate-pulse">⚡</span>
            <span className="hidden md:inline ml-1">Disrupt Route</span>
          </button>
          <button 
            onClick={onRebalance}
            className="group px-4 md:px-5 py-3 bg-cyan-500/10 backdrop-blur-md border border-cyan-400/30 rounded-xl text-cyan-400 font-medium text-xs md:text-sm hover:bg-cyan-500/20 hover:border-cyan-400/50 transition-all hover:scale-105 active:scale-95 btn-glow"
          >
            <span className="group-hover:animate-spin inline-block">⟳</span>
            <span className="hidden md:inline ml-1">Rebalance</span>
          </button>
        </motion.div>
      </div>

      {/* Network Health Bar */}
      {showMetrics && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8 }}
          className="absolute bottom-20 left-4 right-4 md:left-6 md:right-6 pointer-events-none"
        >
          <div className="glass-panel rounded-xl p-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-gray-500 text-[9px] font-mono uppercase tracking-wider">Route Tension Map</span>
              <span className={`font-mono text-[10px] ${criticalRoutes > 0 ? 'text-red-400' : brokenRoutes > 0 ? 'text-amber-400' : 'text-green-400'}`}>
                {criticalRoutes > 0 ? `⚠ ${criticalRoutes} CRITICAL` : brokenRoutes > 0 ? `⚡ ${brokenRoutes} DISRUPTED` : '✓ ALL NOMINAL'}
              </span>
            </div>
            <div className="flex gap-0.5 h-2.5">
              {physicsState.tethers.map((tether) => (
                <div 
                  key={tether.id}
                  className="flex-1 rounded-full transition-all duration-700 relative overflow-hidden"
                  style={{ 
                    backgroundColor: tether.broken 
                      ? '#1a1a1a' 
                      : tether.tension > 15 
                        ? '#ff0055' 
                        : tether.tension > 8 
                          ? '#f59e0b' 
                          : '#00ffcc',
                    opacity: tether.broken ? 0.2 : 0.8,
                    boxShadow: !tether.broken && tether.tension > 15 ? '0 0 6px #ff0055' : 'none'
                  }}
                >
                  {!tether.broken && (
                    <div 
                      className="absolute inset-0 bg-white/20 animate-pulse"
                      style={{ animationDuration: `${2 - Math.min(tether.tension / 15, 1)}s` }}
                    />
                  )}
                </div>
              ))}
            </div>
            <div className="flex justify-between mt-1.5">
              <span className="text-[8px] text-gray-600 font-mono">LOW TENSION</span>
              <span className="text-[8px] text-gray-600 font-mono">CRITICAL</span>
            </div>
          </div>
        </motion.div>
      )}

      {/* Metrics Toggle */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.7 }}
        className="absolute bottom-20 right-4 md:right-6 pointer-events-auto"
      >
        <button 
          onClick={() => setShowMetrics(!showMetrics)}
          className="glass-panel rounded-lg px-3 py-1.5 text-gray-500 text-[9px] font-mono hover:text-white transition-colors"
        >
          {showMetrics ? '◉' : '○'} METRICS
        </button>
      </motion.div>
    </div>
  );
}
