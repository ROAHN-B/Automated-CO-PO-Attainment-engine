export const environment = {
  production: false,
  useMockData: true,
  /**
   * Areas served by the real backend; every other area still uses the in-memory mocks.
   * 'auth' sign-in · 'admin' Super Admin screens · 'course' every course the mock doesn't know
   * (Network Security in the POE demo; needs 'auth' for the token). For the POE: ['auth', 'course'].
   */
  liveAreas: [] as string[],
  apiBaseUrl: 'http://localhost:8081/api/v1'
};
