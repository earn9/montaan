import React from 'react';
import {
	FSDirEntry,
	getOrCreateDir,
	createDir,
	createFile,
	Filesystem,
	getFullPath,
	FSEntry,
} from '../../Montaan/Filesystems';
import { PortugalCOVIDCases } from './PortugalCOVIDCases';
import { getNUTSName } from './NUTS';
import { TreeLink } from '../../Montaan/MainApp';
import Button from 'react-bootstrap/Button';
import utils from '../../Montaan/Utils/utils';
import { PortugalConcelhos } from './PortugalConcelhos';

class CasesFilesystem extends Filesystem {
	graphVisible: boolean = false;

	constructor(mountPoint: FSEntry) {
		super(undefined);
		this.mountPoint = mountPoint;
	}

	async readDir(path: string) {
		return null;
	}

	setLinks = (links: TreeLink[]) => {};
	navigationTarget = '';

	onClick = () => {
		this.graphVisible = !this.graphVisible;
		if (this.graphVisible) {
			this.setLinks(PortugalCOVIDCaseLinks);
		} else {
			this.setLinks([]);
		}
	};

	getUIComponents(state: any) {
		this.setLinks = state.setLinks;
		this.navigationTarget = state.navigationTarget;
		return (
			<div
				style={{ position: 'fixed', top: '80px', left: '10px', zIndex: 10000 }}
				key={this.mountPoint ? getFullPath(this.mountPoint) : 'cases'}
			>
				<Button onClick={this.onClick}>Show graph</Button>
			</div>
		);
	}
}

class PeopleFilesystem extends Filesystem {
	startIndex: number;
	count: number;
	covidCount: number;

	constructor(startIndex: number, count: number, covidCount: number) {
		super(undefined);
		this.startIndex = startIndex;
		this.count = count;
		this.covidCount = covidCount;
	}

	async readDir(path: string): Promise<FSDirEntry | null> {
		return new Promise((resolve, reject) => {
			setTimeout(() => {
				const tree = new FSDirEntry();
				for (
					let i = this.startIndex, l = this.startIndex + this.count, j = 0;
					i < l;
					i++, j++
				) {
					const personEntry = createFile(tree, i.toString());
					personEntry.color = j < this.covidCount ? [0.5, 0, 0] : [0, 0, 0];
					// 		0.65 + 0.35 * Math.sin(i * 0.2),
					// 		0.65 + 0.35 * Math.cos(i * 0.17418),
					// 		0.65 + 0.35 * Math.sin(i * 0.041),
					//   ];
				}
				resolve(tree);
			}, 10);
		});
	}

	async readFile(path: string) {
		return new Promise<ArrayBuffer>((resolve, reject) => {
			setTimeout(() => {
				resolve(new TextEncoder().encode(path).buffer);
			}, 10);
		});
	}
}

function addCasesToCaseList(
	caseList: string[],
	pathPrefix: string,
	startIndex: number,
	count: number
): void {
	for (let i = 0; i < count; i++) {
		const path = '/NUTS' + pathPrefix + '/' + (startIndex + i).toString();
		caseList.push(path);
	}
}

function convertCaseListToLinks(caseList: string[]): TreeLink[] {
	const links: TreeLink[] = [];
	for (let i = 0, j = 1; i < caseList.length && j < caseList.length; i++) {
		for (let k = 0; k < 3 && j < caseList.length; k++, j++) {
			links.push({
				src: caseList[i],
				dst: caseList[j],
				color: {
					r: 0.2 + 0.03 * Math.pow(j, 1 / 3),
					g: 0.3,
					b: 0.7 - 0.03 * Math.pow(j, 1 / 3),
				},
			});
		}
	}
	return links;
}

const dayCases = new Map<string, number>(PortugalCOVIDCases.get('2020-4-17').entries());
const caseList: string[] = [];
const tree = new FSDirEntry('');
tree.filesystem = new CasesFilesystem(tree);
tree.fetched = true;
let populationCounter = 0;
PortugalConcelhos.forEach(([nuts, lau, lauName, lauNameLatin, change, populationString]) => {
	const population = parseInt(populationString);
	const countryEntry = getOrCreateDir(tree, getNUTSName(nuts, 0));
	const nuts1Entry = getOrCreateDir(countryEntry, getNUTSName(nuts, 1));
	const nuts2Entry = getOrCreateDir(nuts1Entry, getNUTSName(nuts, 2));
	let covidCount = dayCases.get(lauName) ?? 0;
	if (covidCount > population) {
		throw new Error('More cases than people');
	}
	if (covidCount > 0) {
		dayCases.delete(lauName);
	}
	const nuts3Entry = getOrCreateDir(nuts2Entry, getNUTSName(nuts, 3));
	const lauEntry = createDir(nuts3Entry, lauName.replace(/\//g, '|'));
	lauEntry.lastIndex += covidCount;
	nuts3Entry.lastIndex += covidCount;
	lauEntry.color = [
		(lauEntry.lastIndex > 0 ? 0.1 : 0) + Math.min(0.4, lauEntry.lastIndex / 500),
		lauEntry.lastIndex <= 0 ? 0.2 : 0,
		0.0,
	];
	nuts3Entry.color = [
		Math.min(0.4, nuts3Entry.lastIndex / 1000),
		Math.min(0.25, nuts3Entry.lastIndex / 1000),
		0,
	];
	for (let i = 0; i < population; i += 150) {
		const populationEntry = createDir(lauEntry, i.toString());
		populationEntry.color = [
			(covidCount > 0 ? 0.2 : 0) + 0.5 * Math.min(150, covidCount) * 0.01,
			0.0,
			0.0,
		];
		populationEntry.filesystem = new PeopleFilesystem(
			populationCounter,
			Math.min(150, population - i),
			covidCount
		);
		addCasesToCaseList(
			caseList,
			getFullPath(populationEntry),
			populationCounter,
			Math.min(150, covidCount)
		);
		covidCount -= 150;
		covidCount = Math.max(0, covidCount);

		populationCounter += Math.min(150, population - i);
	}
});
utils.traverseFSEntry(tree, (fsEntry) => (fsEntry.fetched = fsEntry.filesystem === undefined), '');
export const PortugalCOVIDCaseLinks = convertCaseListToLinks(caseList);
export const PortugalCOVIDTree = tree;
