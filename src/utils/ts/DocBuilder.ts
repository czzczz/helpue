import * as vs from 'vscode';
import * as ts from 'typescript';
import dayjs = require('dayjs');
import { execSync } from 'child_process';
import { getDocHereConfig } from '../config';

type FunctionLike =
	| ts.ConstructorDeclaration
	| ts.MethodDeclaration
	| ts.FunctionDeclaration
	| ts.FunctionExpression
	| ts.ArrowFunction;

const getExpType = (exp: ts.Expression | undefined): string => {
	if (!exp) return 'any';
	else if (ts.isNumericLiteral(exp)) return 'number';
	else if (ts.isStringLiteralLike(exp)) return 'string';
	else if (ts.isFunctionExpression(exp) || ts.isArrowFunction(exp)) return 'function';
	else if (ts.isArrayLiteralExpression(exp)) {
		const elTypes = new Set<string>();
		exp.elements.forEach(e => {
			elTypes.add(getExpType(e));
		});
		if (elTypes.has('any')) return 'any[]';
		else if (elTypes.size > 1) return `(${[...elTypes].join(' | ')})[]`;
		else return [...elTypes][0] + '[]';
	} else if (ts.isObjectLiteralExpression(exp)) return 'object';
	else if (ts.isBinaryExpression(exp)) {
		switch (exp.operatorToken.kind) {
			case ts.SyntaxKind.PlusToken:
				if (getExpType(exp.left) === 'string' || getExpType(exp.right) === 'string') return 'string';
				else return 'number';
			case ts.SyntaxKind.MinusToken:
			case ts.SyntaxKind.AsteriskToken:
			case ts.SyntaxKind.SlashToken:
			case ts.SyntaxKind.PercentToken:
			case ts.SyntaxKind.AmpersandToken:
			case ts.SyntaxKind.BarToken:
			case ts.SyntaxKind.AsteriskAsteriskToken:
			case ts.SyntaxKind.LessThanLessThanToken:
			case ts.SyntaxKind.GreaterThanGreaterThanToken:
				return 'number';
			case ts.SyntaxKind.AmpersandAmpersandToken:
			case ts.SyntaxKind.BarBarToken:
			case ts.SyntaxKind.LessThanToken:
			case ts.SyntaxKind.LessThanEqualsToken:
			case ts.SyntaxKind.GreaterThanToken:
			case ts.SyntaxKind.GreaterThanEqualsToken:
			case ts.SyntaxKind.EqualsEqualsToken:
			case ts.SyntaxKind.ExclamationEqualsToken:
			case ts.SyntaxKind.EqualsEqualsEqualsToken:
			case ts.SyntaxKind.ExclamationEqualsEqualsToken:
				return 'boolean';
			case ts.SyntaxKind.EqualsToken:
			case ts.SyntaxKind.PlusEqualsToken:
			case ts.SyntaxKind.MinusEqualsToken:
			case ts.SyntaxKind.AsteriskEqualsToken:
			case ts.SyntaxKind.SlashEqualsToken:
			case ts.SyntaxKind.PercentEqualsToken:
				return getExpType(exp.right) || 'any';
			default:
				return 'any';
		}
	} else if (ts.isPrefixUnaryExpression(exp)) {
		if (exp.getText().startsWith('!')) return 'boolean';
		else return 'any';
	} else if (ts.isPostfixUnaryExpression(exp)) {
		const text = exp.getText();
		if (text.endsWith('++') || text.endsWith('--')) return 'number';
		else return 'any';
	} else if (ts.isNewExpression(exp)) return exp.expression.getText() || 'any';
	else return 'any';
};

export class DocBuilder {
	private __document: vs.TextDocument;
	private __scope: { start: number; end: number };
	private __content: string[];
	private __hideHeaderDescription: boolean;
	private __authorName: string;
	private __dateFormat: string;
	private __defaultParamName: string;
	private __classDeclarationContent: string[];
	private __classConstructorDocContent: string[];
	private __interfaceDeclarationContent: string[];
	private __EnumDocContent: string[];
	private __FunctionAndMethodsDocContent: string[];

	constructor(document: vs.TextDocument) {
		this.__document = document;
		this.__scope = {
			start: 0,
			end: document.getText().length - 1,
		};
		this.__content = [];
		this.__hideHeaderDescription = getDocHereConfig('hideHeaderDescription', false);
		this.__authorName = getDocHereConfig('authorName', '');
		if (!this.__authorName) {
			try {
				this.__authorName = execSync('git config user.name').toString().trim() || 'unknown';
			} catch (e) {
				this.__authorName = 'unknown';
			}
		}
		this.__dateFormat = getDocHereConfig('dateFormat', 'YYYY-MM-DD');
		this.__defaultParamName = getDocHereConfig('defaultParamName', 'param');
		this.__classDeclarationContent = getDocHereConfig('classDocContent', []);
		this.__classConstructorDocContent = getDocHereConfig('classConstructorDocContent', []);
		this.__interfaceDeclarationContent = getDocHereConfig('InterfaceDocContent', []);
		this.__EnumDocContent = getDocHereConfig('EnumDocContent', []);
		this.__FunctionAndMethodsDocContent = getDocHereConfig('FunctionAndMethodsDocContent', []);
	}

	genDoc(node: ts.Node) {
		this.__content = [];
		switch (node.kind) {
			case ts.SyntaxKind.ClassDeclaration:
				this.__genClassDeclaration(node as ts.ClassDeclaration);
				break;
			case ts.SyntaxKind.Constructor:
				this.__genConstructorDeclaration(node as ts.ConstructorDeclaration);
				break;
			case ts.SyntaxKind.InterfaceDeclaration:
				this.__genInterfaceDeclaration(node as ts.InterfaceDeclaration);
				break;
			case ts.SyntaxKind.EnumDeclaration:
				this.__genEnumDeclaration(node as ts.EnumDeclaration);
				break;
			case ts.SyntaxKind.EnumMember:
				this.__genEnumMember(node as ts.EnumMember);
				break;
			case ts.SyntaxKind.CallSignature:
			case ts.SyntaxKind.FunctionDeclaration:
			case ts.SyntaxKind.FunctionExpression:
			case ts.SyntaxKind.MethodDeclaration:
			case ts.SyntaxKind.MethodSignature:
			case ts.SyntaxKind.ArrowFunction:
				this.__genMethodDeclaration(node as ts.MethodDeclaration);
				break;
			case ts.SyntaxKind.VariableDeclaration:
				this.__genVariableDeclaration(node as ts.VariableDeclaration);
				break;
			case ts.SyntaxKind.VariableDeclarationList:
				this.__genVariableDeclarationList(node as ts.VariableDeclarationList);
				break;
			default:
				break;
		}
		return this.getStringArray();
	}

	private __genVariableDeclarationList(node: ts.VariableDeclarationList) {
		this.__genVariableDeclaration(node.declarations[0]);
	}

	private __genVariableDeclaration(node: ts.VariableDeclaration) {
		if (node.initializer && (ts.isArrowFunction(node.initializer) || ts.isFunctionExpression(node.initializer)))
			this.__genMethodDeclaration(node.initializer);
	}

	private __genMethodDeclaration(node: FunctionLike) {
		this.__FunctionAndMethodsDocContent.forEach((tag, i) => {
			switch (tag) {
				case 'description':
					this.__genDescription(i);
					break;
				case 'function':
					this.__genFunctionName(node);
					break;
				case 'author':
					this.__genAuthor();
					break;
				case 'date':
					this.__genDate();
					break;
				case 'template':
					this.__genTypeParameters(node);
					break;
				case 'param':
					this.__genParams(node);
					break;
				case 'returns':
					this.__genReturns(node);
					break;
				case 'memberof':
					this.__genMemberOf(node.parent);
					break;
				default:
					return;
			}
		});
	}

	private __genFunctionName(node: FunctionLike) {
		let name: string;
		if (node.kind === ts.SyntaxKind.ArrowFunction) {
			const parent = node.parent;
			if (ts.isVariableDeclaration(parent)) name = parent.name.getText();
			else if (
				ts.isBinaryExpression(parent) &&
				parent.operatorToken.kind === ts.SyntaxKind.EqualsToken &&
				ts.isIdentifier(parent.left)
			)
				name = parent.left.getText();
			else if (ts.isPropertyAssignment(parent)) name = parent.name.getText();
			else name = '';
		} else name = node.name?.getText() || '';

		this.__content.push(`@function ${name}`);
	}

	private __genReturns(node: FunctionLike) {
		const findAllReturns = (block: ts.Node) => {
			const statements = block.getChildren();
			let inThisLevel: ts.ReturnStatement[] = statements.filter(
				s => s.kind === ts.SyntaxKind.ReturnStatement
			) as ts.ReturnStatement[];
			statements.forEach(s => {
				if (
					[
						ts.SyntaxKind.FunctionDeclaration,
						ts.SyntaxKind.FunctionExpression,
						ts.SyntaxKind.ArrowFunction,
					].includes(s.kind)
				)
					return;
				else inThisLevel = inThisLevel.concat(findAllReturns(s));
			});
			return inThisLevel;
		};

		const returns = findAllReturns(node);
		const types = new Set();
		returns.forEach(r => {
			types.add(r.expression ? getExpType(r.expression) : '');
		});

		const clearTypes = [...types].filter(t => !!t);
		if (clearTypes.length === 0) return;
		if (clearTypes.length < types.size) clearTypes.push('undefined');

		const type = clearTypes.includes('any') ? 'any' : clearTypes.join(' | ');

		this.__content.push(`@returns {${type}} `);
	}

	private __genConstructorDeclaration(node: ts.ConstructorDeclaration) {
		this.__classConstructorDocContent.forEach((tag, i) => {
			switch (tag) {
				case 'description':
					this.__genDescription(
						i,
						`Creates an instance of ${this.getNodeTextTrim((<ts.ClassDeclaration>node.parent).name)}.`
					);
					break;
				case 'author':
					this.__genAuthor();
					break;
				case 'date':
					this.__genDate();
					break;
				case 'param':
					this.__genParams(node);
					break;
				case 'memberof':
					this.__genMemberOf(node.parent);
					break;
				default:
					return;
			}
		});
	}

	private __genParams(node: FunctionLike | ts.PropertyDeclaration) {
		const docParam = (p: ts.ParameterDeclaration | ts.BindingElement, parentName = '', indexInChild = 0) => {
			const isOptional = (ts.isParameter(p) && p.questionToken) || p.initializer;
			const isArgs = !!p.dotDotDotToken;
			const defaultVal = isOptional ? this.getNodeTextTrim(p.initializer) : '';

			let pType: string;
			if (ts.isParameter(p) && p.type) pType = this.getNodeTextTrim(p.type);
			else if (!p.initializer && ts.isArrayBindingPattern(p.name)) pType = 'any[]';
			else if (!p.initializer && ts.isObjectBindingPattern(p.name)) pType = 'object';
			else pType = getExpType(p.initializer);

			let pName: string;
			if (ts.isIdentifier(p.name)) pName = this.getNodeTextTrim(p.name);
			else if (ts.isBindingElement(p) && p.propertyName) pName = this.getNodeTextTrim(p.propertyName);
			else pName = `${this.__defaultParamName}${indexInChild}`;

			pName = `${parentName ? parentName + '.' : ''}${pName}`;

			this.__content.push(
				`@param {${(isArgs ? '...' : '') + pType}} ${
					!isOptional ? pName : `[${pName}${defaultVal ? `=${defaultVal}` : ''}]`
				} `
			);

			if (ts.isArrayBindingPattern(p.name)) {
				p.name.elements.forEach((e, i) => {
					if (ts.isBindingElement(e)) docParam(e, pName + '[]', i);
				});
			} else if (ts.isObjectBindingPattern(p.name)) {
				p.name.elements.forEach((e, i) => {
					docParam(e, pName, i);
				});
			}
		};
		const doc = (n: FunctionLike) => {
			n.parameters.forEach((p, i) => {
				docParam(p, '', i);
			});
		};
		if (node.kind !== ts.SyntaxKind.PropertyDeclaration) doc(node);
	}

	private __genMemberOf(parent: ts.Node) {
		const parentHasMember = [ts.SyntaxKind.ClassDeclaration, ts.SyntaxKind.InterfaceDeclaration].includes(
			parent.kind
		);
		parentHasMember &&
			this.__content.push(
				`@memberof ${this.getNodeTextTrim((parent as ts.ClassDeclaration | ts.InterfaceDeclaration).name)}`
			);
	}

	private __genEnumMember(node: ts.EnumMember) {
		this.__genDescription();

		let type: string;
		if (!node.initializer) type = '*';
		else if (ts.isStringLiteral(node.initializer)) type = 'string';
		else if (ts.isNumericLiteral(node.initializer)) type = 'number';
		else type = 'any';

		this.__content.push(`@member {${type}} ${this.getNodeTextTrim(node.name)}`);
	}

	private __genEnumDeclaration(node: ts.EnumDeclaration) {
		function getEnumType() {
			const types = new Set();
			let unknown = false;
			node.members.forEach(m => {
				if (!m.initializer) return;
				else if (ts.isStringLiteral(m.initializer)) types.add('string');
				else if (ts.isNumericLiteral(m.initializer)) types.add('number');
				else unknown = true;
			});

			return unknown ? 'any' : [...types].join(', ');
		}
		this.__EnumDocContent.forEach((tag, i) => {
			switch (tag) {
				case 'description':
					this.__genDescription(i);
					break;
				case 'enum':
					this.__content.push(`@enum {${getEnumType()}}`);
					break;
				case 'author':
					this.__genAuthor();
					break;
				case 'date':
					this.__genDate();
					break;
				default:
					return;
			}
		});
	}

	private __genInterfaceDeclaration(node: ts.InterfaceDeclaration) {
		this.__interfaceDeclarationContent.forEach((tag, i) => {
			switch (tag) {
				case 'description':
					this.__genDescription(i);
					break;
				case 'interface':
					this.__content.push('@interface ');
					break;
				case 'heritage':
					this.__genHeritageClauses(node);
					break;
				case 'template':
					this.__genTypeParameters(node);
					break;
				case 'author':
					this.__genAuthor();
					break;
				case 'date':
					this.__genDate();
					break;
				default:
					return;
			}
		});
	}

	private __genClassDeclaration(node: ts.ClassDeclaration) {
		this.__classDeclarationContent.forEach((tag, i) => {
			switch (tag) {
				case 'description':
					this.__genDescription(i);
					break;
				case 'class':
					this.__content.push('@class ');
					break;
				case 'heritage':
					this.__genHeritageClauses(node);
					break;
				case 'template':
					this.__genTypeParameters(node);
					break;
				case 'author':
					this.__genAuthor();
					break;
				case 'date':
					this.__genDate();
					break;
				default:
					return;
			}
		});
	}

	private __genTypeParameters(node: ts.ClassDeclaration | ts.InterfaceDeclaration | FunctionLike) {
		node.typeParameters?.forEach(p => {
			this.__content.push(`@template ${this.getNodeTextTrim(p.name)}`);
		});
	}

	private __genDate() {
		this.__content.push(`@date ${dayjs().format(this.__dateFormat)}`);
	}

	private __genAuthor() {
		this.__content.push(`@author ${this.__authorName}`);
	}

	private __genHeritageClauses(node: ts.ClassDeclaration | ts.InterfaceDeclaration) {
		node.heritageClauses?.forEach(h => {
			let type: string;
			switch (h.token) {
				case ts.SyntaxKind.ExtendsKeyword:
					type = 'extends';
					break;
				case ts.SyntaxKind.ImplementsKeyword:
					type = 'implements';
					break;
				default:
					type = '';
			}

			if (!type) return;

			const exp = h.types.map(e => this.getNodeTextTrim(e)).join(', ');
			this.__content.push(`@${type} ${exp}`);
		});
	}

	private __genDescription(descriptionIndex = 0, content = '') {
		if (this.__hideHeaderDescription && descriptionIndex === 0) this.__content.push(content);
		else this.__content.push(`@description ${content}`);
		this.__content.push('');
	}

	getStringArray() {
		return this.__content.concat();
	}

	convertToString(indentString = '', tagArray = this.__content) {
		return `\n${indentString}/**\n${indentString}${tagArray
			.map(s => ' * ' + s)
			.join(`\n${indentString}`)}\n${indentString} */\n${indentString}`;
	}

	getNodeTextTrim(node: ts.Node | undefined) {
		if (!node) return '';
		return node.getText();
		// return this.getText(node.pos, node.end).trim();
	}

	getText(start = this.__scope.start, end = this.__scope.end) {
		return this.__document.getText(
			new vs.Range(
				this.__document.positionAt(start + this.__scope.start),
				this.__document.positionAt(end + this.__scope.start)
			)
		);
	}

	setScope(scope: { start: number; end: number }) {
		this.__scope = scope;
	}
}
