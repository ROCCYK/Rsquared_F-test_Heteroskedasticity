# 📈 Regression Diagnostics

An interactive web app for learning regression diagnostics — drag data points and watch R², F-statistic, and heteroskedasticity update in real time.

**Live demo:** [heteroskedasticity.netlify.app](https://heteroskedasticity.netlify.app)

---

## What it does

- **Drag data points** on a scatter plot and see the regression line update instantly
- **R²** — measures how much variance in Y is explained by the model
- **F-statistic & p-value** — tests whether the model's fit is statistically significant or could be due to chance
- **Heteroskedasticity score** — detects whether residuals fan out (which makes p-values unreliable)
- **Residual plot** — visualises the spread of errors against fitted values, with envelope lines that reveal fan patterns

---

## Presets

| Preset | Description |
|--------|-------------|
| Weak fit | High noise, low R², non-significant F |
| Moderate fit | Balanced signal and noise |
| Strong fit | Tight clustering around the line, high R² |
| Fan / Hetero | Spread grows with X — classic heteroskedasticity |

---

## Concepts covered

**R²** tells you how much of the outcome your model explains. A value of 0.80 means 80% of the variation in Y is captured by the regression line.

**F-test** asks whether that R² is trustworthy or could have appeared by chance. A low p-value (< 0.05) means the result is statistically significant.

**Heteroskedasticity** occurs when the variance of residuals is not constant — it fans out as X increases. This doesn't bias your coefficients, but it makes standard errors and p-values unreliable. Fixes include robust standard errors or log-transforming Y.

---

## Tech stack

- [React](https://react.dev/) + [TypeScript](https://www.typescriptlang.org/)
- [Vite](https://vitejs.dev/) for bundling
- Pure SVG for charts (no charting library)
- All statistics computed from scratch in JavaScript (regression, F p-value via regularized incomplete beta, Breusch-Pagan-style heteroskedasticity score)
- Deployed on [Netlify](https://netlify.com)

---

## Running locally

```bash
git clone https://github.com/ROCCYK/Rsquared_F-test_Heteroskedasticity
cd Rsquared_F-test_Heteroskedasticity
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173).

## Building for production

```bash
npm run build
```

Output goes to `dist/`. Deploy by dragging that folder to [Netlify Drop](https://app.netlify.com/drop) or push to GitHub for automatic deploys.

---

## Project structure

```
src/
└── App.tsx        # All components and logic in a single file
index.html         # Entry point with title and favicon
tsconfig.json      # TypeScript config (strict mode off)
vite.config.ts     # Vite config
```

---

## License

MIT
