import * as vs from 'vscode';
import * as path from 'path';

const defaultCexts: string[] = [
	'.vue',
	'.nvue', // miniapp
	'.js',
	'.jsx',
	'.ts',
	'.tsx',
];

export const defaultLanguageIds: string[] = [
	'javascript', // js
	'typescript', // ts
	'vue',
	'javascriptreact', // jsx
	'typescriptreact', // tsx
];

export default class EditorChecker {
	private supportedLanguageIds: string[];
	private supportedFileCexts: string[];

	constructor(fileCexts = defaultCexts, languageIds = defaultLanguageIds) {
		// 支持的语言类型
		this.supportedFileCexts = fileCexts;
		this.supportedLanguageIds = languageIds;
	}

	check(editor: vs.TextEditor, cb: (valid: boolean) => void) {
		if (!this.isDocumentSupported(editor.document)) {
			cb(false);
		}

		cb(true);
	}

	isDocumentSupported(document: vs.TextDocument) {
		const cext = path.extname(document.fileName);
		// console.log('file languageId ', document.languageId, ' file cext ', cext);
		return this.supportedLanguageIds.includes(document.languageId) || this.supportedFileCexts.includes(cext);
	}
}
