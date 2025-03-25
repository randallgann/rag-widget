{
  "watch": ["src"],
  "ext": "ts",
  "ignore": ["src/**/*.spec.ts"],
  "exec": "node -r ts-node/register -r ./bootstrap-gcp.js src/app.ts"
}