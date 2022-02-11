declare namespace Mocha {
	interface TestFunction {
		(title: string, fn: NwCallbackFunc): any;
	}

	interface HookFunction {
		(fn: NwCallbackFunc): void;
	}

	type NwCallbackFunc = (this: any, done: object) => void;
}

interface NightwatchBrowser {
	ameQuickSetup(phpHelpers?: string[]): this;

	ameSelectItemByTitle(titles: string[], expand?: boolean, callback?): this;

	ameAssertExecute(callback, args?: any[], expectedResult?: any, message?: string): this;

	ameLoadDefaultMenu(callback?): this;

	logInAsAdmin(callback?): this;
}