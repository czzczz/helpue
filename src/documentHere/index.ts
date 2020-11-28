import * as vs from 'vscode';
import * as ast from './ast';

export default class DocumentHero implements vs.Disposable {
	documentHere(editor: vs.TextEditor, commandName: string) {
		switch (editor.document.languageId) {
			case 'javascript':
			case 'javascriptreact':
				ast.buildForJavaScript(editor);
				break;
			case 'typescript':
			case 'typescriptreact':
				ast.buildForTypeScript(editor);
				break;
			case 'vue':
				ast.buildForVueComponent(editor);
				break;
			default:
				vs.window.showWarningMessage(`Sorry! '${commandName}' currently do not support this file.`);
				return;
		}
	}

	dispose() {}
}
