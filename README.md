# AI Product Builder

AI Product Builder is a TypeScript backend that plans app work, generates project files into `backend/generated`, runs the generated project, and attempts automatic fixes when execution fails.

## Run

From the repo root:

```bash
npm run dev
```

Or from the backend folder:

```bash
npm run dev
```

## API

- `POST /api/plan` generates a task plan from a product idea
- `POST /api/build` generates code, runs it, and retries fixes automatically
- `GET /api/test-ai` checks the AI connection

## Notes

- Backend source lives in `backend/src`
- Generated app files live in `backend/generated`
- The build pipeline is context-aware and includes basic auto-debugging
