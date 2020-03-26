import * as THREE from 'three';
import { FSEntry, createFSTree } from './filesystem';
import { FileTree } from '../MainApp';
var slash = '/'.charCodeAt(0);

var utils = {
	uniq: function(array: any[], cmp: (a: any, b: any) => number) {
		return array.sort(cmp).reduce(function(s, a) {
			if (s.length === 0 || cmp(s[s.length - 1], a) !== 0) s.push(a);
			return s;
		}, []);
	},

	findIntersectionsUnderEvent: function(
		ev: { clientX: number; clientY: number; target: HTMLElement },
		camera: THREE.Camera,
		objects: THREE.Object3D[]
	) {
		var style = getComputedStyle(ev.target);
		var elementTransform = style.getPropertyValue('transform');
		var elementTransformOrigin = style.getPropertyValue('transform-origin');

		var xyz = elementTransformOrigin
			.replace(/px/g, '')
			.split(' ')
			.map(parseFloat);
		xyz[2] = xyz[2] || 0;

		var mat = new THREE.Matrix4();
		mat.identity();
		if (/^matrix\(/.test(elementTransform)) {
			const elements = elementTransform.replace(/^matrix\(|\)$/g, '').split(' ');
			mat.elements[0] = parseFloat(elements[0]);
			mat.elements[1] = parseFloat(elements[1]);
			mat.elements[4] = parseFloat(elements[2]);
			mat.elements[5] = parseFloat(elements[3]);
			mat.elements[12] = parseFloat(elements[4]);
			mat.elements[13] = parseFloat(elements[5]);
		} else if (/^matrix3d\(/i.test(elementTransform)) {
			const elements = elementTransform.replace(/^matrix3d\(|\)$/gi, '').split(' ');
			for (var i = 0; i < 16; i++) {
				mat.elements[i] = parseFloat(elements[i]);
			}
		}

		var mat2 = new THREE.Matrix4();
		mat2.makeTranslation(xyz[0], xyz[1], xyz[2]);
		mat2.multiply(mat);
		mat.makeTranslation(-xyz[0], -xyz[1], -xyz[2]);
		mat2.multiply(mat);

		var bbox = ev.target.getBoundingClientRect();
		var vec = new THREE.Vector3(ev.clientX - bbox.left, ev.clientY - bbox.top, 0);
		vec.applyMatrix4(mat2);

		var width = parseFloat(style.getPropertyValue('width'));
		var height = parseFloat(style.getPropertyValue('height'));

		var mouse3D = new THREE.Vector3((vec.x / width) * 2 - 1, -(vec.y / height) * 2 + 1, 0.5);
		mouse3D.unproject(camera);
		mouse3D.sub(camera.position);
		mouse3D.normalize();
		var raycaster = new THREE.Raycaster(camera.position, mouse3D);
		var intersects = raycaster.intersectObjects(objects);
		return intersects;
	},

	findObjectUnderEvent: function(
		ev: { clientX: number; clientY: number; target: HTMLElement },
		camera: THREE.Camera,
		objects: THREE.Object3D[]
	) {
		var intersects = this.findIntersectionsUnderEvent(ev, camera, objects);
		if (intersects.length > 0) {
			var obj = intersects[0].object;
			return obj;
		}
	},

	addFileTreeEntry: function(
		path: string,
		tree: FSEntry,
		mode: any,
		type: any,
		hash: any,
		size: string
	) {
		var dir = false;
		if (path.charCodeAt(path.length - 1) === slash) {
			dir = true;
		}
		var segments = path.split('/');
		if (dir) {
			segments.pop();
		}
		var branch = tree;
		var addCount = 0;
		for (var i = 0; i < segments.length - 1; i++) {
			var segment = segments[i];
			if (branch.entries === null) {
				branch.entries = {};
			}
			if (typeof branch.entries[segment] !== 'object') {
				branch.entries[segment] = {
					...createFSTree(segment, ''),
					name: segment,
					title: segment,
					entries: {},
					index: undefined,
					size: 0,
				};
				addCount++;
			}
			branch = branch.entries[segment];
		}
		if (branch.entries === null) {
			branch.entries = {};
		}
		if (typeof branch.entries[segments[i]] !== 'object') {
			branch.size++;
			branch.entries[segments[i]] = {
				...createFSTree(segments[i], ''),
				name: segments[i],
				title: segments[i],
				entries: dir ? {} : null,
				index: undefined,
				parent: branch,
			};
			addCount++;
		}
		branch = branch.entries[segments[i]];
		branch.mode = mode;
		branch.type = type;
		branch.hash = hash;
		branch.size = parseInt(size);
		if (isNaN(branch.size)) branch.size = 0;
		return addCount;
	},

	traverseTree: function(tree: FileTree, callback: (fsEntry: FSEntry, path: string) => void) {
		var entry = tree.tree;
		this.traverseFSEntry(entry, callback, '');
	},

	traverseFSEntry: function(
		fsEntry: FSEntry,
		callback: (fsEntry: FSEntry, path: string) => void,
		fullPath: string
	) {
		var path = fullPath;
		callback(fsEntry, path);
		if (fsEntry.entries) {
			var dirName = path + '/';
			for (var i in fsEntry.entries) {
				this.traverseFSEntry(fsEntry.entries[i], callback, dirName + i);
			}
		}
	},

	// convertXMLToTree: function(node:any, uid:{value:number}) {
	// 	var obj = {
	// 		name: uid.value++,
	// 		title: node.tagName || 'document',
	// 		index: undefined,
	// 		entries: {},
	// 	};
	// 	var files = [];
	// 	if (node.attributes) {
	// 		for (let i = 0; i < node.attributes.length; i++) {
	// 			var attr = node.attributes[i];
	// 			files.push({
	// 				name: uid.value++,
	// 				title: attr.name + '=' + attr.value,
	// 				index: undefined,
	// 				entries: null,
	// 			});
	// 		}
	// 	}
	// 	var file;
	// 	for (let i = 0, l = node.childNodes.length; i < l; i++) {
	// 		var c = node.childNodes[i];
	// 		if (c.tagName) {
	// 			file = this.convertXMLToTree(c, uid);
	// 			obj.entries[file.name] = file;
	// 		} else {
	// 			if (c.textContent && /\S/.test(c.textContent)) {
	// 				files.push({
	// 					name: uid.value++,
	// 					title: c.textContent,
	// 					index: undefined,
	// 					entries: null,
	// 				});
	// 			}
	// 		}
	// 	}
	// 	for (let i = 0; i < files.length; i++) {
	// 		file = files[i];
	// 		obj.entries[file.name] = file;
	// 	}
	// 	return obj;
	// },

	// convertBookmarksToTree: function(node: { tagName: string; textContent: any; href: any; parentNode: { querySelector: (arg0: string) => any; }; childNodes: string | any[]; }, uid: { value: number; }) {
	// 	if (node.tagName === 'A') {
	// 		// Bookmark
	// 		return {
	// 			name: uid.value++,
	// 			title: node.textContent,
	// 			index: undefined,
	// 			entries: null,
	// 			href: node.href,
	// 		};
	// 	} else if (node.tagName === 'DL') {
	// 		// List of bookmarks
	// 		var titleEl = node.parentNode.querySelector('H1,H2,H3,H4,H5,H6');
	// 		var title = '';
	// 		if (titleEl) {
	// 			title = titleEl.textContent;
	// 		}
	// 		var obj = { name: uid.value++, title: title, index: undefined, entries: {} };
	// 		var file;
	// 		var files = [];
	// 		for (let i = 0, l = node.childNodes.length; i < l; i++) {
	// 			var c = node.childNodes[i];
	// 			file = this.convertBookmarksToTree(c, uid);
	// 			if (file) {
	// 				if (file.entries) {
	// 					obj.entries[file.name] = file;
	// 				} else {
	// 					files.push(file);
	// 				}
	// 			}
	// 		}
	// 		for (let i = 0; i < files.length; i++) {
	// 			file = files[i];
	// 			obj.entries[file.name] = file;
	// 		}
	// 		return obj;
	// 	} else {
	// 		for (let i = 0, l = node.childNodes.length; i < l; i++) {
	// 			file = this.convertBookmarksToTree(node.childNodes[i], uid);
	// 			if (file) {
	// 				return file;
	// 			}
	// 		}
	// 	}
	// },

	parseFileList: function(
		fileString: string,
		xhr: any,
		includePrefix: any,
		prefix: string | undefined
	) {
		// var xml = xhr && xhr.responseXML;
		// if (!xml) {
		// 	var parser = new DOMParser();
		// 	var type = undefined;
		// 	if (/^\s*<!DOCTYPE /i.test(fileString)) {
		// 		type = 'text/html';
		// 	} else if (/^\s*<\?xml /.test(fileString)) {
		// 		type = 'application/xml';
		// 	} else if (/^\s*<html/i.test(fileString)) {
		// 		type = 'text/html';
		// 	}
		// 	if (type) {
		// 		xml = parser.parseFromString(fileString, type as SupportedType);
		// 		if (xml.querySelector('parsererror')) {
		// 			xml = undefined;
		// 		}
		// 	}
		// }

		// if (xml) {
		// 	// This is some XML here.
		// 	if (/^\s*<!DOCTYPE NETSCAPE-Bookmark-file-1>/.test(fileString)) {
		// 		// Bookmarks! Let's parse them!
		// 		let uid = { value: 0 };
		// 		let tree = this.convertBookmarksToTree(xml, uid);
		// 		return {
		// 			tree: { name: -1, title: '', index: undefined, entries: { Bookmarks: tree } },
		// 			count: uid.value + 1,
		// 		};
		// 	} else {
		// 		// XML visualization is go.
		// 		let uid = { value: 0 };
		// 		window.xml = xml;
		// 		let tree = this.convertXMLToTree(xml, uid);
		// 		return {
		// 			tree: { name: -1, title: '', index: undefined, entries: { XML: tree } },
		// 			count: uid.value + 1,
		// 		};
		// 	}
		// } else {
		// 	try {
		// 		var list = JSON.parse(fileString);
		// 		// Hey it's JSON, let's check for GitHub API & Google Drive API & Dropbox API formats.
		// 		if (list && list.sha && list.url && /\/git\//.test(list.url) && list.tree) {
		// 			return this.parseGitHubTree(list);
		// 		} else if (list && list instanceof Array) {
		// 			if (
		// 				list.every(function(it) {
		// 					return typeof it === 'string';
		// 				})
		// 			) {
		// 				fileString = list.join('\n') + '\n';
		// 			}
		// 		}
		// 	} catch (e) {
		// 		// Not JSON.
		// 	}
		// }
		return this.parseFileList_(fileString, includePrefix, prefix);
	},

	parseFileList_: function(
		fileString: string | ArrayBuffer,
		includePrefix: boolean,
		prefix = '',
		targetTree?: FileTree
	) {
		if (fileString instanceof ArrayBuffer) {
			return this.parseFileListAB_(
				fileString as ArrayBuffer,
				includePrefix,
				prefix,
				targetTree
			);
		}
		// console.log("Parsing file string", fileString.length);
		var sep = fileString.substring(0, 4096).includes('\0') ? 0 : 10;
		// eslint-disable-next-line
		var gitStyle = /^\d{6} (blob|tree) [a-f0-9]{40}\t[^\u0000]+\u0000/.test(fileString);
		var fileTree, fileCount;
		if (!targetTree) {
			fileTree = createFSTree('', '');
			fileCount = 0;
		} else {
			fileTree = targetTree.tree;
			fileCount = targetTree.count;
		}
		var name = '';
		var startIndex = 0;
		var first = includePrefix ? false : true;
		var skip = gitStyle ? 53 : 0;
		// console.log('prefix:', prefix);
		for (var i = 0; i < fileString.length; i++) {
			if (fileString.charCodeAt(i) === sep) {
				if (first) {
					var segs = fileString.substring(startIndex + 1 + skip, i).split('/');
					name = segs[segs.length - 2] + '/';
					skip = i - name.length + 1;
					name = prefix;
					first = false;
				} else {
					name = prefix + fileString.substring(startIndex + skip, i);
					if (gitStyle && fileString.charCodeAt(startIndex + 7) === 116 /* t */)
						name += '/';
					// console.log(name);
				}
				startIndex = i + 1;
				fileCount += utils.addFileTreeEntry(name, fileTree, '', '', '', '0');
			}
		}
		// console.log("Parsed files", fileCount);
		return { tree: fileTree, count: fileCount };
	},

	parseFileListAB_: function(
		buffer: ArrayBuffer,
		includePrefix: boolean,
		prefix = '',
		targetTree?: FileTree
	) {
		const sep = 0;
		// eslint-disable-next-line
		var fileTree, fileCount;
		if (!targetTree) {
			fileTree = createFSTree('', '');
			fileCount = 0;
		} else {
			fileTree = targetTree.tree;
			fileCount = targetTree.count;
		}
		var name = '';
		var startIndex = 0;
		var skip = 0;
		var first = includePrefix ? false : true;
		const u8 = new Uint8Array(buffer);
		// console.log('prefix:', prefix);
		let mode, type, hash, length;
		const td = new TextDecoder();
		for (let i = 0; i < u8.length; i++) {
			if (u8[i] === sep) {
				if (first) {
					const tabIndex = u8.indexOf(9, startIndex + 48);
					const segs = td.decode(u8.slice(tabIndex + 1, i)).split('/');
					[mode, type, hash, length] = td
						.decode(u8.slice(startIndex, tabIndex))
						.split(/\s+/);
					name = segs[segs.length - 2] + '/';
					skip = i - name.length + 1;
					name = prefix;
					first = false;
				} else {
					const tabIndex = u8.indexOf(9, startIndex + 48);
					// console.log(td.decode(u8.slice(startIndex, i)));
					const fn = td.decode(u8.slice(tabIndex + 1 + skip, i));
					[mode, type, hash, length] = td
						.decode(u8.slice(startIndex, tabIndex))
						.split(/\s+/);
					name = prefix + fn;
					if (u8[startIndex + 7] === 116 /* t */ || u8[startIndex + 7] === 99 /* c */)
						name += '/';
				}
				startIndex = i + 1;
				fileCount += utils.addFileTreeEntry(name, fileTree, mode, type, hash, length);
			}
		}
		// console.log("Parsed files", fileCount);
		return { tree: fileTree, count: fileCount };
	},

	parseGitHubTree: function(githubResult: { url: string; tree: any[] }) {
		var repoMatch = githubResult.url.match(
			/^https:\/\/api\.github\.com\/repos\/([^/]+)\/([^/]+)/
		);
		var userName = '';
		var repoName = '';
		if (repoMatch) {
			userName = repoMatch[1];
			repoName = repoMatch[1] + '/' + repoMatch[2];
		} else {
			return createFSTree('', '');
		}
		var paths = githubResult.tree.map(function(file: { path: string; type: string }) {
			return '/' + repoName + '/' + file.path + (file.type === 'tree' ? '/' : '');
		});
		return this.parseFileList_(
			'/' + userName + '/\n/' + repoName + '/\n' + paths.join('\n') + '\n',
			false
		);
	},

	// loadFromText: function(text: any, onSuccess: (arg0: { tree: any; count: any; }, arg1: any) => void, onError: (arg0: any) => void, prefix: any) {
	// 	try {
	// 		onSuccess(this.parseFileList(text, {}, undefined, prefix), text);
	// 	} catch (e) {
	// 		if (onError) onError(e);
	// 	}
	// },

	// loadFiles: function(url: string, onSuccess: (arg0: { tree: any; count: any; }, arg1: any) => void, onError: ((this: XMLHttpRequest, ev: ProgressEvent<EventTarget>) => any) | null, prefix: any) {
	// 	var utils = this;
	// 	var xhr = new XMLHttpRequest();
	// 	xhr.open('GET', url);
	// 	xhr.onload = function(ev) {
	// 		onSuccess(
	// 			utils.parseFileList(ev.target.responseText, ev.target, undefined, prefix),
	// 			ev.target.responseText
	// 		);
	// 	};
	// 	xhr.onerror = onError;
	// 	xhr.send();
	// },
};

export default utils;