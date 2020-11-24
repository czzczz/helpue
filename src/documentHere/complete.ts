import * as vs from 'vscode';

export default class DocHereCompletionItem extends vs.CompletionItem {
	constructor(document: vs.TextDocument, position: vs.Position) {
		super('/** Document Here */', vs.CompletionItemKind.Snippet);
		this.insertText = '';
		this.sortText = '\0';

		const line = document.lineAt(position.line).text;
		const prefix = line.slice(0, position.character).match(/\/\**\s*$/);
		const suffix = line.slice(position.character).match(/^\s*\**\//);
		const start = position.translate(0, prefix ? -prefix[0].length : 0);
		this.range = new vs.Range(start, position.translate(0, suffix ? suffix[0].length : 0));

		this.command = {
			title: 'Document Here',
			command: 'helpue.documentHere',
			arguments: [true],
		};
	}
}
