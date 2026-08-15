import { ReplaySession } from './types';

const ORCHESTRATOR = process.env.NEXT_PUBLIC_ORCHESTRATOR_URL || 'http://localhost:8090';

export async function listSessions(): Promise<ReplaySession[]> {
  const res = await fetch(`${ORCHESTRATOR}/replay`, { next: { revalidate: 5 } });
  if (!res.ok) throw new Error(`Failed to list sessions: ${res.status}`);
  return res.json();
}

export async function getSession(sessionId: string): Promise<ReplaySession> {
  const res = await fetch(`${ORCHESTRATOR}/replay/${sessionId}`, {
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`Failed to get session: ${res.status}`);
  return res.json();
}

export async function startReplay(params: {
  startTraceId: string;
  services: string[];
}): Promise<{ sessionId: string; status: string }> {
  const res = await fetch(`${ORCHESTRATOR}/replay`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  if (!res.ok) throw new Error(`Failed to start replay: ${res.status}`);
  return res.json();
}
