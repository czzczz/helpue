import * as vs from 'vscode';
import * as ast from './ast';

export default class DocumentHero implements vs.Disposable {
	documentHere(editor: vs.TextEditor, commandName: string, forCompletion: boolean) {
		switch (editor.document.languageId) {
			case 'javascript':
			case 'javascriptreact':
				ast.buildForJavaScript(editor, forCompletion);
				break;
			case 'typescript':
			case 'typescriptreact':
				ast.buildForTypeScript(editor, forCompletion);
				break;
			case 'vue':
				ast.buildForVueComponent(editor, forCompletion);
				break;
			default:
				vs.window.showWarningMessage(`Sorry! '${commandName}' currently do not support this file.`);
				return;
		}
	}

	dispose() {}
}
