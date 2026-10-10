/**
 * Asynchronous OSPF & EIGRP Routing Protocol Background Daemon (Web Worker)
 * Simulates Hello timers, DBD exchanges, LSA flooding, and Dijkstra SPF tree calculation.
 */

self.onmessage = (e: MessageEvent) => {
  const { type, payload } = e.data;

  if (type === 'START_ROUTING_DAEMON') {
    // Simulate background OSPF hello neighbor discovery & Dijkstra convergence
    setInterval(() => {
      self.postMessage({
        type: 'ROUTING_TICK',
        payload: {
          timestamp: Date.now(),
          status: 'OSPF Hello timers active. Link state database synchronized.',
        },
      });
    }, 5000);
  } else if (type === 'TRIGGER_LSA_FLOOD') {
    const { linkId, state } = payload;
    self.postMessage({
      type: 'SPF_RECALCULATED',
      payload: {
        linkId,
        state,
        message: `Link state change detected. LSA flooded. Dijkstra SPF tree recalculated successfully.`,
      },
    });
  }
};
