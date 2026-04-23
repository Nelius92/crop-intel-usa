# Functional Validation Report

## Commands Run

1. `npm run lint`
2. `npm test`
3. `npm run build`
4. `npm run typecheck:api`
5. `npm run build:api`
6. `npm run preview -- --host 127.0.0.1 --port 4173`
7. `curl -I http://127.0.0.1:4173/`

## Results

- `npm run lint`
  - Passed.
- `npm test`
  - Passed.
  - `10` test files, `190` tests passing.
  - Added validation coverage for:
    - shared crop-domain threshold mapping
    - USDA grain parser success/fallback behavior
- `npm run build`
  - Passed.
  - Built app served expected assets, including a separate lazy-loaded `CloudHealthCheck` chunk.
  - Warning only: main frontend bundle remains above Vite's default chunk-size threshold.
- `npm run typecheck:api`
  - Passed.
- `npm run build:api`
  - Passed.
- Runtime shell check
  - `vite preview` served successfully on `http://127.0.0.1:4173/`.
  - `curl -I` returned `HTTP/1.1 200 OK`.

## Notes

- Test output still includes expected fallback-path noise from mocked buyer API requests and USDA parser logging, but all assertions passed.
- `baseline-browser-mapping` is outdated and warns during test/build; this did not block validation.
- This validation confirms build, typecheck, and server startup. It does not include a full browser-driven UI walkthrough.
