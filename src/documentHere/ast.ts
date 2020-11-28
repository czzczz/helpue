import * as vs from 'vscode';
import * as vueParser from '../utils/vue/parse';
import { DocDoctor } from '../utils/ts/docDoctor';

export function buildForJavaScript(editor: vs.TextEditor) {
	new DocDoctor(editor).doc();
}

export function buildForTypeScript(editor: vs.TextEditor) {
	buildForJavaScript(editor);
}

export function buildForVueComponent(editor: vs.TextEditor) {
	const text = editor.document.getText();
	// VueComponent AST
	const vueComponentTree = vueParser.parse(text);
	// script node
	const scriptNode = vueParser.getContentByTagType(vueComponentTree, 'script')[0];

	new DocDoctor(editor).docScope({
		start: scriptNode.contentPos as number,
		end: scriptNode.contentEnd as number,
	});
}
