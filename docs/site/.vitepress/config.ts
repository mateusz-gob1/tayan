import { defineConfig } from 'vitepress';

// Published at https://<user>.github.io/tayan/ (see .github/workflows/docs.yml)
export default defineConfig({
  title: 'Tayan',
  base: '/tayan/',
  cleanUrls: true,
  themeConfig: {
    socialLinks: [{ icon: 'github', link: 'https://github.com/mateusz-gob1/tayan' }],
  },
  locales: {
    root: {
      label: 'English',
      lang: 'en',
      description: 'A real-time multiplayer bluffing card game',
      themeConfig: {
        nav: [
          { text: 'Rules', link: '/en/rules' },
          { text: 'Hands', link: '/en/hands' },
          { text: 'FAQ', link: '/en/faq' },
        ],
        sidebar: [
          { text: 'Rules', link: '/en/rules' },
          { text: 'Hand ranking', link: '/en/hands' },
          { text: 'FAQ', link: '/en/faq' },
        ],
      },
    },
    pl: {
      label: 'Polski',
      lang: 'pl',
      link: '/pl/',
      description: 'Przeglądarkowa gra karciana multiplayer w czasie rzeczywistym',
      themeConfig: {
        nav: [
          { text: 'Zasady', link: '/pl/zasady' },
          { text: 'Układy', link: '/pl/uklady' },
          { text: 'FAQ', link: '/pl/faq' },
        ],
        sidebar: [
          { text: 'Zasady', link: '/pl/zasady' },
          { text: 'Ranking układów', link: '/pl/uklady' },
          { text: 'FAQ', link: '/pl/faq' },
        ],
      },
    },
  },
});
