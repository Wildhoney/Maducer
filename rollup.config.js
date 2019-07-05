import resolve from 'rollup-plugin-node-resolve';
import commonjs from 'rollup-plugin-commonjs';
import babel from 'rollup-plugin-babel';
import { terser } from 'rollup-plugin-terser';

module.exports = {
    input: 'src/index.js',
    output: [
        {
            file: 'dist/maducer.cjs.js',
            format: 'cjs',
            sourcemap: true,
            exports: 'named',
        },
        {
            file: 'dist/maducer.esm.js',
            format: 'esm',
            sourcemap: true,
            exports: 'named',
        },
    ],
    plugins: [
        resolve(),

        babel({
            exclude: 'node_modules/**',
            runtimeHelpers: true,
        }),
        commonjs({
            namedExports: {
                include: 'node_modules/**',
                'node_modules/styled-components/dist/styled-components.esm.js': [
                    'createContext',
                ],
            },
        }),
        terser(),
    ],
};
