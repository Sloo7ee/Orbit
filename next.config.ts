import type { NextConfig } from "next";
const config: NextConfig = {
  devIndicators: false,
  distDir: process.env.ORBIT_TEST_SERVER ? ".next-test" : ".next",
  logging: {
    serverFunctions: false,
    // Recovery URLs contain one-time tokens. Do not put them in dev logs.
    incomingRequests: { ignore: [/\/auth\/confirm/] },
  },
};
export default config;
