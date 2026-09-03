import { JwtAuthGuard } from './jwt-auth.guard';
import { describePublicRouteGuard } from './public-route-guard.testkit';

describe('JwtAuthGuard', () => {
  describePublicRouteGuard(JwtAuthGuard);
});
