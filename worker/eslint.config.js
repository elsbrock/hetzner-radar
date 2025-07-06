import js from '@eslint/js';
import ts from 'typescript-eslint';
import prettier from 'eslint-config-prettier';
import globals from 'globals';

/** @type {import('eslint').Linter.FlatConfig[]} */
export default [
	js.configs.recommended,
	...ts.configs.recommended,
	prettier,
	{
		languageOptions: {
			globals: {
				...globals.node,
				...globals.es2021,
			},
		},
	},
	{
		ignores: ['dist/', 'node_modules/', 'coverage/', '.wrangler/'],
	},
];
