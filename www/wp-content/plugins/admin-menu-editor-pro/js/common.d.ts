///<reference path="knockout.d.ts"/>

interface AmeDictionary<T> {
	[mapKey: string]: T;
}

// noinspection JSUnusedGlobalSymbols
type KeysMatchingType<T, V> = { [K in keyof T]: T[K] extends V ? K : never }[keyof T];

type AmeCssBorderStyle = 'none' | 'solid' | 'dashed' | 'dotted' | 'double' | 'groove' | 'ridge' | 'outset';

interface AmeCssBorderSettings {
	style: AmeCssBorderStyle;
	color: string;
	width: number;
}

type AmeObservablePropertiesOf<T> = {
	[P in keyof T]: KnockoutObservable<T[P]>;
}

type AmeRecursiveObservablePropertiesOf<T> = {
	[P in keyof T]: T[P] extends object ? AmeRecursiveObservablePropertiesOf<T[P]> : KnockoutObservable<T[P]>;
}

