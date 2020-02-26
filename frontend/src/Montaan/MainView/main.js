import { getPathEntry, getFullPath, getFSEntryForURL } from '../lib/filesystem';
import Colors from '../lib/Colors.ts';
import createText from '../lib/third_party/three-bmfont-text-modified';
import SDFShader from '../lib/third_party/three-bmfont-text-modified/shaders/msdf';
import Layout from '../lib/Layout';
import utils from '../lib/utils';
import Geometry from '../lib/Geometry';

import TextFileView from './TextFileView';
import ImageFileView from './ImageFileView';

import fontDescription from './assets/fnt/Inconsolata-Regular.fnt';
import fontSDF from './assets/fnt/Inconsolata-Regular.png';

import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter';
import * as THREE from 'three';
import loadFont from 'load-bmfont';

function save(blob, filename) {
	const link = document.createElement('a');
	link.href = URL.createObjectURL(blob);
	link.download = filename;
	link.click();

	// URL.revokeObjectURL( url ); breaks Firefox...
}

function saveString(text, filename) {
	save(new Blob([text], { type: 'text/plain' }), filename);
}

function saveArrayBuffer(buffer, filename) {
	save(new Blob([buffer], { type: 'application/octet-stream' }), filename);
}

function exportGLTF(input) {
	var gltfExporter = new GLTFExporter();

	var options = {
		onlyVisible: false,
		truncateDrawRange: false,
		binary: true,
	};
	gltfExporter.parse(
		input,
		function(result) {
			if (result instanceof ArrayBuffer) {
				saveArrayBuffer(result, 'scene.glb');
			} else {
				var output = JSON.stringify(result, null, 2);
				saveString(output, 'scene.gltf');
			}
		},
		options
	);
}
global.exportGLTF = exportGLTF;

global.THREE = THREE;

THREE.Object3D.prototype.tick = function(t, dt) {
	if (this.ontick) this.ontick(t, dt);
	for (var i = 0; i < this.children.length; i++) {
		this.children[i].tick(t, dt);
	}
};

class Tabletree {
	constructor() {
		this.animating = false;
		this.currentFrame = 0;
		this.pageZoom = 1;
		this.resAdjust = 1;
		if (/Mac OS X/.test(navigator.userAgent)) {
			if (window.screen.width !== 1280 && window.devicePixelRatio >= 2) {
				this.resAdjust = 1280 / window.screen.width;
			}
		}

		this.textMinScale = 1000;
		this.textMaxScale = 0;

		this.history = undefined;

		this.changed = true;
		this.model = null;
		this.authorModel = null;
		this.processModel = null;
		this.lineModel = null;
		this.lineGeo = null;
		this.links = [];

		this.commitsPlaying = false;
		this.searchResults = [];
		this.previousSearchResults = [];

		this.frameFibers = [];
		this.frameStart = -1;

		this.initDone = false;
		this.requestDirs = undefined;
		this.requestDitchDirs = undefined;
		this.setNavigationTarget = undefined;
	}

	init(api, apiPrefix, repoPrefix) {
		if (this.api) {
			console.error('ALREADY INITIALIZED');
			return;
		}
		this.api = api;
		this.apiPrefix = apiPrefix;
		this.repoPrefix = repoPrefix;
		var fontTex, fontDesc;
		new THREE.TextureLoader().load(fontSDF, (tex) => {
			fontTex = tex;
			if (fontDesc && fontTex) this.start(fontDesc, fontTex);
		});
		loadFont(fontDescription, (err, font) => {
			if (err) throw err;
			fontDesc = font;
			if (fontDesc && fontTex) this.start(fontDesc, fontTex);
		});
	}

	async start(font, fontTexture) {
		this.setupScene(); // Renderer, scene and camera setup.
		this.setupTextModel(font, fontTexture); // Text model for files
		this.setupSearchHighlighting(); // Search highlighting
		this.setupEventListeners(); // UI event listeners
		if (this._fileTree) await this.setFileTree(this._fileTree); // Show possibly pre-loaded file tree.
		if (this.commitData) this.setCommitData(this.commitData); // Set pre-loaded commit data.

		this.lastFrameTime = performance.now();
		this.previousFrameTime = performance.now();

		this.tick(); // Main render loop
	}

	setCommitLog = (txt) => (this._commitLog = txt);
	setCommitChanges = (txt) => (this._commitChanges = txt);

	setFileTree(fileTree) {
		if (this.renderer) {
			return this.showFileTree(fileTree);
		} else {
			return new Promise((resolve, reject) => {
				const tick = () => {
					if (this.renderer) this.showFileTree(fileTree).then(resolve);
					else setTimeout(tick, 10);
				};
				tick();
			});
		}
	}

	onResize() {
		this.camera.aspect = window.innerWidth / window.innerHeight;
		this.camera.updateProjectionMatrix();
		if (/Mac OS X/.test(navigator.userAgent)) {
			if (window.screen.width !== 1280 && window.devicePixelRatio >= 2) {
				this.resAdjust = 1280 / window.screen.width;
			}
		}
		this.renderer.setPixelRatio(window.devicePixelRatio);
		if (!/Chrome/.test(navigator.userAgent)) {
			this.renderer.setSize(
				window.innerWidth * this.pageZoom * this.resAdjust,
				window.innerHeight * this.pageZoom * this.resAdjust
			);
		} else {
			this.renderer.setSize(
				window.innerWidth * this.resAdjust,
				window.innerHeight * this.resAdjust
			);
		}
		this.renderer.domElement.style.width = window.innerWidth + 'px';
		this.renderer.domElement.style.height = window.innerHeight + 'px';
		this.changed = true;
	}

	setupScene() {
		var renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
		renderer.domElement.dataset.filename = 'frontend/' + __filename.replace(/\\/g, '/');
		renderer.domElement.id = 'renderCanvas';
		renderer.setPixelRatio(window.devicePixelRatio || 1);
		renderer.setClearColor(Colors.backgroundColor, 1);
		document.body.appendChild(renderer.domElement);

		var scene = new THREE.Scene();
		window.scene3 = scene;
		window.GLTFExporter = GLTFExporter;

		var camera = new THREE.PerspectiveCamera(
			45,
			window.innerWidth / window.innerHeight,
			0.5,
			5
		);

		camera.position.z = 2;
		camera.targetPosition = new THREE.Vector3().copy(camera.position);
		camera.targetFOV = camera.fov;

		scene.add(camera);

		var modelTop = new THREE.Object3D();
		modelTop.position.set(-0.5, -0.5, 0.0);
		var modelPivot = new THREE.Object3D();
		modelPivot.position.set(0.5, 0.5, 0.0);
		scene.add(modelTop);
		modelTop.add(modelPivot);

		this.renderer = renderer;
		this.scene = scene;
		this.camera = camera;
		this.modelTop = modelTop;
		this.modelPivot = modelPivot;

		window.onresize = this.onResize.bind(this);
		this.onResize();
	}

	setGoToHighlight(fsEntry, line) {
		this.addHighlightedLine(fsEntry, line, 0);
	}

	addHighlightedLine(fsEntry, line, indexOverride = -1) {
		if (fsEntry.textHeight) {
			const lineCount = fsEntry.lineCount;
			var geo = this.searchHighlights.geometry;
			var index = indexOverride;
			if (indexOverride < 0) {
				index = this.searchHighlights.index;
				this.searchHighlights.index++;
			}

			const lineBottom = fsEntry.textYZero - ((line + 1) / lineCount) * fsEntry.textHeight;
			const lineTop = fsEntry.textYZero - (line / lineCount) * fsEntry.textHeight;
			var c0 = new THREE.Vector3(fsEntry.x, lineBottom, fsEntry.z);
			var c1 = new THREE.Vector3(fsEntry.x + fsEntry.scale * 0.5, lineBottom, fsEntry.z);
			var c2 = new THREE.Vector3(fsEntry.x + fsEntry.scale * 0.5, lineTop, fsEntry.z);
			var c3 = new THREE.Vector3(fsEntry.x, lineTop, fsEntry.z);

			c0.applyMatrix4(this.model.matrixWorld);
			c1.applyMatrix4(this.model.matrixWorld);
			c2.applyMatrix4(this.model.matrixWorld);
			c3.applyMatrix4(this.model.matrixWorld);

			var off = index * 4;

			geo.vertices[off++].copy(c0);
			geo.vertices[off++].copy(c1);
			geo.vertices[off++].copy(c2);
			geo.vertices[off++].copy(c3);

			geo.verticesNeedUpdate = true;
		} else {
			this.highlightLater.push([fsEntry, line]);
		}
		this.changed = true;
	}

	clearSearchHighlights() {
		var geo = this.searchHighlights.geometry;
		var verts = geo.vertices;
		for (var i = 0; i < verts.length; i++) {
			var v = verts[i];
			v.x = v.y = v.z = 0;
		}
		geo.verticesNeedUpdate = true;
		this.searchHighlights.index = 1;
		this.highlightLater = [];
		this.changed = true;
	}

	highlightResults(results) {
		var ca = this.model.geometry.attributes.color;
		this.highlightedResults.forEach(function(highlighted) {
			Geometry.setColor(
				ca.array,
				highlighted.fsEntry.index,
				Colors[highlighted.fsEntry.entries === null ? 'getFileColor' : 'getDirectoryColor'](
					highlighted.fsEntry
				),
				0
			);
		});
		this.clearSearchHighlights();
		for (var i = 0; i < results.length; i++) {
			var fsEntry = results[i].fsEntry;
			if (fsEntry.entries !== null && results[i].line === 0) {
				Geometry.setColor(
					ca.array,
					fsEntry.index,
					fsEntry.entries === null ? [1, 0, 0] : [0.6, 0, 0],
					0
				);
			} else if (fsEntry.entries === null && results[i].line > 0) {
				this.addHighlightedLine(fsEntry, results[i].line);
			}
		}
		this.highlightedResults = results;
		ca.needsUpdate = true;
		this.changed = true;
	}

	addScreenLine(geo, fsEntry, bbox, index, line, lineCount) {
		var a = new THREE.Vector3(fsEntry.x, fsEntry.y, fsEntry.z);
		a.applyMatrix4(this.model.matrixWorld);
		var b = a,
			bv,
			aUp;

		var av = new THREE.Vector3(a.x + 0.05 * fsEntry.scale, a.y + 0.05 * fsEntry.scale, a.z);

		var off = index * 4;
		if (!bbox || bbox.bottom < 0 || bbox.top > window.innerHeight) {
			bv = new THREE.Vector3(
				b.x - fsEntry.scale * 0.5 - 0.02,
				av.y + 0.05 * fsEntry.scale + 0.01 * 3.15,
				av.z - fsEntry.scale * 0.5
			);
			aUp = new THREE.Vector3(
				av.x - fsEntry.scale * 0.075,
				av.y + 0.05 * fsEntry.scale,
				av.z
			);
		} else {
			this.screenPlane.visible = true;
			var intersections = utils.findIntersectionsUnderEvent(
				{ clientX: bbox.left, clientY: bbox.top + 24, target: this.renderer.domElement },
				this.camera,
				[this.screenPlane]
			);
			this.screenPlane.visible = false;
			b = intersections[0].point;
			bv = new THREE.Vector3(b.x, b.y, b.z);
			aUp = new THREE.Vector3(av.x, av.y, av.z);
			if (line > 0 && fsEntry.textHeight) {
				const textYOff = ((line + 0.5) / lineCount) * fsEntry.textHeight;
				const textLinePos = new THREE.Vector3(
					fsEntry.textXZero,
					fsEntry.textYZero - textYOff,
					fsEntry.z
				);
				textLinePos.applyMatrix4(this.model.matrixWorld);
				aUp = av = textLinePos;
			}
		}

		const verts = geo.getAttribute('position').array;
		off *= 3;
		var v;
		v = av;
		verts[off++] = v.x;
		verts[off++] = v.y;
		verts[off++] = v.z;
		v = aUp;
		verts[off++] = v.x;
		verts[off++] = v.y;
		verts[off++] = v.z;
		v = aUp;
		verts[off++] = v.x;
		verts[off++] = v.y;
		verts[off++] = v.z;
		v = bv;
		verts[off++] = v.x;
		verts[off++] = v.y;
		verts[off++] = v.z;
		geo.getAttribute('position').needsUpdate = true;
	}

	updateSearchLines() {
		var needUpdate = false;
		if (this.searchResults !== this.previousSearchResults) {
			this.clearSearchLine();
			this.previousSearchResults = this.searchResults;
			needUpdate = true;
			this.changed = true;
			this.searchLis = [].slice.call(document.body.querySelectorAll('#searchResults > li'));
		}
		const lis = this.searchLis;
		var verts = this.searchLine.geometry.getAttribute('position').array;
		if (needUpdate && lis.length <= verts.length / 3 / 4) {
			for (var i = 0, l = lis.length; i < l; i++) {
				var li = lis[i];
				this.addScreenLine(
					this.searchLine.geometry,
					li.result.fsEntry,
					null,
					i,
					li.result.line,
					li.result.fsEntry.lineCount
				);
			}
		}
	}

	clearSearchLine() {
		var verts = this.searchLine.geometry.getAttribute('position').array;
		for (
			var i = this.searchResults.length * 4 * 3;
			i < this.previousSearchResults.length * 4 * 3;
			i++
		) {
			verts[i] = 0;
		}
		this.searchLine.geometry.getAttribute('position').needsUpdate = true;
		this.changed = true;
	}

	setupSearchHighlighting() {
		this.highlightedResults = [];
		this.highlightLater = [];
		this.searchHighlights = new THREE.Mesh(
			new THREE.Geometry(),
			new THREE.MeshBasicMaterial({
				side: THREE.DoubleSide,
				color: 0xff0000,
				opacity: 0.33,
				transparent: true,
				depthTest: false,
				depthWrite: false,
			})
		);
		this.searchHighlights.frustumCulled = false;
		this.searchHighlights.index = 1;
		for (let i = 0; i < 40000; i++) {
			this.searchHighlights.geometry.vertices.push(new THREE.Vector3());
		}
		for (let i = 0; i < 10000; i++) {
			let off = i * 4;
			this.searchHighlights.geometry.faces.push(
				new THREE.Face3(off, off + 1, off + 2),
				new THREE.Face3(off, off + 2, off + 3)
			);
		}
		this.searchHighlights.ontick = () => {
			this.searchHighlights.visible = this.searchHighlights.index > 0;
			if (this.highlightLater.length > 0) {
				const later = this.highlightLater.splice(0);
				for (let i = 0; i < later.length; i++)
					this.addHighlightedLine(later[i][0], later[i][1]);
			}
		};

		var screenPlane = new THREE.Mesh(
			new THREE.PlaneBufferGeometry(2000, 2000),
			new THREE.MeshBasicMaterial({ color: 0xff00ff })
		);
		screenPlane.visible = false;
		screenPlane.position.z = 0.75;
		this.scene.add(screenPlane);

		this.screenPlane = screenPlane;

		var searchLine = new THREE.LineSegments(
			new THREE.BufferGeometry(),
			new THREE.LineBasicMaterial({
				color: 0xff0000,
				opacity: 1,
				transparent: true,
				depthTest: false,
				depthWrite: false,
				// linewidth: 2 * (window.devicePixelRatio || 1)
			})
		);
		this.searchLine = searchLine;
		searchLine.frustumCulled = false;
		searchLine.geometry.setAttribute(
			'position',
			new THREE.BufferAttribute(new Float32Array(40000 * 3), 3)
		);

		searchLine.ontick = () => {
			searchLine.visible = this.searchResults && this.searchResults.length > 0;
		};

		this.scene.add(this.searchLine);
		this.scene.add(this.searchHighlights);

		this.lineGeo = new THREE.BufferGeometry();
		this.lineGeo.setAttribute(
			'position',
			new THREE.BufferAttribute(new Float32Array(40000 * 3), 3)
		);
		this.lineGeo.setAttribute(
			'color',
			new THREE.BufferAttribute(new Float32Array(40000 * 3), 3)
		);
		this.lineModel = new THREE.LineSegments(
			this.lineGeo,
			new THREE.LineBasicMaterial({
				color: new THREE.Color(1.0, 1.0, 1.0),
				opacity: 1,
				transparent: true,
				depthWrite: false,
				vertexColors: true,
			})
		);
		this.lineModel.frustumCulled = false;
		this.lineModel.ontick = () => {
			this.lineModel.visible = this.links.length > 0;
		};
		this.scene.add(this.lineModel);
	}

	setSearchResults(searchResults) {
		console.log(searchResults);
		this.searchResults = searchResults || [];
		this.highlightResults(searchResults || []);
		this.updateSearchLines();
	}

	goToFSEntry = (fsEntry, model = this.model) => {
		if (!fsEntry) return;
		const { scene, camera } = this;
		scene.updateMatrixWorld();
		var fsPoint = new THREE.Vector3(
			fsEntry.x + fsEntry.scale * (fsEntry.entries ? 0.5 : 0.25),
			fsEntry.y + fsEntry.scale * (fsEntry.entries ? 0.815 : 0.5),
			fsEntry.z
		);
		fsPoint.applyMatrix4(model.matrixWorld);
		camera.targetPosition.copy(fsPoint);
		camera.targetFOV = fsEntry.scale * (fsEntry.entries ? 23 : 50);
		fsEntry.fov = camera.targetFOV;
		this.changed = true;
	};

	async goToFSEntryCoords(fsEntry, coords, model = this.model) {
		const { scene, camera } = this;
		scene.updateMatrixWorld();
		const res =
			fsEntry.contentObject && (await fsEntry.contentObject.goToCoords(coords, model));
		if (!res) {
			fsEntry.targetLine = { line: coords };
			return this.goToFSEntry(fsEntry, model);
		}
		const { targetPoint, targetFOV } = res;
		camera.targetPosition.copy(targetPoint);
		camera.targetFOV = targetFOV;
		fsEntry.textFOV = camera.targetFOV;
		this.changed = true;
	}

	async goToFSEntryAtSearch(fsEntry, search, model = this.model) {
		const { scene, camera } = this;
		scene.updateMatrixWorld();
		const res =
			fsEntry.contentObject && (await fsEntry.contentObject.goToSearch(search, model));
		if (!res) {
			fsEntry.targetSearch = { search };
			return this.goToFSEntry(fsEntry, model);
		}
		const { targetPoint, targetFOV } = res;
		camera.targetPosition.copy(targetPoint);
		camera.targetFOV = targetFOV;
		fsEntry.textFOV = camera.targetFOV;
		this.changed = true;
	}

	async createFileTreeModel(fileCount, fileTree) {
		const { font, camera } = this;
		const self = this;
		var geo = Geometry.makeGeometry(fileCount + 1);

		var fileIndex = 0;

		fileTree.fsIndex = [fileTree];

		if (fileTree.scale === undefined) {
			fileTree.x = 0;
			fileTree.y = 0;
			fileTree.z = 0;
			fileTree.scale = 1;
		}

		var labels = new THREE.Object3D();
		var thumbnails = new THREE.Object3D();
		await Layout.createFileTreeQuads(
			this.yield,
			fileTree,
			fileIndex,
			geo.attributes.position.array,
			geo.attributes.color.array,
			labels,
			thumbnails,
			fileTree.fsIndex
		);

		var textGeo = await createText({ text: '', font: font, noBounds: true }, this.yield);
		var vertCount = 0;
		labels.traverse(function(c) {
			if (c.geometry) {
				vertCount += c.geometry.attributes.position.array.length;
			}
		});
		var parr = new Float32Array(vertCount);
		var uarr = new Float32Array(vertCount / 2);
		var j = 0;
		labels.traverse(function(c) {
			if (c.geometry) {
				parr.set(c.geometry.attributes.position.array, j);
				uarr.set(c.geometry.attributes.uv.array, j / 2);
				j += c.geometry.attributes.position.array.length;
			}
		});

		textGeo.setAttribute('position', new THREE.BufferAttribute(parr, 4));
		textGeo.setAttribute('uv', new THREE.BufferAttribute(uarr, 2));

		var textMesh = new THREE.Mesh(textGeo, this.textMaterial);

		var mesh = new THREE.Mesh(
			geo,
			new THREE.MeshBasicMaterial({
				color: 0xffffff,
				vertexColors: THREE.VertexColors,
				side: THREE.DoubleSide,
			})
		);
		mesh.fileTree = fileTree;

		const visibleFiles = new THREE.Object3D();
		visibleFiles.visibleSet = {};

		mesh.add(visibleFiles);
		mesh.add(textMesh);
		mesh.add(thumbnails);

		mesh.ontick = function(t, dt) {
			// Dispose loaded files that are outside the current view
			for (var i = 0; i < visibleFiles.children.length; i++) {
				var c = visibleFiles.children[i];
				var fsEntry = c.fsEntry;
				if (
					!Geometry.quadInsideFrustum(fsEntry.index, this, camera) ||
					(fsEntry.scale * 50) / Math.max(camera.fov, camera.targetFOV) < 0.2
				) {
					if (!c.geometry.layout && c.material && c.material.map) {
						c.material.map.dispose();
					}
					if (c.geometry) {
						c.geometry.dispose();
					}
					var fullPath = getFullPath(fsEntry);
					fsEntry.contentObject = undefined;
					visibleFiles.visibleSet[fullPath] = false;
					visibleFiles.remove(c);
					i--;
				}
			}
			var zoomedInPath = '';
			var navigationTarget = '';
			var smallestCovering = this.fileTree;

			// Breadth-first traversal of this.fileTree
			// - determines fsEntry visibility
			// - finds the covering fsEntry
			// - finds the currently zoomed-in path and breadcrumb path
			var stack = [this.fileTree];
			while (stack.length > 0) {
				var obj = stack.pop();
				for (var name in obj.entries) {
					var o = obj.entries[name];
					var idx = o.index;
					if (!Geometry.quadInsideFrustum(idx, this, camera)) {
						continue;
					}
					if ((o.scale * 50) / Math.max(camera.fov, camera.targetFOV) > 0.3) {
						if (Geometry.quadCoversFrustum(idx, this, camera)) {
							zoomedInPath += '/' + o.name;
							navigationTarget += '/' + o.name;
							smallestCovering = o;
						} else if (
							(o.scale * 50) / Math.max(camera.fov, camera.targetFOV) > 0.9 &&
							Geometry.quadAtFrustumCenter(idx, this, camera)
						) {
							navigationTarget += '/' + o.name;
						}
						if (o.entries) {
							stack.push(o);
						} else {
							let fullPath = getFullPath(o);
							if (
								visibleFiles.children.length < 30 &&
								!visibleFiles.visibleSet[fullPath]
							) {
								self.addFileView(visibleFiles, fullPath, o);
							}
						}
					}
				}
			}
			self.zoomedInPath = zoomedInPath;
			self.breadcrumbPath = navigationTarget;
			self.setNavigationTarget(navigationTarget);
			this.geometry.setDrawRange(
				smallestCovering.vertexIndex,
				smallestCovering.lastVertexIndex - smallestCovering.vertexIndex
			);
			textGeo.setDrawRange(
				smallestCovering.textVertexIndex,
				smallestCovering.lastTextVertexIndex - smallestCovering.textVertexIndex
			);
		};

		return mesh;
	}

	yield = () => {
		if (this.frameStart > 0 && performance.now() - this.frameStart > 5) {
			return new Promise((resolve, reject) => {
				const resolver = () => {
					this.changed = true;
					if (performance.now() - this.frameStart > 5) this.frameFibers.push(resolver);
					else resolve();
				};
				this.frameFibers.push(resolver);
			});
		}
		this.changed = true;
	};

	addFileView(visibleFiles, fullPath, fsEntry) {
		const view = Colors.imageRE.test(fullPath) ? ImageFileView : TextFileView;
		fsEntry.contentObject = new view(
			fsEntry,
			this.model,
			fullPath,
			this.api,
			this.yield,
			this.requestFrame,
			this.fontTexture
		);
		fsEntry.contentObject.loadListeners.push(() => {
			if (fsEntry.targetLine) {
				const { line, search } = fsEntry.targetLine;
				if (line !== undefined) this.goToFSEntryCoords(fsEntry, line);
				else if (search !== undefined) this.goToFSEntryAtSearch(fsEntry, search);
				delete fsEntry.targetLine;
			}
		});
		fsEntry.contentObject.load(this.api.server + '/repo/file' + fullPath);

		visibleFiles.visibleSet[fullPath] = true;
		visibleFiles.add(fsEntry.contentObject);
	}

	async addFile(tree) {
		await this.yield();
		const model = await this.createFileTreeModel(Object.keys(tree.parent.entries).length, {
			...tree.parent,
			noGeo: true,
		});
		tree.model = model;
		(tree.parent.model || this.model).add(model);
	}

	async updateTree(fileTree) {
		/*
			Traverse tree to find subtrees that are not in a model.
			If the parent model has enough allocation to host a subtree, write the
			subtree to the model.
			If there's no space left in the model, create a new model for the subtree.
		*/
		const promises = [];
		utils.traverseFSEntry(
			fileTree,
			(tree, path) => {
				if (tree.index === 0 && tree.parent && !tree.parent.building) {
					tree.parent.building = true;
					promises.push(tree);
				}
			},
			''
		);
		for (let i = 0; i < promises.length; i++) {
			await this.addFile(promises[i]);
		}
		this.changed = true;
	}

	async showFileTree(fileTree) {
		if (fileTree.tree === this.fileTree) {
			await this.updateTree(fileTree.tree);
			return;
		}
		if (this.model) {
			this.model.parent.remove(this.model);
			this.model.traverse(function(m) {
				if (m.geometry) {
					m.geometry.dispose();
				}
			});
			this.model = null;
		}
		this.fileTree = fileTree.tree;
		this.model = await this.createFileTreeModel(fileTree.count, fileTree.tree);
		this.model.position.set(-0.5, -0.5, 0.0);
		this.modelPivot.add(this.model);
		this.changed = true;
	}

	makeTextMaterial(palette = null, fontTexture = this.fontTexture) {
		if (!palette || palette.length < 8) {
			palette = [].concat(palette || []);
			while (palette.length < 8) {
				palette.push(palette[palette.length - 1] || Colors.textColor);
			}
		}
		return new THREE.RawShaderMaterial(
			SDFShader({
				map: fontTexture,
				side: THREE.DoubleSide,
				transparent: true,
				color: 0xffffff,
				palette: palette,
				polygonOffset: true,
				polygonOffsetFactor: -0.5,
				polygonOffsetUnits: 0.5,
				depthTest: false,
				depthWrite: false,
			})
		);
	}

	setupTextModel(font, fontTexture) {
		this.font = font;
		this.fontTexture = fontTexture;

		Layout.font = font;

		this.textMaterial = this.makeTextMaterial();
	}

	countChars(s, charCode) {
		var j = 0;
		for (var i = 0; i < s.length; i++) {
			if (s.charCodeAt(i) === charCode) j++;
		}
		return j;
	}

	updateLineBetweenElements(geo, index, color, bboxA, bboxB) {
		this.screenPlane.visible = true;
		var intersectionsA = utils.findIntersectionsUnderEvent(
			{ clientX: bboxA.left, clientY: bboxA.top, target: this.renderer.domElement },
			this.camera,
			[this.screenPlane]
		);
		var intersectionsB = utils.findIntersectionsUnderEvent(
			{ clientX: bboxB.left, clientY: bboxB.top, target: this.renderer.domElement },
			this.camera,
			[this.screenPlane]
		);
		this.screenPlane.visible = false;
		var a = intersectionsA[0].point;
		var av = new THREE.Vector3(a.x, a.y, a.z);
		var b = intersectionsB[0].point;
		var bv = new THREE.Vector3(b.x, b.y, b.z);

		var verts = geo.getAttribute('position').array;
		var off = index * 3;
		var v;
		v = av;
		verts[off++] = v.x;
		verts[off++] = v.y;
		verts[off++] = v.z;
		v = av;
		verts[off++] = v.x;
		verts[off++] = v.y;
		verts[off++] = v.z;
		v = av;
		verts[off++] = v.x;
		verts[off++] = v.y;
		verts[off++] = v.z;
		v = bv;
		verts[off++] = v.x;
		verts[off++] = v.y;
		verts[off++] = v.z;
		v = bv;
		verts[off++] = v.x;
		verts[off++] = v.y;
		verts[off++] = v.z;
		v = bv;
		verts[off++] = v.x;
		verts[off++] = v.y;
		verts[off++] = v.z;

		if (color) {
			verts = geo.getAttribute('color').array;
			off = index * 3;
			v = color;
			verts[off++] = v.r;
			verts[off++] = v.g;
			verts[off++] = v.b;
			v = color;
			verts[off++] = v.r;
			verts[off++] = v.g;
			verts[off++] = v.b;
			v = color;
			verts[off++] = v.r;
			verts[off++] = v.g;
			verts[off++] = v.b;
			v = color;
			verts[off++] = v.r;
			verts[off++] = v.g;
			verts[off++] = v.b;
			v = color;
			verts[off++] = v.r;
			verts[off++] = v.g;
			verts[off++] = v.b;
			v = color;
			verts[off++] = v.r;
			verts[off++] = v.g;
			verts[off++] = v.b;
		}
	}

	updateLineBetweenEntryAndElement(geo, index, color, model, fsEntry, line, lineCount, bbox) {
		var a = new THREE.Vector3(fsEntry.x, fsEntry.y, fsEntry.z);
		a.applyMatrix4(model.matrixWorld);
		var b = a;

		line = line ? line[0] : 0;

		var av = new THREE.Vector3(a.x + 0.05 * fsEntry.scale, a.y + 0.05 * fsEntry.scale, a.z);
		var bv, aUp;

		if (!bbox || bbox.bottom < 0 || bbox.top > window.innerHeight) {
			bv = new THREE.Vector3(
				b.x - fsEntry.scale * 0.5 - 0.02,
				av.y + 0.05 * fsEntry.scale, // + 0.01 * 3.15,
				av.z - fsEntry.scale * 0.5
			);
			aUp = new THREE.Vector3(
				av.x - fsEntry.scale * 0.075,
				av.y + 0.05 * fsEntry.scale,
				av.z
			);
		} else {
			this.screenPlane.visible = true;
			var intersections = utils.findIntersectionsUnderEvent(
				{ clientX: bbox.left, clientY: bbox.top, target: this.renderer.domElement },
				this.camera,
				[this.screenPlane]
			);
			this.screenPlane.visible = false;
			b = intersections[0].point;
			bv = new THREE.Vector3(b.x, b.y, b.z);
			aUp = new THREE.Vector3(av.x, av.y, av.z);
			if (line > 0 && fsEntry.textHeight) {
				const textYOff = ((line + 0.5) / lineCount) * fsEntry.textHeight;
				const textLinePos = new THREE.Vector3(
					fsEntry.textXZero,
					fsEntry.textYZero - textYOff,
					fsEntry.z
				);
				textLinePos.applyMatrix4(this.model.matrixWorld);
				aUp = av = textLinePos;
			}
		}

		var verts = geo.getAttribute('position').array;
		var off = index * 3;
		var v;
		v = av;
		verts[off++] = v.x;
		verts[off++] = v.y;
		verts[off++] = v.z;
		v = aUp;
		verts[off++] = v.x;
		verts[off++] = v.y;
		verts[off++] = v.z;
		v = aUp;
		verts[off++] = v.x;
		verts[off++] = v.y;
		verts[off++] = v.z;
		v = bv;
		verts[off++] = v.x;
		verts[off++] = v.y;
		verts[off++] = v.z;
		v = bv;
		verts[off++] = v.x;
		verts[off++] = v.y;
		verts[off++] = v.z;
		v = bv;
		verts[off++] = v.x;
		verts[off++] = v.y;
		verts[off++] = v.z;

		if (color) {
			verts = geo.getAttribute('color').array;
			off = index * 3;
			v = color;
			verts[off++] = v.r;
			verts[off++] = v.g;
			verts[off++] = v.b;
			v = color;
			verts[off++] = v.r;
			verts[off++] = v.g;
			verts[off++] = v.b;
			v = color;
			verts[off++] = v.r;
			verts[off++] = v.g;
			verts[off++] = v.b;
			v = color;
			verts[off++] = v.r;
			verts[off++] = v.g;
			verts[off++] = v.b;
			v = color;
			verts[off++] = v.r;
			verts[off++] = v.g;
			verts[off++] = v.b;
			v = color;
			verts[off++] = v.r;
			verts[off++] = v.g;
			verts[off++] = v.b;
		}
	}

	updateLineBetweenEntries(
		geo,
		index,
		color,
		modelA,
		entryA,
		lineA,
		lineCountA,
		modelB,
		entryB,
		lineB,
		lineCountB
	) {
		var a = entryA;
		var b = entryB;

		lineA = lineA ? lineA[0] : 0;
		lineB = lineB ? lineB[0] : 0;

		var av = new THREE.Vector3(a.x, a.y, a.z);
		av.applyMatrix4(modelA.matrixWorld);

		var bv = new THREE.Vector3(b.x, b.y + b.scale, b.z);
		bv.applyMatrix4(modelB.matrixWorld);

		if (lineA > 0 && entryA.textHeight) {
			const textYOff = ((lineA + 0.5) / lineCountA) * entryA.textHeight;
			const textLinePos = new THREE.Vector3(
				entryA.textXZero,
				entryA.textYZero - textYOff,
				entryA.z
			);
			textLinePos.applyMatrix4(modelA.matrixWorld);
			av = textLinePos;
		}
		if (lineB > 0 && entryB.textHeight) {
			const textYOff = ((lineB + 0.5) / lineCountB) * entryB.textHeight;
			const textLinePos = new THREE.Vector3(
				entryB.textXZero,
				entryB.textYZero - textYOff,
				entryB.z
			);
			textLinePos.applyMatrix4(modelB.matrixWorld);
			av = textLinePos;
		}

		var aUp = new THREE.Vector3(
			a.x + (a.x < b.x ? 1 : -1) * 0.1 * entryA.scale,
			a.y + (0.1 + 0.01 * (entryB.size % 10)) * entryA.scale,
			Math.max(a.z, b.z) + 1 * entryA.scale
		);
		aUp.applyMatrix4(modelA.matrixWorld);
		var bUp = new THREE.Vector3(
			b.x + (a.x > b.x ? 1 : -1) * 0.1 * entryB.scale,
			b.y + b.scale + (0.1 + 0.01 * (entryB.size % 10)) * entryB.scale,
			Math.max(a.z, b.z) + 1 * entryB.scale
		);
		bUp.applyMatrix4(modelB.matrixWorld);

		var verts = geo.getAttribute('position').array;
		var off = index * 3;
		var v;
		v = av;
		verts[off++] = v.x;
		verts[off++] = v.y;
		verts[off++] = v.z;
		v = aUp;
		verts[off++] = v.x;
		verts[off++] = v.y;
		verts[off++] = v.z;
		v = aUp;
		verts[off++] = v.x;
		verts[off++] = v.y;
		verts[off++] = v.z;
		v = bUp;
		verts[off++] = v.x;
		verts[off++] = v.y;
		verts[off++] = v.z;
		v = bUp;
		verts[off++] = v.x;
		verts[off++] = v.y;
		verts[off++] = v.z;
		v = bv;
		verts[off++] = v.x;
		verts[off++] = v.y;
		verts[off++] = v.z;

		if (color) {
			verts = geo.getAttribute('color').array;
			off = index * 3;
			v = color;
			verts[off++] = v.r;
			verts[off++] = v.g;
			verts[off++] = v.b;
			v = color;
			verts[off++] = v.r;
			verts[off++] = v.g;
			verts[off++] = v.b;
			v = color;
			verts[off++] = v.r;
			verts[off++] = v.g;
			verts[off++] = v.b;
			v = color;
			verts[off++] = v.r;
			verts[off++] = v.g;
			verts[off++] = v.b;
			v = color;
			verts[off++] = v.r;
			verts[off++] = v.g;
			verts[off++] = v.b;
			v = color;
			verts[off++] = v.r;
			verts[off++] = v.g;
			verts[off++] = v.b;
		}
	}

	parseTarget(dst, dstPoint) {
		if (typeof dst === 'string') {
			const { fsEntry, point } = getFSEntryForURL(this.fileTree, dst);
			return { fsEntry, point };
		} else {
			return { fsEntry: dst, point: dstPoint };
		}
	}

	updateLinks() {
		if (this.linksUpdatedOn !== this.currentFrame) {
			this.setLinks(this.links, true);
			this.linksUpdatedOn = this.currentFrame;
		}
	}

	setLinks(links, updateOnlyElements = false) {
		if (this.lineGeo) {
			const geo = this.lineGeo;
			const verts = geo.getAttribute('position').array;

			for (let i = links.length; i < this.links.length; i++) {
				let j = i * 6 * 3;
				for (let k = 0; k < 18; k++) verts[j + k] = -100;
			}
			this.links = links;
			for (let i = 0; i < links.length; i++) {
				const l = links[i];
				const model = this.model;
				const srcIsElem = l.src instanceof Element;
				const dstIsElem = l.dst instanceof Element;

				if (srcIsElem && dstIsElem) {
					const bboxA = l.src.getBoundingClientRect();
					const bboxB = l.dst.getBoundingClientRect();
					this.updateLineBetweenElements(geo, i * 6, l.color, bboxA, bboxB);
				} else if (srcIsElem) {
					const bbox = l.src.getBoundingClientRect();
					const dst = this.parseTarget(l.dst, l.dstPoint);
					this.updateLineBetweenEntryAndElement(
						geo,
						i * 6,
						l.color,
						model,
						dst.fsEntry,
						dst.point,
						dst.fsEntry.lineCount,
						bbox
					);
				} else if (dstIsElem) {
					const bbox = l.dst.getBoundingClientRect();
					const dst = this.parseTarget(l.src, l.srcPoint);
					this.updateLineBetweenEntryAndElement(
						geo,
						i * 6,
						l.color,
						model,
						dst.fsEntry,
						dst.point,
						dst.fsEntry.lineCount,
						bbox
					);
				} else if (!updateOnlyElements) {
					const src = this.parseTarget(l.src, l.srcPoint);
					const dst = this.parseTarget(l.dst, l.dstPoint);
					this.updateLineBetweenEntries(
						geo,
						i * 6,
						l.color,
						model,
						src.fsEntry,
						src.point,
						src.fsEntry.lineCount,
						model,
						dst.fsEntry,
						dst.point,
						dst.fsEntry.lineCount
					);
				}
			}
			geo.getAttribute('position').needsUpdate = true;
			geo.getAttribute('color').needsUpdate = true;
			this.changed = true;
		}
	}

	zoomCamera(zf, cx, cy) {
		const camera = this.camera;
		if (zf < 1 || camera.fov < 120) {
			camera.position.x += cx - cx * zf;
			camera.position.y -= cy - cy * zf;
			camera.fov *= zf;
			if (camera.fov > 120) camera.fov = 120;
			camera.targetFOV = camera.fov;
			camera.targetPosition.copy(camera.position);
			camera.updateProjectionMatrix();
			this.changed = true;
		}
	}

	getEntryAtMouse(ev) {
		var models = [this.model];
		if (this.processModel) models.push(this.processModel);
		if (this.authorModel) models.push(this.authorModel);
		return Geometry.findFSEntry(
			{ clientX: ev.clientX, clientY: ev.clientY, target: this.renderer.domElement },
			this.camera,
			models,
			this.highlighted
		);
	}

	getTextPosition(fsEntry, intersection) {
		const fv = new THREE.Vector3(fsEntry.textXZero, fsEntry.textYZero, fsEntry.z);
		const pv = new THREE.Vector3().copy(intersection.point);
		const inv = new THREE.Matrix4().getInverse(intersection.object.matrixWorld);
		pv.applyMatrix4(inv);
		const uv = new THREE.Vector3().subVectors(pv, fv);
		uv.divideScalar(fsEntry.scale * fsEntry.textScale);
		uv.y /= 38;
		uv.x /= 19;

		const line = Math.floor(-uv.y);
		const col = Math.floor(uv.x + 1);
		return { line, col };
	}

	handleTextClick(ev, fsEntry, intersection) {
		const { line, col } = this.getTextPosition(fsEntry, intersection);
		const text = fsEntry.contentObject.geometry.layout._opt.text;
		const lineStr = text.split('\n')[line - 1];
		const urlRE = /https?:\/\/[a-z0-9.%$#@&?/_-]+/gi;
		var hit = null;
		while ((hit = urlRE.exec(lineStr))) {
			const startIndex = hit.index;
			const endIndex = hit.index + hit[0].length - 1;
			if (col >= startIndex && col <= endIndex) {
				if (this.onElectron) {
					// Open link in a floating iframe added to the tree.
					// On render, update the matrix of the iframe's 3D transform.
					// This can only be done on Electron as X-Frame-Options: DENY
					// disables cross-origin iframes.
					var iframe = document.createElement('iframe');
					iframe.src = hit[0];
					iframe.style.border = '10px solid white';
					iframe.style.backgroundColor = 'white';
					iframe.style.position = 'absolute';
					iframe.style.right = '10px';
					iframe.style.top = 96 + 'px';
					iframe.style.zIndex = '2';
					iframe.style.width = '600px';
					iframe.style.height = 'calc(100vh - 106px)';
					this.renderer.domElement.parentNode.appendChild(iframe);
					return true;
				} else {
					// Open link in a new window.
					window.open(hit[0]);
					return true;
				}
			}
		}
		return false;
	}

	registerElementForURL(el, url) {
		this.urlIndex[url] = this.urlIndex[url] || [];
		this.urlIndex[url].push(el);
	}

	async gcURLElements() {
		const deletions = [];
		let i = 0;
		const elFilter = (el) => {
			i++;
			return el.ownerDocument.body.contains(el);
		};
		for (let n in this.urlIndex) {
			this.urlIndex[n] = this.urlIndex[n].filter(elFilter);
			if (this.urlIndex[n].length === 0) deletions.push(n);
			if (i > 100) {
				await this.yield();
				i = 0;
			}
		}
		deletions.forEach((n) => delete this.urlIndex[n]);
	}

	goToURL(url) {
		if (!this.fileTree) return;
		const result = getFSEntryForURL(this.fileTree, url);
		if (!result) return;
		const { fsEntry, point, search } = result;
		if (point && !isNaN(point[0])) this.goToFSEntryCoords(fsEntry, point);
		else if (search) this.goToFSEntryAtSearch(fsEntry, search);
		else this.goToFSEntry(fsEntry);
	}

	getURLForFSEntry(fsEntry, location = []) {
		const locationStr = location.length > 0 ? '#' + location.join(',') : '';
		return getFullPath(fsEntry) + locationStr;
	}

	zoomToEntry(ev) {
		const intersection = this.getEntryAtMouse(ev);
		if (intersection) {
			var fsEntry = intersection.fsEntry;
			// var ca = intersection.object.geometry.attributes.color;
			// var vs = intersection.object.geometry.attributes.position;
			// var tvs = intersection.object.children[1].geometry.attributes.position;
			if (this.highlighted && this.highlighted.highlight) {
				var obj = this.highlighted.highlight;
				obj.parent.remove(obj);
			}
			if (this.highlighted !== fsEntry) {
				this.highlighted = fsEntry;
				const url = this.getURLForFSEntry(fsEntry);
				this.history.push(url);
			} else {
				if (this.highlighted.entries === null) {
					var fovDiff = (this.highlighted.scale * 50) / this.camera.fov;
					if (fovDiff > 1 || !fsEntry.lineCount) {
						if (
							!fsEntry.lineCount ||
							!this.handleTextClick(ev, this.highlighted, intersection)
						) {
							const url = this.getURLForFSEntry(this.highlighted);
							this.history.push(url);
						}
					} else {
						const url = this.getURLForFSEntry(this.highlighted, [0]);
						this.history.push(url);
					}
				} else {
					const url = this.getURLForFSEntry(this.highlighted);
					this.history.push(url);
				}
			}
			this.changed = true;
		}
	}

	fsEntryCmp(a, b) {
		if (!!a.entries === !!b.entries) return a.title < b.title ? -1 : a.title > b.title ? 1 : 0;
		else if (a.entries) return -1;
		else return 1;
	}

	setupEventListeners() {
		const { renderer, camera, modelPivot } = this;

		const self = this;

		var down = false;
		var previousX, previousY, startX, startY;
		var clickDisabled = false;

		var pinchStart, pinchMid;

		var inGesture = false;

		renderer.domElement.addEventListener(
			'touchstart',
			function(ev) {
				document.activeElement.blur();
				ev.preventDefault();
				if (ev.touches.length === 1) {
					renderer.domElement.onmousedown(ev.touches[0]);
				} else if (ev.touches.length === 2) {
					inGesture = true;
					var dx = ev.touches[0].clientX - ev.touches[1].clientX;
					var dy = ev.touches[0].clientY - ev.touches[1].clientY;
					pinchStart = Math.sqrt(dx * dx + dy * dy);
					pinchMid = {
						clientX: ev.touches[1].clientX + dx / 2,
						clientY: ev.touches[1].clientY + dy / 2,
					};
					renderer.domElement.onmousedown(pinchMid);
				}
			},
			false
		);

		renderer.domElement.addEventListener(
			'touchmove',
			function(ev) {
				ev.preventDefault();
				if (ev.touches.length === 1) {
					if (!inGesture) {
						window.onmousemove(ev.touches[0], 0.0000525);
					}
				} else if (ev.touches.length === 2) {
					var dx = ev.touches[0].clientX - ev.touches[1].clientX;
					var dy = ev.touches[0].clientY - ev.touches[1].clientY;
					var zoom = pinchStart / Math.sqrt(dx * dx + dy * dy);
					pinchStart = Math.sqrt(dx * dx + dy * dy);
					pinchMid = {
						clientX: ev.touches[1].clientX + dx / 2,
						clientY: ev.touches[1].clientY + dy / 2,
					};
					var cx = (pinchMid.clientX - window.innerWidth / 2) * 0.0000575 * camera.fov;
					var cy = (pinchMid.clientY - window.innerHeight / 2) * 0.0000575 * camera.fov;
					self.zoomCamera(zoom, cx, cy);
					window.onmousemove(pinchMid);
				}
			},
			false
		);

		renderer.domElement.addEventListener(
			'touchend',
			function(ev) {
				ev.preventDefault();
				if (ev.touches.length === 0) {
					if (!inGesture) {
						window.onmouseup(ev.changedTouches[0]);
					} else {
						inGesture = false;
						window.onmouseup(pinchMid);
					}
				} else if (ev.touches.length === 1) {
				}
			},
			false
		);

		renderer.domElement.addEventListener(
			'touchcancel',
			function(ev) {
				ev.preventDefault();
				if (ev.touches.length === 0) {
					if (!inGesture) {
						window.onmouseup(ev.changedTouches[0]);
					} else {
						inGesture = false;
						window.onmouseup(pinchMid);
					}
				} else if (ev.touches.length === 1) {
				}
			},
			false
		);

		window.onkeydown = function(ev) {
			if (!ev.target || ev.target.tagName !== 'INPUT') {
				var factor = 0.0001;
				var dx = 0,
					dy = 0,
					dz = 0;
				switch (ev.keyCode) {
					case 39:
						dx = -50;
						break;

					case 40:
						dy = -50;
						break;

					case 37:
						dx = 50;
						break;

					case 38:
						dy = 50;
						break;

					default: // do nothing
				}
				// Arrow keys pan normally, WASD is context-sensitive scroll (next file, etc.)
				switch (ev.key) {
					case 'w': // scroll up
						{
							const fsEntry = getPathEntry(self.fileTree, self.breadcrumbPath);
							if (fsEntry) {
								const files = Object.values(fsEntry.parent.entries).sort(
									self.fsEntryCmp
								);
								const fn = files[files.indexOf(fsEntry) - 1];
								if (fn) self.goToFSEntry(fn);
							}
						}
						break;
					case 's': // scroll down
						{
							const fsEntry = getPathEntry(self.fileTree, self.breadcrumbPath);
							if (fsEntry) {
								const files = Object.values(fsEntry.parent.entries).sort(
									self.fsEntryCmp
								);
								const fn = files[files.indexOf(fsEntry) + 1];
								if (fn) self.goToFSEntry(fn);
							}
						}
						break;
					case 'a': // scroll left
						break;
					case 'd': // scroll right
						break;
					case 'e': // zoom in
						dz = -50;
						break;
					case 'q': // zoom out
						dz = 50;
						break;
					case 'z': // zoom in to object
						const intersection = self.getEntryAtMouse({
							clientX: window.innerWidth / 2,
							clientY: window.innerHeight / 2,
						});
						if (intersection) {
							const fsEntry = intersection.fsEntry;
							const fovDiff = (fsEntry.scale * 50) / self.camera.fov;
							if (self.highlighted === fsEntry) {
								if (fsEntry.textScale) self.goToFSEntryCoords(fsEntry, [0]);
								else dz = -50;
							} else {
								if (fovDiff > 0.95) {
									if (fsEntry.textScale) self.goToFSEntryCoords(fsEntry, [0]);
									else dz = -50;
								} else self.goToFSEntry(fsEntry);
							}
							self.highlighted = fsEntry;
						} else {
							dz = -50;
						}
						// self.zoomToEntry({clientX: window.innerWidth/2, clientY: window.innerHeight/2});
						break;
					case 'x': // zoom out of object
						var fsEntry = getPathEntry(
							self.fileTree,
							self.breadcrumbPath.replace(/\/[^/]+$/, '')
						);
						if (fsEntry && fsEntry.title) self.goToFSEntry(fsEntry, self.model);
						break;

					default: // do nothing
				}
				camera.targetPosition.x -= factor * dx * camera.fov;
				camera.targetPosition.y += factor * dy * camera.fov;
				camera.targetFOV *= Math.pow(1.01, dz);
				self.changed = true;
			}
		};

		renderer.domElement.onmousedown = function(ev) {
			document.activeElement.blur();
			if (ev.preventDefault) ev.preventDefault();
			down = true;
			clickDisabled = false;
			startX = previousX = ev.clientX;
			startY = previousY = ev.clientY;
		};

		window.onmousemove = function(ev, factor) {
			if (down) {
				if (!factor) {
					factor = 0.0001;
				}
				self.changed = true;
				if (ev.preventDefault) ev.preventDefault();
				var dx = ev.clientX - previousX;
				var dy = ev.clientY - previousY;
				previousX = ev.clientX;
				previousY = ev.clientY;
				if (Math.abs(ev.clientX - startX) > 10 || Math.abs(ev.clientY - startY) > 10) {
					clickDisabled = true;
				}
				if (ev.shiftKey) {
					modelPivot.rotation.z += dx * 0.01;
					modelPivot.rotation.x += dy * 0.01;
				} else {
					camera.position.x -= factor * dx * camera.fov;
					camera.position.y += factor * dy * camera.fov;
					camera.targetPosition.copy(camera.position);
					camera.targetFOV = camera.fov;
				}
			}
		};

		var lastScroll = Date.now();

		var prevD = 0;
		var wheelSnapTimer;
		var wheelFreePan = false;
		renderer.domElement.onwheel = function(ev) {
			ev.preventDefault();

			if (ev.ctrlKey) {
				// zoom on wheel
				var cx =
					((ev.clientX - window.innerWidth / 2) / window.innerWidth / 34) * camera.fov;
				var cy =
					((ev.clientY - window.innerHeight / 2) / window.innerHeight / 34) * camera.fov;
				var d = ev.deltaY !== undefined ? ev.deltaY * 3 : ev.wheelDelta;
				if (Date.now() - lastScroll > 500) {
					prevD = d;
				}
				if (d > 20 || d < -20) {
					d = (20 * d) / Math.abs(d);
				}
				if ((d < 0 && prevD > 0) || (d > 0 && prevD < 0)) {
					d = 0;
				}
				prevD = d;
				self.zoomCamera(Math.pow(1.003, d), cx, cy);
				lastScroll = Date.now();
			} else {
				clearTimeout(wheelSnapTimer);
				wheelSnapTimer = setTimeout(function() {
					wheelFreePan = false;
				}, 1000);

				// pan on wheel
				const factor = 0.0000575;
				const adx = Math.abs(ev.deltaX);
				const ady = Math.abs(ev.deltaY);
				var xMove = false,
					yMove = true;
				if (adx > ady) {
					xMove = true;
					yMove = false;
				}
				wheelFreePan = wheelFreePan || (adx > 5 && ady > 5);
				if (wheelFreePan || xMove) camera.position.x += factor * ev.deltaX * camera.fov;
				if (wheelFreePan || yMove) camera.position.y -= factor * ev.deltaY * camera.fov;
				camera.targetPosition.copy(camera.position);
				camera.targetFOV = camera.fov;
				self.changed = true;
			}
		};

		var gestureStartScale = 0;
		window.addEventListener('gesturestart', function(e) {
			e.preventDefault();
			gestureStartScale = 1;
		});
		window.addEventListener('gesturechange', function(ev) {
			ev.preventDefault();
			var cx = ((ev.clientX - window.innerWidth / 2) / window.innerWidth / 34) * camera.fov;
			var cy = ((ev.clientY - window.innerHeight / 2) / window.innerHeight / 34) * camera.fov;
			var d = ev.scale / gestureStartScale;
			gestureStartScale = ev.scale;
			self.zoomCamera(1 / d, cx, cy);
		});
		window.addEventListener('gestureend', function(e) {
			e.preventDefault();
		});

		this.highlighted = null;
		window.onmouseup = function(ev) {
			if (down && ev.preventDefault) ev.preventDefault();
			if (clickDisabled) {
				down = false;
				return;
			}
			if (down) {
				down = false;
				self.zoomToEntry(ev);
			}
		};

		document.getElementById('playCommits').onclick = function(ev) {
			self.commitsPlaying = !self.commitsPlaying;
			self.changed = true;
		};

		document.getElementById('commitSlider').oninput = function(ev) {
			var v = parseInt(this.value);
			if (self.activeCommits[v]) {
				self.showCommit(self.activeCommits[v].sha);
				self.changed = true;
			}
		};
		document.getElementById('previousCommit').onclick = function(ev) {
			var slider = document.getElementById('commitSlider');
			var v = parseInt(slider.value) - 1;
			if (self.activeCommits[v]) {
				slider.value = v;
				slider.oninput();
			}
		};
		document.getElementById('nextCommit').onclick = function(ev) {
			var slider = document.getElementById('commitSlider');
			var v = parseInt(slider.value) + 1;
			if (self.activeCommits[v]) {
				slider.value = v;
				slider.oninput();
			}
		};
	}

	render() {
		const { scene, camera, renderer } = this;
		scene.updateMatrixWorld(true);
		var t = performance.now();
		scene.tick(t, t - this.lastFrameTime);
		this.lastFrameTime = t;
		renderer.render(scene, camera);
		this.currentFrame++;
	}

	tick = () => {
		if ((window.pageZoom || 100) / 100 !== this.pageZoom) {
			this.pageZoom = (window.pageZoom || 100) / 100;
			this.onResize();
		}
		this.frameStart = performance.now();
		this.frameFibers.splice(0).map((f) => f());
		const camera = this.camera;
		if (!camera) return this.requestFrame();
		const currentFrameTime = performance.now();
		var dt = currentFrameTime - this.previousFrameTime;
		this.previousFrameTime += dt;
		if (dt < 16 || this.frameLoopPaused) {
			dt = 16;
		}

		if (
			camera.targetPosition.x !== camera.position.x ||
			camera.targetPosition.y !== camera.position.y ||
			camera.fov !== camera.targetFOV
		) {
			camera.position.x +=
				(camera.targetPosition.x - camera.position.x) * (1 - Math.pow(0.85, dt / 16));
			camera.position.y +=
				(camera.targetPosition.y - camera.position.y) * (1 - Math.pow(0.85, dt / 16));
			if (Math.abs(camera.position.x - camera.targetPosition.x) < camera.fov * 0.00001) {
				camera.position.x = camera.targetPosition.x;
			}
			if (Math.abs(camera.position.y - camera.targetPosition.y) < camera.fov * 0.00001) {
				camera.position.y = camera.targetPosition.y;
			}
			camera.fov += (camera.targetFOV - camera.fov) * (1 - Math.pow(0.85, dt / 16));
			if (Math.abs(camera.fov - camera.targetFOV) < camera.targetFOV / 1000) {
				camera.fov = camera.targetFOV;
			}
			camera.updateProjectionMatrix();
			this.updateLinks();
			this.changed = true;
			this.animating = true;
		} else {
			this.animating = false;
		}
		var wasChanged = this.changed || this.frameFibers.length > 0;
		this.changed = false;
		if (wasChanged || this.animating) this.render();
		this.frameRequested = false;
		if (this.frameFibers.length > 0 || this.changed || this.animating) this.requestFrame();
		this.frameLoopPaused = !this.frameRequested;
	};

	get changed() {
		return this._changed;
	}

	set changed(v) {
		this._changed = v;
		if (v) this.requestFrame();
	}

	requestFrame = () => {
		this._changed = true;
		if (!this.frameRequested) {
			this.frameRequested = true;
			window.requestAnimationFrame(this.tick);
		}
	};
}

export default new Tabletree();
