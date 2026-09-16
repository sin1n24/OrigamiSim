import { defineConfig } from 'vite';

// Served at https://sin1n24.github.io/OrigamiSim/ (a project page, not a
// user/org root page), so asset URLs need this base -- otherwise the built
// JS/CSS reference absolute root paths and 404 under the /OrigamiSim/ prefix.
export default defineConfig({
  base: '/OrigamiSim/',
});
