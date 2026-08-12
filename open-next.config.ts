import { defineCloudflareConfig } from "@opennextjs/cloudflare";

// The application has no ISR or tag-cache contract. Keep the preview adapter
// deliberately minimal so API responses retain their explicit no-store policy.
export default defineCloudflareConfig();
