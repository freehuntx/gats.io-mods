import typescript from '@rollup/plugin-typescript'
import { nodeResolve } from '@rollup/plugin-node-resolve'
import commonjs from '@rollup/plugin-commonjs'
import json from '@rollup/plugin-json'

export default {
  input: 'src/lib/GatsClient/index.ts',
  output: {
    file: 'public/js/GatsClient.js',
    format: 'umd',
    name: 'GatsClient'
  },
  plugins: [
    typescript(),
    commonjs(),
    json(),
    nodeResolve({
      browser: true
    })
  ]
}