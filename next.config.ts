import type { NextConfig } from "next";
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";

// Lets `next dev` provide the same binding shape as the OpenNext Worker. In
// production OpenNext initializes this context before Next handles a request.
initOpenNextCloudflareForDev();

const nextConfig: NextConfig = {};

export default nextConfig;
