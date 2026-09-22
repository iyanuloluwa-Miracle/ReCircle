import withNuxt from './.nuxt/eslint.config.mjs'

export default withNuxt({
  ignores: ['.output/**', 'node_modules/**'],
  rules: {
    'vue/multi-word-component-names': 'off',
    '@typescript-eslint/no-explicit-any': 'error'
  }
})
