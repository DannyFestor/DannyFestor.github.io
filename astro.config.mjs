import mdx from "@astrojs/mdx";
// @ts-check
import { defineConfig } from "astro/config";
import githubdark from "shiki/themes/github-dark.mjs";
import githublight from "shiki/themes/github-light.mjs";

import sitemap from "@astrojs/sitemap";

// https://astro.build/config
export default defineConfig({
    site: "https://DannyFestor.github.io",
	integrations: [mdx(), sitemap()],

	markdown: {
		shikiConfig: {
			themes: {
				light: githublight,
				dark: githubdark,
			},
			defaultColor: false,
			wrap: true,
			transformers: [],
		},
	},
});
