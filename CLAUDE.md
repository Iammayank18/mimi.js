# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Install dependencies
npm install

# No build step — this is a CommonJS package published directly
# Publish to npm
npm publish
```

There are no configured tests yet (`npm test` exits with error). No linter or formatter is configured beyond `.prettierrc`.

## Architecture

`mimi.js` is a thin Express wrapper published as an npm package. It wraps Express with pre-configured middleware and exposes a single `mimi()` factory function alongside named exports.

### Entry Points

- `index.js` — re-exports `./lib`
- `lib/index.js` — defines `mimi()` factory, applies all middleware, calls `loadRoutes`, and re-exports all named utilities

### Module Layout

```
lib/
├── index.js          # mimi() factory + all named exports
├── router.js         # Auto-loads *.js files from consumer's ./routes/ directory
├── parsers/          # body-parser (JSON + urlencoded) + customParser
├── auth/             # JWT (generateToken, verifyToken, authMiddleware) + bcrypt helpers
├── swagger/          # express-jsdoc-swagger setup via setupSwagger(app, options)
├── logger/           # winston-based requestLogger middleware
└── db/
    ├── mongodb/      # mongodbManager class (singleton, wraps mongoose)
    └── sqllite/      # SQLiteManager class (wraps sequelize + sqlite3)
```

### Key Design Decisions

- **Auto-route loading**: `loadRoutes` in `router.js` scans `process.cwd()/routes/` at startup and mounts every `.js` file. It handles both CJS (`require`) and ESM (`import`) based on the consumer's `package.json` `"type"` field.
- **Singleton DB managers**: Both `mongodbManager` and `SQLiteManager` implement the singleton pattern — subsequent `new` calls return the existing instance.
- **Package type is `commonjs`**: Despite README examples showing ESM syntax, the package itself is `"type": "commonjs"`. ESM consumers use dynamic `import()` internally in the router loader.
- **JWT secret**: `generateToken` / `verifyToken` read `process.env.JWT_SECRET`. This must be set in the consumer's environment.

### Named Exports

All public exports come from `lib/index.js`:

| Export | Source |
|--------|--------|
| `mimi` (default) | `lib/index.js` |
| `setupSwagger` | `lib/swagger` |
| `customParser` | `lib/parsers` |
| `hashPassword`, `comparePassword`, `generateToken`, `verifyToken`, `authMiddleware` | `lib/auth` |
| `Router` | `express.Router` |
| `mongodbManager` | `lib/db/mongodb` |
| `SQLiteManager` | `lib/db/sqllite` |
