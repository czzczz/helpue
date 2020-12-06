import * as vs from 'vscode';

import EditorChecker, { defaultLanguageIds } from './editorChecker';
import DocumentHero from './documentHere';
import DocHereCompletionItem from './documentHere/complete';
import VueComponentDefProvider from './goDef';

let editorChecker: EditorChecker;
let documentHero: DocumentHero;

function docHereRegister(context: vs.ExtensionContext) {
	const languageEntries = defaultLanguageIds.map(l => ({ scheme: 'file', language: l }));

	// dochere completionItem
	context.subscriptions.push(
		vs.languages.registerCompletionItemProvider(
			languageEntries,
			{
				provideCompletionItems: (document: vs.TextDocument, position: vs.Position) => {
					const line = document.lineAt(position.line).text;
					const prefix = line.slice(0, position.character);

					if (prefix.match(/^\s*\/\*\*$/)) {
						return [new DocHereCompletionItem(document, position)];
					}

					return;
				},
			},
			'/',
			'*'
		)
	);
	// dochere entry
	context.subscriptions.push(
		vs.commands.registerCommand('helpue.documentHere', () => {
			const commandName = 'Document Here';

			if (!editorChecker) editorChecker = new EditorChecker();

			editorChecker.check(<vs.TextEditor>vs.window.activeTextEditor, valid => {
				if (!valid) vs.window.showWarningMessage(`Sorry! '${commandName}' currently do not support this file.`);

				if (!documentHero) documentHero = new DocumentHero();

				try {
					documentHero.documentHere(<vs.TextEditor>vs.window.activeTextEditor, commandName);
				} catch (e) {
					// console.log(e);
					vs.window.showWarningMessage(e);
				}
			});
		})
	);
}

function goDefRegister(context: vs.ExtensionContext) {
	const editor = vs.window.activeTextEditor;
	if (!editor || editor.document.languageId !== 'vue') return;
	context.subscriptions.push(
		vs.languages.setLanguageConfiguration('vue', {
			// 区分单词的正则，会影响getWordRangeAtPosition的选择结果
			wordPattern: /(\w+((-\w+)+)?)/,
		})
	);
	context.subscriptions.push(vs.languages.registerDefinitionProvider(['vue'], new VueComponentDefProvider()));
}

export function activate(context: vs.ExtensionContext): void {
	// docHere
	docHereRegister(context);
	// goDef
	goDefRegister(context);
}
