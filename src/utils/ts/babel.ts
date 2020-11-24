import { parse, ParserOptions } from '@babel/parser';

const babelParserOptions: ParserOptions = {
	allowImportExportEverywhere: true,
	sourceType: 'module',
	plugins: ['jsx', 'typescript'],
};

export function parseJS(text: string) {
	return parse(text, babelParserOptions);
}
