import type { ShikiTransformer, ThemeRegistration } from "shiki";

// A code block is printed in one ink: keywords bold, comments in ink-2. github-light rides
// along in --shiki-colour and shows under the pointer.
export const inkTheme: ThemeRegistration = {
  name: "ink",
  type: "light",
  colors: { "editor.background": "#F6F6F6", "editor.foreground": "#141414" },
  tokenColors: [
    { settings: { foreground: "#141414" } },
    {
      scope: ["comment", "punctuation.definition.comment"],
      settings: { foreground: "#4D4D4D", fontStyle: "italic" },
    },
    {
      scope: ["keyword", "storage", "storage.type", "storage.modifier", "constant.language"],
      settings: { fontStyle: "bold" },
    },
  ],
};

export const SHIKI_THEMES = { light: inkTheme, colour: "github-light" } as const;

// The printout's shadow has to sit outside the torn edges the pre is masked to.
export const printout: ShikiTransformer = {
  name: "printout",
  root(root) {
    root.children = [
      {
        type: "element",
        tagName: "div",
        properties: { class: "printout" },
        children: root.children as never,
      },
    ];
  },
};
