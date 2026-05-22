export function snapshotEnv(keys = []) {
  return new Map(keys.map((key) => [key, process.env[key]]));
}

export function restoreEnv(snapshot) {
  snapshot.forEach((value, key) => {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  });
}

export function applyEnv(values = {}) {
  Object.entries(values).forEach(([key, value]) => {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  });
}

export function resetBrowserGlobals(keys = ["window", "document", "navigator", "localStorage", "sessionStorage"]) {
  keys.forEach((key) => {
    delete globalThis[key];
  });
}
