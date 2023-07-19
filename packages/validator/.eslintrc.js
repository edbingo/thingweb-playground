export const parser = "@typescript-eslint/parser";
export const parserOptions = {
    tsconfigRootDir: __dirname,
    project: ["./tsconfig.eslint.json"],
};
export const eslintExtends = ["eslint:recommended", "standard", "prettier", "plugin:@typescript-eslint/recommended"];
export const plugins = ["@typescript-eslint", "unused-imports", "workspaces", "notice"];
export const env = {
    es6: true,
    node: true,
};
export const ignorePatterns = [".eslintrc.js", "dist", "node_modules", "/examples", "bin", "*.js"];
export const rules = {
    "notice/notice": [
        "error",
        {
            mustMatch: "Copyright \\(c\\) [0-9]{0,4} Contributors to the Eclipse Foundation",
            templateFile: __dirname + "/license.template.txt",
            onNonMatchingHeader: "replace",
        },
    ],
    "workspaces/no-relative-imports": "error",
    "@typescript-eslint/no-unused-vars": "off",
    "no-use-before-define": "off",
    "@typescript-eslint/no-use-before-define": ["error"],
    "unused-imports/no-unused-imports": "error",
    "unused-imports/no-unused-vars": [
        "warn",
        {
            args: "none",
            varsIgnorePattern: "Test", // Ignore test suites from unused-imports
        },
    ],
};