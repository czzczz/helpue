import * as vs from 'vscode';

import EditorChecker, { defaultLanguageIds } from './editorChecker';
import DocumentHero from './documentHere';
import DocHereCompletionItem from './documentHere/complete';

let editorChecker: EditorChecker;
let documentHero: DocumentHero;

export function activate(context: vs.ExtensionContext): void {
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
		vs.commands.registerCommand('helpue.documentHere', (forCompletion: boolean) => {
			// forCompletion 为 DocHereCompletionItem 传递的参数
			const commandName = 'Document Here';

			if (!editorChecker) editorChecker = new EditorChecker();

			editorChecker.check(<vs.TextEditor>vs.window.activeTextEditor, valid => {
				if (!valid) vs.window.showWarningMessage(`Sorry! '${commandName}' currently do not support this file.`);

				if (!documentHero) documentHero = new DocumentHero();

				try {
					documentHero.documentHere(<vs.TextEditor>vs.window.activeTextEditor, commandName, forCompletion);
				} catch (e) {
					// console.log(e);
					vs.window.showWarningMessage(e);
				}
			});
		})
	);
}
