import { useState, useEffect, useRef, useCallback } from 'react';

export interface TelemetryEvent {
  type: 'ROUTE_SNAP' | 'TENSION_WARNING' | 'CARGO_UPDATE' | 'NODE_STRESS' | 'REROUTE';
  id?: string;
  value?: number;
  timestamp: number;
  message: string;
}

interface TelemetryState {
  events: TelemetryEvent[];
  isSimulating: boolean;
  lastEventTime: number;
  eventCount: number;
  routeSnapCount: number;
}

export function useTelemetry(
  routeIds: string[],
  onRouteSnap?: (routeId: string) => void,
  onTensionUpdate?: (value: number) => void
) {
  const [state, setState] = useState<TelemetryState>({
    events: [],
    isSimulating: true,
    lastEventTime: Date.now(),
    eventCount: 0,
    routeSnapCount: 0,
  });
  
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastSnapTimeRef = useRef(0);

  const addEvent = useCallback((event: TelemetryEvent) => {
    setState(prev => ({
      ...prev,
      events: [...prev.events.slice(-15), event],
      lastEventTime: event.timestamp,
      eventCount: prev.eventCount + 1,
      routeSnapCount: event.type === 'ROUTE_SNAP' ? prev.routeSnapCount + 1 : prev.routeSnapCount,
    }));
  }, []);

  useEffect(() => {
    if (!state.isSimulating || routeIds.length === 0) return;

    // Initial startup event
    addEvent({
      type: 'CARGO_UPDATE',
      timestamp: Date.now(),
      message: 'Telemetry stream initialized — receiving live data',
    });

    intervalRef.current = setInterval(() => {
      const now = Date.now();
      const randomEvent = Math.random();
      
      if (randomEvent > 0.75 && now - lastSnapTimeRef.current > 8000) {
        // 25% chance to trigger a route snap (but not more than once per 8 seconds)
        const randomRoute = routeIds[Math.floor(Math.random() * routeIds.length)];
        lastSnapTimeRef.current = now;
        
        const event: TelemetryEvent = {
          type: 'ROUTE_SNAP',
          id: randomRoute,
          timestamp: now,
          message: `⚡ CRITICAL: Route ${randomRoute} has failed — cargo drifting`,
        };
        
        addEvent(event);
        onRouteSnap?.(randomRoute);
      } else if (randomEvent > 0.5) {
        // Tension warning
        const tension = Math.random() * 25;
        const event: TelemetryEvent = {
          type: 'TENSION_WARNING',
          value: tension,
          timestamp: now,
          message: tension > 15 
            ? `⚠ High tension detected: ${tension.toFixed(1)}N` 
            : `Route tension nominal: ${tension.toFixed(1)}N`,
        };
        
        addEvent(event);
        onTensionUpdate?.(tension);
      } else if (randomEvent > 0.3) {
        // Cargo update
        const cargo = Math.floor(Math.random() * 500) + 100;
        addEvent({
          type: 'CARGO_UPDATE',
          value: cargo,
          timestamp: now,
          message: `📦 Cargo flow update: ${cargo} TEU transferred`,
        });
      } else {
        // Node stress
        addEvent({
          type: 'NODE_STRESS',
          timestamp: now,
          message: '🔄 Node gravitational stress within parameters',
        });
      }
    }, 4000); // New data every 4 seconds

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [state.isSimulating, routeIds, addEvent, onRouteSnap, onTensionUpdate]);

  const toggleSimulation = useCallback(() => {
    setState(prev => ({ ...prev, isSimulating: !prev.isSimulating }));
  }, []);

  return {
    events: state.events,
    isSimulating: state.isSimulating,
    toggleSimulation,
    eventCount: state.eventCount,
    routeSnapCount: state.routeSnapCount,
    lastEventTime: state.lastEventTime,
  };
}
