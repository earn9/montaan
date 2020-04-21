# Tasks

# Strengths

    Keep these in mind when deciding what to work on. Improving these increases project value for everyday use.

    [] Code browsing
    [] Seeing through hierarchy
    [] Understanding structure
    [] Following links visually
    [] Displaying large linkages
    [] Comparing linkages
    [] Lateral navigation
    [] Cherry-picked revert of a file
    [] Browsing large image collections
    [] Opening content in-line
    [] Editing content in-line
    [] Fast filesystem browsing

# FIX

    [] Thumbnails reload on zoom
    [] Thumbnails stick around for too long in the wrong place

# Release checklist

    [] Clean well-documented path to create a new component & integrate it
        [] Write tour about creating component
            [x] Creating a filesystem
            [x] Creating filesystem components
            [x] yarn makeComponent
            [x] yarn updateComponent
    [] Solid repo import path
        [x] Import Github repo
        [] In-progress spinner
        [] Import local repo
    [x] Repo auto-pull & update

# KEY FEATURES

    [] Thumbnail mip pyramid server
        [] Copy from Muryu?
    [] Custom layouts
        [] Move files around
        [] Save file positions in DB
        [] Load file positions from .layout
    [] Workflow to export file / dir models from Blender
        [x] Instanced rendering demo
        [] Individual models per dir / subtree
        [] Load demo models from GLB
        [] Add instancing & model loading to main app
        [] Load models based on directory scene file (e.g. add trees and other props)
        [] Palette editor for live editing of file type looks
    [] Path tracer as renderer
        - For easy instanced rendering of complex scenes
        - For high visual quality
        - Target machine is 3x 2080 Ti @ around 2030
    [] Dynamic commit loading
        [] 10k commits at a time
        [] Calendar data from server
    [] Documentation that makes people achieve things
    [] Documentation that increases commit volume

# Features

## Make a pleasant place

    [] Party
    [] Artwork

## Plugins

    [] Some sort of plugin system to enable parallel development
    [] Overlay filesystems to add metadata & selections & UI state
    [] FileViewProvider - PopupFileView
    [] HistoryProvider - overlay fs?
    [] MetadataProvider - overlay fs?
    Somehow:
    - Detect when you're viewing a git repo with node_modules, pull in commits and tree history and depcruise.
    - Register FileViewProvider for filename pattern
    - Display directory of photos organized into calendar and events
    [] Fetch plugins from GitHub
        [] Sandbox plugins
    [] yarn create-worker
    [] yarn create-spirv-worker

## Faster commit flow

    [] Bors for driving CI
    [] Remove unnecessary hurdles to commit flow
        [] Aim for fully-automated merges of unsafe code - think Wikipedia
        [] If your commit passes automated tests, either your commit is good or the tests are broken
        [] Fast & easy reverts
        [] Sandbox everything
    [] Instead of a single core codebase, multiple core codebases (core maintainers do 95% of code, and are difficult to scale in-codebase -> better to have multiple codebases)

## "Payment" system

    [] Commit prompt to pay for use via commit

## Frontend data model

    [] Use paths to refer to objects
        [] /repo/branch/tree/path
        [] branches
        [] commits
        [] authors

## UX tweaks

    [] Snap scroll to document boundaries
    [] Line numbers for text view
    [] Kb navigation of search results
    [] Better dashboard view
        [] Recent activity (commits, issues)
    [] Navigate to coords in image
    [] Type-ahead navigation of the tree
        - type /f/b/b/q/ to navigate to /foo/bar/baz/qux/

## Performance

    [] Far-future expires-headers for files & dirs
        [] readDirs & files based on object hash instead of branch name (foo/master/bar.txt can change, foo/8f8a54e3d1a99 can't)
    [] Generate files.txt for branches but split it into 1000-dir subtree chunks (BFS up to 1000 dirs, then BFS each dangling subtree up to 1000 dirs, recurse)
    [] Optimize lines
        [] Limit to ~10k lines in view
        [] Stratified random sampling
        [] Update visible lines when navigating
    [] Fetch configurable level deep
    [] Server approximates what's visible and sends that in one go
    [] Instanced rendering of all models
    [] Limit number of glyphs on the screen
    [] Cache zoomed out view into a impostor
        -> No real limit to number of zoomed-out glyphs
        -> See patterns even in tiny dirs
    [] Move tree rebuild into a worker
        [] Serialize FSEntry tree into a buffer
    [] Optimize React prop flow (only take in absolutely necessary props)
        [] Search
        [] CommitInfo
        [] CommitControls

## Website engine

    [] Turn README.md into HTML and display it on top of directory
    [] Display images nicely - design system for directories
    [] Use a Blender scene as directory and models as files

## Layout

    [] Navigation tags (little models next to long lists like e.g. Android contacts)
        [] Commit date tags (show "2019-09-01" next to first commit on that date)
            [] Commit dates in UTC
        [] Author alphabetical tags (show "C" next to first author starting with "C")

## Font

    [] Target is "HTML layouts in 3D"
        [] Full Unicode support
        [] Multiple fonts
        [] Font variants
        [] Generate MSDF fonts on the fly using Canvas
        [] HTML font rendering parity
        [] Render arbitrary HTML (Uh, how about just using CSS 3D transforms to do "iframes")
        [] Render images
        [] Render videos
        [] Text wrapped on 3D shapes (e.g. ring of text, text stamped on mesh)

## Search

    [] Highlight found search token
    [] Non-regexp search FFS. Exact string matching (case-sensitive).
    [] Color code search results by category
    [] Uncategorized result view

## Backend

    [] Convert backend to TypeScript
        [] Share type definitions with frontend
        [] Statically typed API
    [] Public/private repos
    [] Public repo list
    [] Better non-logged-in experience
        [] Public repos explorer
    [] Poll server for new commits
    [] Automatically pull changes
        [] Show activity in real-time (Large projects get a commit every five minutes. If you have a few of them on-screen, you'd see a constant flurry of activity.)

## Version history

    [] Compare file at any revision to HEAD in file diff view (so that you can first find a file with code you want to revert, then compare that with the current version to know what to revert.)
    [] Commit view
        [] Show list of files after message (click file to open)
        [] Collapse/expand individual diffs
        [] Navigate
    [] Show commit filter
    [] Don't hide other authors when clicking an author
    [] Editable commit filter
        [] Select multiple authors with
            + - = Author Name <email>
        [] Select date range (ctrl/shift drag)
        [] Crop / expand path filter
    [] Parse change metadata like
        [cleanup][CSA] TNodify InitializeAllocationMemento
        Bug: v8:10021
        Change-Id: I78948e93ca61116a6a1a45ccbc1dfa7c27988c30
        Reviewed-on: https://chromium-review.googlesource.com/c/v8/v8/+/1995391
        Reviewed-by: Maya Lekova <mslekova@chromium.org>
        Commit-Queue: Santiago Aboy Solanes <solanes@chromium.org>
        Cr-Commit-Position: refs/heads/master@{#65730}
    [] Parse URLs into links

## Commits

    [] Display list of files touched by author
    [] Navigate to file in zoom view

## Visualization

    [] All files in repo by type (all the images, all the c, all the py, all the rs, all the js)

## Visuals

    [] Sub-pixel AA & hinting for fonts https://github.com/astiopin/webgl_fonts/issues/7
    [] Sparkling precious particle diamonds like on Precious Nature map
    [] Design that makes you feel awesome

## Payment system

    [] Ad magazine to pay for today's use
    [] Buy ads
    [] Buy platform credits

# Completed

## KEY FEATURES

    [x] [Directories | Files] layout
        [x] 1:1 wide rectangle
        [x] N:M split based on count
    [x] Dynamic tree loading
        [x] One directory at a time
            [x] API to load single dirs
            [x] If directory is larger than X, fetch its contents and graft onto file tree
            [x] If directory is smaller than X, remove it from the file tree
        [x] Cheap tree updates
            [x] Edit tree geometry instead of regenerating the whole thing
        [x] Hide and show tree parts
            [x] Based on size
            [x] Based on frustum
        [x] Lots of directories at a time
            [x] Batch fetch directories smaller than X
    [x] View re-parenting prototype
        [x] Move camera instead of changing FOV
        [x] Change transformation matrices  when containing object changes
    [x] View re-parenting

## Plugins

    [x] Filesystem mounts
    [x] Filesystem-specific UI
    [x] TreeProvider - filesystem mounts
    [x] FileInlineProvider - file views
    [x] LinkageProvider - overlay fs?

## Make a pleasant place

    [x] Mockup target visuals
    [x] Theme music for tasks / parts of project
        [x] Per-dir playlist URL

## Font

    [x] MSDF for sharp corners

## Visuals

    [x] Output a 3D model for rendering with a path tracer
    [x] Fade out text before hiding it

## Backend

    [x] Register & Log in
    [x] Add your own repos (supply repo URL -> pull repo -> add to repo list)
        [x] repo/create
        [x] repo/list
        [x] UI for repo/list
        [x] UI for repo/create
        [x] Make App use repo/list
        [x] View public repo
    [] Better non-logged-in experience
        [x] Public repo MainApp view

## Search

    [x] Add line number to search index
    [x] Group search results by file and sort in-file hits by line number:
        search_result_1.txt
            |- Line 234
            '- Line 625
        search_result_2.txt
            |- Line 23
            |- Line 48
            '- Line 300
        [x] Navigate to line when clicking a line result
    [x] Highlight search hit line
        [x] Draw connection line to hit line
        [x] Add a line-sized quad under each hit line
        [x] Render the damn quads properly (instead of 3 lines)
    [x] Switch search engine to codesearch
        - codesearch is server-side (it only uses the index to get the names of potentially matching files, then runs grep on the file contents)
    [x] Fix lunr search with <3 letter search queries (Well, it seems to work?)
    [x] Shrink search results outside current view
    [x] Pull and display line snippet context somehow
    [z] Score results by relevancy (lunr-style)
    [x] Categorize results
    [x] Search for Commits and Authors

## Commits

    [x] Animated file tree history
    [x] Animated commit history
    [x] Show files touched by single commit
    [x] Show files and commits for author
    [x] Show commits and authors for file
    [x] Add a button to toggle commits view
    [x] Click on commit to show files touched by commit
        [x] Slider to scrub commits
        [x] Frame navigation to go from commit to next
    [x] Click on file to show commits and authors for file (Who worked on this and when and how?)
        [x] Constrain commit slider to file commits
        [x] Show commits under directory hierarchy
        [x] Show diffs for file commits (How did this file came to be?)
    [x] Play button to play commits animation
    [x] Display list of authors who have worked on the file
    [x] Display list of commits and diffs for a file
    [x] Crop commit diffs to only ones relevant to file
    [x] Link from authors list to files and commits in current active set
    [x] Click on author to show commits by that author
        [/] Click handler for author timeline (raycast to scene, find closest author to ray if ray is in the active area for authors)
    [/] Click handler for commit timeline (raycast to scene, find closest commit to ray if ray is in the active area for commits)
    [x] Link from commits list to files and authors in current active set

## Version history

    [x] Single-file version history + moving between versions
    [x] Crop commits by date
    [x] Sort authors by commit count

## Visualization

    [/] Different representation for zoomed-out-text (solid lines minimap)

## Visuals

    [x] Fix images: proper alpha & CORS

## UX tweaks

    [x] Breadcrumb navigation
        [x] Show sibling dirs in breadcrumb (like OSX column view)
    [x] Use scroll for lateral navigation
        [x] In text view, constrain scroll to up-down with snap distance to free scroll (Normally scrolls just up and down but if you go to the side enough, you unlock free scroll)
        [x] Snap scroll to vertical or horizontal, only do freeform after a diagonal swipe
        [x] Better y-x-snap
    [x] Use gestures to zoom on touchpad
    [x] Parse text file URLs into links
    [x] Find out which letter you clicked on
    [x] Keyboard zoom controls
    [x] Kb navigation in dir contents
    [x] Hide search results without erasing search term
    [x] All my repos
    [x] Zoom text doc left side to screen left side (instead of middle of screen)

## Data model

    [x] Use React to maintain current UI state
        [x] Slicing-dicing MegaQueryObject to pass down fileTree, highlights, connections
        [x] Search query
        [x] Search results
        [x] Commit filters
        [x] HTML UI elements
    [x] file:filePath URI
    [x] Element-FSEntry
    [x] FSEntry-FSEntry
    [x] Element-Element
    [x] Single line geometry for all lines
        [x] Links
        [x] Search results

## Performance

    [x] Pipeline text model creation to avoid frame stutter (probably coming from shader compile / geometry creation)
    [z] Handle a million commits somehow
    [x] Text view generation fully in worker

## Layout

    [x] Layout text files as vertical [] (think of the minimap, source files are tall and narrow)
    [x] Split folders into [subdirs | files]

## FIX

    [x] Search works
    [x] Commit history works
    [x] Solid file tree rebuilds (no missing files)
    [x] Fix click navigation
        (use px coords everywhere)
    [x] Fix page <title>
    [x] Issue where clicking doesn't work
    [x] Issue with jank during reparenting
        - Make createFileTreeQuads yield...
    [x] Navigate to URL on page load
    [x] Navigate to yet-unloaded-URL
        [x] Hierarchical drill-down
        [x] Request beam
    [x] Move tree rebuilding off main thread
    [x] Issue where rebuild doesn't rebuild things
    [x] Issue where reparenting screws up everything (appeared after using yield in Layout createFileTreeQuads)
    [x] Issue where things don't show up
    [x] Issue where pinch zoom fucks everything up
    [x] Each request returns >1 deep hierarchy (limit by count of files)
    [x] Navigate to line in text view
    [x] main.js is too large
        [x] Convert to TS
        [x] Move tree build to lib
        [x] Move links rendering to lib
        [x] Move highlight rendering to lib
    [x] MainApp is too large
        [x] Move commits to MontaanGit
        [x] Move widget loading to FSOverlays
    [x] Sort repos
    [x] Optimize the text layout library
    [x] Optimize layoutDir
    [x] Move visibility checking to tree builder
    [x] Tree rebuilds have files missing
    [x] Loading trees takes forever and too many requests
    [x] Move repo management to MontaanUserRepos
    [x] Add visible link endpoints to fetchList and preserveSet
    [x] Zoom to file#0 as navUrl fails 100% of the time.
    [x] Zoom to file often fails (camera goes wonky)
    [x] Navigation to unseen parts
    [x] Search highlighting update on every frame
    [x] Breadcrumbs go crazy
    [x] Tests pass
    [x] Search results visibility
    [x] CommitInfo commits crop to view
    [x] CommitInfo diffs crop to view
    [x] Sometimes highlighted lines don't highlight
    [x] yarn create-component
        [x] yarn create-filesystem
        [x] yarn create-fileview
    [x] yarn update-component
    [x] Right-clicking inputs shouldn't take you to component source

# Ideas

    [] Correct-by-construction programming system (like Blockly & Scratch & node salad editors)
        - No syntax errors
        - No shared state
        - GLSL semantics for execution (parallel SPMD on remote processors, explicitly passed heap)
        - Bind nodes manipulation to keys & chords to be faster to type
        - Reference to nodes by name
        - Should feel like IntelliSense
        - Touch manipulation and voice input for mobile
        - Should have same flexibility as text-based model but with fewer correctness issues (syntax errors, typos, type mismatches, null handling, state smashing, ...)
        - Fewer merge conflicts?
    [] Migrate from git-like model to Wikipedia-like model
    [] BERT for question-answering about code
    [] AI code review (train best practices)
    [] Absorb 1M commits per day
        [] Absorb 30k commits per day
        [] Absorb 1000 commits per day
        - no-conflict repo structure
        - no human verification (would need 10k reviewers @ 100 reviews per day)
        - automatic task allocation from issues (reduce time to commit)
        - independent work units (think: pixel shaders)
        - very fast CI tests (12 runs per second)
            - highly parallel tests on commit level
            - batch commits so that master CI operates at 12 commits / second (e.g. CI takes 10 seconds => merge batch of 120 commits => 12 commits / second CI throughput)
        - tests to maintain quality metrics
        - fast reverts
        - rewards for commits
        - losses for lack of commits
        - handover strategy when someone dies (with million authors, avg. 1 every 4 days)

    When writing functions, try to keep their domains as tight as possible. If the domain is tight enough, we can run an exhaustive test on the function and verify its operation and performance. For large domains, we do a partial domain exhaustive test and a random sampling of the rest of the domain. These tests are run as part of the in-editor lint runs, so you'll get immediate feedback on the any inputs that throw exceptions, and the performance of your function.

    If your code matches one of the earlier encountered shapes, we suggest auto-completion or optimized variants. This often saves a ton of time and converts O(n^2) nested loops into O(n lg n).

    ```tsx
    const results = [];
    myArray.forEach(elem => {
        if (!results.includes(elem)) {
            results.push(elem);
        }
    });

    // Becomes

    const results = [];
    {
        const _tmp = new Set();
        for (let i = 0; i < myArray.length; i++) _tmp.set(myArray[i]);
        for (let i of _tmp.keys()) results.push(i);
    }
    ```

# Future alignment

## Target machine

    32-core laptop with 16-wide SIMD and 3 x 2080Ti as GPU
    - Path tracing with 2 spp at 4k
    - Wasm + Workers + SIMD crucial for perf
        Current: max/JS = 360x ST, 60x MT.
        Future: max/JS = 4000x ST, 130x MT.
        With WASM: 2-10x MT
    - Stable WebGPU: another 10x perf
    - Compile to SPIR-V to WebGPU & Wasm+SIMD+MT
    - Foldable tablet phones mainstream
    - Looking Glass type 3D TVs mainstream
    - XR landed as consumer tech

## Target common use in 2030 - stay nimble

    [] GLSL Compute as the main language
        [] Run everything as WebAssembly workers
        [] WebGPU backend
    [] XR version
    [] Mobile-friendly UI

# Rolling rewrites plan

    Towards fast execution and safety.

    [] Move from async coroutines to workers
        [] No shared state
        [] No parsing on main thread
        [] Offscreen canvas
    [] Use spirv-wasm to write parts in GLSL
        [] Tree rebuild
        [] Text geometry generation
    [x] Change to code pretty-printing library with TSX support
        [x] Remove the need for DOM + CSS
    [] Rewrite backend away from executing shell commands & sanitize inputs
    [] Backend to WebAssembly sandboxes
        - https://www.fastly.com/blog/announcing-lucet-fastly-native-webassembly-compiler-runtime
