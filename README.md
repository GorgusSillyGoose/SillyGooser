# 🍁 SillyGooser 🍁

Three.js scene with a tree, bench, and controllable goose.

## GitHub Pages

Use the repository root `index.html` as the Pages entrypoint.

The local app files live in `src/`:
- `src/script.js`
- `src/style.css`
- `src/assets/`

The root `index.html` loads those files directly, so the project can run from `github.io` without a build step.

## Memories Timeline

Memories live in `src/assets/Memories/` as folders named:

```text
DD-MM-YYYY - Memory Title
```

Inside each folder, add numbered images named:

```text
1.Cover description.png
2.Second photo description.png
3.Third photo description.png
```

PNG, JPG, JPEG, and WebP files are supported; keep the same numbered filename format.

Run this after adding or renaming memories:

```bash
npm run generate:memories
```

If Node/npm is not installed on Windows, run the PowerShell generator instead:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\generate-memories.ps1
```

That writes `src/assets/Memories/memories.json`, which the GitHub Pages site loads at runtime. The included Pages workflow runs the same command before deployment, so pushed folders are scanned automatically when Pages is deployed from GitHub Actions.

The generator also creates lightweight WebP card thumbnails in `src/assets/Memories/.generated/` so the timeline scrolls with small images while the detail view can still open the original photos.
