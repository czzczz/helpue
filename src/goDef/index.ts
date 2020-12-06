import * as vs from 'vscode';
import DefCollector from './defCollector';

export default class VueComponentDefProvider implements vs.DefinitionProvider {
	provideDefinition(
		document: vs.TextDocument,
		position: vs.Position,
		token: vs.CancellationToken
	): Promise<vs.Location | vs.Location[]> | null {
		return new Promise(resolve => {
			const selected = this.getSelectedWord(document, position);
			if (selected) resolve(new DefCollector(document, selected).buildDefGroup().collect());
			else resolve([]);
		});
	}

	getSelectedWord(doc: vs.TextDocument, pos: vs.Position) {
		return doc.getWordRangeAtPosition(pos);
	}
}
