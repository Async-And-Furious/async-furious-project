import { JwtCustomerAuthGuard } from './jwt-customer-auth.guard';
import { describePublicRouteGuard } from './public-route-guard.testkit';

describe('JwtCustomerAuthGuard', () => {
  describePublicRouteGuard(JwtCustomerAuthGuard);
});
