# Deploying XSL-FO Studio to GitHub Pages

This project is a **frontend-only Angular 17 SPA** — perfect for GitHub Pages.
The deploy pipeline is fully automated via a GitHub Actions workflow.

---

## 1 · Push the code to GitHub

Use the **"Save to GitHub"** button in the Emergent chat input to push the
codebase to your GitHub repository. Once pushed, verify these paths exist on
GitHub:

```
.github/workflows/deploy.yml
frontend/
  angular.json
  package.json
  src/…
```

---

## 2 · Enable GitHub Pages (one-time)

1. Go to your repo on GitHub.
2. Open **Settings → Pages**.
3. Under **Build and deployment → Source**, choose **"GitHub Actions"**.
4. Save.

---

## 3 · Trigger the deploy

Any push to the `main` branch (or a manual **Run workflow** from the Actions
tab) will:

1. Install dependencies with Yarn.
2. Run a production Angular build with the correct `--base-href="/<repo-name>/"`
   (auto-detected from `github.event.repository.name`).
3. Copy `index.html` → `404.html` so client-side routing / deep links keep
   working.
4. Add `.nojekyll` to prevent GitHub from ignoring files starting with `_`.
5. Upload the `frontend/dist/frontend/browser` folder as a Pages artifact.
6. Deploy it to GitHub Pages.

Your live site will be available at:

```
https://<your-username>.github.io/<repo-name>/
```

The workflow prints the deployed URL as an output when it finishes.

---

## 4 · Running the production build locally (optional)

If you want to preview the exact bundle that gets deployed:

```bash
cd frontend
yarn install
yarn ng build --configuration production --base-href="/<your-repo-name>/"
npx http-server dist/frontend/browser -p 4200
# Visit http://localhost:4200/<your-repo-name>/
```

---

## 5 · Custom domain (optional)

If you want to serve the app from your own domain (e.g. `studio.example.com`):

1. In **Settings → Pages**, set **Custom domain** to your domain.
2. GitHub will create a `CNAME` file in the deployed branch — you don't need to
   add it manually. Alternatively, add `frontend/src/CNAME` with your domain
   and include `"src/CNAME"` in the `assets` array of `angular.json`.
3. Change the workflow's `--base-href` to `--base-href="/"` since you are now
   at the root of the custom domain. Edit `.github/workflows/deploy.yml`:

   ```yaml
   - name: Build (production)
     run: yarn ng build --configuration production --base-href="/"
   ```

---

## Troubleshooting

- **Blank page / 404 assets**: the `--base-href` doesn't match the URL path.
  Ensure the workflow used the correct repo name, or rebuild locally with the
  matching `--base-href`.
- **Fonts / icons missing**: Google Fonts and Material Symbols load from a CDN
  in `frontend/src/index.html` — check that your network allows them, or bundle
  them into `src/assets` and update the `<link>` tags.
- **`monaco-editor` bundle warnings**: the app inlines Monaco's core; budgets
  are already raised in `angular.json` (`initial: 8mb`) to accommodate this.

That's it — push and your XSL-FO Studio is live on GitHub Pages.
