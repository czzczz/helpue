const reg = {
	tag: () => {
		return /(<([A-Za-z0-9\-]+)(\s([\s\S]*?))?\s*>)|(<\/([A-Za-z0-9\-]*)\s*>)|(<([A-Za-z0-9\-]+)(\s([\s\S]*?))?\s*\/\s*>)/g;
	},
	tagStart: () => {
		return /\s*<([A-Za-z0-9\-]+)\s*(([\s\S]*?))?\s*>\s*/g;
	},
	tagEnd: () => {
		return /\s*<\/[A-Za-z0-9\-]+\s*>\s*/g;
	},
	tagAutoClose: () => {
		return /\s*<([A-Za-z0-9\-]+)\s*(([\s\S]*?))?\s*\/\s*>\s*/g;
	},
	tagProperties: () => {
		return /[^'"\s]+(=(\'[^\']*\')|(\"[^\"]*\"))?/g;
	},
};

interface ENodeProp {
	key: string;
	value?: string;
}

export interface ENode {
	parent?: ENode;
	name: string;
	pos?: number;
	end?: number;
	contentPos?: number;
	contentEnd?: number;
	props: ENodeProp[];
	children: ENode[];
}

interface ENodeRoot extends ENode {
	parent: undefined;
}

/**
 * @description 根据输入的字符串获取html like tag的名称和属性
 * @param text 输入的字符串
 * @returns {object} 结果
 */
function getTagInfo(text: string) {
	const res = {
		name: '',
		props: <ENodeProp[]>[],
	};
	text.replace(reg.tagStart(), (match, name, propsString) => {
		res.name = name;
		if (propsString)
			propsString.match(reg.tagProperties()).forEach((p: string) => {
				if (p.includes('=')) {
					const pInfo = p.split('=');
					res.props.push({
						key: pInfo[0],
						// 将props的双引号或单引号去掉
						value: pInfo[1].slice(1, -1),
					});
				} else
					res.props.push({
						key: p,
					});
			});
		return match;
	});
	return res;
}

/**
 * @description 根据输入的字符串构建VueComponent的AST
 * @param {string} text 输入的字符串
 * @returns {ENodeRoot} 构建完成的树
 */
export function buildAST(text: string) {
	// console.time();
	const tagList = text.match(reg.tag());
	const textLength = text.length;
	const tree: ENodeRoot = {
		parent: undefined,
		name: 'document',
		props: [],
		pos: 0,
		end: textLength - 1,
		contentPos: 0,
		contentEnd: textLength - 1,
		children: [],
	};
	let p: ENode = tree,
		pText = 0;

	tagList?.forEach(t => {
		const pos = text.indexOf(t, pText);
		pText = pos + t.length;
		if (reg.tagEnd().test(t)) {
			p.contentEnd = pos;
			p.end = pText;
			if (p.parent) p = p.parent;
		} else {
			const { name, props } = getTagInfo(t);
			const newNode: ENode = {
				parent: p,
				name,
				pos,
				contentPos: pText,
				props,
				children: [],
			};
			p.children?.push(newNode);
			if (!reg.tagAutoClose().test(t)) p = newNode;
			else {
				newNode.contentPos = newNode.contentEnd = undefined;
				newNode.end = pText;
			}
		}
	});
	// console.timeEnd();
	return tree;
}

export const parse = buildAST;

/**
 * @description 对目标树进行深度遍历
 *
 * @function traverseAST
 * @author chanzrz
 * @date 2020-12-06
 * @param {ENode} ast 需要开始遍历的ENode节点
 * @param {function} [cb=(node: ENode) => { console.log(node); }] 回调，每个节点都会执行
 * @param {ENode} cb.node 回调时传递的参数
 */
export function traverseAST(
	ast: ENode,
	cb = (node: ENode) => {
		console.log(node);
	}
) {
	cb(ast);
	ast.children.forEach(c => {
		traverseAST(c, cb);
	});
}

export const traverse = traverseAST;

/**
 * @description 查询属性列表中是否包含目标属性，若有的话同时返回其内容
 * @param props 数据数组
 * @param target 要查找的目标
 * @returns {[boolean, string | undefined]} result
 */
export function getENodePropsValue(props: ENodeProp[], target: string): [boolean, string | undefined] {
	let has = false,
		res = undefined;
	props.forEach(p => {
		if (new RegExp(`^${target}$`).test(p.key)) {
			has = true;
			res = p.value;
		}
	});
	return [has, res];
}

/**
 * @description 根据tagName在node中深度搜索所有有目标名称的tag并返回其内容
 * @param node 要查询的树或节点
 * @param tagName 要查询的目标tag
 */
export function getContentByTagType(node: ENode, tagName: string): ENode[] {
	let res: ENode[] = [];
	if (node.name === tagName) res.push(node);
	node.children?.forEach(n => {
		res = res.concat(getContentByTagType(n, tagName));
	});
	return res;
}
