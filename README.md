# Gradiks - Astro.js Website

This is the Astro.js version of the Gradiks educational consultancy website, converted from static HTML files.

## 🚀 Project Structure

```
/
├── public/                 # Static assets
│   ├── logo-2x.webp       # Logo images
│   ├── logo.png
│   └── logo-small.png
├── src/
│   ├── components/        # Reusable components
│   │   ├── Navigation.astro
│   │   └── Footer.astro
│   ├── layouts/           # Page layouts
│   │   ├── MainLayout.astro      # Warm theme (home page)
│   │   └── CountryLayout.astro   # Dark theme (country pages)
│   ├── pages/             # Website pages
│   │   ├── index.astro           # Home page (MBBS Abroad)
│   │   ├── germany-study.astro   # Germany programs
│   │   ├── ireland-study.astro   # Ireland programs
│   │   ├── uk-study.astro        # UK programs
│   │   └── india-medical.astro   # India NEET counselling
│   └── styles/
│       └── global.css     # Tailwind CSS import
├── astro.config.mjs       # Astro configuration
├── tailwind.config.js     # Tailwind CSS configuration
└── package.json
```

## 📄 Pages

| Page | Route | Description |
|------|-------|-------------|
| Home | `/` | Main landing page - MBBS Abroad consultancy |
| Germany | `/germany-study/` | Tuition-free Master's programs in Germany |
| Ireland | `/ireland-study/` | MSc, MBA programs with 2-year stay-back |
| UK | `/uk-study/` | Masters, MBA, Nursing programs |
| India Medical | `/india-medical/` | NEET counselling support for South India |

## 🎨 Themes

- **Warm Theme (MainLayout)**: Used for the home page - coral, teal, and cream colors
- **Dark Theme (CountryLayout)**: Used for country pages - red, black, and gold colors

## 🧞 Commands

All commands are run from the root of the project:

| Command           | Action                                       |
| :---------------- | :------------------------------------------- |
| `npm install`     | Installs dependencies                        |
| `npm run dev`     | Starts local dev server at `localhost:4321`  |
| `npm run build`   | Build your production site to `./dist/`      |
| `npm run preview` | Preview your build locally                   |

## 📦 Deployment

The `dist/` folder contains the static build output that can be deployed to any static hosting platform:
- Netlify
- Vercel
- GitHub Pages
- AWS S3 + CloudFront
- Any web server

## 🔧 Technologies

- [Astro](https://astro.build/) - Static site generator
- [Tailwind CSS](https://tailwindcss.com/) - Utility-first CSS framework
- TypeScript - Type-safe JavaScript

## 📝 Notes

- All pages are statically generated at build time
- Forms use client-side JavaScript for submission feedback (demo only)
- Responsive design works on mobile, tablet, and desktop
- Optimized for performance with minimal JavaScript
