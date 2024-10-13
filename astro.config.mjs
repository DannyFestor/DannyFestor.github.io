// @ts-check
import {defineConfig} from 'astro/config';
import mdx from '@astrojs/mdx';
import githublight from 'shiki/themes/github-light.mjs'
import githubdark from 'shiki/themes/github-dark.mjs'

import sitemap from '@astrojs/sitemap';

// https://astro.build/config
export default defineConfig({
    site: 'https://example.com',
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