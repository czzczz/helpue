import * as vs from 'vscode';

export function getExtentionConfig<T>(section: string, defaultValue: T) {
	return vs.workspace.getConfiguration('helpue').get(section, defaultValue);
}

export function getDocHereConfig<T>(section: string, defaultValue: T) {
	return vs.workspace.getConfiguration('helpue.documentHere').get(section, defaultValue);
}
