export interface ServerToClientEvents {
  'joined:branch': (payload: { room: string }) => void;
  'error:join:branch': (payload: { message: string }) => void;
}

export interface ClientToServerEvents {
  'join:branch': (payload: { organizationId: string }) => void;
}
