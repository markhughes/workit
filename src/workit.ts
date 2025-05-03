/**
 * Creates a function that runs fn in a worker.
 * @param fn - The function to run in the worker.
 * @param options - Some simple options.
 * @returns A function that runs fn in a worker.
 */
export function workit<TArgs, TResult>(
  fn: (args: TArgs) => Promise<TResult> | TResult,
  options: {
    virtualFilename?: string; // TODO: use virtualFilename for stack traces
    imports?: Record<string, string>; // e.g., { toUpperCase: './util.ts' }
  } = {},
): (args: TArgs) => Promise<TResult> {
  const fnStr = fn.toString();
  const bodyMatch = fnStr.match(/^[^{]*{([\s\S]*)}$/);
  if (!bodyMatch) {
    throw new Error("Failed to extract function body.");
  }
  const fnBody = bodyMatch[1];

  // TODO: Is there a better way to resolve import paths?
  const resolveImportPathWhereFnIsDefined = (relativePath: string) => {
    // so I want it so you can use workit wherever, so this will resolve the path based on where the fn is defined
    // in deno we can use an Error object to get the stack trace, not sure if this is the best approach
    const stack = new Error().stack;
    if (!stack) {
      throw new Error(
        "Failed to extract import path from stack trace: no stack",
      );
    }

    const lines = stack.split("\n").map((line) => line.trim());
    const workitIndex = lines.findIndex((line) => line.includes("at workit"));

    if (workitIndex !== -1 && workitIndex + 1 < lines.length) {
      const callerLine = lines[workitIndex + 1];

      const match = callerLine.match(/at (?:.*\()?(.+):(\d+):(\d+)\)?$/);

      if (match) {
        const [, file, line, column] = match;
        // TODO: can we use line and column later to craft a better stack trace?
        const resolvedPath = new URL(relativePath, file).href;
        return resolvedPath;
      }
    }

    throw new Error("Failed to extract import path from stack trace: no match");
  };

  const imports = options.imports ?? {};
  const importLines = Object.entries(imports)
    .map(([name, path]) =>
      `import { ${name} } from '${resolveImportPathWhereFnIsDefined(path)}';`
    )
    .join("\n");

  return (args: TArgs): Promise<TResult> => {
    return new Promise<TResult>((resolve, reject) => {

      // TODO: add an option to keep the worker alive for a certain amount of time, prevent re-creating the worker on every call
      const workerCode = `
          ${importLines}
  
          self.onmessage = async (e) => {
            const { args } = e.data;
            try {
              const fn = async (args) => {
                ${fnBody}
              };
              const result = await fn(args);
              self.postMessage({ result });
            } catch (err) {
              self.postMessage({ 
                error: err.message,
                stack: err.stack,
              });
            }
          };
        `;

      const blob = new Blob([workerCode], { type: "application/javascript" });
      const worker = new Worker(URL.createObjectURL(blob), { type: "module" });

      worker.postMessage({ args });

      worker.onmessage = (e) => {
        const { result, error, stack } = e.data;
        if (error) {
          // TODO: enhance errors
          const enhancedError = new Error(error);
          enhancedError.stack = `Worker stack trace:\n${stack}`;
          reject(enhancedError);
        } else {
          resolve(result);
        }
        worker.terminate();
      };

      worker.onerror = (err) => {
        reject(err);
        worker.terminate();
      };
    });
  };
}
