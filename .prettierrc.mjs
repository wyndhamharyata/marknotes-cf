/** @type {import("prettier").Config} */
export default {
  plugins: ["prettier-plugin-astro", "prettier-plugin-tailwindcss"],
  overrides: [
    {
      files: "*.astro",
      options: {
        parser: "astro",
      },
    },
    {
      // MainDO's RPC surface uses arrow class fields so each method is a
      // single-line expression delegation to a query function. Widen the
      // printWidth so prettier doesn't wrap them.
      files: "src/do/main-do.ts",
      options: {
        printWidth: 200,
      },
    },
  ],
  semi: true,
  singleQuote: false,
  tabWidth: 2,
  trailingComma: "es5",
  printWidth: 100,
};
