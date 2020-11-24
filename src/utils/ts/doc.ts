import * as vs from 'vscode';
import * as t from '@babel/types';
import traverseJS from '@babel/traverse';

export function convertLocToPosition(loc: { line: number; column: number } | undefined) {
	if (loc) return new vs.Position(loc.line - 1, loc.column);
	else return new vs.Position(0, 0);
}

export function getNodeRange(node: t.Node) {
	return new vs.Range(convertLocToPosition(node.loc?.start), convertLocToPosition(node.loc?.end));
}

export function createNodeCursoredChecker(curserPos: vs.Position, forCompletion: boolean) {
	if (!forCompletion)
		return function (node: t.FunctionDeclaration | t.ArrowFunctionExpression | t.ObjectMethod | t.ClassMethod) {
			const nodeRange = getNodeRange(node);
			return nodeRange.contains(curserPos);
		};
	else
		return function (node: t.FunctionDeclaration | t.ArrowFunctionExpression | t.ObjectMethod | t.ClassMethod) {
			const nodePos = convertLocToPosition(node.loc?.start);
			return nodePos.line === curserPos.line + 1 || nodePos.line === curserPos.line + 0;
		};
}

export class DocBuilder {
	private readonly __content: string[] = [];

	private readonly __editor: vs.TextEditor;
	private readonly __text: string;
	private __node?: t.FunctionDeclaration | t.ArrowFunctionExpression | t.ObjectMethod | t.ClassMethod;

	private propsIndex = 0;

	constructor(
		editor: vs.TextEditor,
		text?: string,
		node?: t.FunctionDeclaration | t.ArrowFunctionExpression | t.ObjectMethod | t.ClassMethod
	) {
		this.__editor = editor;
		if (!text) this.__text = editor.document.getText();
		else this.__text = text;
		if (node) this.__node = node;
	}

	convertToString(indentString = '') {
		const str = `\n${indentString}/**\n${indentString}${this.__content
			.map(s => ' * ' + s)
			.join(`\n${indentString}`)}\n${indentString} */\n${indentString}`;
		return str;
	}

	convertToSnippet() {
		return new vs.SnippetString(this.convertToString());
	}

	docFunctionOrMethod(node: t.FunctionDeclaration | t.ArrowFunctionExpression | t.ObjectMethod | t.ClassMethod) {
		this.__node = node;
		this.docDescription();
		this.docFunctionParams();
		this.docFunctionReturns();
	}

	docDescription() {
		this.__content.push(`@description `);
	}

	docFunctionParams() {
		this.propsIndex = 0;
		this.__node?.params.forEach(p => {
			this.__docFunctionParam(p);
		});
	}

	docFunctionReturns() {
		if (this.__text.slice(<number>this.__node?.start, <number>this.__node?.end).includes('return '))
			this.__content.push('@returns {*} ');
	}

	private __docFunctionParam(
		node:
			| t.ArrayPattern // 数组解构
			| t.AssignmentPattern // 赋值初始化
			| t.Identifier // 直接定义
			| t.RestElement // ...rest接参
			| t.ObjectPattern // 对象解构
			| t.ObjectProperty // 解构后的对象成员
			| t.MemberExpression // 访问成员（.访问或x[y]访问）
			| t.TSParameterProperty,
		parentName = '',
		name?: string
	) {
		const parentStr = parentName ? parentName + '.' : '';
		if (t.isIdentifier(node)) {
			const name = node.optional ? `[${node.name}]` : node.name;
			const type =
				node.typeAnnotation &&
				(t.isTypeAnnotation(node.typeAnnotation) || t.isTSTypeAnnotation(node.typeAnnotation))
					? this.__getTypeAnnotationName(node.typeAnnotation.typeAnnotation)
					: '*';
			this.__content.push(`@param {${type}} ${parentStr}${name} `);
		} else if (t.isAssignmentPattern(node)) {
			let name = '',
				type = '',
				defaultV = this.__text.slice(<number>node.right.start, <number>node.right.end);
			if (t.isIdentifier(node.left)) name = node.left.name;
			else name = 'p' + this.propsIndex++;
			if (t.isObjectExpression(node.right) || t.isObjectExpression(node.left)) type = 'object';
			else if (t.isArrayExpression(node.right) || t.isArrayExpression(node.left)) type = 'any[]';
			else if (t.isNumericLiteral(node.right)) type = 'number';
			else if (t.isStringLiteral(node.right)) type = 'string';
			else type = '*';
			this.__content.push(`@param {${type}} [${parentStr}${name}=${defaultV}] `);
			if (t.isObjectPattern(node.left))
				node.left.properties.forEach(p => {
					this.__docFunctionParam(p, `${parentStr}${name}`);
				});
			if (t.isArrayPattern(node.left))
				node.left.elements.forEach(el => {
					if (el) this.__docFunctionParam(el, `${parentStr}${name}`);
				});
		} else if (t.isObjectPattern(node)) {
			if (!name) name = `p${this.propsIndex++}`;
			this.__content.push(`@param {object} ${parentStr}${name} `);
			node.properties.forEach((p, i) => {
				this.__docFunctionParam(p, `${parentStr}${name}`);
			});
		} else if (t.isObjectProperty(node)) {
			if (t.isPatternLike(node.value)) {
				let name: string | undefined;
				if (t.isIdentifier(node.key)) name = node.key.name;
				else if (t.isStringLiteral(node.key) || t.isNumericLiteral(node.key)) name = String(node.key.value);
				else name = undefined;
				this.__docFunctionParam(node.value, parentName, name);
			}
		} else if (t.isArrayPattern(node)) {
			if (!name) name = `p${this.propsIndex++}`;
			this.__content.push(`@param {any[]} ${parentStr}${name} `);
			node.elements.forEach((el, i) => {
				if (el) this.__docFunctionParam(el, `${parentStr}${name}[]`);
			});
		} else if (t.isRestElement(node)) {
			this.__docFunctionParam(node.argument);
		} else this.__content.push(`@param {*} ${parentStr} `);
	}

	private __getTypeAnnotationName(typeAnnotation: t.FlowType | t.TSType): string {
		if (t.isStringTypeAnnotation(typeAnnotation) || t.isTSStringKeyword(typeAnnotation)) return 'string';
		else if (t.isNumberTypeAnnotation(typeAnnotation) || t.isTSNumberKeyword(typeAnnotation)) return 'number';
		else if (t.isBooleanTypeAnnotation(typeAnnotation) || t.isTSBooleanKeyword(typeAnnotation)) return 'boolean';
		else if (t.isObjectTypeAnnotation(typeAnnotation) || t.isTSObjectKeyword(typeAnnotation)) return 'object';
		else if (t.isArrayTypeAnnotation(typeAnnotation) || t.isTSArrayType(typeAnnotation))
			return this.__getTypeAnnotationName((typeAnnotation as t.ArrayTypeAnnotation).elementType) + '[]';
		else if (t.isGenericTypeAnnotation(typeAnnotation)) {
			const id = t.isIdentifier(typeAnnotation.id) ? typeAnnotation.id.name : typeAnnotation.id.id.name;
			return `${id}<${typeAnnotation.typeParameters?.params
				.map(p => this.__getTypeAnnotationName(p))
				.join(',')}>`;
		} else if (t.isTSTypeReference(typeAnnotation)) {
			const id = t.isIdentifier(typeAnnotation.typeName)
				? typeAnnotation.typeName.name
				: typeAnnotation.typeName.right.name;
			return `${id}<${typeAnnotation.typeParameters?.params
				.map(p => this.__getTypeAnnotationName(p))
				.join(',')}>`;
		} else if (t.isAnyTypeAnnotation(typeAnnotation) || t.isTSAnyKeyword(typeAnnotation)) return 'any';
		else return '*';
	}
}

export class DocDoctor {
	protected __active: boolean;
	protected __docBuilder: DocBuilder;
	protected __editor: vs.TextEditor;
	protected __text?: string;

	constructor(editor: vs.TextEditor, text?: string) {
		this.__active = false;
		this.__editor = editor;
		if (!text) this.__text = editor.document.getText();
		else this.__text = text;
		this.__docBuilder = new DocBuilder(editor, text);
	}

	doDoc(ast: t.File, forCompletion = false) {
		const isNodeCursored = this.__getCursorChecker(forCompletion);
		traverseJS(ast, {
			FunctionDeclaration: {
				exit: ({ node }) => {
					if (isNodeCursored(node))
						this.__checkCanDoc().then(() => {
							this.__docFuncAndMethod(node);
						});
				},
			},
			ArrowFunctionExpression: {
				exit: ({ node }) => {
					if (isNodeCursored(node))
						this.__checkCanDoc().then(() => {
							this.__docFuncAndMethod(node);
						});
				},
			},
			ClassMethod: {
				exit: ({ node }) => {
					if (isNodeCursored(node))
						this.__checkCanDoc().then(() => {
							this.__docFuncAndMethod(node);
						});
				},
			},
			ObjectMethod: {
				exit: ({ node }) => {
					if (isNodeCursored(node))
						this.__checkCanDoc().then(() => {
							this.__docFuncAndMethod(node);
						});
				},
			},
		});
	}

	protected __getCursorChecker(forCompletion = false) {
		return createNodeCursoredChecker(this.__editor.selection.start, forCompletion);
	}

	protected __checkCanDoc() {
		return new Promise(resolve => {
			if (this.__active) return;
			else resolve((this.__active = true));
		});
	}

	protected __docFuncAndMethod(
		node: t.FunctionDeclaration | t.ArrowFunctionExpression | t.ObjectMethod | t.ClassMethod
	) {
		this.__docBuilder.docFunctionOrMethod(node);
		this.__clearRangeAndInsert(node);
	}

	protected __clearRangeAndInsert(
		node: t.FunctionDeclaration | t.ArrowFunctionExpression | t.ObjectMethod | t.ClassMethod
	) {
		const nodePos = this.__getNodePos(node);
		const line = this.__editor.document.lineAt(nodePos);
		const lineHead = new vs.Position(line.lineNumber, line.firstNonWhitespaceCharacterIndex);
		const nodeOffset = this.__editor.document.offsetAt(lineHead);
		const textBeforeNode = this.__editor.document.getText().slice(0, nodeOffset);
		const dirtyStrs = textBeforeNode.match(/\s*(\s*\/\*[^/]*?\*\/)*\s*$/g);
		if (dirtyStrs && dirtyStrs[0]) {
			const dirtyStart = this.__editor.document.positionAt(textBeforeNode.lastIndexOf(dirtyStrs[0]));
			this.__editor.edit(edit => {
				const indentString = line.text.slice(0, lineHead.character);
				const replaceRange = new vs.Range(new vs.Position(dirtyStart.line + 1, lineHead.character), lineHead);
				edit.replace(replaceRange, this.__docBuilder.convertToString(indentString));
			});
		} else {
			this.__editor.insertSnippet(this.__docBuilder.convertToSnippet(), lineHead);
		}
	}

	protected __getNodePos(node: t.FunctionDeclaration | t.ArrowFunctionExpression | t.ObjectMethod | t.ClassMethod) {
		return convertLocToPosition(node.loc?.start);
	}
}
