/**
 * The demo backend's shared state. The coordinator and faculty services each
 * talk to their own mock store, but one backend sits behind both: a coordinator's
 * completed allocation must appear on the allocated faculty member's dashboard.
 */
import { CoordinationMockStore } from './coordination.mock';

let coordination: CoordinationMockStore | undefined;

export function coordinationMock(): CoordinationMockStore {
  return (coordination ??= new CoordinationMockStore());
}
