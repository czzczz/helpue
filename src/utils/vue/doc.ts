import * as vs from 'vscode';
import * as t from '@babel/types';
import { DocDoctor } from '../ts/doc';

export class DocDoctor4VueComponent extends DocDoctor {
	protected __scriptIndex: number;

	constructor(editor: vs.TextEditor, scriptPos: number, scriptEnd: number) {
		super(editor, editor.document.getText().slice(scriptPos, scriptEnd));
		this.__scriptIndex = scriptPos;
	}

	protected __getCursorChecker(forCompletion = false) {
		const cursorIndexInScript = this.__editor.document.offsetAt(this.__editor.selection.start) - this.__scriptIndex;
		if (!forCompletion)
			return (node: t.FunctionDeclaration | t.ArrowFunctionExpression | t.ObjectMethod | t.ClassMethod) => {
				return <number>node.start <= cursorIndexInScript && <number>node.end >= cursorIndexInScript;
			};
		else
			return (node: t.FunctionDeclaration | t.ArrowFunctionExpression | t.ObjectMethod | t.ClassMethod) => {
				const nodePos = this.__editor.document.positionAt(<number>node.start + this.__scriptIndex);
				return (
					nodePos.line === this.__editor.selection.start.line + 1 ||
					nodePos.line === this.__editor.selection.start.line
				);
			};
	}

	protected __getNodePos(node: t.FunctionDeclaration | t.ArrowFunctionExpression | t.ObjectMethod | t.ClassMethod) {
		return this.__editor.document.positionAt(this.__scriptIndex + <number>node.start);
	}
}
