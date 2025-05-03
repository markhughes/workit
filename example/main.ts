import { workit } from "../src/workit.ts";
import { toUpperCase } from "./util.ts";

interface ExampleArgs {
  name: string;
  age: number;
}

const threadedFunction = workit(
  async (args: ExampleArgs) => {
    const doExpensiveComputation = () => {
      return new Promise((resolve) => {
        // ... sample, some busy task ...
        setTimeout(() => {
          resolve(`Processed: ${toUpperCase(args.name)}, Age ${args.age}`);
        }, 2000);
      });
    };
    const result = await doExpensiveComputation();

    return result;
  },
  {
    imports: {
      "toUpperCase": "./util.ts",
    },
  },
);

const result = await threadedFunction({ name: "John", age: 20 });
console.log(result);
