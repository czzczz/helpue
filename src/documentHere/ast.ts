import * as vs from 'vscode';
import * as vueParser from '../utils/vue/parse';
import { parseJS as parseTS } from '../utils/ts/babel';
import { DocDoctor } from '../utils/ts/doc';
import { DocDoctor4VueComponent } from '../utils/vue/doc';

export function buildForJavaScript(editor: vs.TextEditor, forCompletion: boolean) {
	new DocDoctor(editor).doDoc(parseTS(editor.document.getText()), forCompletion);
}

export function buildForTypeScript(editor: vs.TextEditor, forCompletion: boolean) {
	buildForJavaScript(editor, forCompletion);
}

export function buildForVueComponent(editor: vs.TextEditor, forCompletion: boolean) {
	const text = editor.document.getText();
	// VueComponent AST
	const vueComponentTree = vueParser.parse(text);
	// script node
	const scriptNode = vueParser.getContentByTagType(vueComponentTree, 'script')[0];
	// text cleared
	const scriptContent = text?.slice(scriptNode.contentPos, scriptNode.contentEnd);

	new DocDoctor4VueComponent(editor, <number>scriptNode.contentPos, <number>scriptNode.contentEnd).doDoc(
		parseTS(scriptContent),
		forCompletion
	);
}
