import { defineConfig } from 'astro/config';

export default defineConfig({
  site: 'https://brendankowitz.github.io',
  base: '/dsp-fhir',
  trailingSlash: 'ignore',
  devToolbar: { enabled: false }
});
