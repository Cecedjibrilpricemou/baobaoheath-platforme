import { AsyncLocalStorage } from 'async_hooks';

interface RequestContextData {
  requestId: string;
  userId?: string;
}

export const requestContext = new AsyncLocalStorage<RequestContextData>();

export function getRequestId(): string | undefined {
  return requestContext.getStore()?.requestId;
}

export function setContextUserId(userId: string): void {
  const store = requestContext.getStore();
  if (store) store.userId = userId;
}

export function getContextUserId(): string | undefined {
  return requestContext.getStore()?.userId;
}
