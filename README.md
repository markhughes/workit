# workit

Small experiment to automate and simplify creating a worker for an expensive task in Deno.

## Usage 

Basic usage:

```typescript
const threadedFunction = workit(
  async (exampleArg: number) => {
    const result = exampleArg * 2;

    // ... do some expensive calculations ...

    return result;
  }
);
```

However if you want to use imports from other files you must specify it in the options object

```typescript
import { hashAlg } from "../util/hash.ts";


const threadedFunction = workit(
  async (value: string, secret: string) => {
    const result = await hashAlg(value, secret);

    return result;
  },
  {
    imports: {
      "hashAlg": "../util/hash.ts",
    },
  }
);
```

## TODO

- cache workers, don't recreate them every time 