import * as vs from 'vscode';
import * as ts from 'typescript';
import { parse, ENode, traverse, getENodePropsValue } from '../utils/vue/parse';

type TemplateDefType = 'ref' | 'vForScope' | 'slotScope';

function isTemplateDefType(def: Definition) {
	return ['ref', 'vForScope', 'slotScope'].includes(def.type);
}

type StylesheetDefType = 'style-class' | 'style-id';

function isStylesheetDefType(def: Definition) {
	return ['style-class', 'style-id'].includes(def.type);
}

type VueOptionsDefType = 'component' | 'setup' | 'prop' | 'data' | 'computed' | 'method';

function isVueOptionsDefType(def: Definition) {
	return ['component', 'setup', 'prop', 'data', 'computed', 'method'].includes(def.type);
}

type DefinitionType = VueOptionsDefType | StylesheetDefType | TemplateDefType;

interface DefinitionBase {
	name: string;
	type: DefinitionType;
	pos: vs.Position;
}

interface ScriptDefinition extends DefinitionBase {
	type: VueOptionsDefType;
}

interface TemplateDefinition extends DefinitionBase {
	type: TemplateDefType;
	activeScope?: vs.Range;
}

interface StyleDefinition extends DefinitionBase {
	type: StylesheetDefType;
}

type Definition = TemplateDefinition | StyleDefinition | ScriptDefinition;

export default class DefCollector {
	private __doc: vs.TextDocument;
	private __offsetBase: number;
	private __target: vs.Range;
	private __defGroup: Definition[];

	constructor(doc: vs.TextDocument, target: vs.Range) {
		this.__doc = doc;
		this.__offsetBase = 0;
		this.__target = target;
		this.__defGroup = [];
	}

	buildDefGroup(doc = this.__doc) {
		this.__doc = doc;
		if (doc.languageId === 'vue') {
			const ast = parse(doc.getText());
			ast.children.forEach(n => {
				if (n.name === 'template') this.__buildForTemplate(n);
				else if (n.name === 'script')
					this.__buildForScript(doc.getText().slice(n.contentPos, n.contentEnd), n.contentPos);
				else if (n.name === 'style')
					this.__buildForStylesheet(doc.getText().slice(n.contentPos, n.contentEnd), n.contentPos);
			});
		}
		return this;
	}

	private __buildForStylesheet(text: string, offsetBase = 0) {
		this.__offsetBase = offsetBase;
		let offsetIndex = 0;
		let res: StyleDefinition[] = [];
		text.match(/[#.][\w-_]+(?=\s*{)/g)?.forEach(match => {
			const idx = text.indexOf(match, offsetIndex);
			const name = match.slice(1);
			let type: StylesheetDefType | undefined;
			if (match.startsWith('.')) type = 'style-class';
			else if (match.startsWith('#')) type = 'style-id';
			if (idx > -1 && type) res.push({ name, type, pos: this.positionAt(idx + match.length) });
			offsetIndex = offsetIndex + match.length;
		});
		this.__defGroup = this.__defGroup.concat(res);
	}

	private __buildForTemplate(templateRoot: ENode) {
		const res: Definition[] = [];
		traverse(templateRoot, node => {
			const [hasRef, refVal] = getENodePropsValue(node.props, 'ref');
			const [hasVFor, vForVal] = getENodePropsValue(node.props, 'v-for');
			const [hasVSlot, vSlotVal] = getENodePropsValue(node.props, 'v-slot(:[\\w-_]+)?');
			const [hasSlotScope, slotScopeVal] = getENodePropsValue(node.props, 'slot-scope');

			const nodeTagStartText = this.__doc.getText().slice(node.pos, node.contentPos || node.end);
			const nodeScope = new vs.Range(this.positionAt(node.pos as number), this.positionAt(node.end as number));
			if (hasRef && refVal)
				res.push({
					name: refVal,
					type: 'ref',
					pos: this.positionAt(
						nodeTagStartText.indexOf(refVal, nodeTagStartText.indexOf('ref') + 'ref'.length) +
							(node.pos as number)
					),
				});
			if (hasVFor && vForVal) {
				const defStr = vForVal.split(' ')[0];
				let startIdx = nodeTagStartText.indexOf('v-for') + 'v-for'.length;
				defStr?.match(/\w+/g)?.forEach(m => {
					res.push({
						name: m,
						type: 'vForScope',
						pos: this.positionAt(nodeTagStartText.indexOf(m, startIdx) + (node.pos as number)),
						activeScope: nodeScope,
					});
					startIdx = nodeTagStartText.indexOf(m, startIdx);
				});
			}
			if (hasVSlot && vSlotVal) {
				let startIdx = nodeTagStartText.indexOf('v-slot') + 'v-slot'.length;
				vSlotVal.match(/\w+/g)?.forEach(m => {
					res.push({
						name: m,
						type: 'slotScope',
						pos: this.positionAt(nodeTagStartText.indexOf(m, startIdx) + (node.pos as number)),
						activeScope: nodeScope,
					});
					startIdx = nodeTagStartText.indexOf(m, startIdx);
				});
			}
			if (hasSlotScope && slotScopeVal) {
				let startIdx = nodeTagStartText.indexOf('slot-scope') + 'slot-scope'.length;
				slotScopeVal.match(/\w+/g)?.forEach(m => {
					res.push({
						name: m,
						type: 'slotScope',
						pos: this.positionAt(nodeTagStartText.indexOf(m, startIdx) + (node.pos as number)),
						activeScope: nodeScope,
					});
					startIdx = nodeTagStartText.indexOf(m, startIdx);
				});
			}
		});

		this.__defGroup = this.__defGroup.concat(res);
	}

	private __buildForScript(text: string, offsetBase = 0) {
		this.__offsetBase = offsetBase;
		const sf = ts.createSourceFile('tmp', text, ts.ScriptTarget.Latest, false, ts.ScriptKind.TSX);
		this.__traverseScriptContent(sf);
	}

	private __traverseScriptContent(sf: ts.Node) {
		const sfRoot = sf.getChildren()[0];
		// console.log(sfRoot.getChildren());
		const exportDefault = sfRoot.getChildren().find(n => ts.isExportAssignment(n));
		if (!exportDefault) {
			const exportDefaultClass = sfRoot.getChildren().find(n => {
				if (!ts.isClassDeclaration(n)) return false;
				let isExport, isDefault;
				n.modifiers?.forEach(m => {
					if (m.kind === ts.SyntaxKind.ExportKeyword) isExport = true;
					else if (m.kind === ts.SyntaxKind.DefaultKeyword) isDefault = true;
				});
				if (!isExport || !isDefault) return false;
				else return true;
			});
			console.log(exportDefaultClass);
			// TODO: 分析Vue2使用的Class Style Component
		} else {
			// export default后跟的表达式
			// console.log(exportDefault);
			const exp = (exportDefault as ts.ExportAssignment).expression;
			if (ts.isObjectLiteralExpression(exp)) {
				// 直接export default的options对象
				this.__analysisVueOptions(exp);
			} else if (ts.isCallExpression(exp)) {
				// export default调用函数，包括Vue2的Vue.extend以及Vue3的defineComponent，其参数为options对象
				if (exp.arguments.length < 1) return;
				const arg0 = exp.arguments[0];
				if (ts.isObjectLiteralExpression(arg0)) this.__analysisVueOptions(arg0);
			} else return;
		}
	}

	private __analysisVueOptions(opt: ts.ObjectLiteralExpression) {
		opt.properties.forEach(p => {
			if (p.name?.kind === ts.SyntaxKind.Identifier) {
				switch (p.name.escapedText) {
					case 'components': {
						if (ts.isPropertyAssignment(p) && ts.isObjectLiteralExpression(p.initializer))
							this.__analysisComponent(p.initializer);
						break;
					}
					case 'props':
						if (
							ts.isPropertyAssignment(p) &&
							(ts.isObjectLiteralExpression(p.initializer) || ts.isArrayLiteralExpression(p.initializer))
						)
							this.__analysisProps(p.initializer);
						break;
					case 'setup':
						if (ts.isMethodDeclaration(p) && p.body) this.__analysisSetup(p.body);
						break;
					case 'data':
						if (ts.isMethodDeclaration(p) && p.body) this.__analysisData(p.body);
						break;
					case 'computed':
						if (
							ts.isPropertyAssignment(p) &&
							(ts.isObjectLiteralExpression(p.initializer) || ts.isCallExpression(p.initializer))
						)
							this.__analysisComputed(p.initializer);
						break;
					case 'methods':
						if (
							ts.isPropertyAssignment(p) &&
							(ts.isObjectLiteralExpression(p.initializer) || ts.isCallExpression(p.initializer))
						)
							this.__analysisMethod(p.initializer);
						break;
					default:
						return;
				}
			}
		});
	}

	private __analysisMethod(methodsOpt: ts.ObjectLiteralExpression | ts.CallExpression) {
		if (ts.isCallExpression(methodsOpt) && ts.isObjectLiteralExpression(methodsOpt.arguments[0]))
			this.__defGroup = this.__defGroup.concat(
				this.__getPropertiesDefinitionOfObject(
					methodsOpt.arguments[0] as ts.ObjectLiteralExpression,
					'computed'
				)
			);
		else if (ts.isObjectLiteralExpression(methodsOpt))
			this.__defGroup = this.__defGroup.concat(this.__getPropertiesDefinitionOfObject(methodsOpt, 'computed'));
	}

	private __analysisComputed(computedOpt: ts.ObjectLiteralExpression | ts.CallExpression) {
		if (ts.isCallExpression(computedOpt) && ts.isObjectLiteralExpression(computedOpt.arguments[0]))
			this.__defGroup = this.__defGroup.concat(
				this.__getPropertiesDefinitionOfObject(
					computedOpt.arguments[0] as ts.ObjectLiteralExpression,
					'computed'
				)
			);
		else if (ts.isObjectLiteralExpression(computedOpt))
			this.__defGroup = this.__defGroup.concat(this.__getPropertiesDefinitionOfObject(computedOpt, 'computed'));
	}

	private __analysisData(funcBody: ts.Block) {
		const returnStatement = funcBody.statements.find(
			s => ts.isReturnStatement(s) && s.expression && ts.isObjectLiteralExpression(s.expression)
		);
		if (returnStatement)
			this.__defGroup = this.__defGroup.concat(
				this.__getPropertiesDefinitionOfObject(
					(returnStatement as ts.ReturnStatement).expression as ts.ObjectLiteralExpression,
					'data'
				)
			);
	}

	private __analysisSetup(funcBody: ts.Block) {
		const returnStatement = funcBody.statements.find(
			s => ts.isReturnStatement(s) && s.expression && ts.isObjectLiteralExpression(s.expression)
		);
		if (returnStatement)
			this.__defGroup = this.__defGroup.concat(
				this.__getPropertiesDefinitionOfObject(
					(returnStatement as ts.ReturnStatement).expression as ts.ObjectLiteralExpression,
					'setup'
				)
			);
	}

	private __analysisProps(propsOpt: ts.ObjectLiteralExpression | ts.ArrayLiteralExpression) {
		if (ts.isObjectLiteralExpression(propsOpt))
			this.__defGroup = this.__defGroup.concat(this.__getPropertiesDefinitionOfObject(propsOpt, 'prop'));
		else if (ts.isArrayLiteralExpression(propsOpt))
			this.__defGroup = this.__defGroup.concat(this.__getPropertiesDefinitionOfArray(propsOpt, 'prop'));
	}

	private __analysisComponent(componentsOpt: ts.ObjectLiteralExpression) {
		this.__defGroup = this.__defGroup.concat(this.__getPropertiesDefinitionOfObject(componentsOpt, 'component'));
	}

	private __getPropertiesDefinitionOfArray(arr: ts.ArrayLiteralExpression, type: DefinitionType) {
		let res: Definition[] = [];
		arr.elements.forEach(e => {
			if (!e) return;
			const pos = this.positionAt(e.end);
			let name = '';
			if (ts.isIdentifier(e)) name = e.escapedText.toString();
			else if (ts.isStringLiteral(e)) name = e.text;
			if (name) res.push({ name, type, pos });
		});
		return res;
	}

	private __getPropertiesDefinitionOfObject(obj: ts.ObjectLiteralExpression, type: DefinitionType) {
		let res: Definition[] = [];
		obj.properties.forEach(p => {
			let name = '';
			if (ts.isPropertyAssignment(p) || ts.isMethodDeclaration(p)) {
				if (ts.isIdentifier(p.name)) name = p.name.escapedText.toString();
				else if (ts.isStringLiteral(p.name)) name = p.name.text;
			} else if (ts.isShorthandPropertyAssignment(p)) name = p.name.escapedText.toString();
			else if (ts.isSpreadAssignment(p)) {
				// 对象解构赋值
				name = '';
				if (ts.isObjectLiteralExpression(p.expression))
					res = res.concat(this.__getPropertiesDefinitionOfObject(p.expression, type));
				else if (ts.isCallExpression(p.expression) && ts.isObjectLiteralExpression(p.expression.arguments[0]))
					res = res.concat(
						this.__getPropertiesDefinitionOfObject(
							p.expression.arguments[0] as ts.ObjectLiteralExpression,
							type
						)
					);
			}
			if (name && p.name) res.push({ name, type, pos: this.positionAt(p.name.end) });
		});
		return res;
	}

	collect(): vs.Location[] {
		const targetName = this.__doc.getText(this.__target);
		console.log(targetName);
		const res: vs.Location[] = [];
		this.__defGroup.forEach(def => {
			if (def.name === targetName) {
				if (
					isTemplateDefType(def) &&
					(def as TemplateDefinition).activeScope &&
					!(def as TemplateDefinition).activeScope?.contains(this.__target)
				)
					return;
				else res.push(this.getLocation(def));
			}
		});
		console.log(res);
		return res;
	}

	getLocation(def: Definition) {
		return new vs.Location(this.__doc.uri, def.pos);
	}

	private positionAt(offset: number) {
		return this.__doc.positionAt(offset + this.__offsetBase);
	}
}
