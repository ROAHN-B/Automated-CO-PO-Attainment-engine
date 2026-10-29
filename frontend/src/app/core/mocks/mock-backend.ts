/**
 * The demo backend's shared state. The coordinator and faculty services each
 * talk to their own mock store, but one backend sits behind both: a coordinator's
 * completed allocation must appear on the allocated faculty member's dashboard.
 */
import { CoordinationMockStore } from './coordination.mock';

/**
 * The POE demo (30 Oct 2026): the faculty demo account sees two courses, Computer
 * Networks finished from start to close-out, and Network Security waiting at
 * "Accept allocation". Tests build their own stores without it.
 */
export const POE_DEMO = true;

let coordination: CoordinationMockStore | undefined;

export function coordinationMock(): CoordinationMockStore {
  return (coordination ??= new CoordinationMockStore({ poeDemo: POE_DEMO }));
}
