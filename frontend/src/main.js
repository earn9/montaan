import { EALREADY } from 'constants';
const MAX_COMMITS = 1000000;
				console.time("commits");

				console.log(commits.length, 'commits');
				// commits.splice(MAX_COMMITS);
				console.timeLog("commits", "commits preparse");

				{
					let lineStart = 0, hash = null, setHash = false;
					for (let i = 0; i < commitChanges.length; i++) {
						let c = commitChanges.charCodeAt(i);
						if (c === 10) { // new line
							if (lineStart !== i) {
								if (setHash) hash = commitChanges.substring(lineStart, i);
								else if (commitIndex[hash]) {
									let [action, path, renamed] = commitChanges.substring(lineStart, i).split("\t");
									commitIndex[hash].files.push({action, path, renamed});
								}
							}
							lineStart = i+1;
						} else if (lineStart === i) setHash = ((c >= 97 && c <= 102) || (c >= 48 && c <= 57));
				}

				console.timeLog("commits", "changes preparse");

				console.timeLog("commits", "done with commits");
				console.timeLog("commits", "done with authors");
				// authorModel = createFileListModel(window.AuthorTree.count, window.AuthorTree.tree);
				// authorModel.position.set(1.5, -0.5, 0.0);
				// modelPivot.add(authorModel);
				// processModel = createFileListModel(window.CommitTree.count, window.CommitTree.tree);
				// processModel.position.set(0.5, -0.5, 0.0);
				// modelPivot.add(processModel);
				// processModel.updateMatrix();
				// authorModel.updateMatrix();
					// for (var i=0; i<author.length; i++) {
						// var commit = author[i];
						// if (commit && commit.fsEntry && author.fsEntry && author.fsEntry.entries[commit.sha]) {
						// 	addLineBetweenEntries(lineGeo, color, processModel, commit.fsEntry, authorModel, author.fsEntry.entries[commit.sha]);
						// }
					// }
								// addLineBetweenEntries(lineGeo, author.color, processModel, commitFSEntry, model, fileEntry);
				console.timeLog("commits", "done with touchedFiles");

				console.timeEnd("commits");

					return commits.filter(c => c.files.some(f => {
 						if (f.renamed && f.renamed.startsWith(path)) {
							if (f.renamed === path) path = f.path;
							return true;
						}
						if (f.path.startsWith(path)) return true;
					}));
				var span = function(className='', content='') {
					var el = document.createElement('span');
					el.className = className;
					el.textContent = content;
					return el;
				};

				var parseDiff = function(diff) {
					/*
					1. It is preceded with a "git diff" header that looks like this:

						diff --git a/file1 b/file2

					The a/ and b/ filenames are the same unless rename/copy is involved. Especially, even for a
					creation or a deletion, /dev/null is not used in place of the a/ or b/ filenames.

					When rename/copy is involved, file1 and file2 show the name of the source file of the rename/copy
					and the name of the file that rename/copy produces, respectively.

					2. It is followed by one or more extended header lines:

						old mode <mode>
						new mode <mode>
						deleted file mode <mode>
						new file mode <mode>
						copy from <path>
						copy to <path>
						rename from <path>
						rename to <path>
						similarity index <number>
						dissimilarity index <number>
						index <hash>..<hash> <mode>

					File modes are printed as 6-digit octal numbers including the file type and file permission bits.

					Path names in extended headers do not include the a/ and b/ prefixes.

					The similarity index is the percentage of unchanged lines, and the dissimilarity index is the
					percentage of changed lines. It is a rounded down integer, followed by a percent sign. The
					similarity index value of 100% is thus reserved for two equal files, while 100% dissimilarity
					means that no line from the old file made it into the new one.

					The index line includes the SHA-1 checksum before and after the change. The <mode> is included if
					the file mode does not change; otherwise, separate lines indicate the old and the new mode.

					*/
					const lines = diff.split("\n");
					const changes = [];
					var currentChange = { cmd: '', newMode: '', index: '', srcPath: '', dstPath: '', changes: [] };
					var pos = null;
					var parsePos = function(posMatch, line) {
						if (!posMatch) console.log(line, lines);
						pos = {
							previous: {line: parseInt(posMatch[1]), lineCount: parseInt(posMatch[3])},
							current: {line: parseInt(posMatch[4]), lineCount: parseInt(posMatch[6])},
						};
						currentChange.changes.push({pos, lines: [line.substring(posMatch[0].length)]});
					};
					var parseCmd = function(line) {
						currentChange = { cmd: '', newMode: '', index: '', srcPath: '', dstPath: '', changes: [] };
						pos = null;
						currentChange.cmd = line;
					};
					lines.forEach(line => {
						if (/^diff/.test(line)) {
							if (currentChange.cmd) changes.push(currentChange);
							parseCmd(line);
						}
						else if (line.charCodeAt(0) === 64) {
							var posMatch = line.match(/^@@ -(\d+)(,(\d+))? \+(\d+)(,(\d+))? @@/);
							if (!posMatch) posMatch = ['', 0, 0, 0, 0, 0, 0];
							parsePos(posMatch, line);
						}
						else if (/^(dis)?similarity index /.test(line)) currentChange.similarity = line;
						else if (/^(new|deleted|old) /.test(line)) currentChange.newMode = line;
						else if (/^copy from /.test(line)) currentChange.srcPath = line.substring(10);
						else if (/^copy to /.test(line)) currentChange.srcPath = line.substring(8);
						else if (/^rename from /.test(line)) currentChange.srcPath = line.substring(12);
						else if (/^rename to /.test(line)) currentChange.srcPath = line.substring(10);
						else if (/^index /.test(line)) currentChange.index = line;
						else if (/^Binary /.test(line)) parsePos(['', 0, 0, 0, 0, 0, 0], line);
						else if (!pos && /^\-\-\- /.test(line)) currentChange.srcPath = line.substring(5);
						else if (!pos && /^\+\+\+ /.test(line)) currentChange.dstPath = line.substring(5);
						else if (pos) currentChange.changes[currentChange.changes.length-1].lines.push(line);
					});
					if (currentChange.cmd) changes.push(currentChange);
					return changes;
				};

				var formatDiff = function(diff) {
					const container = span();
					const changes = parseDiff(diff);
					changes.forEach(change => {
						const inPath = ('/' + repoPrefix + change.dstPath).startsWith(breadcrumbPath);
						const changeEl = span(inPath ? '' : 'collapsed');
						container.append(changeEl);
						changeEl.append(
							span('prev', change.srcPath),
							span('cur', change.dstPath)
						);
						change.changes.forEach(({pos, lines}) => {
							changeEl.append(span('pos', `-${pos.previous.line},${pos.previous.lineCount} +${pos.current.line},${pos.current.lineCount}`));
							lines.forEach(line => {
								var lineClass = '';
								if (line.startsWith("+")) lineClass = 'add';
								else if (line.startsWith("-")) lineClass = 'sub';
								changeEl.appendChild(span(lineClass, line));
							});
						});
					});
					return container;
				};

				var createCalendar = function(dates) {
					var createYear = function(year) {
						const el = document.createElement('div');
						el.className = 'calendar-year';
						el.dataset.year = year;
						for (var i = 0; i < 12; i++) {
							var monthEl = span('calendar-month');
							var week = 0;
							for (var j = 0; j < 31; j++) {
								var dateString = `${year}-${i<9?'0':''}${i+1}-${j<9?'0':''}${j+1}`;
								var date = new Date(Date.parse(dateString));
								if (date.getUTCMonth() === i) {
									var day = date.getUTCDay();
									var dayEl = span('calendar-day');
									dayEl.dataset.day = day;
									dayEl.dataset.week = week;
									dayEl.dataset.commitCount = 0;
									dayEl.dataset.date = dateString;
									monthEl.appendChild(dayEl);
									if (day === 0) week++;
								}
							}
							el.appendChild(monthEl);
						}
						return el;
					};
					const el = document.createElement('div');
					el.className = 'calendar';
					var years = {};
					dates.forEach(d => {
						const year = d.getUTCFullYear();
						const month = d.getUTCMonth();
						const date = d.getUTCDate();
						if (!years[year]) {
							years[year] = createYear(year);
							el.appendChild(years[year]);
						}
						years[year].childNodes[month].childNodes[date-1].dataset.commitCount++;
					});
					return el;
				};

				var updateActiveCommitSetDiffs = function() {
					var el = document.getElementById('commitList');
					while (el.firstChild) el.removeChild(el.firstChild);
					el.dataset.count = activeCommitSet.length;

					el.appendChild(createCalendar(activeCommitSet.map(c => c.date)));

					activeCommitSet.forEach(c => {
						var div = document.createElement('div');
						var hashSpan = span('commit-hash', c.sha);
						var dateSpan = span('commit-date', c.date.toString());
						var authorSpan = span('commit-author', `${c.author.name} <${c.author.email}>`);
						var messageSpan = span('commit-message', c.message);
						var diffSpan = span('commit-diff', '');
						if (c.diff && !c.diffEl) c.diffEl = formatDiff(c.diff);
						if (c.diffEl) diffSpan.appendChild(c.diffEl);
						var toggle = span('commit-toggle', 'Full info');
						var toggleDiffs = span('commit-toggle-diffs', 'All changes');
						toggle.onmousedown = function(ev) { ev.preventDefault(); div.classList.toggle('expanded'); };
						toggleDiffs.onmousedown = function(ev) { ev.preventDefault(); div.classList.toggle('expanded-diffs'); };
						div.append(toggle, hashSpan, dateSpan, authorSpan, messageSpan, toggleDiffs, diffSpan);
						el.appendChild(div);
					});
				};

				var updateActiveCommitSetAuthors = function(authors, authorCommitCounts) {
					var el = document.getElementById('authorList');
					while (el.firstChild) el.removeChild(el.firstChild);
					el.dataset.count = authors.length;
					var originalCommitSet = activeCommitSet;
					var filteredByAuthor = false;
					authors.forEach(({name, email}) => {
						var div = document.createElement('div');
						var key = name + ' <' + email + '>';
						div.dataset.commitCount = authorCommitCounts[key];
						var nameSpan = span('author-name', name);
						var emailSpan = span('author-email', email);
						div.append(nameSpan, emailSpan);
						div.onmousedown = function(ev) {
							ev.preventDefault();
							if (filteredByAuthor === this) {
								activeCommitSet = originalCommitSet;
								filteredByAuthor = false;
							} else {
								activeCommitSet = originalCommitSet.filter(c => (c.author.name + ' <' + c.author.email + '>') === key);
								filteredByAuthor = this;
							}
							updateActiveCommitSetDiffs();
						};
						el.appendChild(div);
					});
				};

						const authorList = activeCommitSet.map(c => c.author);
						const authorCommitCounts = {};
						authorList.forEach(author => {
							const key = author.name + ' <' + author.email + '>';
							if (!authorCommitCounts[key]) authorCommitCounts[key] = 0;
							authorCommitCounts[key]++;
						});
						const authors = utils.uniq(authorList, authorCmp);
						updateActiveCommitSetAuthors(authors, authorCommitCounts);
						updateActiveCommitSetDiffs();
						Promise.all(activeCommitSet.map(async c => {
							if (!c.diff) {
								const diff = await (await fetch(apiPrefix + '/repo/diff', {method: 'POST', body: JSON.stringify({repo: repoPrefix, hash: c.sha})})).text();
								c.diff = diff;
							}
						})).then(updateActiveCommitSetDiffs);
					} else {
						activeCommitSet = [];
						updateActiveCommitSetAuthors([]);
						updateActiveCommitSetDiffs();