module.exports = {
    env: {
        node: true,
        es2021: true
    },
    plugins: ["@typescript-eslint", "promise", "prettier"],
    extends: ["eslint:recommended", "plugin:@typescript-eslint/recommended", "plugin:prettier/recommended"],
    parser: "@typescript-eslint/parser",
    overrides: [
        {
            files: ["*.ts"],
            parserOptions: {
                ecmaVersion: "es2022",
                sourceType: "module",
                project: ["./tsconfig.json"]
            }
        }
    ],

    rules: {
        "@typescript-eslint/explicit-module-boundary-types": "off",
        "@typescript-eslint/no-extra-semi": "off",
        "@typescript-eslint/no-non-null-assertion": "off",
        "@typescript-eslint/prefer-ts-expect-error": "error",
        "@typescript-eslint/no-explicit-any": "off",
        "@typescript-eslint/no-namespace": "off",
        eqeqeq: "error",
        "no-duplicate-imports": "warn",
        "promise/no-return-wrap": "error",
        "promise/param-names": "error",
        "promise/no-native": "off",
        "promise/no-nesting": "warn",
        "promise/no-promise-in-callback": "warn",
        "promise/no-callback-in-promise": "warn",
        "promise/avoid-new": "off",
        "promise/no-new-statics": "error",
        "promise/no-return-in-finally": "warn",
        "promise/valid-params": "warn"
    }
};
