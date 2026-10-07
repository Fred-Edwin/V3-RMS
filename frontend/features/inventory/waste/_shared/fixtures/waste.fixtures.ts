import type { FixtureHandler } from '../../../_shared/services/scw-call';
import { fail } from '../../../_shared/fixtures/fixture-clock';

export const wasteFixtureHandler: FixtureHandler = ({ method, path }) => fail(404, 'NOT_FOUND', `No fixture for ${method} ${path}`);
