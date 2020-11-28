import * as vs from 'vscode';
import * as ts from 'typescript';
import { DocBuilder } from './DocBuilder';

const kind = ts.SyntaxKind;
const supportedTypes = [
	kind.SourceFile,

	kind.ClassDeclaration,
	kind.Constructor,
	kind.InterfaceDeclaration,

	kind.EnumDeclaration,
	kind.EnumMember,

	kind.FunctionDeclaration,
	kind.ArrowFunction,
	kind.MethodDeclaration,
	kind.FunctionExpression,
	kind.CallSignature,
	kind.MethodSignature,

	kind.VariableDeclaration,
	kind.VariableDeclarationList,
];

export class DocDoctor {
	private __editor: vs.TextEditor;
	private __builder: DocBuilder;
	private __scope: { start: number; end: number };
	private __docForAll: boolean;
	private __targetNode: ts.Node[];

	constructor(editor: vs.TextEditor) {
		this.__editor = editor;
		this.__builder = new DocBuilder(editor.document);
		this.__scope = {
			start: 0,
			end: editor.document.getText().length - 1,
		};
		this.__docForAll = false;
		this.__targetNode = [];
	}

	doc(forAll = false) {
		this.__docForAll = forAll;
		const text = this.__editor.document.getText().slice(this.__scope.start, this.__scope.end);
		const sf = ts.createSourceFile('tmp', text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
		this.__findTarget(sf);
		const docs: { node: ts.Node; doc: string[] }[] = [];
		this.__targetNode.forEach(n => {
			const doc = this.__builder.genDoc(n);
			docs.push({
				node: n,
				doc,
			});
		});

		docs.sort((a, b) => b.node.pos - a.node.pos);

		docs.forEach(d => {
			this.__insertDoc(d.node, d.doc);
		});
	}

	protected __insertDoc(node: ts.Node, doc: string[]) {
		const targetLine = this.__editor.document.lineAt(
			this.__positionAt(node.pos + node.getFullText().search(/\S/)).line
		);
		const indentStr = targetLine.text.slice(0, targetLine.firstNonWhitespaceCharacterIndex);
		const docStr = this.__builder.convertToString(indentStr, doc);

		const dirtyEnd = new vs.Position(targetLine.lineNumber, indentStr.length);
		const textBeforeTarget = this.__editor.document.getText(new vs.Range(new vs.Position(0, 0), dirtyEnd));
		const dirtyStrs = textBeforeTarget.match(/\s*(\s*\/\*[^/]*?\*\/)*\s*$/g);
		if (!dirtyStrs || dirtyStrs.length === 0) return;
		const dirtyStart = this.__editor.document.positionAt(textBeforeTarget.lastIndexOf(dirtyStrs[0]));
		this.__editor.edit(d => {
			d.replace(new vs.Range(dirtyStart, dirtyEnd), docStr);
		});
	}

	private __findTarget(node: ts.Node) {
		if (supportedTypes.includes(node.kind)) {
			if (this.__docForAll) this.__targetNode.push(node);
			else if (this.isNodeSelected(node)) {
				this.__targetNode = [node];
			}
		}
		node.forEachChild(c => {
			this.__findTarget(c);
		});
	}

	docScope(scriptRange: { start: number; end: number }, forAll = false) {
		this.__scope = scriptRange;
		this.__builder.setScope(scriptRange);
		this.doc(forAll);
	}

	protected isNodeSelected(node: ts.Node) {
		const curserOffset = this.__offsetAt(this.__selection().active);
		return node.pos <= curserOffset && node.end >= curserOffset;
	}

	protected __positionAt(offset = 0, doc = this.__editor.document) {
		return doc.positionAt(offset + this.__scope.start);
	}

	protected __offsetAt(pos: vs.Position, doc = this.__editor.document) {
		return doc.offsetAt(pos) - this.__scope.start;
	}

	private __selection() {
		return this.__editor.selection;
	}
}
