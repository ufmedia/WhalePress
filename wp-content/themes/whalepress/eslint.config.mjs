import globals from "globals";
import pluginJs from "@eslint/js";
import wordpress from "@wordpress/eslint-plugin";
import prettier from "eslint-plugin-prettier";

export default [
  {
    languageOptions: {
      globals: {
        ...globals.browser,
        global: true,
      }
    },
  },
  pluginJs.configs.recommended,
  {
    // Use WordPress plugin rules
    plugins: {
      "@wordpress": wordpress,
      prettier,
    },
    rules: {
      // Apply the recommended rules from the WordPress plugin
      ...wordpress.configs.recommended.rules,
    },
  },
];