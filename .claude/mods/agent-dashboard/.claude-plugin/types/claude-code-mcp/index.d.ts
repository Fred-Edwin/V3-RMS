// The inputs of the MCP tools the session had connected when this mod
// was last saved, from each server's tools/list inputSchema.
// Merges into the engine's ToolCallInput (types/ McpToolInputs) so
// `e.tool === "mcp__<server>__<tool>"` narrows to the tool's arguments.
// Written again at a save of the mod with a server connected.
export {}
declare module 'claude-code' {
  interface McpToolInputs {
    /** Clicks on the provided element */
    "mcp__chrome-devtools__click": {
      /** Targets a specific page by ID. */
      pageId: number
      /** The uid of an element on the page from the page content snapshot */
      uid: string
      /** Set to true for double clicks. Default is false. */
      dblClick?: boolean
      /** Whether to include a snapshot in the response. Default is false. */
      includeSnapshot?: boolean
    }
    /** Closes the page by its index. The last open page cannot be closed. */
    "mcp__chrome-devtools__close_page": {
      /** The ID of the page to close. Call list_pages to list pages. */
      pageId: number
    }
    /** Drag an element onto another element */
    "mcp__chrome-devtools__drag": {
      /** Targets a specific page by ID. */
      pageId: number
      /** The uid of the element to drag */
      from_uid: string
      /** The uid of the element to drop into */
      to_uid: string
      /** Whether to include a snapshot in the response. Default is false. */
      includeSnapshot?: boolean
    }
    /** Emulates various features on the target page. */
    "mcp__chrome-devtools__emulate": {
      /** Targets a specific page by ID. */
      pageId: number
      /** Throttle network. Omit to disable throttling. */
      networkConditions?: "Offline" | "Slow 3G" | "Fast 3G" | "Slow 4G" | "Fast 4G"
      /** Represents the CPU slowdown factor. Omit or set the rate to 1 to disable throttling */
      cpuThrottlingRate?: number
      /** Geolocation (`<latitude>,<longitude>`) to emulate. Latitude between -90 and 90. Longitude between -180 and 180. Omit to clear the geolocation override. */
      geolocation?: string
      /** User agent to emulate. Set to empty string to clear the user agent override. */
      userAgent?: string
      /** Emulate the dark or the light mode. Set to "auto" to reset to the default. */
      colorScheme?: "dark" | "light" | "auto"
      /** Emulate device viewports '<width>x<height>x<devicePixelRatio>[,mobile][,touch][,landscape]'. 'touch' and 'mobile' to emulate mobile devices. 'landscape' to emulate landscape mode. */
      viewport?: string
      /** Extra HTTP headers as a JSON string object, e.g. {"X-Custom": "value", "Authorization": "Bearer token"}. Headers are included into every HTTP request originating from the page and persist across navigations until cleared. Pass an empty string to clear all extra headers. */
      extraHttpHeaders?: string
    }
    /** Evaluate a JavaScript function inside the target page. Returns the response as JSON, so returned values have to be JSON-serializable. */
    "mcp__chrome-devtools__evaluate_script": {
      /** Targets a specific page by ID. */
      pageId: number
      /** A JavaScript function declaration to be executed by the tool in the target page. Example without arguments: `() => document.title` or `async () => await fetch("example.com")`. Example with arguments: `(el) => el.innerText` */
      function: string
      /** An optional list of arguments to pass to the function. */
      args?: string[]
      /** The absolute or relative path to a file to save the script output to. If omitted, the output is returned inline. */
      filePath?: string
      /** Handle dialogs while execution. "accept", "dismiss", or string for response of window.prompt. Defaults to accept. */
      dialogAction?: string
      /** Whether to wait for the DOM to settle. Pass false if the script only reads data. Defaults to true. */
      waitForStableDom?: boolean
    }
    /** Type text into an input, text area or select an option from a <select> element. */
    "mcp__chrome-devtools__fill": {
      /** Targets a specific page by ID. */
      pageId: number
      /** The uid of an element on the page from the page content snapshot */
      uid: string
      /** The value to fill in. "true" or "false" for checkboxes and toggles, "true" for radio buttons. */
      value: string
      /** Whether to include a snapshot in the response. Default is false. */
      includeSnapshot?: boolean
    }
    /** Fill out multiple form elements (inputs, selects, checkboxes, radios) at once. ALWAYS prefer this tool over multiple individual 'fill' or 'click' calls when interacting with forms. It is significantly faster, more reliable, and reduces turn count. Example: Fill username, password, and check "Remember Me" in one call. */
    "mcp__chrome-devtools__fill_form": {
      /** Targets a specific page by ID. */
      pageId: number
      /** Elements from snapshot to fill out. */
      elements: Array<{
        /** The uid of the element to fill out */
        uid: string
        /** Value for the element. "true" or "false" for checkboxes and toggles, "true" for radio buttons. */
        value: string
      }>
      /** Whether to include a snapshot in the response. Default is false. */
      includeSnapshot?: boolean
    }
    /** Gets a console message by its ID. You can get all messages by calling list_console_messages. */
    "mcp__chrome-devtools__get_console_message": {
      /** Targets a specific page by ID. */
      pageId: number
      /** The msgid of a console message on the page from the listed console messages */
      msgid: number
    }
    /** Retrieve matched CSS rules, inline styles, inherited styles, and cascade information for an element identified by its UID. Use this tool to debug why specific CSS properties are applied, overridden, or conflicting. Results are paginated and return 10 rules per page by default; use pageIdx to page through the remaining rules. Requires a UID from take_snapshot. */
    "mcp__chrome-devtools__get_css_styles": {
      /** Targets a specific page by ID. */
      pageId: number
      /** The uid of the element on the page from the page content snapshot to inspect CSS styles for */
      uid: string
      /** Maximum number of CSS rules to return per page. Defaults to 10. */
      pageSize?: number
      /** Page number to return (0-based). Defaults to 0 (the first page). */
      pageIdx?: number
    }
    /** Gets a network request by an optional reqid, if omitted returns the currently selected request in the DevTools Network panel. Useful for inspecting request headers (including 'Cookie') and response headers (including 'Set-Cookie' and directives). */
    "mcp__chrome-devtools__get_network_request": {
      /** Targets a specific page by ID. */
      pageId: number
      /** The reqid of the network request. If omitted returns the currently selected request in the DevTools Network panel. */
      reqid?: number
      /** The absolute or relative path to a .network-request file to save the request body to. If omitted, the body is returned inline. */
      requestFilePath?: string
      /** The absolute or relative path to a .network-response file to save the response body to. If omitted, the body is returned inline. */
      responseFilePath?: string
    }
    /** If a browser dialog was opened, use this command to handle it */
    "mcp__chrome-devtools__handle_dialog": {
      /** Targets a specific page by ID. */
      pageId: number
      /** Whether to dismiss or accept the dialog */
      action: "accept" | "dismiss"
      /** Optional prompt text to enter into the dialog. */
      promptText?: string
    }
    /** Hover over the provided element */
    "mcp__chrome-devtools__hover": {
      /** Targets a specific page by ID. */
      pageId: number
      /** The uid of an element on the page from the page content snapshot */
      uid: string
      /** Whether to include a snapshot in the response. Default is false. */
      includeSnapshot?: boolean
    }
    /** Get Lighthouse score and reports for accessibility, SEO, best practices, and agentic browsing. This excludes performance. For performance audits, run performance_start_trace */
    "mcp__chrome-devtools__lighthouse_audit": {
      /** Targets a specific page by ID. */
      pageId: number
      /** "navigation" reloads & audits. "snapshot" analyzes current state. */
      mode?: "navigation" | "snapshot"
      /** Device to emulate. */
      device?: "desktop" | "mobile"
      /** Directory for reports. If omitted, uses temporary files. */
      outputDirPath?: string
    }
    /** List all console messages for the target page since the last navigation. */
    "mcp__chrome-devtools__list_console_messages": {
      /** Targets a specific page by ID. */
      pageId: number
      /** Maximum number of messages to return. When omitted, returns all messages. */
      pageSize?: number
      /** Page number to return (0-based). When omitted, returns the first page. */
      pageIdx?: number
      /** Filter messages to only return messages of the specified resource types. When omitted or empty, returns all messages. */
      types?: Array<"log" | "debug" | "info" | "error" | "warn" | "dir" | "dirxml" | "table" | "trace" | "clear" | "startGroup" | "startGroupCollapsed" | "endGroup" | "assert" | "profile" | "profileEnd" | "count" | "timeEnd" | "verbose" | "issue">
      /** Set to true to return the preserved messages over the last 3 navigations. */
      includePreservedMessages?: boolean
      /** Set to true to include the stack trace for each message when available. Increases the response size. */
      includeStackTraces?: boolean
      /** Filter messages to only return messages of the specified service worker. */
      serviceWorkerId?: string
    }
    /** Lists the most recent requests for the target page since the last navigation. */
    "mcp__chrome-devtools__list_network_requests": {
      /** Targets a specific page by ID. */
      pageId: number
      /** Maximum number of requests to return. When omitted, returns all requests. */
      pageSize?: number
      /** Page number to return (0-based). When omitted, returns the first page. */
      pageIdx?: number
      /** Filter requests to only return requests of the specified resource types. When omitted or empty, returns all requests. */
      resourceTypes?: Array<"document" | "stylesheet" | "image" | "media" | "font" | "script" | "texttrack" | "xhr" | "fetch" | "prefetch" | "eventsource" | "websocket" | "manifest" | "signedexchange" | "ping" | "cspviolationreport" | "preflight" | "fedcm" | "other">
      /** Set to true to return the preserved requests over the last 3 navigations. */
      includePreservedRequests?: boolean
    }
    /** Get a list of pages open in the browser. */
    "mcp__chrome-devtools__list_pages": {}
    /** Go to a URL, or back, forward, or reload. Use project URL if not specified otherwise. */
    "mcp__chrome-devtools__navigate_page": {
      /** Targets a specific page by ID. */
      pageId: number
      /** Navigate the page by URL, back or forward in history, or reload. */
      type?: "url" | "back" | "forward" | "reload"
      /** Target URL (only type=url) */
      url?: string
      /** Whether to ignore cache on reload. */
      ignoreCache?: boolean
      /** Whether to auto accept or beforeunload dialogs triggered by this navigation. Default is accept. */
      handleBeforeUnload?: "accept" | "dismiss"
      /** A JavaScript script to be executed on each new document before any other scripts for the next navigation. */
      initScript?: string
      /** Maximum wait time in milliseconds. If set to 0, the default timeout will be used. */
      timeout?: number
    }
    /** Open a new tab and load a URL. Use project URL if not specified otherwise. */
    "mcp__chrome-devtools__new_page": {
      /** URL to load in a new page. */
      url: string
      /** Whether to open the page in the background without bringing it to the front. Default is false (foreground). */
      background?: boolean
      /** If specified, the page is created in an isolated browser context with the given name. Pages in the same browser context share cookies and storage. Pages in different browser contexts are fully isolated (useful for clean-slate testing of cookies and authentication). */
      isolatedContext?: string
      /** Maximum wait time in milliseconds. If set to 0, the default timeout will be used. */
      timeout?: number
    }
    /** Provides more detailed information on a specific Performance Insight of an insight set that was highlighted in the results of a trace recording. */
    "mcp__chrome-devtools__performance_analyze_insight": {
      /** Targets a specific page by ID. */
      pageId: number
      /** The id for the specific insight set. Only use the ids given in the "Available insight sets" list. */
      insightSetId: string
      /** The name of the Insight you want more information on. For example: "DocumentLatency" or "LCPBreakdown" */
      insightName: string
    }
    /** Start a performance trace on the target webpage. Use to find frontend performance issues, Core Web Vitals (LCP, INP, CLS), and improve page load speed. */
    "mcp__chrome-devtools__performance_start_trace": {
      /** Targets a specific page by ID. */
      pageId: number
      /** Determines if, once tracing has started, the target page should be automatically reloaded. Navigate the page to the right URL using the navigate_page tool BEFORE starting the trace if reload or autoStop is set to true. */
      reload?: boolean
      /** Determines if the trace recording should be automatically stopped. */
      autoStop?: boolean
      /** The absolute file path, or a file path relative to the current working directory, to save the raw trace data. For example, trace.json.gz (compressed) or trace.json (uncompressed). */
      filePath?: string
    }
    /** Stop the active performance trace recording on the target webpage. */
    "mcp__chrome-devtools__performance_stop_trace": {
      /** Targets a specific page by ID. */
      pageId: number
      /** The absolute file path, or a file path relative to the current working directory, to save the raw trace data. For example, trace.json.gz (compressed) or trace.json (uncompressed). */
      filePath?: string
    }
    /** Press a key or key combination. Use this when other input methods like fill() cannot be used (e.g., keyboard shortcuts, navigation keys, or special key combinations). */
    "mcp__chrome-devtools__press_key": {
      /** Targets a specific page by ID. */
      pageId: number
      /** A key or a combination (e.g., "Enter", "Control+A", "Control++", "Control+Shift+R"). Modifiers: Control, Shift, Alt, Meta */
      key: string
      /** Whether to include a snapshot in the response. Default is false. */
      includeSnapshot?: boolean
    }
    /** Resizes the page's window so that the page has specified dimension */
    "mcp__chrome-devtools__resize_page": {
      /** Targets a specific page by ID. */
      pageId: number
      /** Page width */
      width: number
      /** Page height */
      height: number
    }
    /** Select a page as a context for future tool calls. */
    "mcp__chrome-devtools__select_page": {
      /** The ID of the page to select. Call list_pages to get available pages. */
      pageId: number
      /** Whether to focus the page and bring it to the top. */
      bringToFront?: boolean
    }
    /** Capture a heap snapshot of the target page. Use to analyze the memory distribution of JavaScript objects and debug memory leaks. */
    "mcp__chrome-devtools__take_heapsnapshot": {
      /** Targets a specific page by ID. */
      pageId: number
      /** A path to a .heapsnapshot file to save the heapsnapshot to. */
      filePath: string
    }
    /** Take a screenshot of the page or element. */
    "mcp__chrome-devtools__take_screenshot": {
      /** Targets a specific page by ID. */
      pageId: number
      /** Type of format to save the screenshot as. Default is "png" */
      format?: "png" | "jpeg" | "webp"
      /** Compression quality for JPEG and WebP formats (0-100). Higher values mean better quality but larger file sizes. Ignored for PNG format. */
      quality?: number
      /** The uid of an element on the page from the page content snapshot. If omitted, takes a page screenshot. */
      uid?: string
      /** If set to true takes a screenshot of the full page instead of the currently visible viewport. Incompatible with uid. */
      fullPage?: boolean
      /** The absolute path, or a path relative to the current working directory, to save the screenshot to instead of attaching it to the response. */
      filePath?: string
    }
    /** Take a text snapshot of the target page based on the a11y tree. The snapshot lists page elements along with a unique identifier (uid). Always use the latest snapshot. Prefer taking a snapshot over taking a screenshot. The snapshot indicates the element selected in the DevTools Elements panel (if any). */
    "mcp__chrome-devtools__take_snapshot": {
      /** Targets a specific page by ID. */
      pageId: number
      /** Whether to include all possible information available in the full a11y tree. Default is false. */
      verbose?: boolean
      /** The absolute path, or a path relative to the current working directory, to save the snapshot to instead of attaching it to the response. */
      filePath?: string
    }
    /** Type text using keyboard into a previously focused input */
    "mcp__chrome-devtools__type_text": {
      /** Targets a specific page by ID. */
      pageId: number
      /** The text to type */
      text: string
      /** Optional key to press after typing. E.g., "Enter", "Tab", "Escape" */
      submitKey?: string
    }
    /** Upload a file through a provided element. */
    "mcp__chrome-devtools__upload_file": {
      /** Targets a specific page by ID. */
      pageId: number
      /** The uid of the file input element or an element that will open file chooser on the page from the page content snapshot */
      uid: string
      /** One or more files paths to upload. File paths have to be local to the browser instance (not the MCP). */
      filePaths: string[]
      /** Whether to include a snapshot in the response. Default is false. */
      includeSnapshot?: boolean
    }
    /** Wait for the specified text to appear on the selected page. */
    "mcp__chrome-devtools__wait_for": {
      /** Targets a specific page by ID. */
      pageId: number
      /** Non-empty list of texts. Resolves when any value appears on the page. */
      text: string[]
      /** Maximum wait time in milliseconds. If set to 0, the default timeout will be used. */
      timeout?: number
    }
    /** Create a doc, or apply several operations to one doc atomically. */
    mcp__claude_ai_Claude_Docs__batch: {
      batch?: unknown[]
      container?: {
        kind: string
        id?: string
        create?: {}
      }
      verbose?: boolean
      opId?: string
    }
    /** Create one object in a doc: a tab, its contents, a comment, an upload record. */
    mcp__claude_ai_Claude_Docs__create: {
      object: "file" | "node" | "utterance" | "enum" | "blob"
      engine?: string
      payload: {} | string
      container?: {
        kind: string
        id: string
        version?: string
      }
      verbose?: boolean
      opId?: string
      artifact?: string
    }
    /** Delete one object from a doc: a tab, its contents, a comment, an upload record. A doc keeps at least one tab (deleting its last refuses `last_tab`): to start over, rewrite that tab's contents with `update`, never delete and recreate the tab. */
    mcp__claude_ai_Claude_Docs__delete: {
      ref: {
        object: "project" | "file" | "node" | "utterance"
        id: string
      }
      engine?: string
      container?: {
        kind: string
        id: string
        version?: string
      }
      payload?: {} | string
      verbose?: boolean
      opId?: string
    }
    /** Export one tab inline as base64: pdf, docx, html, text, markdown or notion (Notion-flavored markdown, what notion-create-pages takes). To just keep the file in the doc's files, create a blob {from: {object: "file", id}, format} instead (no large result). */
    mcp__claude_ai_Claude_Docs__export: {
      container: {
        kind: string
        id: string
        version?: string
      }
      file: string
      format: "markdown" | "text" | "html" | "docx" | "pdf" | "notion"
      paper?: "letter" | "a4"
      maxBytes?: number
    }
    /** Docs guides: topic.instructions repeats the server instructions. Read it only if your client dropped them. Also topic.<name>, refusal.<code>. After a doc's birth → ["topic.index"]. */
    mcp__claude_ai_Claude_Docs__guide: {
      /** topic.<name> (instructions, index, editing, tabs, comments, charts, chart-definition, diagram, uploads, sharing, skill) or refusal.<code>; several per call is fine. */
      items?: unknown[]
    }
    /** List a tab's or a doc's comment history (threads, replies, resolves). */
    mcp__claude_ai_Claude_Docs__query: {
      container?: {
        kind: string
        id: string
        version?: string
      }
      object?: "utterance"
      payload?: {} | string
    }
    /** Read a doc (lists its tabs), a tab's contents, or a comment. A claude.ai/[code/]artifact/[<title>-]<id> link → `ref {"object":"project","id":"<id>"}` first; reads inside it take `container {"kind":"project","id":"<id>"}`. */
    mcp__claude_ai_Claude_Docs__read: {
      ref: {
        object: "project" | "file" | "node" | "utterance" | "enum" | "blob"
        id: string
      }
      engine?: string
      container?: {
        kind: string
        id: string
        version?: string
      }
      payload?: {} | string
    }
    /** Edit a tab's contents, rename a doc or tab, or change a stored value. */
    mcp__claude_ai_Claude_Docs__update: {
      ref: {
        object: "project" | "file" | "node" | "utterance" | "enum"
        id: string
      }
      engine?: string
      payload: {} | string
      container?: {
        kind: string
        id: string
        version?: string
      }
      verbose?: boolean
      opId?: string
      answering?: string
    }
    /** Map a Figma node to a code component in your codebase using Code Connect. Use the nodeId parameter to specify a node id. Use the fileKey parameter to specify the file key. If a URL is provided, extract the node id and file key from the URL, for example, if given the URL https://figma.com/design/:fileKey/:fileName?node-id=1-2, the extracted nodeId would be `1:2` and the fileKey would be `:fileKey`. If the URL does not include `node-id`, ask the user for a node-specific URL. Do not pass an empty or guessed nodeId. */
    mcp__claude_ai_Figma__add_code_connect_map: {
      /** The ID of the node in the Figma document, eg. "123:456" or "123-456". This should be a valid node ID in the Figma document. Do not pass an empty string for node_id. */
      nodeId: string
      /** The key of the Figma file to use. If the URL is provided, extract the file key from the URL. The given URL must be in the format https://figma.com/design/:fileKey/:fileName?node-id=:int1-:int2. The extracted fileKey would be `:fileKey`. Only design files are supported: the URL must be a /design/ URL. /slides/, /board/, and /make/ URLs are not allowed. */
      fileKey: string
      /** The location of the component in the source code */
      source: string
      /** The name of the component to map to in the source code */
      componentName: string
      /** The framework or language label for this Code Connect mapping. Valid values: React, Web Components, Vue, Svelte, Storybook, Javascript, Swift, Swift UIKit, Objective-C UIKit, SwiftUI, Compose, Java, Kotlin, Android XML Layout, Flutter, Markdown */
      label: "React" | "Web Components" | "Vue" | "Svelte" | "Storybook" | "Javascript" | "Swift" | "Swift UIKit" | "Objective-C UIKit" | "SwiftUI" | "Compose" | "Java" | "Kotlin" | "Android XML Layout" | "Flutter" | "Markdown"
      /** The executable JS template code for a Code Connect template. When provided, creates a figmadoc-type record (full template) instead of a component_browser mapping (simple mapping). */
      template?: string
      /** JSON string of template metadata. May include isParserless (boolean), imports, nestable, props fields. If omitted when template is provided, defaults to {}. */
      templateDataJson?: string
    }
    /** You MUST load the figma-generative-plugins skill before calling this tool. If it is not installed, read skill://figma/figma-generative-plugins/SKILL.md with resources/read or get_figma_skill. Use this for requests to build, create, upload, or publish a “Figma plugin,” “generative plugin,” or “custom tool.” It creates a generative plugin in the account library; it does not install an existing Figma Community plugin. Creates a new generative plugin in the authenticated user's account library and returns its id. The plugin starts as a working scaffold — a runnable starter that draws a square — so it is a structural starting point, not a finished plugin: follow this call with the update tool to replace the scaffold's source with the behavior the user asked for. planKey names the plan that will own the plugin; take it from the plans list returned by whoami. */
    mcp__claude_ai_Figma__create_generative_plugin: {
      /** Display name for the new resource. */
      name: string
      /** One-line description of what the resource does. */
      description: string
      /** The team or organization key (e.g. "team::1234567890" or "organization::1234567890"). Use the `key` field verbatim from one of the user's plans. If the user has more than one plan, ask which one to use before calling. */
      planKey: string
    }
    /** Create a new blank Figma file. IMPORTANT: You MUST load the /figma-create-new-file skill BEFORE every call to this tool, if it exists. NEVER call this tool without loading that skill first if it exists. By default the file is placed in the authenticated user's drafts folder; If specified it can be placed inside a project. Use this tool when you need a new file to work with before calling use_figma. Returns the new file key and URL. Always include all three required arguments: fileName, planKey, and editorType. For editorType, use "design", "figjam", or "slides". If the user already provided a planKey, use it directly. Otherwise, call the whoami tool first to get the list of plans. If the user has one plan, use its "key" field. If multiple, ask the user which team or organization to use. Optionally accepts a projectId. If the URL is of the format https://figma.com/files/project/:projectId, https://figma.com/files/:orgId/project/:projectId, or https://figma.com/files/team/:teamId/project/:projectId then use the :projectId as the projectId. */
    mcp__claude_ai_Figma__create_new_file: {
      /** The name for the new Figma file. */
      fileName: string
      /** The team or organization key (e.g. "team::1234567890" or "organization::1234567890"). Use the `key` field verbatim from one of the user's plans. If the user has more than one plan, ask which one to use before calling. */
      planKey: string
      /** The type of Figma file to create. "design" creates a Figma design file. "figjam" creates a FigJam whiteboard file. "slides" creates a Figma Slides presentation file. */
      editorType: "design" | "figjam" | "slides"
      /** The id of the project (folder) in Figma. If the URL is provided, extract the project id from the URL. Common URL formats include https://figma.com/files/project/:projectId, https://figma.com/files/:orgId/project/:projectId, and https://figma.com/files/team/:teamId/project/:projectId. The extracted projectId would be `:projectId`. */
      projectId?: string
    }
    /** You MUST load the figma-shaders skill before calling this tool. If it is not installed, read skill://figma/figma-shaders/SKILL.md with resources/read or get_figma_skill. Use this for requests to build, create, upload, or publish a “Figma shader,” “shader effect,” “shader fill,” “custom effect,” “custom fill,” or “procedural shader.” Creates a new shader effect or fill in the authenticated user's account library and returns its id. Set kind to effect for a shader that transforms the layer beneath it, or fill for a shader that generates its own pixels. The resource starts as a working scaffold, so follow this call with the update tool to replace the scaffold's source with the shader the user asked for. planKey names the plan that will own the shader; take it from the plans list returned by whoami. */
    mcp__claude_ai_Figma__create_shader: {
      /** Display name for the new resource. */
      name: string
      /** One-line description of what the resource does. */
      description: string
      /** The team or organization key (e.g. "team::1234567890" or "organization::1234567890"). Use the `key` field verbatim from one of the user's plans. If the user has more than one plan, ask which one to use before calling. */
      planKey: string
      /** The shader kind: effect transforms the layer beneath it; fill generates its own pixels. */
      kind: "effect" | "fill"
    }
    /** Download assets from a Figma file for a single node: an exported render, the original source images, and SVGs of the vector layers. The response contains: (1) `export` — an exported image of the whole node; (2) `rawImages` — original uploaded source images (JPEG, PNG, GIF, WebP) found as fills anywhere in the node subtree (capped at 20); and (3) `svgAssets` — SVGs for the vector layers in the subtree that are best represented as SVG (icons, logos, simple illustrations), the same set get_design_context surfaces (capped at 20). Each raw image carries a `format` field with its actual image format (e.g. "png", "jpeg", "gif", "webp") so you can save it with the correct file extension; if the format cannot be determined it is reported as "original". Each `svgAssets` entry has format "svg". Call this tool for asset URLs get_design_context has not already provided: the `export` render of the whole node, a specific format or scale, or assets for a node you have not requested design context for. Export precedence: when you pass defaultFormat and/or defaultScale, those override the export settings configured on the node in Figma. When you omit them, the node-configured export settings are used if present, otherwise png at scale 1. Pass defaultFormat or defaultScale only when the user explicitly asks for a specific format, size, or resolution. For cross-file image transfer, use the raw image URLs with upload_assets. URLs are temporary — download promptly. Works on Figma design files (URL path `/design/`), Figma Slides (`/slides/`), and FigJam boards (`/board/`). Does NOT work on Figma Make files (`/make/`). */
    mcp__claude_ai_Figma__download_assets: {
      /** The key of the Figma file to use. If the URL is provided, extract the file key from the URL. The given URL must be in the format https://figma.com/design/:fileKey/:fileName?node-id=:int1-:int2. The extracted fileKey would be `:fileKey`. */
      fileKey: string
      /** The ID of the node in the Figma document, eg. "123:456" or "123-456". This should be a valid node ID in the Figma document. Do not pass an empty string for node_id. */
      nodeId: string
      /** Export format. When you provide this, it overrides any export settings configured on the node in Figma. When you omit it, the node-configured export format is used if present, otherwise png. Set this only when the user asks for a specific format. */
      defaultFormat?: "png" | "jpg" | "svg" | "pdf"
      /** Export scale (resolution multiplier). When you provide this, it overrides any export settings configured on the node in Figma. When you omit it, the node-configured export scale is used if present, otherwise 1. Set this only when the user asks for a specific size or resolution. */
      defaultScale?: number
    }
    /** Export a Figma timeline node as an MP4 video. This tool only produces MP4 — GIF and animated SVG export are not supported yet. Renders the timeline server-side and returns a presigned download URL. The file stays available for `ttlSeconds` (defaults to 1 hour, clamped server-side to [30s, 7d]); use `availableUntil` in the response to know when it is deleted. Some renders finish in seconds, others take minutes; if the render hasn't finished within the handler budget, the response includes a `jobId` and `status: "processing"` — re-invoke `export_video` with `{ fileKey, jobId }` after 10–15s to poll. Required: `fileKey` and either `nodeId` (to start a new export) or `jobId` (to poll). The `nodeId` must be the top-level frame that owns the timeline — in a design file a frame placed directly on the page or in a section, and in Slides the slide itself (not a layer inside it) — not a nested layer or sub-clip. If you animated a descendant, pass its containing top-level frame (the slide, in Slides); if `get_motion_context` returns a `timelineCohorts` entry, its `rootNodeId` is that frame. Use the `quality` field ("low"/"medium"/"high") to control output size. */
    mcp__claude_ai_Figma__export_video: {
      /** The key of the Figma file to use. If the URL is provided, extract the file key from the URL. The given URL must be in the format https://figma.com/design/:fileKey/:fileName?node-id=:int1-:int2. The extracted fileKey would be `:fileKey`. */
      fileKey: string
      /** The timeline node to export. Required when starting a new export. Provide nodeId OR jobId, never both — the call is rejected if both are set. Must be the top-level frame that owns the timeline — in a design file a frame placed directly on the page or in a section, and in Slides the slide itself (not a layer inside it) — not a nested layer or sub-clip. If you animated a descendant, pass its containing top-level frame (the slide, in Slides); if get_motion_context returns a `timelineCohorts` entry, its `rootNodeId` is that frame. */
      nodeId?: string
      /** Frames per second for the rendered MP4 (5-60). Optional; the server picks a default. */
      fps?: number
      /** Render quality preset. Higher quality means a larger file. Optional; the server picks a default. */
      quality?: "low" | "medium" | "high"
      /** Output-size constraint. SCALE multiplies the node's natural size (value is the multiplier, e.g. 2 = 2x); WIDTH / HEIGHT pin that dimension to an absolute pixel count and scale the other to preserve aspect ratio. Optional; omit to render at the node's natural size (1x). Clamped server-side to a max 10x scale / 4096px per dimension. Ignored when polling with jobId. */
      constraint?: {
        type: "SCALE" | "WIDTH" | "HEIGHT"
        value: number
      }
      /** How long (in seconds) the rendered MP4 is retained on the server. Each poll reissues a fresh presigned download URL; once this window elapses the file is deleted and the job is no longer reachable. Clamped server-side to [30, 7d]. */
      ttlSeconds?: number
      /** Returned from a previous call when the export was still rendering. Pass this to poll. Provide nodeId OR jobId, never both — the call is rejected if both are set. When polling, fps/quality/ttlSeconds are ignored (they were fixed when the job was created). */
      jobId?: string
    }
    /** Create a flowchart, decision tree, gantt chart, sequence diagram, state diagram, or entity relationship diagram in FigJam, using Mermaid.js. Generated diagrams should be simple, unless a user asks for details. This tool also does not support generating Figma designs, class diagrams, timelines, venn diagrams, or other Mermaid.js diagram types. This tool also does not support font changes, or moving individual shapes around -- if a user asks for those changes to an existing diagram, encourage them to open the diagram in Figma. If the tool is unable to complete the user's task, reference the error that is passed back. Do not use the create_new_file tool prior to creating a diagram using this tool; generate_diagram creates its own files. */
    mcp__claude_ai_Figma__generate_diagram: {
      /** A human-readable title for the diagram. Keep it short, but descriptive. */
      name: string
      /** Mermaid.js code for the diagram. Keep diagrams simple, unless the user has detailed requirements. Only the following diagram types are supported: graph, flowchart, sequenceDiagram, stateDiagram, stateDiagram-v2, gantt, and erDiagram. Make sure to use correct Mermaid.js syntax. For graph, flowchart, or entity relationship diagrams, use LR direction by default and put all shape and edge text in quotes (eg. ["Text"], -->|"Edge Text"|, --"Edge Text"-->). Do not use emojis in the Mermaid.js code. Do not use to represent new lines. Feel free to use the full range of shapes and connectors that Mermaid.js syntax offers. For graph and flowchart diagrams only, you can use color styling--but do so sparingly unless the user asks for it. In gantt charts, do not use color styling. In sequence diagrams, do not use notes. Do not use the word "end" in classNames. */
      mermaidSyntax: string
      /** A description of what the user is trying to accomplish with this tool call. Important: Do not add extraneous information other than what the user provides. */
      userIntent?: string
      /** The team or organization key (e.g. "team::1234567890" or "organization::1234567890"). Use the `key` field verbatim from one of the user's plans. If the user has more than one plan, ask which one to use before calling. */
      planKey?: string
      /** Optional. Indicates whether to use the same plan for future generations. Do not provide this parameter unless the user specifically requests it, and a planKey is also provided. */
      savePlanKey?: boolean
      /** Optional. To generate a diagram using the software architecture layout, pass the code from the architecture-diagram-instructions resource. Omit this parameter for standard diagrams. */
      useArchitectureLayoutCode?: string
      /** Optional. The key of an existing FigJam file to add the diagram to. Extract from a Figma URL like figma.com/board/{fileKey}/... When provided, the diagram is placed directly in this file instead of creating a new one. The user must have edit access to the file. */
      fileKey?: string
    }
    /** Get a mapping of {[nodeId]: {codeConnectSrc: e.g. location of component in codebase, codeConnectName: e.g. name of component in codebase} E.g. {'1:2': { codeConnectSrc: 'https://github.com/foo/components/Button.tsx', codeConnectName: 'Button' } }. Use the nodeId parameter to specify a node id. Use the fileKey parameter to specify the file key. If a URL is provided, extract the node id and file key from the URL, for example, if given the URL https://figma.com/design/:fileKey/:fileName?node-id=1-2, the extracted nodeId would be `1:2` and the fileKey would be `:fileKey`. If the URL does not include `node-id`, ask the user for a node-specific URL. Do not pass an empty or guessed nodeId. */
    mcp__claude_ai_Figma__get_code_connect_map: {
      /** The ID of the node in the Figma document, eg. "123:456" or "123-456". This should be a valid node ID in the Figma document. Do not pass an empty string for node_id. */
      nodeId: string
      /** The key of the Figma file to use. If the URL is provided, extract the file key from the URL. The given URL must be in the format https://figma.com/design/:fileKey/:fileName?node-id=:int1-:int2. The extracted fileKey would be `:fileKey`. */
      fileKey: string
      /** The label used to fetch Code Connect information for a particular language or framework when multiple Code Connect mappings exist. */
      codeConnectLabel?: string
    }
    /** Get AI-suggested strategy for linking a Figma node to code components via Code Connect. Workflow: call this tool → review suggestions with the user → call send_code_connect_mappings to save the approved mappings. Use the nodeId parameter to specify a node id. Use the fileKey parameter to specify the file key. If a URL is provided, extract the node id and file key from the URL, for example, if given the URL https://figma.com/design/:fileKey/:fileName?node-id=1-2, the extracted nodeId would be `1:2` and the fileKey would be `:fileKey`. If the URL does not include `node-id`, ask the user for a node-specific URL. Do not pass an empty or guessed nodeId. */
    mcp__claude_ai_Figma__get_code_connect_suggestions: {
      /** The ID of the node in the Figma document, eg. "123:456" or "123-456". This should be a valid node ID in the Figma document. Do not pass an empty string for node_id. */
      nodeId: string
      /** The key of the Figma file to use. If the URL is provided, extract the file key from the URL. The given URL must be in the format https://figma.com/design/:fileKey/:fileName?node-id=:int1-:int2. The extracted fileKey would be `:fileKey`. Only design files are supported: the URL must be a /design/ URL. /slides/, /board/, and /make/ URLs are not allowed. */
      fileKey: string
      /** Whether to exclude the prompt text and images from the response, returning only a lightweight list of unmapped components. */
      excludeMappingPrompt?: boolean
    }
    /** Get structured component metadata including properties, variants, and descendant tree for a Figma component or component set. Returns property definitions with types and variant options, and a tree of descendant instances and text nodes with their property references. Designed for creating Code Connect template files. Use the nodeId parameter to specify a node id. Use the fileKey parameter to specify the file key. If a URL is provided, extract the node id and file key from the URL, for example, if given the URL https://figma.com/design/:fileKey/:fileName?node-id=1-2, the extracted nodeId would be `1:2` and the fileKey would be `:fileKey`. If the URL does not include `node-id`, ask the user for a node-specific URL. Do not pass an empty or guessed nodeId. */
    mcp__claude_ai_Figma__get_context_for_code_connect: {
      /** The ID of the node in the Figma document, eg. "123:456" or "123-456". This should be a valid node ID in the Figma document. Do not pass an empty string for node_id. */
      nodeId: string
      /** The key of the Figma file to use. If the URL is provided, extract the file key from the URL. The given URL must be in the format https://figma.com/design/:fileKey/:fileName?node-id=:int1-:int2. The extracted fileKey would be `:fileKey`. Only design files are supported: the URL must be a /design/ URL. /slides/, /board/, and /make/ URLs are not allowed. */
      fileKey: string
    }
    /** Get design context for a Figma node — the primary tool for design-to-code workflows. Returns reference code, a screenshot, and contextual metadata that must be adapted to the target project. IMPORTANT: You MUST load figma-design-to-code guidance BEFORE calling this tool. Prefer the /figma-design-to-code skill if available; otherwise read the skill://figma/figma-design-to-code/SKILL.md MCP resource. NEVER call this tool without loading that guidance first — skipping it produces code that ignores the target project's existing components, design tokens, and conventions. Use the nodeId parameter to specify a node id. Use the fileKey parameter to specify the file key. If a URL is provided, extract the node id and file key from the URL, for example, if given the URL https://figma.com/design/:fileKey/:fileName?node-id=1-2, the extracted nodeId would be `1:2` and the fileKey would be `:fileKey`. If the URL does not include `node-id`, ask the user for a node-specific URL. Do not pass an empty or guessed nodeId. If the URL is of the format https://figma.com/design/:fileKey/branch/:branchKey/:fileName then use the branchKey as the fileKey. If the URL is of the format https://figma.com/make/:makeFileKey/:makeFileName then use the makeFileKey to identify the Figma Make file. Only for Figma Make files (URLs containing `/make/`), and only when calling get_design_context, assume the nodeId is `0:1`. The response will contain a code string and a JSON of download URLs for the assets referenced in the code. It will also include a screenshot of the node for context by default. */
    mcp__claude_ai_Figma__get_design_context: {
      /** The ID of the node in the Figma document, eg. "123:456" or "123-456". This should be a valid node ID in the Figma document. Do not pass an empty string for node_id. */
      nodeId: string
      /** The key of the Figma file to use. If the URL is provided, extract the file key from the URL. The given URL must be in the format https://figma.com/design/:fileKey/:fileName?node-id=:int1-:int2. The extracted fileKey would be `:fileKey`. */
      fileKey: string
      /** A comma separated list of programming languages used by the client in the current context in string form, e.g. `javascript`, `html,css,typescript`, etc. If you do not know, please list `unknown`. This is used for logging purposes to understand which languages are being used. If you are unsure, it is better to list `unknown` than to make a guess. */
      clientLanguages?: string
      /** A comma separated list of frameworks used by the client in the current context, e.g. `react`, `vue`, `django` etc. If you do not know, please list `unknown`. This is used for logging purposes to understand which frameworks are being used. If you are unsure, it is better to list `unknown` than to make a guess */
      clientFrameworks?: string
      /** Whether code should always be returned, instead of returning just metadata if the output size is too large. Only set this when the user directly requests to force the code. */
      forceCode?: boolean
      /** Whether Code Connect should be used to get the design context. Only set this when the user directly requests to disable Code Connect. */
      disableCodeConnect?: boolean
      /** A comma-separated list of Figma skill names being followed, if any (e.g. "figma-design-to-code", "figma-design-to-code,figma-code-connect"). Only pass this when explicitly instructed to by skill documentation. Used for logging purposes. If the skill was loaded via a skill-content MCP resource, prefix the skill name with "resource:". (e.g. "resource:figma-design-to-code", "resource:figma-design-to-code,resource:figma-code-connect") */
      skillNames?: string
      /** Whether to exclude the screenshot of the design from the response. IMPORTANT: it is not recommended to exclude screenshots. Only set this to true if the user has explicitly requested it or you are trying to preserve context. */
      excludeScreenshot?: boolean
    }
    /** Generate UI code for a given FigJam node in Figma. Use the nodeId parameter to specify a node id. If no node id is provided, use `0:1` which is the root node ID. Use the fileKey parameter to specify the file key. If a URL is provided, extract the node id from the URL, for example, if given the URL https://figma.com/board/:fileKey/:fileName?node-id=1-2, the extracted nodeId would be `1:2` and the fileKey would be `:fileKey`. IMPORTANT: This tool only works for FigJam files (URL path `/board/`), not other Figma files. */
    mcp__claude_ai_Figma__get_figjam: {
      /** The ID of the node in the FigJam board, eg. "123:456" or "123-456". If a URL is provided, extract the node id from the FigJam board URL, e.g. for https://figma.com/board/:fileKey/:fileName?node-id=1-2 the extracted nodeId would be `1:2`. Do not pass an empty string for node_id. */
      nodeId: string
      /** The key of the FigJam (board) file to use. If a URL is provided, extract the file key from the FigJam board URL. The given URL must be in the format https://figma.com/board/:fileKey/:fileName?node-id=:int1-:int2. The extracted fileKey would be `:fileKey`. A `/design/...` URL is NOT a FigJam file — do not call this tool with a design fileKey. */
      fileKey: string
      /** Whether to include images of nodes in the response */
      includeImagesOfNodes?: boolean
    }
    /** Read a single Figma skill resource (the skill index, a SKILL.md, or a skill reference file) by its skill:// URI and return its text content. You MUST ONLY use skill:// URIs. You MUST NOT use this for any other resource (docs, Make source, files, node data, etc.). Discover URIs from the server instructions or by reading the skill index at "skill://index.json". A SKILL.md links to its reference files with relative paths (e.g. references/foo.md); read those as skill://figma/<skill-name>/references/<path>. To read several resources (for example a skill plus its reference files), call this tool once per URI. */
    mcp__claude_ai_Figma__get_figma_skill: {
      /** The skill resource URI to read: the skill index ("skill://index.json"), a SKILL.md ("skill://figma/<skill-name>/SKILL.md"), or a reference file ("skill://figma/<skill-name>/references/<path>"). Only skill:// URIs are supported — discover them in the server instructions or the skill://index.json index. Returns the resource text content. */
      uri: string
    }
    /** Reads a generative plugin from the account library by id (from list_generative_plugins), returning its name, description, owner, version, and a manifest of its source files as { filename, bytes, uri }. Owner is the authenticated user's email when they own the plugin, or a public publisher handle otherwise. Read each file's contents from its uri as an MCP resource (contents are not inlined here). Only set includeSource to true to add source to each file when the MCP client cannot read MCP resources. Pass an optional version (commit SHA) to read a specific build; defaults to the latest. */
    mcp__claude_ai_Figma__get_generative_plugin: {
      /** The id of the resource to read, taken from the matching list tool. */
      id: string
      /** Optional 40-character commit SHA. Defaults to the latest built version. */
      version?: string
      /** Include each file's source directly in the tool result, up to 100 files and 1,000,000 cumulative bytes. The result reports which limit caused truncation. Leave this false unless the MCP client cannot read MCP resources. */
      includeSource?: boolean
    }
    /** Get the design libraries associated with a Figma file. Returns two lists: (1) libraries currently added to the file (subscribed), and (2) libraries available to add (community UI kits and organization libraries). Each library includes its name, library key, description, and source type. The organization libraries portion of libraries_available_to_add is paginated — when the response includes a libraries_available_to_add_next_offset value, pass it back via the offset parameter to fetch the next page. Use the library keys from the response to scope searches with search_design_system by passing them as includeLibraryKeys. */
    mcp__claude_ai_Figma__get_libraries: {
      /** The key of the Figma file to get libraries for. */
      fileKey: string
      /** Pagination offset from a previous response (libraries_available_to_add_next_offset). Pass this to fetch the next page of organization libraries in libraries_available_to_add. */
      offset?: number
    }
    /** IMPORTANT: Always prefer to use get_design_context tool. Get metadata for a node or page in the Figma desktop app in XML format. Useful only for getting an overview of the structure, it only includes node IDs, layer types, names, positions and sizes. You can call get_design_context on the node IDs contained in this response. Use the nodeId parameter to specify a node id, it can also be the page id (e.g. 0:1). IMPORTANT: This tool only works for Figma design files (URL path `/design/`). It is NOT supported for FigJam (`/board/`) or Slides (`/slides/`) files. This tool is not supported for Figma Make Files (URLs containing `/make/`). The nodeId parameter is optional: when omitted, the tool returns a list of the top-level pages (guid + name) in the document instead of an XML dump — use this when you don't yet know which page or node to drill into. When the user has a current selection relevant to the request, the response is prepended with a "Currently selected nodes:" block listing the selection by guid and name, so you can tell whether it matches the queried nodeId. If the URL includes `node-id`, extract it and pass it as nodeId; for example, if given the URL https://figma.com/design/:fileKey/:fileName?node-id=1-2, the extracted nodeId would be `1:2`. If the URL does not include `node-id`, do not set nodeId; omit the field so the tool lists top-level pages. Do not pass an empty or guessed nodeId. If the URL is of the format https://figma.com/design/:fileKey/branch/:branchKey/:fileName then use the branchKey as the fileKey. */
    mcp__claude_ai_Figma__get_metadata: {
      /** The ID of the node in the Figma document, eg. "123:456" or "123-456". This should be a valid node ID in the Figma document. Do not pass an empty string for node_id. */
      nodeId?: string
      /** The key of the Figma file to use. If the URL is provided, extract the file key from the URL. The given URL must be in the format https://figma.com/design/:fileKey/:fileName?node-id=:int1-:int2. The extracted fileKey would be `:fileKey`. */
      fileKey: string
    }
    /** Get keyframe animation data for a Figma node. Returns animated-node inventory, keyframe tracks with easing curves, pre-computed CSS/@keyframes and motion.dev code snippets, and timeline coordination hints for recursive calls. Use after get_design_context for motion-aware code generation. Use the nodeId parameter to specify a node id. Use the fileKey parameter to specify the file key. If a URL is provided, extract the node id and file key from the URL, for example, if given the URL https://figma.com/design/:fileKey/:fileName?node-id=1-2, the extracted nodeId would be `1:2` and the fileKey would be `:fileKey`. */
    mcp__claude_ai_Figma__get_motion_context: {
      /** The ID of the node in the Figma document, eg. "123:456" or "123-456". This should be a valid node ID in the Figma document. Do not pass an empty string for node_id. */
      nodeId: string
      /** The key of the Figma file to use. If the URL is provided, extract the file key from the URL. The given URL must be in the format https://figma.com/design/:fileKey/:fileName?node-id=:int1-:int2. The extracted fileKey would be `:fileKey`. */
      fileKey: string
      /** If true, traverses the subtree and returns motion data for all descendant nodes with animations. */
      recursive?: boolean
      /** A comma separated list of programming languages used by the client in the current context in string form, e.g. `javascript`, `html,css,typescript`, etc. If you do not know, please list `unknown`. This is used for logging purposes to understand which languages are being used. If you are unsure, it is better to list `unknown` than to make a guess. */
      clientLanguages?: string
      /** A comma separated list of frameworks used by the client in the current context, e.g. `react`, `vue`, `django` etc. If you do not know, please list `unknown`. This is used for logging purposes to understand which frameworks are being used. If you are unsure, it is better to list `unknown` than to make a guess */
      clientFrameworks?: string
    }
    /** Generate a screenshot for a given node or the currently selected node in the Figma desktop app. Works on Figma design files (URL path `/design/`), FigJam boards (`/board/`), and Figma Slides (`/slides/`). The optional `maxDimension` parameter (positive integer, max 65536, default 1024) caps the longer edge of the rendered PNG in pixels — increase it when you need to inspect fine detail, decrease it for thumbnails or to save context. The JSON metadata entry in the response includes both `width`/`height` (the rendered PNG size) and `original_width`/`original_height` (the node's natural canvas size before any clamping), so callers can decide whether to re-request at a higher `maxDimension`. Use the nodeId parameter to specify a node id. nodeId parameter is REQUIRED. Use the fileKey parameter to specify the file key. fileKey parameter is REQUIRED. If a URL is provided, extract the file key and node id from the URL. For example, if given the URL https://figma.com/design/pqrs/ExampleFile?node-id=1-2 the extracted fileKey would be `pqrs` and the extracted nodeId would be `1:2`. If the URL does not include `node-id`, ask the user for a node-specific URL. Do not pass an empty or guessed nodeId. This tool is not supported for Figma Make Files (URLs containing `/make/`). By default this tool returns a short-lived URL to the screenshot plus curl instructions for downloading the PNG — the URL+curl path is strongly preferred because it uses far fewer tokens than embedding the image inline. The `enableBase64Response` parameter defaults to `false`. Only set `enableBase64Response: true` when the agent cannot fetch URLs (no shell access, no HTTP client, or a sandboxed environment that blocks outbound requests); when set, an inline base64 image entry is appended to the response in addition to the URL and curl instructions. If the URL is of the format https://figma.com/design/:fileKey/branch/:branchKey/:fileName then use the branchKey as the fileKey. */
    mcp__claude_ai_Figma__get_screenshot: {
      /** The ID of the node in the Figma document, eg. "123:456" or "123-456". This should be a valid node ID in the Figma document. Do not pass an empty string for node_id. */
      nodeId: string
      /** The key of the Figma file to use. If the URL is provided, extract the file key from the URL. The given URL must be in the format https://figma.com/design/:fileKey/:fileName?node-id=:int1-:int2. The extracted fileKey would be `:fileKey`. */
      fileKey: string
      /** When true, renders the node in isolation — floating/overlapping content (e.g. connectors parented to the page that visually sit above a section) is excluded. Defaults to false so screenshots match what the user sees on the canvas. Only set to true if the caller specifically needs the isolated render. */
      contentsOnly?: boolean
      /** When true, the response also includes the screenshot inline as a base64-encoded image entry, in addition to the short-lived URL and curl instructions. Defaults to false. Set to true ONLY if the agent cannot fetch URLs (no shell access, no HTTP client, or a sandboxed environment that blocks outbound requests) */
      enableBase64Response?: boolean
      /** Optional. Maximum pixel size of the longer edge of the rendered screenshot — the server scales the node so that max(width, height) ≤ maxDimension while preserving aspect ratio. Defaults to 1024. Must be a positive integer; values above 65536 are rejected. Increase when the agent will visually inspect fine detail; decrease for thumbnails or to save context. */
      maxDimension?: number
    }
    /** Reads a shader effect or shader fill from the account library by id (from list_shaders), returning its name, description, owner, type, version, and a manifest of its source files as { filename, bytes, uri }. Owner is the authenticated user's email for their shaders, or figma for first-party shaders. Read each file's contents from its uri as an MCP resource. Only set includeSource to true to add source to each file when the MCP client cannot read MCP resources. Pass an optional version (commit SHA) to read a specific build; defaults to the latest. */
    mcp__claude_ai_Figma__get_shader: {
      /** The id of the resource to read, taken from the matching list tool. */
      id: string
      /** Optional 40-character commit SHA. Defaults to the latest built version. */
      version?: string
      /** Include each file's source directly in the tool result, up to 100 files and 1,000,000 cumulative bytes. The result reports which limit caused truncation. Leave this false unless the MCP client cannot read MCP resources. */
      includeSource?: boolean
    }
    /** Get variable definitions for a given node id. E.g. {'icon/default/secondary': #949494}Variables are reusable values that can be applied to all kinds of design properties, such as fonts, colors, sizes and spacings. Use the nodeId parameter to specify a node id. Extract the node id from the URL, for example, if given the URL https://figma.com/design/:fileKey/:fileName?node-id=1-2, the extracted nodeId would be `1:2`. If the URL does not include `node-id`, ask the user for a node-specific URL. Do not pass an empty or guessed nodeId. This remote tool requires a concrete node target. This tool is not supported for Figma Make Files (URLs containing `/make/`). If the URL is of the format https://figma.com/design/:fileKey/branch/:branchKey/:fileName then use the branchKey as the fileKey. */
    mcp__claude_ai_Figma__get_variable_defs: {
      /** The ID of the node in the Figma document, eg. "123:456" or "123-456". This should be a valid node ID in the Figma document. Do not pass an empty string for node_id. */
      nodeId: string
      /** The key of the Figma file to use. If the URL is provided, extract the file key from the URL. The given URL must be in the format https://figma.com/design/:fileKey/:fileName?node-id=:int1-:int2. The extracted fileKey would be `:fileKey`. Only design files are supported: the URL must be a /design/ URL. /slides/, /board/, and /make/ URLs are not allowed. */
      fileKey: string
    }
    /** List every component and component set PUBLISHED to a Figma file's library, with the cross-component dependency graph needed to plan Code Connect in bulk. Only published components are returned (unpublished/local-only components are omitted). Returns one entry per component with its properties (exhaustive variant options, defaults, instance-swap preferred values), page and asset/library membership, child instance tags, instance count, and direct dependencies (each flagged internal vs. external library). Unlike get_context_for_code_connect — which returns the deep descendant tree for one known component — this returns the flat whole-file graph for dependency-ordered, batched template generation. Takes only a file key (no node id). Use the fileKey parameter to specify the file key. If a URL is provided, extract the file key from the URL, for example, if given the URL https://figma.com/design/:fileKey/:fileName, the extracted fileKey would be `:fileKey`. If the URL is of the format https://figma.com/design/:fileKey/branch/:branchKey/:fileName then use the branchKey as the fileKey. */
    mcp__claude_ai_Figma__list_file_components_for_code_connect: {
      /** The key of the Figma file to use. If the URL is provided, extract the file key from the URL. The given URL must be in the format https://figma.com/design/:fileKey/:fileName?node-id=:int1-:int2. The extracted fileKey would be `:fileKey`. */
      fileKey: string
    }
    /** Lists the shader effects and shader fills used in a Figma file. Returns each shader as { id, name, description, type, version, published, truncated, files }, where type is "effect" (post-effect that samples an input raster) or "fill" (generates pixels directly), published indicates whether the shader is a published library version, and files is a manifest of its authored source files as { filename, uri }. When truncated is true, the manifest hit its 10,000-file safety cap and is not exhaustive. The top-level truncated field is true when a referenced shader could not be returned, including when the file references more than the 100 returned shaders. Read each file's contents from its uri as an MCP resource (contents are not inlined here). Requires view access to the file. Use this to inspect shaders in a file you can open, including ones you do not own. Source reads are pinned to the exact shader version referenced by the file. */
    mcp__claude_ai_Figma__list_file_shaders: {
      /** The key of the Figma file to use. If the URL is provided, extract the file key from the URL. The given URL must be in the format https://figma.com/design/:fileKey/:fileName?node-id=:int1-:int2. The extracted fileKey would be `:fileKey`. */
      fileKey: string
    }
    /** Lists the generative plugins in the authenticated user's account library, including Figma's first-party plugins. Returns each plugin's id, name, description, and owner (plus a nextCursor when more pages exist). Owner is the authenticated user's email for their plugins, or a public publisher handle otherwise. Use the id with get_generative_plugin to read a plugin's source. Generative plugins are runnable tools that modify the canvas, distinct from shader effects and shader fills. */
    mcp__claude_ai_Figma__list_generative_plugins: {
      /** Pagination cursor returned as nextCursor by a previous call. Omit to fetch the first page. */
      cursor?: string
    }
    /** Lists the shader effects and shader fills in the authenticated user's account library. Returns each shader's id, name, description, owner, and type (effect or fill), plus a nextCursor when more pages exist. Owner is the authenticated user's email for their shaders, or figma for first-party shaders. Use the id with get_shader to read either shader type's source. */
    mcp__claude_ai_Figma__list_shaders: {
      /** Pagination cursor returned as nextCursor by a previous call. Omit to fetch the first page. */
      cursor?: string
    }
    /** Search for design system assets (components, variables, and styles). Returns matching assets from all design libraries. Use this when you need to find specific components, variables (e.g. colors, spacing tokens), or styles from design libraries. Pass `queries` as an array of objects, never strings. Each object must contain `entity` (`"component"`, `"variable"`, or `"style"`) and a string `query`. Example: `{"fileKey":"<file key>","queries":[{"entity":"component","query":"button"},{"entity":"variable","query":"surface"}]}`. Do not pass `{"queries":["button"]}`. Combine searches already required for the task in one call, without speculative terms, synonyms, variants, or checklist items. Results are returned in a `results` array in the same order as `queries`; each item repeats its `entity` and `query`. */
    mcp__claude_ai_Figma__search_design_system: {
      /** Array of search objects. Each entry must specify `entity` as exactly "component", "variable", or "style" (singular), and `query` as a string. Example: [{"entity":"component","query":"button"}]. Run multiple design-system searches in one call instead of issuing separate calls per term. Each entry must be an asset already identified as needed for the current task. Do not add speculative terms, generic checklists, synonyms, or naming variants to fill a batch. Use one batched call instead of parallel tool calls. Inspect results before deciding on a follow-up, and do not treat an empty result as a reason to try alternate terms. Results are returned in the same order as the entries. */
      queries: Array<{
        /** Required asset type for this entry: exactly "component", "variable", or "style" (singular). */
        entity: "component" | "variable" | "style"
        /** Text query describing one design-system asset of the specified entity type to find. Use a specific asset name or a short natural-language phrase. Multi-word names and phrases are allowed. Each query MUST express exactly one search intent. You MUST NOT combine alternatives, synonyms, or unrelated searches in one query; this tool does NOT apply OR semantics. */
        query: string
      }>
      /** The file key for context */
      fileKey: string
      /** Whether to disable Code Connect for search results. */
      disableCodeConnect?: boolean
      /** Optional list of library keys to restrict the search to. When provided, only results from these libraries are returned. Library keys are returned in previous search results. */
      includeLibraryKeys?: string[]
    }
    /** Save multiple Code Connect mappings in bulk. Use after get_code_connect_suggestions to confirm and save approved mappings. Use the nodeId parameter to specify a node id. Use the fileKey parameter to specify the file key. If a URL is provided, extract the node id and file key from the URL, for example, if given the URL https://figma.com/design/:fileKey/:fileName?node-id=1-2, the extracted nodeId would be `1:2` and the fileKey would be `:fileKey`. If the URL does not include `node-id`, ask the user for a node-specific URL. Do not pass an empty or guessed nodeId. */
    mcp__claude_ai_Figma__send_code_connect_mappings: {
      /** The ID of the node in the Figma document, eg. "123:456" or "123-456". This should be a valid node ID in the Figma document. Do not pass an empty string for node_id. */
      nodeId: string
      /** The key of the Figma file to use. If the URL is provided, extract the file key from the URL. The given URL must be in the format https://figma.com/design/:fileKey/:fileName?node-id=:int1-:int2. The extracted fileKey would be `:fileKey`. */
      fileKey: string
      /** A comma separated list of programming languages used by the client in the current context in string form, e.g. `javascript`, `html,css,typescript`, etc. If you do not know, please list `unknown`. This is used for logging purposes to understand which languages are being used. If you are unsure, it is better to list `unknown` than to make a guess. */
      clientLanguages?: string
      /** A comma separated list of frameworks used by the client in the current context, e.g. `react`, `vue`, `django` etc. If you do not know, please list `unknown`. This is used for logging purposes to understand which frameworks are being used. If you are unsure, it is better to list `unknown` than to make a guess */
      clientFrameworks?: string
      mappings: Array<{
        /** The Figma node identifier */
        nodeId: string
        /** The component name, e.g. "Button/Primary" */
        componentName: string
        /** The path to the component in the codebase */
        source: string
        /** The framework or language label for this Code Connect mapping */
        label: "React" | "Web Components" | "Vue" | "Svelte" | "Storybook" | "Javascript" | "Swift" | "Swift UIKit" | "Objective-C UIKit" | "SwiftUI" | "Compose" | "Java" | "Kotlin" | "Android XML Layout" | "Flutter" | "Markdown"
        /** The executable JS template code for a Code Connect template. When provided, creates a figmadoc-type record (full template) instead of a component_browser mapping (simple mapping). */
        template?: string
        /** JSON string of template metadata. May include isParserless (boolean), imports, nestable, props fields. If omitted when template is provided, defaults to {}. */
        templateDataJson?: string
      }>
    }
    /** You MUST load the figma-generative-plugins skill before calling this tool. If it is not installed, read skill://figma/figma-generative-plugins/SKILL.md with resources/read or get_figma_skill. Use this when the user asks to update, revise, or republish an existing Figma plugin, generative plugin, or custom tool in their account library. Updates an existing generative plugin in the authenticated user's account library. Provide the plugin id, existing authored files to replace, optional name and description metadata, and a required Git commit message describing the change. The update is built, versioned, and deployed; record the new version when the response includes it. Use create_generative_plugin first when no plugin exists. */
    mcp__claude_ai_Figma__update_generative_plugin: {
      /** The id of the existing resource to update. */
      id: string
      /** Existing entrypoint or UI files to replace. New files cannot be created and unspecified files are preserved. */
      files?: Array<{
        /** Path of an existing file relative to the authored resource directory, such as code.ts or ui.html. */
        path: "code.ts" | "ui.html"
        /** Complete replacement content for the file. */
        content: string
      }>
      metadata?: {
        /** New display name for the resource. */
        name?: string
        /** New one-line description for the resource. */
        description?: string
      }
      /** Required Git commit message describing this update. */
      commitMessage: string
    }
    /** You MUST load the figma-shaders skill before calling this tool. If it is not installed, read skill://figma/figma-shaders/SKILL.md with resources/read or get_figma_skill. Use this when the user asks to update, revise, or republish an existing Figma shader, shader effect, shader fill, custom effect, custom fill, or procedural shader. Updates an existing shader effect or fill in the authenticated user's account library. Provide its id, matching kind, existing authored files to replace, optional name, description, animation, and mouse metadata, and a required Git commit message describing the change. The update is built, versioned, and deployed; the response includes the new version. Use create_shader first when no shader exists. */
    mcp__claude_ai_Figma__update_shader: {
      /** The id of the existing resource to update. */
      id: string
      /** Existing main.ts to replace. New files cannot be created. */
      files?: Array<{
        /** The existing shader entrypoint path. */
        path: "main.ts"
        /** Complete replacement content for main.ts. */
        content: string
      }>
      metadata?: {
        /** New display name for the shader. */
        name?: string
        /** New one-line description for the shader. */
        description?: string
        /** Whether the shader renders over time. */
        isAnimated?: boolean
        /** Whether the shader reads the mouse position. */
        usesMouse?: boolean
      }
      /** Required Git commit message describing this update. */
      commitMessage: string
      /** The existing shader kind. It must match the resource identified by id. */
      kind: "effect" | "fill"
    }
    /** Upload assets (images and SVGs) into a Figma file. Call with a "count" to get that many single-use upload URLs. POST raw asset bytes to each URL with the correct Content-Type header (e.g. image/png, image/jpeg, image/svg+xml). Each upload URL handles storage, BlobStore commit, and canvas placement automatically. Use nodeIds to set raster images as fills on corresponding existing nodes; its order matches the returned upload URLs. Returned upload entries include targetNodeId when a target was provided. Without a target node, creates new frames with image fills on currentPageId when provided, otherwise on the current page. SVGs (image/svg+xml) are imported as editable vector node trees on that page; nodeIds and scaleMode do not apply to SVGs. Supports PNG, JPG, GIF, WebP, and SVG. Max 10MB per asset. Works on Figma design files (URL path `/design/`), FigJam boards (`/board/`), and Figma Slides (`/slides/`). Request at most 60 upload URLs per call, then POST to every returned URL before calling upload_assets again. Repeat until all assets have been uploaded. */
    mcp__claude_ai_Figma__upload_assets: {
      /** The key of the Figma file to use. If the URL is provided, extract the file key from the URL. The given URL must be in the format https://figma.com/design/:fileKey/:fileName?node-id=:int1-:int2. The extracted fileKey would be `:fileKey`. */
      fileKey: string
      /** The GUID of the page to target. Always pass this when available. Use the page the user is currently viewing unless the request explicitly refers to a different page. */
      currentPageId?: string
      /** Number of assets to upload. Returns that many single-use upload URLs. POST raw asset bytes to each URL with the correct Content-Type header (e.g. image/png, image/jpeg); the URLs can be POSTed in parallel. By default, each upload URL handles storage, BlobStore commit, and canvas placement automatically. */
      count?: number
      /** Optional. Set to true only if you can call the returned commitUrl exactly once after all uploads complete. When enabled server-side, this commits and places all assets in one file operation. If omitted, each upload URL commits and places its asset automatically. */
      batchCommit?: boolean
      /** Deprecated: use nodeIds instead. If provided, sets the uploaded raster image as a fill on this existing node. Can only be used when count is 1. Ignored for SVGs, which are imported as vector node trees. */
      nodeId?: string
      /** Optional target node IDs, one per upload URL in the same order. Each uploaded raster image is set as a fill on its corresponding existing node. The array length must equal count. Cannot be combined with nodeId. Ignored for SVGs, which are imported as vector node trees. */
      nodeIds?: string[]
      /** How a raster image fills the node. Default: FILL. Ignored for SVGs. */
      scaleMode?: "FILL" | "FIT" | "TILE"
    }
    /** Create, edit, generate, or sync any design in Figma — UIs, screens, mockups, components, frames, variables, styles, text, images, layouts, and design systems. This general-purpose tool writes to Figma with JavaScript via the Figma Plugin API. Works on Figma design files (URL path `/design/`), FigJam boards (`/board/`), and Figma Slides (`/slides/`). IMPORTANT: Before calling this tool, load figma-use guidance — prefer the /figma-use skill if available, otherwise read the skill://figma/figma-use/SKILL.md MCP resource if available. Skipping this causes common, hard-to-debug failures. Use this tool when the user wants to: - Create or generate a Figma design, screen, UI, or mockup from scratch, intent, or code - Update, edit, or sync an existing Figma design - Generate or sync Figma designs from source code - Set up or modify design tokens, variables, or styles - Build or extend a design system or component/variant library - Fix layout, spacing, auto-layout, or fill/hug issues - Add component descriptions, annotations and Code Connect metadata to nodes - Review or fix accessibility, contrast, typography, or visual polish - Inspect or query node properties programmatically CHOOSING BETWEEN use_figma AND generate_figma_design: - Default to use_figma for all write operations - Exception: generate_figma_design ONLY to capture a web app page/view for the first time. For web apps, run both in parallel — generate_figma_design captures a pixel-perfect screenshot, use_figma builds from imported design system components and refines against the screenshot - Non-web (iOS, Android, generic UI) and from-scratch designs: use_figma only - Updating/syncing a Figma page already captured: use_figma — even if source code changed GOTCHAS - For the font "Inter", the style is "Semi Bold", not "SemiBold" and "Extra Bold" not "ExtraBold" - MUST use `await figma.setCurrentPageAsync(page)` to change pages. Setting figma.currentPage is not supported - MUST NEVER use loadAllPagesAsync,setPluginData,createImageAsync. They are not supported API */
    mcp__claude_ai_Figma__use_figma: {
      /** The key of the Figma file to use. If the URL is provided, extract the file key from the URL. The given URL must be in the format https://figma.com/design/:fileKey/:fileName?node-id=:int1-:int2. The extracted fileKey would be `:fileKey`. */
      fileKey: string
      /** JavaScript code to execute. Has access to the `figma` global (Figma Plugin API) */
      code: string
      /** A concise description of what the code aims to do */
      description: string
      /** A comma-separated list of Figma skill names being followed, if any (e.g. "figma-use", "figma-use,figma-generate-design"). Only pass this when explicitly instructed to by skill documentation. Used for logging purposes. If the skill was loaded via a skill-content MCP resource, prefix the skill name with "resource:". (e.g. "resource:figma-use", "resource:figma-use,resource:figma-generate-design") */
      skillNames?: string
    }
    /** Cancels one or more in-progress runs of a Weave tool (a published Weave workflow). Pass the `recipeId` of the tool and, optionally, the `runIds` to cancel (from weave_run_tool); omit `runIds` to cancel all of the user's currently running runs for that tool. Use this to stop a run the user no longer wants. Cancellation cannot be undone. */
    mcp__claude_ai_Figma__weave_cancel_tool_run: {
      /** The id of the Weave tool whose runs to cancel (from weave_list_tools). */
      recipeId: string
      /** The run ids to cancel (from weave_run_tool). Omit to cancel all of the user's currently running runs for this tool. */
      runIds?: string[]
    }
    /** Finds a Weave AI model by name so it can be run directly with weave_run_model — no Weave tool needed. Use this when the user names a model ("run nano banana 2 on this image", "make a video with veo 3"). A model is not a Weave tool: for a published Weave workflow use weave_list_tools and weave_run_tool instead. Returns the model with an approximate cost and the contract to run it with — its inputs and tunable params, each with a type, whether it is required, and any allowed values — or a short list of candidates to choose between when the name matches more than one model. */
    mcp__claude_ai_Figma__weave_find_model: {
      /** The model name as the user said it ("nano banana 2", "veo 3"). */
      query: string
    }
    /** Gets the output and status of Weave model runs started with weave_run_model. Pass the `predictionIds` those calls returned. This is for model runs only — for a run of a Weave tool (a published Weave workflow) use weave_get_tool_run_output instead. Poll this after weave_run_model to track progress and read the output. The response also includes curl instructions for downloading the outputs — the URL+curl path is strongly preferred because it uses far fewer tokens than embedding media inline. */
    mcp__claude_ai_Figma__weave_get_model_run_output: {
      /** The prediction ids to fetch output for, as returned by weave_run_model. */
      predictionIds: string[]
    }
    /** Gets the input contract of a Weave tool (a published Weave workflow) — the inputs you fill in to run it. Pass the `recipeId` (from weave_list_tools, or the `<id>` in a pasted Weave URL like app.weavy.ai/tool/<id> or app.weavy.ai/flow/<id> — that `<id>` is the recipeId). A pasted Weave URL is enough to inspect and run the tool right here — do not open a browser or use browser automation for Weave. Call this before weave_run_tool to learn what to send. Returns the tool `version` (pass it back to weave_run_tool), an `outputs` summary (what the tool produces), and a flat `inputs` list. Each input has a `nodeId` (the key you send in weave_run_tool), `name`, `type` (text, integer, boolean, select, seed, image, video, audio, 3D, color, or any), `default` (its current value), and `required` (true only when there is no current value, so you must provide one), plus `options` (for `select`), `range`, `isIterator`, and `description`. */
    mcp__claude_ai_Figma__weave_get_tool_inputs: {
      /** The id of the Weave tool whose input contract to fetch — from weave_list_tools, or the `<id>` in a pasted Weave URL (app.weavy.ai/tool/<id> or app.weavy.ai/flow/<id>), which is the recipeId. */
      recipeId: string
      /** Tool version to inspect; omit for the latest. */
      version?: number
    }
    /** Gets the output and status of runs of a Weave tool (a published Weave workflow). Pass the `recipeId` of the tool and the `runIds` returned by weave_run_tool; omit `runIds` to get the tool's most recent run. Returns each run's status (RUNNING, COMPLETED, FAILED, or CANCELED), progress, any error, and — when complete — a link to every output the run produced. Poll this after running a tool to track progress and read its output. Each output is a JSON entry with a `url`, its `type` (e.g. image, video), and, when known, `width`/`height`/`format`. The response also includes curl instructions for downloading the outputs — the URL+curl path is strongly preferred because it uses far fewer tokens than embedding media inline. */
    mcp__claude_ai_Figma__weave_get_tool_run_output: {
      /** The id of the Weave tool whose runs to fetch (from weave_list_tools). */
      recipeId: string
      /** The run ids to fetch output for, as returned by weave_run_tool. Omit to use the tool's most recent run (the latest in-flight run, or the latest completed run's output if none are in flight). */
      runIds?: string[]
    }
    /** Lists the Weave tools the authenticated user can run — published Weave workflows — in their active Weave workspace: their own, those shared with the workspace, and those shared with them directly. Here "tool" means a Weave tool (a published Weave workflow), not an agent/MCP tool. Use this when the user wants to see, browse, or choose from the Weave tools available to them. Returns the most recently updated tools and the total number available, each with its name, who created it, when it was last updated, and a link to open it in Weave. If the user already pasted a specific Weave URL (app.weavy.ai/tool/<id> or app.weavy.ai/flow/<id>), you already have its recipeId — that `<id>` — so skip this and go straight to weave_get_tool_inputs/weave_run_tool instead of opening a browser. */
    mcp__claude_ai_Figma__weave_list_tools: {
      /** Case-insensitive substring matched against tool names, to look up a tool the user named. */
      search?: string
    }
    /** Runs a Weave AI model directly — no Weave tool needed — and returns a prediction id; poll it with weave_get_model_run_output. Call weave_find_model first for the model `id` and its `contract`. Running spends the user's Weave credits, so it is gated: a call without `acknowledgedCost` only quotes and spends nothing, returning `inputs_required` or `cost_confirmation_required` with instructions to follow. Always show the user the cost and get an explicit Approve/Cancel (a structured prompt, not free text) before echoing `acknowledgedCost` to run — every run, including reruns. Ask the user for any input you don't have; never invent one. */
    mcp__claude_ai_Figma__weave_run_model: {
      /** The model's `id` from weave_find_model. */
      id: string
      /** The values to run with, keyed by the names in weave_find_model's `contract` — its `inputs` and `params` together, as one flat object. Send an array only for a field that declares `maxItems`; a field without one takes a single value. */
      input: {}
      /** The `cost` this tool quoted in its `cost_confirmation_required` response, echoed back after the user approves, to confirm the spend and run. Omit it on the first call. */
      acknowledgedCost?: number
    }
    /** Runs a Weave tool (a published Weave workflow) and returns run ids; poll them with weave_get_tool_run_output. A pasted Weave URL (app.weavy.ai/tool/<id> or app.weavy.ai/flow/<id>) is enough — never open a browser or use browser automation for Weave. Call weave_get_tool_inputs first to learn the inputs. Running spends the user's Weave credits, so it is gated: a call without `acknowledgedCost` only quotes and spends nothing, returning `status: "inputs_required"` or `cost_confirmation_required` with instructions to follow. Always show the user the cost and get an explicit Approve/Cancel (a structured prompt, not free text) before echoing `acknowledgedCost` to run — every run, including reruns — and confirm any auto-filled inputs (values you did not set that the run will use). Include the response's `costDisclosure` string as its own sentence after the question, not folded into it, the first time you quote a cost in a conversation; omit it after that. For an image/video input, pass a reachable https URL directly; only upload a local file with weave_upload_asset and pass the asset object it returns. If the user wants an input you did not get from weave_get_tool_inputs, do not omit it or fold it into another input like the prompt — re-fetch weave_get_tool_inputs (its inputs can change) and set it. For a local file, just call weave_upload_asset — it shows the user a file picker; never ask them for a path. */
    mcp__claude_ai_Figma__weave_run_tool: {
      /** The id of the Weave tool to run — from weave_list_tools, or the `<id>` in a pasted Weave URL (app.weavy.ai/tool/<id> or app.weavy.ai/flow/<id>), which is the recipeId. */
      recipeId: string
      /** The tool `version` from weave_get_tool_inputs; omit to run the latest. */
      version?: number
      /** Values for the inputs you want to set. Omit an input to keep its current value. */
      inputs?: Array<{
        /** The input's `nodeId` from weave_get_tool_inputs. */
        nodeId: string
        /** The value for this input, in the shape for its `type` (from weave_get_tool_inputs): text→string, integer→number, boolean→true/false, select→one of its `options`, seed→a number (or omit this input for random), image/video→a reachable https URL, color→a hex string like "#RRGGBB" (or a list of them), an iterator→an array of values (runs once per item). */
        value?: unknown
      }>
      /** How many times to run the tool (1–10). */
      numberOfRuns?: number
      /** The credit `cost` the tool quoted in its `cost_confirmation_required` response, echoed back after the user approves to confirm the spend and run. For a dynamic-cost tool (the response had `isDynamicCost: true` and `cost: null`), pass `-1` to confirm a variable charge. */
      acknowledgedCost?: number
    }
    /** Shows the user an in-chat file-picker widget to select a local image, video, audio, or 3D file, which uploads to Weave from their browser. Call it with no arguments; the uploaded asset is sent back to you automatically. If the user already gave you a reachable https URL, pass that directly to weave_run_tool instead. */
    mcp__claude_ai_Figma__weave_upload_asset: {}
    /** Returns the authenticated user's handle, email, all the plans the user belongs to (and the ID for each plan) and their seats on those plans. You MUST use this tool if you are experiencing file access/permission issues or are being rate limited by the Figma MCP to help debug the issue. */
    mcp__claude_ai_Figma__whoami: {}
    /** Prefer `trash_message` or `mark_message_spam` instead. Adds a sensitive label (Trash or Spam) to a single message in the authenticated user's Gmail account. Use `apply_sensitive_message_label` when applying Trash or Spam to exactly 1 message. To apply sensitive labels to multiple messages, use `batch_apply_sensitive_message_labels` instead. If the message belongs to a thread that should be labeled as a whole, prefer `trash_thread` or `mark_thread_spam`. To find the message ID, use tools like `search_threads` or `get_thread`. To find the draft message ID, use tools like `list_drafts`. */
    mcp__claude_ai_Gmail__apply_sensitive_message_label: {
      /** Required. The sensitive label option to add. */
      labelOption: "LABEL_OPTION_UNSPECIFIED" | "TRASH" | "SPAM"
      /** Required. The ID of the message to add the label to. */
      messageId: string
    }
    /** Prefer `trash_thread` or `mark_thread_spam` instead. Adds a sensitive label (Trash or Spam) to a single thread in the authenticated user's Gmail account. This operation affects all messages currently in the thread. Use `apply_sensitive_thread_label` when applying Trash or Spam to exactly 1 thread. To apply sensitive labels to multiple threads, use `batch_apply_sensitive_thread_labels` instead. To find the thread ID, use the `search_threads` tool first. */
    mcp__claude_ai_Gmail__apply_sensitive_thread_label: {
      /** Required. The sensitive label option to add. */
      labelOption: "LABEL_OPTION_UNSPECIFIED" | "TRASH" | "SPAM"
      /** Required. The ID of the thread to add the label to. */
      threadId: string
    }
    /** Creates a new draft email in the authenticated user's Gmail account. This tool takes recipient addresses (`to`, `cc`, `bcc`), a `subject`, and body content as inputs. Plain text body content can be provided in `body` (do NOT format `body` with Markdown), and rich-text HTML content can be provided in `htmlBody` (use valid HTML tags for formatting; if both are provided, `body` serves as the plain-text alternative). If the draft is created as a reply to an existing message, the ID of the original message should be passed to the tool in the `replyToMessageId` field. Returns a Draft object with the `id`, `threadId`, and `viewUrl` fields populated. */
    mcp__claude_ai_Gmail__create_draft: {
      /** Optional. The attachments to include in the email. The combined size of attachments in the message cannot exceed 25MB. If you need to send files larger than 25MB, upload the file to Drive first and then insert the Drive link into `body` or `html_body`. */
      attachments?: Array<unknown /* $ref #/$defs/Attachment */>
      /** Optional. The blind carbon copy recipients of the email draft. Each string MUST be a valid plain email address (e.g., "user@example.com"). */
      bcc?: string[]
      /** Optional. The plain text body content of the email draft. Do NOT format this field with Markdown (such as headers `#`, bold `**`, bullet points `*`, or tables `|`). If formatted rich text is desired, use `html_body` instead. If `html_body` is also provided, this field is treated as the plain-text alternative. */
      body?: string
      /** Optional. The carbon copy recipients of the email draft. Each string MUST be a valid plain email address (e.g., "user@example.com"). */
      cc?: string[]
      /** Optional. The HTML content of the email draft. If provided, this will be used as the rich-text version of the email. Use this field (with valid HTML tags such as ` `, ` */
      htmlBody?: string
      /** Optional. The ID of the message to reply to. If provided, this will be used as the reply-to message ID for the email draft, and the `body` and `html_body` will be appended to the original message body. */
      replyToMessageId?: string
      /** Optional. The subject line of the email. Defaults to empty if not provided. */
      subject?: string
      /** Optional. The primary recipients of the email draft. Each string MUST be a valid plain email address (e.g., "user@example.com"). */
      to?: string[]
    }
    /** Creates a new label in the authenticated user's Gmail account. Supports creating nested labels (sub-labels) using a forward slash (e.g., 'Projects/Alpha/Sprint-1'). By default, parent labels will be automatically created if they do not exist. */
    mcp__claude_ai_Gmail__create_label: {
      /** Optional. Whether to automatically create parent labels for nested labels (separated by `/`). Defaults to `true`. When set to `true`, missing parent labels in the hierarchy (e.g., `Projects` and `Projects/Alpha` for `Projects/Alpha/Sprint-1`) are created automatically. When set to `false`, parent label auto-creation is disabled. */
      autoCreateParentLabels?: boolean
      /** Deprecated: Do not use. Use `color_preset` instead. Legacy field for raw text and background color hex strings. */
      color?: unknown /* $ref #/$defs/LabelColor */
      /** Optional. The color preset tile to assign to the new label. Select from predefined contrast-safe color options (e.g., LABEL_COLOR_PRESET_RED, LABEL_COLOR_PRESET_BLUE, LABEL_COLOR_PRESET_BLACK, LABEL_COLOR_PRESET_GREEN). If omitted, default label styling is applied. */
      colorPreset?: "LABEL_COLOR_PRESET_UNSPECIFIED" | "LABEL_COLOR_PRESET_BLACK" | "LABEL_COLOR_PRESET_DARK_GRAY" | "LABEL_COLOR_PRESET_GRAY" | "LABEL_COLOR_PRESET_LIGHT_GRAY" | "LABEL_COLOR_PRESET_WHITE" | "LABEL_COLOR_PRESET_RED" | "LABEL_COLOR_PRESET_ORANGE" | "LABEL_COLOR_PRESET_YELLOW" | "LABEL_COLOR_PRESET_GREEN" | "LABEL_COLOR_PRESET_MINT" | "LABEL_COLOR_PRESET_TEAL" | "LABEL_COLOR_PRESET_BLUE" | "LABEL_COLOR_PRESET_PURPLE" | "LABEL_COLOR_PRESET_PINK" | "LABEL_COLOR_PRESET_DARK_RED" | "LABEL_COLOR_PRESET_DARK_ORANGE" | "LABEL_COLOR_PRESET_DARK_GREEN" | "LABEL_COLOR_PRESET_DARK_BLUE" | "LABEL_COLOR_PRESET_DARK_PURPLE" | "LABEL_COLOR_PRESET_DARK_PINK" | "LABEL_COLOR_PRESET_BROWN"
      /** Required. The display name of the label to create. Supports nested label hierarchy using `/` (e.g., `Projects/Alpha/Sprint-1`). */
      displayName: string
      /** Optional. The visibility of the label in the label list in the Gmail web interface. Defaults to `LABEL_SHOW`. */
      labelListVisibility?: "LABEL_LIST_VISIBILITY_UNSPECIFIED" | "LABEL_SHOW" | "LABEL_SHOW_IF_UNREAD" | "LABEL_HIDE"
      /** Optional. The visibility of messages with this label in the message list in the Gmail web interface. Defaults to `SHOW`. */
      messageListVisibility?: "MESSAGE_LIST_VISIBILITY_UNSPECIFIED" | "SHOW" | "HIDE"
    }
    /** Deletes a draft email in the authenticated user's Gmail account using its draft ID. */
    mcp__claude_ai_Gmail__delete_draft: {
      /** Required. The unique identifier of the draft to delete. */
      draftId: string
    }
    /** Deletes a label in the authenticated user's Gmail account. */
    mcp__claude_ai_Gmail__delete_label: {
      /** Required. The ID of the label to delete. */
      labelId: string
    }
    /** Forwards a specific email message in the authenticated user's Gmail account. Optional comments can be added before the forwarded message using `forwardText` for plain text (do NOT format with Markdown) or `htmlBody` for rich HTML. Returns a Message object with the `id`, `threadId`, and `labelIds` fields populated. */
    mcp__claude_ai_Gmail__forward: {
      /** Optional. The blind carbon copy recipients of the email. Each string MUST be a valid plain email address (e.g., "user@example.com"). */
      bcc?: string[]
      /** Optional. The carbon copy recipients of the email. Each string MUST be a valid plain email address (e.g., "user@example.com"). */
      cc?: string[]
      /** Optional. Plain text comments to add before the forwarded message. Do NOT format this field with Markdown (such as headers `#`, bold `**`, bullet points `*`, or tables `|`). If formatted rich text is desired, use `html_body` instead. If `html_body` is also provided, this field is treated as the plain-text alternative. */
      forwardText?: string
      /** Optional. The HTML content of the comments to add before the forwarded message. If provided, this will be used as the rich-text version of the forward comments. Use this field (with valid HTML tags such as ` `, ` */
      htmlBody?: string
      /** Required. The unique identifier of the message to forward. A specific `message_id` is required to forward, which can be obtained by retrieving the thread via `get_thread`. */
      messageId: string
      /** Optional. The primary recipients of the email. Each string MUST be a valid plain email address (e.g., "user@example.com"). */
      to?: string[]
    }
    /** Retrieves a specific draft email from the authenticated user's Gmail account by ID, including its `viewUrl` for viewing and editing in the Gmail Web UI. The optional `messageFormat` parameter controls the format of the draft returned. Use `MINIMAL` to return snippet and key headers, `METADATA_ONLY` to exclude snippet, subject, and body, `FULL_CONTENT` for the complete draft, or `RAW` for the raw MIME message content. */
    mcp__claude_ai_Gmail__get_draft: {
      /** Required. The unique identifier of the draft to fetch. */
      draftId: string
      /** Optional. Specifies the format of the draft returned. Defaults to `FULL_CONTENT`. */
      messageFormat?: "MESSAGE_FORMAT_UNSPECIFIED" | "MINIMAL" | "FULL_CONTENT" | "METADATA_ONLY" | "PLAIN_TEXT" | "RAW"
    }
    /** Retrieves a specific email message from the authenticated user's Gmail account by its unique message ID, including its `viewUrl`. Use this tool to inspect a single, individual email when you already know its message ID. If the user wants to read a specific email in detail, check the exact wording of a message, or examine attachment metadata for a single email, this is the right tool. It is not suitable for retrieving entire conversations or viewing back-and-forth discussion threads; use the 'get_thread' tool instead. Note: This tool does not support retrieving draft messages. To view drafts, use the 'list_drafts' tool instead. Key indicators include if the user asks for the full content of a specific message ID returned by a previous search, or if the query asks to inspect a specific individual email rather than an entire thread. Example user prompts are: "Get the full text of message ID 18f123456789abcd.", "Read the latest message in that thread from Alice.", and "What are the attachment names in the email I just received from HR?" The optional `messageFormat` parameter controls the format of the message returned. By default (or with `FULL_CONTENT`), it returns the full content of the message. We recommend using `PLAIN_TEXT`, which returns the plain text body without the HTML body. Use `MINIMAL` to include only subject and snippet (excluding body). Use `METADATA_ONLY` to include only basic metadata (message ID, thread ID, viewUrl, labels, timestamp, and size estimate). */
    mcp__claude_ai_Gmail__get_message: {
      /** Optional. Specifies the format of the message returned. Defaults to `FULL_CONTENT`. We recommend using `PLAIN_TEXT` to prevent context exhaustion. */
      messageFormat?: "MESSAGE_FORMAT_UNSPECIFIED" | "MINIMAL" | "FULL_CONTENT" | "METADATA_ONLY" | "PLAIN_TEXT" | "RAW"
      /** Required. The unique identifier of the message to fetch. */
      messageId: string
    }
    /** Retrieves a specific email thread from the authenticated user's Gmail account, including its `viewUrl` and a list of its messages (each with their own `viewUrl`). Note: This tool does not support retrieving drafts. Any draft messages within a thread are omitted. To view drafts, use the `list_drafts` tool instead. The optional `messageFormat` parameter controls the format of the messages returned. By default (or with `FULL_CONTENT`), it returns the full content of messages. We recommend using `PLAIN_TEXT`, which returns the plain text body without the HTML body. Use `MINIMAL` to include only subject and snippet (excluding body). Use `METADATA_ONLY` to include only basic metadata (message ID, thread ID, viewUrl, labels, timestamp, and size estimate). */
    mcp__claude_ai_Gmail__get_thread: {
      /** Optional. Specifies the format of the messages returned within the thread. Defaults to `FULL_CONTENT`. We recommend using `PLAIN_TEXT` to prevent context exhaustion. Note: `MINIMAL` format returns `id`, `snippet`, `subject`, `sender`, `to_recipients`, `cc_recipients`, `bcc_recipients`, `date`, `label_ids`. `METADATA_ONLY` format returns `id`, `sender`, `to_recipients`, `cc_recipients`, `bcc_recipients`, `date`, `label_ids`. `FULL_CONTENT` returns `id`, `snippet`, `subject`, `sender`, `to_recipients`, `cc_recipients`, `bcc_recipients`, `date`, `label_ids`, `attachment_ids`, `plaintext_body`, `html_body`, `attachments`. `PLAIN_TEXT` returns `id`, `snippet`, `subject`, `sender`, `to_recipients`, `cc_recipients`, `bcc_recipients`, `date`, `label_ids`, `attachment_ids`, `plaintext_body`, `attachments` (without `html_body`). `RAW` format is not supported here. */
      messageFormat?: "MESSAGE_FORMAT_UNSPECIFIED" | "MINIMAL" | "FULL_CONTENT" | "METADATA_ONLY" | "PLAIN_TEXT" | "RAW"
      /** Required. The unique identifier of the thread to fetch. */
      threadId: string
    }
    /** Adds one or more labels to a specific message in the authenticated user's Gmail account. To find the message ID, use tools like `search_threads` or `get_thread`. If unsure of a user label's ID, use the `list_labels` tool first to discover available labels and their IDs. To move a specific message to Trash or mark it as Spam, please use the `trash_message` or `mark_message_spam` tool instead. */
    mcp__claude_ai_Gmail__label_message: {
      /** Required. The IDs of the labels to add. Can be a system label ID (e.g., `INBOX`, `STARRED`, `UNREAD`, `IMPORTANT`) or a user-defined label ID. The tool accepts `label_ids` and not label names. Use the `list_labels` tool to get the corresponding label id to a display name for user-defined labels. */
      labelIds: string[]
      /** Required. The ID of the message to add the labels to. */
      messageId: string
    }
    /** Adds labels to an entire thread in the authenticated user's Gmail account. This operation affects all messages currently in the thread and any future messages added to it. If unsure of the thread ID, use the `search_threads` tool first. If unsure of a user label's ID, use the `list_labels` tool first to discover available labels and their IDs. To move a thread to Trash or mark it as Spam, please use the `trash_thread` or `mark_thread_spam` tool instead. */
    mcp__claude_ai_Gmail__label_thread: {
      /** Required. The unique identifiers of the labels to add. Can be a system label ID (e.g., `INBOX`, `STARRED`, `UNREAD`, `IMPORTANT`) or a user-defined label ID. The tool accepts `label_ids` and not label names. Use the `list_labels` tool to get the corresponding label id to a display name for user-defined labels. */
      labelIds: string[]
      /** Required. The unique identifier of the thread to add labels to. */
      threadId: string
    }
    /** Lists draft emails from the authenticated user's Gmail account. This tool can filter drafts based on a query string and supports pagination. It returns a list of drafts, including their IDs, subjects (unless `view` is set to `DRAFT_VIEW_METADATA_ONLY`), and `viewUrl`. `page_token` can be used to paginate the results. To retrieve subsequent pages of results, use the `page_token` returned in the previous response. The `view` parameter controls which fields are populated in the response. By default (or with `DRAFT_VIEW_FULL`), it returns full content. Use `DRAFT_VIEW_METADATA_ONLY` to exclude sensitive content like subject and body. Note: An empty JSON object `{}` represents zero matching items, not an error. */
    mcp__claude_ai_Gmail__list_drafts: {
      /** Optional. The maximum number of drafts to return. If unspecified, defaults to 20. The maximum allowed value is 50. */
      pageSize?: number
      /** Optional. A token received from a previous `list_drafts` call to retrieve the next page of results. Leave empty to fetch the first page. This is primarily used for pagination to continue fetching results from where the previous `ListDraft` call left off, especially when the number of drafts matching the query exceeds the `page_size` limit. */
      pageToken?: string
      /** Examples: - `subject:OneMCP Update` - `from:gduser1@workspacesamples.dev` - `to:gduser2@workspacesamples.dev AND newer_than:7d` - `project proposal has:attachment` - `is:unread` A space or a dash (`-`) will separate a number while a dot (`.`) will be a decimal. For example, `01.2047-100` is considered two numbers: `01.2047` and `100`. Note: If we want to ensure all drafts for the query are returned, we can paginate the results by making repeated calls to the tool until the response contains an empty list of drafts. */
      query?: string
      /** Optional. Controls the fields populated for drafts in the draft list. Defaults to returning metadata only (`id`, `thread_id`, `to_recipients`, `cc_recipients`, `bcc_recipients`, `date`). Set to `DRAFT_VIEW_FULL` to include `subject` and `plaintext_body` content. */
      view?: "DRAFT_VIEW_UNSPECIFIED" | "DRAFT_VIEW_METADATA_ONLY" | "DRAFT_VIEW_FULL"
    }
    /** Lists all labels available in the authenticated user's Gmail account. Use this tool to discover the `id` of a label before calling `label_thread`, `unlabel_thread`, `label_message`, or `unlabel_message`. Note: the system labels, `DRAFT` and `SENT`, cannot be set on messages and are read only. Note: An empty JSON object `{}` represents zero matching items, not an error. */
    mcp__claude_ai_Gmail__list_labels: {}
    /** Marks a specific message as Spam in the authenticated user's Gmail account. To find the message ID, use tools like `search_threads` or `get_thread`. */
    mcp__claude_ai_Gmail__mark_message_spam: {
      /** Required. The ID of the message to mark as Spam. */
      messageId: string
    }
    /** Marks an entire thread as Spam in the authenticated user's Gmail account. This operation affects all messages currently in the thread. Use `mark_thread_spam` when marking a thread as spam, even if it currently contains only 1 message. Marking spam at the thread level ensures all current messages in the thread are marked as Spam. If unsure of the thread ID, use the `search_threads` tool first. */
    mcp__claude_ai_Gmail__mark_thread_spam: {
      /** Required. The ID of the thread to mark as Spam. */
      threadId: string
    }
    /** Replies to a specific email message in the authenticated user's Gmail account. Supports replying to only the sender or to all recipients (reply-all) via the `replyAll` parameter. Requires the `messageId` of the message to reply to. Plain text body content can be provided in `body` (do NOT format `body` with Markdown), and rich-text HTML content in `htmlBody` (use valid HTML tags). If `htmlBody` is not provided, then `body` is required. If `body` is not provided, then `htmlBody` is required. To reply to an existing thread, retrieve the thread via `get_thread` first to find the `messageId` of the latest message in that thread. Returns a Message object with the `id`, `threadId`, and `labelIds` fields populated. */
    mcp__claude_ai_Gmail__reply: {
      /** Optional. The blind carbon copy recipients of the email reply. Each string MUST be a valid plain email address (e.g., "user@example.com"). */
      bcc?: string[]
      /** Optional. The plain text body content of the reply. Do NOT format this field with Markdown (such as headers `#`, bold `**`, bullet points `*`, or tables `|`). If formatted rich text is desired, use `html_body` instead. If `html_body` is also provided, this field is treated as the plain-text alternative. If `html_body` is not provided, then `body` is required. */
      body?: string
      /** Optional. The carbon copy recipients of the email reply. If specified, overrides the default CC recipients. Each string MUST be a valid plain email address (e.g., "user@example.com"). */
      cc?: string[]
      /** Optional. The HTML content of the reply. If provided, this will be used as the rich-text version of the email. Use this field (with valid HTML tags such as ` `, ` */
      htmlBody?: string
      /** Required. The unique identifier of the message to reply to. If you want to reply to an existing thread, first retrieve the thread via `get_thread` to find the `message_id` of the last message in the thread. Pass that `message_id` here to ensure proper threading. */
      messageId: string
      /** Optional. Whether to reply to all recipients. Defaults to false. */
      replyAll?: boolean
      /** Optional. The primary recipients of the email reply. If specified, overrides the default reply recipients. Each string MUST be a valid plain email address (e.g., "user@example.com"). */
      to?: string[]
    }
    /** Lists email threads from the authenticated user's Gmail account. This tool can filter threads based on a query string and supports pagination. It returns a list of threads, including their IDs, `viewUrl`, and related messages (each with their own `viewUrl`). Each related message contains details like a snippet of the message body, the subject, the sender, the recipients etc. The `view` parameter controls which fields are populated in the related messages. By default (or with `THREAD_VIEW_MINIMAL`), it includes subject and snippet. Use `THREAD_VIEW_METADATA_ONLY` to exclude subject and snippet. Note that the full message bodies are not returned by this tool; use the 'get_thread' tool with a thread ID to fetch the full message body if needed. Threads with excluded criteria may still appear in the results. This occurs because Gmail identifies matching messages first. For example, if you search for -is:starred, Gmail will find an entire thread if it contains at least one unstarred message, even if other emails in that same conversation are starred. Note: An empty JSON object `{}` represents zero matching items, not an error. */
    mcp__claude_ai_Gmail__search_threads: {
      /** Optional. Include threads from TRASH in the results. Defaults to false. */
      includeTrash?: boolean
      /** Optional. The maximum number of threads to return. If unspecified, defaults to 20. The maximum allowed value is 50. */
      pageSize?: number
      /** Optional. Page token to retrieve a specific page of results in the list. Leave empty to fetch the first page. This is primarily used for pagination to continue fetching results from where the previous `SearchThreads` call left off, especially when the number of threads matching the query exceeds the `page_size` limit. */
      pageToken?: string
      /** Optional. A query string to filter the threads. Natural language queries must be pre-converted into Gmail syntax queries to use this tool. If omitted, all threads (excluding spam and trash by default) are listed. Supported Operators by Category: Sender & Recipient: - `from:` — Sent from a specific person. - `to:` — Sent to a specific person. - `cc:` — Specific people in Cc. - `bcc:` — Specific people in Bcc. - `deliveredto:` — Delivered to a specific address. - `list:` — From a specific mailing list. Time & Date: - `after:YYYY/MM/DD` / `newer:YYYY/MM/DD` — Received after a date. - `before:YYYY/MM/DD` / `older:YYYY/MM/DD` — Received before a date. - `older_than:` — Older than a duration (for example, `1y`, `2d`). - `newer_than:` — Newer than a duration. Content: - `subject:` — Words in the subject line. - `has:` — Has specific content types (attachment, drive, youtube, document). - `filename:` — Attachment with a specific name or type. - `""` — Search for an exact word or phrase. (for example, `"holiday"`, `"holiday vacation"`). Note: Double quotes enforce strict contiguous phrase matching. For topic, discussion, or keyword queries, prefer unquoted keywords (e.g. `partner advertising` instead of `"partner advertising"`). - `+` — Match a word exactly. (for example, `+holiday`, `+unicorn`) - `rfc822msgid:` — Specific message ID header. - `AROUND ` — Find words near each other (for example, `holiday AROUND 10 vacation`). Labels & Categories: - `label:` — Under a specific label. The tool accepts label IDs, not display names. Use the `list_labels` tool to get the ID. - `category:` — In a category (primary, social, promotions, updates, forums, reservations, purchases). - `in:` — Search in specific labels (archive, snoozed, trash, sent, inbox). For example, `in:trash`, `in:inbox`. Archived and sent messages are included by default; use `-in:archive` and `-in:sent` to exclude them. Drafts are explicitly excluded by default by the tool. Use `in:inbox` to restrict search to the inbox only. - `has:userlabels` — Has any user labels. - `has:nouserlabels` — Does not have any user labels. - `has:*-star` — Specific star colors (if enabled, for example, `has:yellow-star`). - `in:draft` — Search in drafts. -in:draft means exclude drafts from the search results. - `in:sent` — Search in sent messages. - `in:anywhere` — Search in all folders (including spam and trash). Status: - `is:` — Search by status (important, starred, unread, read, muted). Size: - `size:` — Specific size in bytes. - `larger:` / `smaller:` — Larger or smaller than a size (for example, `10M` for 10 MB). Logic & Grouping: - `AND` — Match all criteria (default behavior). - `OR` or `{ }` — Match one or more criteria (for example, `from:amy OR from:david`, `{from:amy from:david}`). - `-` (minus) — Exclude criteria (for example, `-movie`). - `( )` — Group multiple search terms (for example, `subject:(dinner film)`). Examples: - `subject:OneMCP Update` - `from:user@example.com` - `to:user2@example.com AND newer_than:7d` - `project proposal has:attachment` - `is:unread -in:draft` To prevent overly strict queries, favor concise, keyword-based queries over long subject strings or full sentences. Avoid copying overly detailed subjects from the user prompt verbatim, as this often leads to search misses. Instead, extract the most unique keywords (e.g., subject:amazon \"delivery\" OR \"order\" instead of \"amazon order\"). Use boolean operators to broaden your search coverage. Use OR to search for synonyms or multiple potential senders, and use ( ) for grouping criteria. Note that whitespace between terms acts as an implicit AND. */
      query?: string
      /** Optional. Controls the fields populated for threads in the thread list. Defaults to `THREAD_VIEW_MINIMAL`. `THREAD_VIEW_MINIMAL` returns `id`, `snippet`, `subject`, `sender`, `to_recipients`, `cc_recipients`, `bcc_recipients`, `date`, `label_ids`. `THREAD_VIEW_METADATA_ONLY` returns `id`, `sender`, `to_recipients`, `cc_recipients`, `bcc_recipients`, `date`, `label_ids`. */
      view?: "THREAD_VIEW_UNSPECIFIED" | "THREAD_VIEW_METADATA_ONLY" | "THREAD_VIEW_MINIMAL"
    }
    /** Sends a new email message immediately from the authenticated user's Gmail account. To send an existing draft message, provide the `draftId`. To send a new message, provide recipients in `to`, `cc`, or `bcc`, a `subject`, and message content in `body` or `htmlBody` (plain text in `body`, rich HTML in `htmlBody`; do NOT format `body` with Markdown). To thread the message under an existing thread or conversation, provide `replyThreadId` (preferred for send-only clients) or `replyToMessageId`. If sending a new message, attachments can be included via the `attachments` field, but the combined size cannot exceed 25MB. Returns a Message object with the `id`, `threadId`, and `labelIds` fields populated. */
    mcp__claude_ai_Gmail__send_message: {
      /** Optional. The attachments to include in the email. The combined size of attachments in the message cannot exceed 25MB. If you need to send files larger than 25MB, upload the file to Drive first and then insert the Drive link into `body` or `html_body`. */
      attachments?: Array<unknown /* $ref #/$defs/Attachment */>
      /** Optional. The blind carbon copy recipients of the email. Each string MUST be a valid plain email address (e.g., "user@example.com"). */
      bcc?: string[]
      /** Optional. The plain text body content of the email. Do NOT format this field with Markdown (such as headers `#`, bold `**`, bullet points `*`, or tables `|`). If formatted rich text is desired, use `html_body` instead. If `html_body` is also provided, this field is treated as the plain-text alternative. */
      body?: string
      /** Optional. The carbon copy recipients of the email. Each string MUST be a valid plain email address (e.g., "user@example.com"). */
      cc?: string[]
      /** Optional. The unique identifier of an existing draft to send. If provided, the other fields (`to`, `cc`, `bcc`, `subject`, `body`, `html_body`) are ignored, and the specified draft is sent as is. */
      draftId?: string
      /** Optional. The HTML content of the email. If provided, this will be used as the rich-text version of the email. Use this field (with valid HTML tags such as ` `, ` */
      htmlBody?: string
      /** Optional. The unique identifier of the thread to send this message in. If provided, the sent message will be threaded under the specified thread. Compatible with all scopes including send-only (gmail.send). */
      replyThreadId?: string
      /** Optional. The unique identifier of the message to reply to. If provided, this message will be threaded in reply to the specified message. Note: Resolving a message by ID requires read permissions (e.g., 'gmail.modify' or 'gmail.compose'). If the caller only has send-only permissions ('gmail.send'), use `reply_thread_id` instead. */
      replyToMessageId?: string
      /** Optional. The subject line of the email. */
      subject?: string
      /** Optional. The primary recipients of the email. Required if `draft_id` is not provided. Each string MUST be a valid plain email address (e.g., "user@example.com"). */
      to?: string[]
    }
    /** Moves a specific message to the Trash in the authenticated user's Gmail account. Use `trash_message` when targeting a specific message within a thread. To trash an entire thread or a single-message thread, prefer `trash_thread`. To find the message ID, use tools like `search_threads` or `get_thread`. To find the draft message ID, use tools like `list_drafts`. */
    mcp__claude_ai_Gmail__trash_message: {
      /** Required. The ID of the message to move to Trash. */
      messageId: string
    }
    /** Moves an entire thread to the Trash in the authenticated user's Gmail account. This operation affects all messages currently in the thread. Use `trash_thread` when trashing a thread, even if it currently contains only 1 message. Trashing at the thread level ensures all current messages in the thread are moved to Trash. If unsure of the thread ID, use the `search_threads` tool first. */
    mcp__claude_ai_Gmail__trash_thread: {
      /** Required. The ID of the thread to move to Trash. */
      threadId: string
    }
    /** Removes one or more labels from a specific message in the authenticated user's Gmail account. To find the message ID, use tools like `search_threads` or `get_thread`. If unsure of a user label's ID, use the `list_labels` tool first to discover available labels and their IDs. */
    mcp__claude_ai_Gmail__unlabel_message: {
      /** Required. The IDs of the labels to remove. Can be a system label ID (e.g., `INBOX`, `TRASH`, `SPAM`, `STARRED`, `UNREAD`, `IMPORTANT`) or a user-defined label ID. The tool accepts `label_ids` and not label names. Use the `list_labels` tool to get the corresponding label id to a display name for user-defined labels. */
      labelIds: string[]
      /** Required. The ID of the message to remove the labels from. */
      messageId: string
    }
    /** Removes labels from an entire thread in the authenticated user's Gmail account. If unsure of the thread ID, use the `search_threads` tool first. If unsure of a user label's ID, use the `list_labels` tool first. */
    mcp__claude_ai_Gmail__unlabel_thread: {
      /** Required. The unique identifiers of the labels to remove. Can be a system label ID (e.g., `INBOX`, `TRASH`, `SPAM`, `STARRED`, `UNREAD`, `IMPORTANT`) or a user-defined label ID. The tool accepts `label_ids` and not label names. Use the `list_labels` tool to get the corresponding label id to a display name for user-defined labels. */
      labelIds: string[]
      /** Required. The unique identifier of the thread to remove labels from. */
      threadId: string
    }
    /** Unmarks a specific message as Spam in the authenticated user's Gmail account. To find the message ID, use tools like `search_threads` or `get_thread`. */
    mcp__claude_ai_Gmail__unmark_message_spam: {
      /** Required. The ID of the message to unmark as Spam. */
      messageId: string
    }
    /** Unmarks an entire thread as Spam in the authenticated user's Gmail account. If unsure of the thread ID, use the `search_threads` tool first. */
    mcp__claude_ai_Gmail__unmark_thread_spam: {
      /** Required. The ID of the thread to unmark as Spam. */
      threadId: string
    }
    /** Removes a specific message from the Trash in the authenticated user's Gmail account. To find the message ID, use tools like `search_threads` or `get_thread`. */
    mcp__claude_ai_Gmail__untrash_message: {
      /** Required. The ID of the message to remove from Trash. */
      messageId: string
    }
    /** Removes an entire thread from the Trash in the authenticated user's Gmail account. If unsure of the thread ID, use the `search_threads` tool first. */
    mcp__claude_ai_Gmail__untrash_thread: {
      /** Required. The ID of the thread to remove from Trash. */
      threadId: string
    }
    /** Updates an existing draft email in the authenticated user's Gmail account. This operation supports merge semantics: fields provided in the request (non-empty) will overwrite the corresponding fields in the draft, while omitted (or empty) fields will preserve their existing values. Plain text body content can be provided in `body` (do NOT format `body` with Markdown), and rich-text HTML content can be provided in `htmlBody` (use valid HTML tags for formatting; if only one is provided, the other is cleared to keep content in sync). WARNING: Attachments are NOT merged. If the draft contains attachments, they will be removed unless they are explicitly re-provided in the `attachments` field of this request. Returns a Draft object with the `id`, `threadId`, and `viewUrl` fields populated. */
    mcp__claude_ai_Gmail__update_draft: {
      /** Optional. The attachments to include in the email. The combined size of attachments in the message cannot exceed 25MB. If you need to send files larger than 25MB, upload the file to Drive first and then insert the Drive link into `body` or `html_body`. If omitted or empty, any existing attachments on the draft will be removed. */
      attachments?: Array<unknown /* $ref #/$defs/Attachment */>
      /** Optional. The blind carbon copy recipients of the email draft. Each string MUST be a valid plain email address (e.g., "user@example.com"). If omitted or empty, the existing recipients are preserved. */
      bcc?: string[]
      /** Optional. The plain text body content of the email draft. Do NOT format this field with Markdown (such as headers `#`, bold `**`, bullet points `*`, or tables `|`). If formatted rich text is desired, use `html_body` instead. If `html_body` is also provided, this field is treated as the plain-text alternative. If both `body` and `html_body` are omitted or empty, the existing body is preserved. If `body` is provided but `html_body` is omitted, the body will be updated to plain text and the existing HTML body will be cleared. */
      body?: string
      /** Optional. The carbon copy recipients of the email draft. Each string MUST be a valid plain email address (e.g., "user@example.com"). If omitted or empty, the existing recipients are preserved. */
      cc?: string[]
      /** Required. The unique identifier of the draft to update. */
      draftId: string
      /** Optional. The HTML content of the email draft. If provided, this will be used as the rich-text version of the email. Use this field (with valid HTML tags such as ` `, ` */
      htmlBody?: string
      /** Optional. The subject line of the email. If omitted or empty, the existing subject is preserved. */
      subject?: string
      /** Optional. The primary recipients of the email draft. Each string MUST be a valid plain email address (e.g., "user@example.com"). If omitted or empty, the existing recipients are preserved. */
      to?: string[]
    }
    /** Modifies an existing label's name and color in the user's Gmail account. */
    mcp__claude_ai_Gmail__update_label: {
      /** Deprecated: Do not use. Use `color_preset` instead. Legacy field for raw text and background color hex strings. */
      color?: unknown /* $ref #/$defs/LabelColor */
      /** Optional. The new color preset tile to assign to the label. Select from predefined contrast-safe color options (e.g., LABEL_COLOR_PRESET_RED, LABEL_COLOR_PRESET_BLUE, LABEL_COLOR_PRESET_BLACK, LABEL_COLOR_PRESET_GREEN). If omitted, existing label color is preserved. */
      colorPreset?: "LABEL_COLOR_PRESET_UNSPECIFIED" | "LABEL_COLOR_PRESET_BLACK" | "LABEL_COLOR_PRESET_DARK_GRAY" | "LABEL_COLOR_PRESET_GRAY" | "LABEL_COLOR_PRESET_LIGHT_GRAY" | "LABEL_COLOR_PRESET_WHITE" | "LABEL_COLOR_PRESET_RED" | "LABEL_COLOR_PRESET_ORANGE" | "LABEL_COLOR_PRESET_YELLOW" | "LABEL_COLOR_PRESET_GREEN" | "LABEL_COLOR_PRESET_MINT" | "LABEL_COLOR_PRESET_TEAL" | "LABEL_COLOR_PRESET_BLUE" | "LABEL_COLOR_PRESET_PURPLE" | "LABEL_COLOR_PRESET_PINK" | "LABEL_COLOR_PRESET_DARK_RED" | "LABEL_COLOR_PRESET_DARK_ORANGE" | "LABEL_COLOR_PRESET_DARK_GREEN" | "LABEL_COLOR_PRESET_DARK_BLUE" | "LABEL_COLOR_PRESET_DARK_PURPLE" | "LABEL_COLOR_PRESET_DARK_PINK" | "LABEL_COLOR_PRESET_BROWN"
      /** Optional. The human-readable display name of the label. */
      displayName?: string
      /** Required. The unique identifier of the label to modify. Use the `list_labels` tool to get the corresponding label id to a display name for user-defined labels. */
      labelId: string
      /** Optional. The new visibility of the label in the label list in the Gmail web interface. */
      labelListVisibility?: "LABEL_LIST_VISIBILITY_UNSPECIFIED" | "LABEL_SHOW" | "LABEL_SHOW_IF_UNREAD" | "LABEL_HIDE"
      /** Optional. The new visibility of messages with this label in the message list in the Gmail web interface. */
      messageListVisibility?: "MESSAGE_LIST_VISIBILITY_UNSPECIFIED" | "SHOW" | "HIDE"
    }
    /** Atomically adds and/or removes labels from a specific message in the authenticated user's Gmail account. Requires at least one of `addLabelIds` or `removeLabelIds` to be provided. Moving an email between labels can be accomplished in a single call by specifying the target label in `addLabelIds` and the current label in `removeLabelIds`. */
    mcp__claude_ai_Gmail__update_message_labels: {
      /** Optional. The IDs of the labels to add. Can be a system label ID (e.g., `INBOX`, `STARRED`, `UNREAD`, `IMPORTANT`) or a user-defined label ID. */
      addLabelIds?: string[]
      /** Required. The ID of the message to modify labels for. */
      messageId: string
      /** Optional. The IDs of the labels to remove. Can be a system label ID or a user-defined label ID. */
      removeLabelIds?: string[]
    }
    /** Creates an event on the given calendar. */
    mcp__claude_ai_Google_Calendar__create_event: {
      /** Optional. Create and add a Google Meet URL. Default: `false`. */
      addGoogleMeetUrl?: boolean
      /** Optional. Whether the event spans the entire day. If true, start/end times are treated as midnight. */
      allDay?: boolean
      /** Optional. File attachments. */
      attachments?: Array<unknown /* $ref #/$defs/Attachment */>
      /** Optional. Deprecated: use `attendees` instead. */
      attendeeEmails?: string[]
      /** Optional. Attendees of the event. For events that are created on the user's primary calendar with at least one other attendee, the current user will automatically be added as an attendee if not already included. */
      attendees?: Array<unknown /* $ref #/$defs/Attendee */>
      /** Optional. Availability setting. */
      availability?: "AVAILABILITY_UNSPECIFIED" | "AVAILABILITY_BUSY" | "AVAILABILITY_FREE"
      /** Optional. ID of the calendar to create the event on. Email address - can be resolved using `list_calendars`. Default: primary calendar. */
      calendarId?: string
      /** Optional. The color of the event. For a list of color IDs, refer to the documentation of the Event resource. */
      colorId?: string
      /** Optional. Description. Can contain HTML. */
      description?: string
      /** Required. End time (ISO 8601, for example `2026-04-30T11:00:00+08:00`). */
      endTime: string
      /** Optional. Type of the event. */
      eventType?: "EVENT_TYPE_UNSPECIFIED" | "DEFAULT" | "OUT_OF_OFFICE" | "FOCUS_TIME" | "WORKING_LOCATION" | "BIRTHDAY" | "FROM_GMAIL"
      /** Optional. Specific Google Meet URL or meeting ID. Overrides `add_google_meet_url`. */
      googleMeetUrl?: string
      /** Optional. Guest permissions. */
      guestPermissions?: unknown /* $ref #/$defs/GuestPermissions */
      /** Optional. Location. */
      location?: string
      /** Optional. Which email notification should be sent for this event update. */
      notificationLevel?: "NOTIFICATION_LEVEL_UNSPECIFIED" | "NONE" | "EXTERNAL_ONLY" | "ALL"
      /** Optional. Reminders override calendar defaults. */
      overrideReminders?: Array<unknown /* $ref #/$defs/Reminder */>
      /** Optional. Recurrence rules as `RRULE`, `RDATE`, or `EXDATE` strings (per RFC 5545). */
      recurrenceData?: string[]
      /** Required. Start time (ISO 8601, for example `2026-04-30T10:00:00+08:00`). */
      startTime: string
      /** Required. Title. */
      summary: string
      /** Optional. IANA Time Zone Database name (for example, `America/Los_Angeles`). Default: the user's primary time zone. Overrides offsets in `start_time` and `end_time`. */
      timeZone?: string
      /** Optional. Whether to use the default reminders for the event. If true, the event will use default reminders. Cannot be set to true if `override_reminders` are specified. If set to false and `override_reminders` is empty or unset, the event will have no reminders. Defaults to false if override_reminders is set, otherwise defaults to true. */
      useDefaultReminders?: boolean
      /** Optional. Visibility of the event. Possible values are: - `default` - Uses the default visibility for events on the calendar. Default value. - `public` - The event is public and event details are visible to all readers of the calendar. - `private` - Only event attendees may view event details. */
      visibility?: string
      /** Optional. Working location properties (if `eventType` is `WORKING_LOCATION`). */
      workingLocationProperties?: unknown /* $ref #/$defs/WorkingLocationProperties */
    }
    /** Deletes an event on the given calendar. */
    mcp__claude_ai_Google_Calendar__delete_event: {
      /** Optional. ID of the calendar containing the event. Email address - can be resolved using `list_calendars`. Default: primary calendar. */
      calendarId?: string
      /** Required. The ID of the event to delete. */
      eventId: string
      /** Optional. Which email notification should be sent for this event update. */
      notificationLevel?: "NOTIFICATION_LEVEL_UNSPECIFIED" | "NONE" | "EXTERNAL_ONLY" | "ALL"
    }
    /** Returns a single event on the given calendar. */
    mcp__claude_ai_Google_Calendar__get_event: {
      /** Optional. ID of the calendar containing the event. Email address - can be resolved using `list_calendars`. Default: primary calendar. */
      calendarId?: string
      /** Required. Event ID. Can be resolved using `list_events` or `search_events`. */
      eventId: string
    }
    /** Returns the calendars this user has access to (their calendar list). Use this tool to resolve calendar identifying data (for example, 'my family calendar') into its corresponding `calendar_id` (email identifier) */
    mcp__claude_ai_Google_Calendar__list_calendars: {
      /** Optional. Max results per page. Default `100`, max `250`. */
      pageSize?: number
      /** Optional. Token specifying which result page to return. */
      pageToken?: string
    }
    /** Returns events on the given calendar matching all specified constraints. Time constraints should not be specified unless requested by the user. For open-ended keyword or topic-based searches on the primary calendar, the search_events tool must be used instead. */
    mcp__claude_ai_Google_Calendar__list_events: {
      /** Optional. ID of the calendar containing the events. Email address - can be resolved using `list_calendars`. Default: primary calendar. */
      calendarId?: string
      /** Optional. The upper bound of a time range. Must only be set when a specific timeframe or a time in the past is requested by the user. Must be an ISO 8601 timestamp greater than `start_time`. Default: `start_time` + 7 days. */
      endTime?: string
      /** Optional. The event types to return. If empty, only the following event types are returned: `DEFAULT`, `OUT_OF_OFFICE`, `FOCUS_TIME`, `FROM_GMAIL` */
      eventType?: Array<"EVENT_TYPE_UNSPECIFIED" | "DEFAULT" | "OUT_OF_OFFICE" | "FOCUS_TIME" | "WORKING_LOCATION" | "BIRTHDAY" | "FROM_GMAIL">
      /** Optional. Deprecated: use `event_type` instead. */
      eventTypeFilter?: string[]
      /** Optional. Free-form case-insensitive search matching title, description, location, or attendees. Matches events containing all query terms verbatim (AND search). */
      fullText?: string
      /** Optional. The order in which events should be returned. Possible values are: - `default` - Unspecified, but deterministic ordering (default). - `startTime` - Order by start time ascending. - `startTimeDesc` - Order by start time descending. - `lastModified` - Order by last modification time ascending. */
      orderBy?: string
      /** Optional. Max events per page (default `100`, max `250`). Recommended: `10`. */
      pageSize?: number
      /** Optional. Next page token. Use the value from the previous page's `nextPageToken`. */
      pageToken?: string
      /** Optional. The lower bound of a time range. Must only be set when a specific timeframe is requested by the user. Must be an ISO 8601 timestamp less than `end_time`. Default: now. */
      startTime?: string
      /** Optional. Time zone (IANA ID, for example `Europe/Zurich`) used to resolve timezone-less dates. Default: calendar's timezone. */
      timeZone?: string
    }
    /** Responds to an event on a calendar. */
    mcp__claude_ai_Google_Calendar__respond_to_event: {
      /** Optional. ID of the calendar containing the event. Email address - can be resolved using `list_calendars`. Default: primary calendar. */
      calendarId?: string
      /** Required. The ID of the event to respond to. */
      eventId: string
      /** Optional. Which email notification should be sent for this event update. */
      notificationLevel?: "NOTIFICATION_LEVEL_UNSPECIFIED" | "NONE" | "EXTERNAL_ONLY" | "ALL"
      /** Optional. The user's comment attached to the response. */
      responseComment?: string
      /** Required. The new user's response status of the event. Possible values are: - `declined` - The attendee has declined the invitation. - `tentative` - The attendee has tentatively accepted the invitation. - `accepted` - The attendee has accepted the invitation. */
      responseStatus: string
    }
    /** Searches events on the user's primary calendar using semantic search. */
    mcp__claude_ai_Google_Calendar__search_events: {
      /** Optional. Maximum number of entries returned on one result page. */
      pageSize?: number
      /** Optional. Token specifying which result page to return. */
      pageToken?: string
      /** Required. Query string to search for events (case-insensitive). */
      query: string
    }
    /** Suggests time periods across one or more calendars. */
    mcp__claude_ai_Google_Calendar__suggest_time: {
      /** Required. Attendee emails to find free time for. */
      attendeeEmails: string[]
      /** Optional. Min duration of free slot in minutes. Default: `30`. */
      durationMinutes?: number
      /** Required. Query interval end (ISO 8601). */
      endTime: string
      /** Preferences to find suggested time. */
      preferences?: unknown /* $ref #/$defs/Preferences */
      /** Required. Query interval start (ISO 8601). */
      startTime: string
      /** Optional. Time zone for search times (IANA ID, for example `Europe/Zurich`). Default: the offset of `start_time`, if none then the user's primary time zone. */
      timeZone?: string
    }
    /** Updates an event on the given calendar. */
    mcp__claude_ai_Google_Calendar__update_event: {
      /** Optional. If true, creates or updates a Google Meet URL for the event. Ignored if Meet is disabled. */
      addGoogleMeetUrl?: boolean
      /** Optional. File attachments to add to the event. */
      addedAttachments?: Array<unknown /* $ref #/$defs/Attachment */>
      /** Optional. Deprecated: use `added_attendees` instead. */
      addedAttendeeEmails?: string[]
      /** Optional. Attendees to add to the event. */
      addedAttendees?: Array<unknown /* $ref #/$defs/Attendee */>
      /** Optional. Changes the event to all-day. If set, `start_time`/`end_time` must also be provided. */
      allDay?: boolean
      /** Optional. Whether the event blocks time on the calendar. */
      availability?: "AVAILABILITY_UNSPECIFIED" | "AVAILABILITY_BUSY" | "AVAILABILITY_FREE"
      /** Optional. ID of the calendar containing the event. Email address - can be resolved using `list_calendars`. Default: primary calendar. */
      calendarId?: string
      /** Optional. New color of the event. For a list of color IDs, refer to the documentation of the Event resource. */
      colorId?: string
      /** Optional. New description. Can contain HTML. */
      description?: string
      /** Optional. New end time (ISO 8601). */
      endTime?: string
      /** Required. Event ID. Can be resolved using `list_events` or `search_events`. */
      eventId: string
      /** Optional. Allows attaching an existing Google Meet URL or meeting ID to the event. Overrides the value of `addGoogleMeetUrl`. */
      googleMeetUrl?: string
      /** Optional. Guest permission settings for this event. */
      guestPermissions?: unknown /* $ref #/$defs/GuestPermissions */
      /** Optional. New location. */
      location?: string
      /** Optional. Email notification to send for this event update. Default: `ALL`. */
      notificationLevel?: "NOTIFICATION_LEVEL_UNSPECIFIED" | "NONE" | "EXTERNAL_ONLY" | "ALL"
      /** Optional. If set, replaces all existing reminders for the event. */
      overrideReminders?: Array<unknown /* $ref #/$defs/Reminder */>
      /** Optional. File attachments to remove from the event. */
      removedAttachmentFileUrls?: string[]
      /** Optional. The attendees of the event to remove, as email addresses. */
      removedAttendeeEmails?: string[]
      /** Optional. New start time (ISO 8601). Preserves duration if updating only start. */
      startTime?: string
      /** Optional. New title. */
      summary?: string
      /** Optional. IANA Time Zone Database name (for example, `America/Los_Angeles`). Default: the user's primary time zone. Overrides offsets in `start_time` and `end_time`. */
      timeZone?: string
      /** Optional. Whether to use the default reminders for the event. If true, the event will use default reminders (and clear override reminders). Cannot be set to true if `override_reminders` are specified. If set to false and `override_reminders` is empty or unset, all reminders are removed. */
      useDefaultReminders?: boolean
      /** Optional. New visibility of the event. Possible values are: - `default` - Uses the default visibility for events on the calendar. Default value. - `public` - Event details are visible to all readers of the calendar. - `private` - The event is private and only event attendees may view event details. */
      visibility?: string
    }
    /** Call this tool to copy an existing File in Google Drive. The tool allows specifying a new title and a parent folder for the copy. If the title is not specified, the copy title will be 'Copy of {original title}'. If the parent folder is not specified, the copy will be created in the same folder as the original file, unless the requesting user does not have write access to that folder, in which case the copy will be created in the user's root folder.Returns the newly created File object upon successful copying. */
    mcp__claude_ai_Google_Drive__copy_file: {
      /** Required. The ID of the file to copy. */
      fileId: string
      /** The parent id of the newly created file. If empty, the file will be created with the same parent as the original file. */
      parentId?: string
      /** The title of the newly created file. If empty, the title will be 'Copy of {original file title}'. */
      title?: string
    }
    /** Call this tool to create or upload a File to Google Drive. If uploading content, prefer `textContent` for text content. For non-UTF8 contents, use the `base64Content` field and base64 encode the data to set on that field. Returns a single File object upon successful creation. The following Google first-party mime types can be created without providing content: - `application/vnd.google-apps.document` - `application/vnd.google-apps.spreadsheet` - `application/vnd.google-apps.presentation` Folders can be created by setting the mime type to `application/vnd.google-apps.folder`. When uploading content, the `contentMimeType` field is required and should match the type of the content being uploaded. By default, supported content will be converted to Google first-party mime types. To disable conversions for first-party mime types, set `disableConversionToGoogleType` to true. */
    mcp__claude_ai_Google_Drive__create_file: {
      /** Optional. The base64 encoded content to upload. It's an error to set this and `textContent`. */
      base64Content?: string
      /** Deprecated: Use `base64Content` or `textContent` instead. The content of the file encoded as base64. The content field should always be base64 encoded regardless of the mime type of the file. */
      content?: string
      /** The mime type of the content being uploaded. Required when any type of content is provided. */
      contentMimeType?: string
      /** Set to true to retain the passed in content mime type and not convert to a Google type. For example, without this a `text/plain` content mime type will be converted to to `application/vnd.google-apps.document`. Has no effect for types that do not have a Google equivalent. */
      disableConversionToGoogleType?: boolean
      /** Deprecated: DO NOT USE!! Set `contentMimeType` instead. */
      mimeType?: string
      /** The parent id of the file. */
      parentId?: string
      /** Optional. The (UTF-8) text content to upload. It's an error to set this and `base64Content`. */
      textContent?: string
      /** Required. The title of the file. */
      title: string
    }
    /** Call this tool to download the content of a Drive file as a base64 encoded string. If the file is a Google Drive first-party mime type, the `exportMimeType` field specifies the desired export mime type. When the field is unset, defaults to plain text types (e.g. `text/plain`, `text/csv`). If the file is not found, try using other tools like `search_files` to find the file the user is requesting. If the user wants a natural language representation of their Drive content, use the `read_file_content` tool (`read_file_content` should be smaller and easier to parse). */
    mcp__claude_ai_Google_Drive__download_file_content: {
      /** Optional. For Google native files, the MIME type to export the file to, ignored otherwise. Defaults to text if not specified. */
      exportMimeType?: string
      /** Required. The ID of the file to retrieve. */
      fileId: string
      /** Optional. The revision id for the version of the file to download. If not specified, the latest revision will be downloaded. */
      revisionId?: string
    }
    /** Call this tool to find general metadata about a user's Drive file. Context window token management can be tuned via `snippetVerbosity` (default is `SnippetVerbosity.DETAILED`) or if only metadata is needed, use `excludeContentSnippets`. If the file is not found, try using other tools like `search_files` to find the file the user is requesting. */
    mcp__claude_ai_Google_Drive__get_file_metadata: {
      /** If true, the content snippet will be excluded from the response. */
      excludeContentSnippets?: boolean
      /** Required. The ID of the file to retrieve. */
      fileId: string
      /** Optional. Set to specify how verbose the snippets should be. Defaults to DETAILED if not set. */
      snippetVerbosity?: "UNSPECIFIED" | "BRIEF" | "MEDIUM" | "DETAILED" | "MAX_ALLOWED"
    }
    /** Call this tool to list the permissions of a Drive File. */
    mcp__claude_ai_Google_Drive__get_file_permissions: {
      /** Required. The ID of the file to get permissions for. */
      fileId: string
    }
    /** Call this tool to find recent files for a user specified a sort order. Default sort order is `recency` if orderBy is not set or set to an unsupported value. Context window token management can be tuned via `snippetVerbosity` (default is `SnippetVerbosity.DETAILED`) or if only metadata is needed, use `excludeContentSnippets`. Supported sort orders are: - `recency`: The most recent timestamp from the file's date-time fields. - `lastModified`: The last time the file was modified by anyone. - `lastModifiedByMe`: The last time the file was modified by the user. The default page size is 10. Utilize `next_page_token` to paginate through the results. */
    mcp__claude_ai_Google_Drive__list_recent_files: {
      /** If true, the content snippet will be excluded from the response. */
      excludeContentSnippets?: boolean
      /** The sort order for the files. */
      orderBy?: string
      /** The maximum number of files to return. */
      pageSize?: number
      /** The page token to use for pagination. */
      pageToken?: string
      /** Optional. Set to specify how verbose the snippets should be. Defaults to DETAILED if not set. */
      snippetVerbosity?: "UNSPECIFIED" | "BRIEF" | "MEDIUM" | "DETAILED" | "MAX_ALLOWED"
    }
    /** Call this tool to fetch a natural language representation of a known Drive file, and if specified, its comments. REQUIREMENTS & WORKFLOW: - `fileId` is required. You MUST pass an exact Drive file ID returned by a previous discovery tool (`search_files` or `list_recent_files`) or provided explicitly in the user prompt. - NEVER guess, invent, or hallucinate a `fileId` string from a file title or name. - If given a file title, name, or topic without an explicit `fileId`, you MUST FIRST call `search_files` to find the file and retrieve its `fileId` before invoking this tool. The file content may be incomplete for very large files. The text representation will change over time, so don't make assumptions about the particular format of the text returned by this tool. If supported and specified, comment tags will be included in the content. Supported Mime Types: - `application/vnd.google-apps.document` (supports comments) - `application/vnd.google-apps.presentation` (supports comments) - `application/vnd.google-apps.spreadsheet` (supports comments) - `application/pdf` - `application/msword` - `application/vnd.openxmlformats-officedocument.wordprocessingml.document` - `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet` - `application/vnd.openxmlformats-officedocument.presentationml.presentation` - `application/vnd.oasis.opendocument.spreadsheet` - `application/vnd.oasis.opendocument.presentation` - `application/x-vnd.oasis.opendocument.text` - `image/png` - `image/jpeg` - `image/jpg` If the file is not found, try using other tools like `search_files` to find the file the user is requesting using keywords. */
    mcp__claude_ai_Google_Drive__read_file_content: {
      /** Required. The ID of the file to retrieve. */
      fileId: string
      /** Whether to include comments in the response. Comments will be inlined in the text content of the file with a mapping to the comment threads. Note: Comments are only supported for Google Docs, Slides, and Sheets. */
      includeComments?: boolean
    }
    /** Search for Drive files using a structured query (syntax: `query_term operator values`). Only terms in this list are supported. Combine clauses with `and`, `or`, `not`, and parentheses. String values must be single-quoted; escape embedded quotes as `\'`. Context window token management can be tuned via `snippetVerbosity` (default is `SnippetVerbosity.DETAILED`) or if only metadata is needed, use `excludeContentSnippets`. Do NOT include document type terms (e.g., 'presentation', 'slides', 'deck', 'document', 'doc', 'spreadsheet', 'sheet', 'pdf', 'folder') inside `title contains '...'` or `fullText contains '...'` clauses. Separate title keywords from file type terms. Instead map them to `mimeType` clauses in the query (e.g., 'slides' -> `mimeType = 'application/vnd.google-apps.presentation'`). Query terms & operators: - `title` (ops: contains, =, !=) — file title - `fullText` (ops: contains) — title or body text - `mimeType` (ops: contains, =, !=) — MIME type - `modifiedTime`, `viewedByMeTime`, `createdTime` (ops: `<=`, `<`, `=`, `!=`, `>`, `>=`). Use RFC 3339 UTC, e.g., `2012-06-04T12:00:00-08:00`. Date types not comparable. - `parentId` (ops: `=`, `!=`). Use `'root'` for the user's "My Drive". - `owner` (ops: `=`, `!=`). Use `'me'` for the requesting user. - `sharedWithMe` (ops: `=`, `!=`). Values: `true` or `false`. Other operators: `and`, `or`, `not`. Examples: - `title contains 'hello' and title contains 'goodbye'` - `modifiedTime > '2024-01-01T00:00:00Z' and (mimeType contains 'image/' or mimeType contains 'video/')` - `parentId = '1234567'` - `fullText contains 'hello'` - `owner = 'test@example.org'` - `sharedWithMe = true` - `owner = 'me'` (for files owned by the user) Use `next_page_token` to paginate. An empty response means no more results. */
    mcp__claude_ai_Google_Drive__search_files: {
      /** If true, the content snippet will be excluded from the response. */
      excludeContentSnippets?: boolean
      /** The maximum number of files to return in each page. */
      pageSize?: number
      /** The page token to use for pagination. */
      pageToken?: string
      /** The search query. */
      query?: string
      /** Optional. Set to specify how verbose the snippets should be. Defaults to DETAILED if not set. */
      snippetVerbosity?: "UNSPECIFIED" | "BRIEF" | "MEDIUM" | "DETAILED" | "MAX_ALLOWED"
    }
    /** Call this tool to share a Google Drive file with a user or group. If the user or group already has permission to the file, this tool will update their permission level to match the role in this request, if the new role is higher than their current role. */
    mcp__claude_ai_Google_Drive__share_file: {
      /** Required. The email address of the user or group to share with. */
      emailAddress: string
      /** Required. The ID of the file to share. */
      fileId: string
      /** Required. The role to grant. Supported roles (in descending order of access level): * `writer` * `commenter` * `reader` */
      role: string
    }
    /** Moves a Google Drive file to the user's trash. It does not permanently delete the file.Returns an empty response upon successful completion. */
    mcp__claude_ai_Google_Drive__trash_file: {
      /** Required. The ID of the file to trash. */
      fileId: string
    }
    /** Call this tool to update the metadata of a Google Drive file. If the file is not found, try using other tools like `search_files` to find the file the user is attempting to update. For moving files, use `search_files` to identify the destination parent id. */
    mcp__claude_ai_Google_Drive__update_file: {
      /** Required. The ID of the file to update. */
      fileId: string
      /** The updated parent id of the file. If the file has an existing parent, it will be replaced, resulting in a folder move. If provided, must not be empty. */
      parentId?: string
      /** The updated title of the file. If provided, must not be empty. */
      title?: string
    }
    /** Execute a sequence of browser tool calls in ONE round trip. Each item is {name, input} where input is exactly what you'd pass to that tool standalone. Actions execute SEQUENTIALLY (not in parallel) and stop on the first error. Use this tool extensively to quickly execute work whenever you can predict two or more steps ahead — e.g. navigate, click a field, type, press Return, screenshot. Each tool's own permission check runs per item — if an action navigates to a domain without permission, the next item's check fails and the batch stops. Screenshots and other images are returned interleaved with outputs; coordinates you write in THIS batch refer to the screenshot taken BEFORE this call. browser_batch cannot be nested. */
    "mcp__claude-in-chrome__browser_batch": {
      /** List of tool calls to execute sequentially. Example: [{"name":"computer","input":{"action":"left_click","coordinate":[100,200],"tabId":123}},{"name":"computer","input":{"action":"type","text":"hello","tabId":123}},{"name":"navigate","input":{"url":"https://example.com","tabId":123}}] */
      actions: Array<{
        /** Tool name (e.g. computer, navigate, find, tabs_create_mcp). browser_batch cannot be nested. */
        name: string
        /** That tool's input — same shape you'd pass when calling it directly. For computer items whose action is left_click, right_click, double_click, triple_click, left_click_drag, key or type, and for form_input items, include action_summary in the item's input, as you would when calling that tool directly. */
        input: {}
      }>
    }
    /** Use a mouse and keyboard to interact with a web browser, and take screenshots. If you don't have a valid tab ID, use tabs_context_mcp first to get available tabs. * Whenever you intend to click on an element like an icon, you should consult a screenshot to determine the coordinates of the element before moving the cursor. * If you tried clicking on a program or link but it failed to load, even after waiting, try adjusting your click location so that the tip of the cursor visually falls on the element that you want to click. * Make sure to click any buttons, links, icons, etc with the cursor tip in the center of the element. Don't click boxes on their edges unless asked. */
    "mcp__claude-in-chrome__computer": {
      /** The action to perform: * `left_click`: Click the left mouse button at the specified coordinates. * `right_click`: Click the right mouse button at the specified coordinates to open context menus. * `double_click`: Double-click the left mouse button at the specified coordinates. * `triple_click`: Triple-click the left mouse button at the specified coordinates. * `type`: Type a string of text. * `screenshot`: Take a screenshot of the screen. * `wait`: Wait for a specified number of seconds. * `scroll`: Scroll up, down, left, or right at the specified coordinates. * `key`: Press a specific keyboard key. * `left_click_drag`: Drag from start_coordinate to coordinate. * `zoom`: Take a screenshot of a specific region for closer inspection. * `scroll_to`: Scroll an element into view using its element reference ID from read_page or find tools. * `hover`: Move the mouse cursor to the specified coordinates or element without clicking. Useful for revealing tooltips, dropdown menus, or triggering hover states. */
      action: "left_click" | "right_click" | "type" | "screenshot" | "wait" | "scroll" | "key" | "left_click_drag" | "double_click" | "triple_click" | "zoom" | "scroll_to" | "hover"
      /** (x, y): The x (pixels from the left edge) and y (pixels from the top edge) coordinates. Required for `left_click`, `right_click`, `double_click`, `triple_click`, and `scroll`. For `left_click_drag`, this is the end position. */
      coordinate?: number[]
      /** The text to type (for `type` action) or the key(s) to press (for `key` action). For `key` action: Provide space-separated keys (e.g., "Backspace Backspace Delete"). Supports keyboard shortcuts using the platform's modifier key (use "cmd" on Mac, "ctrl" on Windows/Linux, e.g., "cmd+a" or "ctrl+a" for select all). Page zoom shortcuts (e.g. "cmd+=", "ctrl+-", "cmd+0") are not supported and will return an error - use the `zoom` action to magnify a region of the page instead. */
      text?: string
      /** The number of seconds to wait. Required for `wait`. Maximum 10 seconds. */
      duration?: number
      /** The direction to scroll. Required for `scroll`. */
      scroll_direction?: "up" | "down" | "left" | "right"
      /** The number of scroll wheel ticks. Optional for `scroll`, defaults to 3. */
      scroll_amount?: number
      /** (x, y): The starting coordinates for `left_click_drag`. */
      start_coordinate?: number[]
      /** (x0, y0, x1, y1): The rectangular region to capture for `zoom`. Coordinates define a rectangle from top-left (x0, y0) to bottom-right (x1, y1) in pixels from the viewport origin. Required for `zoom` action. Useful for inspecting small UI elements like icons, buttons, or text. */
      region?: number[]
      /** For `screenshot` and `zoom` only. Scale factor in [0.1, 1] for the returned image; 1 (default) uses the full image token budget, 0.5 returns an image at half the width and height (~quarter of the tokens). Coordinates are ALWAYS in the full-resolution coordinate frame (reported with every scaled screenshot), never in the scaled image's own pixels. Requires a Claude in Chrome extension version that supports scale; older extensions return the full-size image. */
      scale?: number
      /** Number of times to repeat the key sequence. Only applicable for `key` action. Must be a positive integer between 1 and 100. Default is 1. Useful for navigation tasks like pressing arrow keys multiple times. */
      repeat?: number
      /** Element reference ID from read_page or find tools (e.g., "ref_1", "ref_2"). Required for `scroll_to` action. Can be used as alternative to `coordinate` for click actions. */
      ref?: string
      /** Modifier keys for click actions. Supports: "ctrl", "shift", "alt", "cmd" (or "meta"), "win" (or "windows"). Can be combined with "+" (e.g., "ctrl+shift", "cmd+alt"). Optional. */
      modifiers?: string
      /** Tab ID to execute the action on. Must be a tab in the current group. Use tabs_context_mcp first if you don't have a valid tab ID. */
      tabId: number
      /** For screenshot/zoom actions: save the image to disk so it can be attached to a message for the user. Returns the saved path in the tool result. Only set this when you intend to share the image — screenshots you're just looking at don't need saving. */
      save_to_disk?: boolean
      /** A few words saying what this action does on the page and to what, for example 'Sends the drafted reply to pat@example.com' or 'Opens the Filters menu'. Set it on every left_click, right_click, double_click, triple_click, left_click_drag, key and type action. State the effect only, and accurately: no reasons, nothing about what you were asked or allowed to do, no passwords or other secrets. */
      action_summary?: string
    }
    /** Upload one or multiple files to a file input element on the page. Do not click on file upload buttons or file inputs — clicking opens a native file picker dialog that you cannot see or interact with. Instead, use read_page or find to locate the file input element, then use this tool with its ref to upload files directly. Only files the user has shared with this session (attachments, the session's outputs/uploads folders, or folders the user has connected) can be uploaded; other paths will be rejected. The combined size of all files in a single call must stay under 10 MB. */
    "mcp__claude-in-chrome__file_upload": {
      /** Absolute paths to the files to upload. Each path must be a file the user has shared with this session. */
      paths: string[]
      /** Element reference ID of the file input from read_page or find tools (e.g., "ref_1", "ref_2"). */
      ref: string
      /** Tab ID where the file input is located. Use tabs_context_mcp first if you don't have a valid tab ID. */
      tabId: number
    }
    /** Find elements on the page using natural language. Can search for elements by their purpose (e.g., "search bar", "login button") or by text content (e.g., "organic mango product"). Returns up to 20 matching elements with references that can be used with other tools. If more than 20 matches exist, you'll be notified to use a more specific query. If you don't have a valid tab ID, use tabs_context_mcp first to get available tabs. */
    "mcp__claude-in-chrome__find": {
      /** Natural language description of what to find (e.g., "search bar", "add to cart button", "product title containing organic") */
      query: string
      /** Tab ID to search in. Must be a tab in the current group. Use tabs_context_mcp first if you don't have a valid tab ID. */
      tabId: number
    }
    /** Set values in form elements using element reference ID from the read_page tool. If you don't have a valid tab ID, use tabs_context_mcp first to get available tabs. */
    "mcp__claude-in-chrome__form_input": {
      /** Element reference ID from the read_page tool (e.g., "ref_1", "ref_2") */
      ref: string
      /** The value to set. For checkboxes use boolean, for selects use option value or text, for other inputs use appropriate string/number */
      value: string | boolean | number
      /** Tab ID to set form value in. Must be a tab in the current group. Use tabs_context_mcp first if you don't have a valid tab ID. */
      tabId: number
      /** A few words saying what this form fill does on the page and to what, for example 'Sets the delivery date to 29 September'. State the effect only, and accurately: no reasons, nothing about what you were asked or allowed to do, no passwords or other secrets. */
      action_summary?: string
    }
    /** Extract raw text content from the page, prioritizing article content. Ideal for reading articles, blog posts, or other text-heavy pages. Returns plain text without HTML formatting. If you don't have a valid tab ID, use tabs_context_mcp first to get available tabs. */
    "mcp__claude-in-chrome__get_page_text": {
      /** Tab ID to extract text from. Must be a tab in the current group. Use tabs_context_mcp first if you don't have a valid tab ID. */
      tabId: number
    }
    /** Manage GIF recording and export for browser automation sessions. Control when to start/stop recording browser actions (clicks, scrolls, navigation), then export as an animated GIF with visual overlays (click indicators, action labels, progress bar, watermark). All operations are scoped to the tab's group. When starting recording, take a screenshot immediately after to capture the initial state as the first frame. When stopping recording, take a screenshot immediately before to capture the final state as the last frame. For export, either provide 'coordinate' to drag/drop upload to a page element, or set 'download: true' to download the GIF. */
    "mcp__claude-in-chrome__gif_creator": {
      /** Action to perform: 'start_recording' (begin capturing), 'stop_recording' (stop capturing but keep frames), 'export' (generate and export GIF), 'clear' (discard frames) */
      action: "start_recording" | "stop_recording" | "export" | "clear"
      /** Tab ID to identify which tab group this operation applies to */
      tabId: number
      /** Always set this to true for the 'export' action only. This causes the gif to be downloaded in the browser. */
      download?: boolean
      /** Optional filename for exported GIF (default: 'recording-[timestamp].gif'). For 'export' action only. */
      filename?: string
      /** Optional GIF enhancement options for 'export' action. Properties: showClickIndicators (bool), showDragPaths (bool), showActionLabels (bool), showProgressBar (bool), showWatermark (bool), quality (number 1-30). All default to true except quality (default: 10). */
      options?: {
        /** Show orange circles at click locations (default: true) */
        showClickIndicators?: boolean
        /** Show red arrows for drag actions (default: true) */
        showDragPaths?: boolean
        /** Show black labels describing actions (default: true) */
        showActionLabels?: boolean
        /** Show orange progress bar at bottom (default: true) */
        showProgressBar?: boolean
        /** Show Claude logo watermark (default: true) */
        showWatermark?: boolean
        /** GIF compression quality, 1-30 (lower = better quality, slower encoding). Default: 10 */
        quality?: number
      }
    }
    /** Execute JavaScript code in the context of the current page. The code runs in the page's context and can interact with the DOM, window object, and page variables. Returns the result of the last expression or any thrown errors. If you don't have a valid tab ID, use tabs_context_mcp first to get available tabs. */
    "mcp__claude-in-chrome__javascript_tool": {
      /** Must be set to 'javascript_exec' */
      action: string
      /** The JavaScript code to execute. Evaluated in the page context with REPL semantics: top-level `await` works, and the result of the last expression is returned automatically — write the expression you want (e.g. `window.myData.value`, or `await fetch(url).then(r=>r.json())`) rather than `return ...`. You can access and modify the DOM, call page functions, and interact with page variables. */
      text: string
      /** Tab ID to execute the code in. Must be a tab in the current group. Use tabs_context_mcp first if you don't have a valid tab ID. */
      tabId: number
    }
    /** List all Chrome browsers (extension instances) currently connected to this account. Returns each browser's deviceId, display name, OS platform, isLocal (its OS matches this computer's, a weak hint), when known onThisComputer (it is, or recently was, running on this computer), and inUse on the browser this session's actions go to when that is settled. When the user needs to choose a browser, use this to present the choices before select_browser. You do not need to call this before using the browser: when one browser is connected, or one was already chosen for this session, browser tools just work. Only if a browser tool reports that several browsers are connected and none is selected, or the user asks to change browsers, ask with the AskUserQuestion tool: one option per connected browser, the ones on this computer first (display name as the label, deviceId in parentheses), plus a final option labeled exactly: "Open a confirmation screen in every connected Chrome extension and let me select the right one there." Then call select_browser with the chosen deviceId, or switch_browser for the final option. Never pick one yourself. */
    "mcp__claude-in-chrome__list_connected_browsers": {}
    /** Navigate to a URL, or go forward/back in browser history. tabId may be omitted for URL navigation when calling navigate STANDALONE (not inside browser_batch): tabs_context_mcp{createIfEmpty:true} is called for you and the first tab in the session's group is navigated — its result is appended to this call's output so you have the tab list and ids for subsequent calls. Inside browser_batch, navigate (and other tools that act on a page) requires an explicit tabId. Pass an explicit tabId when you need a specific tab or when the session's group has multiple tabs whose state you must preserve. tabId is required for url:"back"/"forward". A tab opened for you this way is yours to clean up, the same as one from tabs_create_mcp: close it with tabs_close_mcp once you no longer need it and before finishing your task, unless the user asked to see it or wants it kept open. */
    "mcp__claude-in-chrome__navigate": {
      /** The URL to navigate to. Can be provided with or without protocol (defaults to https://). Use "forward" to go forward in history or "back" to go back in history. */
      url: string
      /** Tab ID to navigate. Must be a tab in the current group. If omitted for URL navigation when calling navigate standalone, tabs_context_mcp{createIfEmpty:true} is called for you. Required for url:"back"/"forward" and for navigate (and other tools that act on a page) inside browser_batch. */
      tabId?: number
    }
    /** Read browser console messages (console.log, console.error, console.warn, etc.) from a specific tab. Useful for debugging JavaScript errors, viewing application logs, or understanding what's happening in the browser console. Returns console messages from the current domain only. If you don't have a valid tab ID, use tabs_context_mcp first to get available tabs. IMPORTANT: Always provide a pattern to filter messages - without a pattern, you may get too many irrelevant messages. */
    "mcp__claude-in-chrome__read_console_messages": {
      /** Tab ID to read console messages from. Must be a tab in the current group. Use tabs_context_mcp first if you don't have a valid tab ID. */
      tabId: number
      /** If true, only return error and exception messages. Default is false (return all message types). */
      onlyErrors?: boolean
      /** If true, clear the console messages after reading to avoid duplicates on subsequent calls. Default is false. */
      clear?: boolean
      /** Regex pattern to filter console messages. Only messages matching this pattern will be returned (e.g., 'error|warning' to find errors and warnings, 'MyApp' to filter app-specific logs). You should always provide a pattern to avoid getting too many irrelevant messages. */
      pattern?: string
      /** Maximum number of messages to return. Defaults to 100. Increase only if you need more results. */
      limit?: number
    }
    /** Read HTTP network requests (XHR, Fetch, documents, images, etc.) from a specific tab. Useful for debugging API calls, monitoring network activity, or understanding what requests a page is making. Returns all network requests made by the current page, including cross-origin requests. Requests are automatically cleared when the page navigates to a different domain. If you don't have a valid tab ID, use tabs_context_mcp first to get available tabs. */
    "mcp__claude-in-chrome__read_network_requests": {
      /** Tab ID to read network requests from. Must be a tab in the current group. Use tabs_context_mcp first if you don't have a valid tab ID. */
      tabId: number
      /** Optional URL pattern to filter requests. Only requests whose URL contains this string will be returned (e.g., '/api/' to filter API calls, 'example.com' to filter by domain). */
      urlPattern?: string
      /** If true, clear the network requests after reading to avoid duplicates on subsequent calls. Default is false. */
      clear?: boolean
      /** Maximum number of requests to return. Defaults to 100. Increase only if you need more results. */
      limit?: number
    }
    /** Get an accessibility tree representation of elements on the page. By default returns all elements including non-visible ones. Output is limited to 50000 characters by default. If the output exceeds this limit it is truncated at a line boundary, with a note giving the full size — pass a larger max_chars, or use depth/ref_id to focus on part of the page. Optionally filter for only interactive elements. If you don't have a valid tab ID, use tabs_context_mcp first to get available tabs. */
    "mcp__claude-in-chrome__read_page": {
      /** Filter elements: "interactive" for buttons/links/inputs only, "all" for all elements including non-visible ones (default: all elements) */
      filter?: "interactive" | "all"
      /** Tab ID to read from. Must be a tab in the current group. Use tabs_context_mcp first if you don't have a valid tab ID. */
      tabId: number
      /** Maximum depth of the tree to traverse (default: 15). Use a smaller depth if output is too large. */
      depth?: number
      /** Reference ID of a parent element to read. Will return the specified element and all its children. Use this to focus on a specific part of the page when output is too large. */
      ref_id?: string
      /** Maximum characters for output (default: 50000). Set to a higher value if your client can handle large outputs. */
      max_chars?: number
    }
    /** Resize the current browser window to specified dimensions. Useful for testing responsive designs or setting up specific screen sizes. If you don't have a valid tab ID, use tabs_context_mcp first to get available tabs. */
    "mcp__claude-in-chrome__resize_window": {
      /** Target window width in pixels */
      width: number
      /** Target window height in pixels */
      height: number
      /** Tab ID to get the window for. Must be a tab in the current group. Use tabs_context_mcp first if you don't have a valid tab ID. */
      tabId: number
    }
    /** Select a specific Chrome browser by deviceId for browser automation, without broadcasting a pairing request. Use this after list_connected_browsers when the user has chosen one from the list. */
    "mcp__claude-in-chrome__select_browser": {
      /** The deviceId from list_connected_browsers. */
      deviceId: string
    }
    /** Execute a shortcut or workflow by running it in a new sidepanel window using the current tab (shortcuts and workflows are interchangeable). Use shortcuts_list first to see available shortcuts. This starts the execution and returns immediately - it does not wait for completion. */
    "mcp__claude-in-chrome__shortcuts_execute": {
      /** Tab ID to execute the shortcut on. Must be a tab in the current group. Use tabs_context_mcp first if you don't have a valid tab ID. */
      tabId: number
      /** The ID of the shortcut to execute */
      shortcutId?: string
      /** The command name of the shortcut to execute (e.g., 'debug', 'summarize'). Do not include the leading slash. */
      command?: string
    }
    /** List all available shortcuts and workflows (shortcuts and workflows are interchangeable). Returns shortcuts with their commands, descriptions, and whether they are workflows. Use shortcuts_execute to run a shortcut or workflow. */
    "mcp__claude-in-chrome__shortcuts_list": {
      /** Tab ID to list shortcuts from. Must be a tab in the current group. Use tabs_context_mcp first if you don't have a valid tab ID. */
      tabId: number
    }
    /** Send a connection request to every Chrome browser with the extension installed and wait (up to 2 minutes) for the user to click 'Connect' in the one they want to use. The user can name the browser when they connect. Use this when the user wants to pick the browser themselves from inside Chrome rather than choosing from a list; otherwise prefer select_browser with a known deviceId. */
    "mcp__claude-in-chrome__switch_browser": {}
    /** Close a tab in the MCP tab group by its ID. Use to clean up tabs you're done with. Only tabs in this session's group are closable; call tabs_context_mcp first to get valid IDs. If you close the group's last tab, Chrome auto-removes the group — the next tabs_context_mcp with createIfEmpty starts fresh. */
    "mcp__claude-in-chrome__tabs_close_mcp": {
      /** The ID of the tab to close. Must be in this session's tab group. Get valid IDs from tabs_context_mcp. */
      tabId: number
    }
    /** Get context information about the current MCP tab group. Returns all tab IDs inside the group if it exists. CRITICAL: You must get the context at least once before using other browser automation tools so you know what tabs exist. Each new conversation should create its own new tab (using tabs_create_mcp) rather than reusing existing tabs, unless the user explicitly asks to use an existing tab. */
    "mcp__claude-in-chrome__tabs_context_mcp": {
      /** Creates a new MCP tab group if none exists, creates a new Window with a new tab group containing an empty tab (which can be used for this conversation). If a MCP tab group already exists, this parameter has no effect. */
      createIfEmpty?: boolean
    }
    /** Creates a new empty tab in the MCP tab group. CRITICAL: You must get the context using tabs_context_mcp at least once before using other browser automation tools so you know what tabs exist. Tabs you create are yours to clean up: close each one with tabs_close_mcp as soon as you no longer need it, and close any that remain before finishing your task. Leave a tab open only if the user asked to see it or wants it kept open. */
    "mcp__claude-in-chrome__tabs_create_mcp": {}
    /** Upload a screenshot you took with the computer tool's screenshot action to a file input or drag & drop target. Screenshot IDs expire a few minutes after capture, so take the screenshot of what you want to upload right before uploading. Don't reuse an ID that an upload already failed with: to retry, take a new screenshot of the same content, and retry that upload at most once (never after the user declined). This tool cannot upload user-attached images or other files; use file_upload with the file's path for those, if that tool is available. Supports two approaches: (1) ref - for targeting specific elements, especially hidden file inputs, (2) coordinate - for drag & drop to visible locations like Google Docs. Provide either ref or coordinate, not both. */
    "mcp__claude-in-chrome__upload_image": {
      /** ID of a screenshot from the computer tool's screenshot action, taken shortly before this call. IDs of user-attached images are not accepted. */
      imageId: string
      /** Element reference ID from read_page or find tools (e.g., "ref_1", "ref_2"). Use this for file inputs (especially hidden ones) or specific elements. Provide either ref or coordinate, not both. */
      ref?: string
      /** Viewport coordinates [x, y] for drag & drop to a visible location. Use this for drag & drop targets like Google Docs. Provide either ref or coordinate, not both. */
      coordinate?: number[]
      /** Tab ID where the target element is located. This is where the image will be uploaded to. */
      tabId: number
      /** Optional filename for the uploaded file (default: "image.png") */
      filename?: string
    }
    /** Add review comment to the requester's latest pending pull request review. A pending review needs to already exist to call this (check with the user if not sure). */
    mcp__github__add_comment_to_pending_review: {
      /** The text of the review comment */
      body: string
      /** The line of the blob in the pull request diff that the comment applies to. For multi-line comments, the last line of the range */
      line?: number
      /** Repository owner */
      owner: string
      /** The relative path to the file that necessitates a comment */
      path: string
      /** Pull request number */
      pullNumber: number
      /** Repository name */
      repo: string
      /** The side of the diff to comment on. LEFT indicates the previous state, RIGHT indicates the new state */
      side?: "LEFT" | "RIGHT"
      /** For multi-line comments, the first line of the range that the comment applies to */
      startLine?: number
      /** For multi-line comments, the starting side of the diff that the comment applies to. LEFT indicates the previous state, RIGHT indicates the new state */
      startSide?: "LEFT" | "RIGHT"
      /** The level at which the comment is targeted */
      subjectType: "FILE" | "LINE"
    }
    /** Add a comment and/or reaction to a specific issue or issue comment in a GitHub repository. Use this tool with pull requests as well (in this case pass pull request number as issue_number), but only if user is not asking specifically to add or react to review comments. At least one of body or reaction is required. */
    mcp__github__add_issue_comment: {
      /** Comment content. Required unless reaction is provided. */
      body?: string
      /** The numeric ID of the issue or pull request comment to react to. Use this for reactions to comments; omit it to react to the issue or pull request itself. Cannot be combined with body. */
      comment_id?: number
      /** Issue or pull request number to comment on or react to. */
      issue_number: number
      /** Repository owner */
      owner: string
      /** Emoji reaction to add. Required unless body is provided. */
      reaction?: "+1" | "-1" | "laugh" | "confused" | "heart" | "hooray" | "rocket" | "eyes"
      /** Repository name */
      repo: string
    }
    /** Add a reply and/or reaction to an existing pull request comment. This can create a new comment linked as a reply to the specified comment, add an emoji reaction to the specified comment, or do both. At least one of body or reaction is required. */
    mcp__github__add_reply_to_pull_request_comment: {
      /** The text of the reply. Required unless reaction is provided. */
      body?: string
      /** The numeric ID of the pull request review comment to reply or react to. Use the number from a #discussion_r... anchor, not the GraphQL thread node ID (PRRT_...). */
      commentId: number
      /** Repository owner */
      owner: string
      /** Pull request number. Required when body is provided. */
      pullNumber?: number
      /** Emoji reaction to add. Required unless body is provided. */
      reaction?: "+1" | "-1" | "laugh" | "confused" | "heart" | "hooray" | "rocket" | "eyes"
      /** Repository name */
      repo: string
    }
    /** Assign Copilot to a specific issue in a GitHub repository. This tool can help with the following outcomes: - a Pull Request created with source code changes to resolve the issue More information can be found at: - https://docs.github.com/en/copilot/concepts/agents/cloud-agent/about-cloud-agent */
    mcp__github__assign_copilot_to_issue: {
      /** Git reference (e.g., branch) that the agent will start its work from. If not specified, defaults to the repository's default branch */
      base_ref?: string
      /** Optional custom instructions to guide the agent beyond the issue body. Use this to provide additional context, constraints, or guidance that is not captured in the issue description */
      custom_instructions?: string
      /** Issue number */
      issue_number: number
      /** Repository owner */
      owner: string
      /** Repository name */
      repo: string
    }
    /** Create a new branch in a GitHub repository */
    mcp__github__create_branch: {
      /** Name for new branch */
      branch: string
      /** Source branch (defaults to repo default) */
      from_branch?: string
      /** Repository owner */
      owner: string
      /** Repository name */
      repo: string
    }
    /** Create or update a single file in a GitHub repository. If updating, you should provide the SHA of the file you want to update. Use this tool to create or update a file in a GitHub repository remotely; do not use it for local file operations. To obtain the current blob SHA before updating, call the get_file_contents tool with the same owner, repo, and path, and set its ref parameter to this tool's branch value. The first text result reports the blob SHA for the requested path. SHA MUST be provided for existing file updates. */
    mcp__github__create_or_update_file: {
      /** Set true to update a symbolic link itself; content must be its new target path. */
      allow_symlink_write?: boolean
      /** Branch to create/update the file in */
      branch: string
      /** Content of the file, exactly as it should appear once written. Do not base64-encode it; this server does that before calling the REST API. */
      content: string
      /** Commit message */
      message: string
      /** Repository owner (username or organization) */
      owner: string
      /** Path where to create/update the file */
      path: string
      /** Repository name */
      repo: string
      /** The blob SHA of the file being replaced. Required if the file already exists. Retrieve it with get_file_contents using the same owner, repo, and path, with ref set to this tool's branch value. */
      sha?: string
    }
    /** Create a new pull request in a GitHub repository. */
    mcp__github__create_pull_request: {
      /** Branch to merge into */
      base: string
      /** PR description */
      body?: string
      /** Create as draft PR */
      draft?: boolean
      /** Branch containing changes */
      head: string
      /** Allow maintainer edits */
      maintainer_can_modify?: boolean
      /** Repository owner */
      owner: string
      /** Repository name */
      repo: string
      /** GitHub usernames or ORG/team-slug team reviewers to request reviews from */
      reviewers?: string[]
      /** PR title */
      title: string
    }
    /** Create a new GitHub repository in your account or specified organization */
    mcp__github__create_repository: {
      /** Initialize with README */
      autoInit?: boolean
      /** Repository description */
      description?: string
      /** Repository name */
      name: string
      /** Organization to create the repository in (omit to create in your personal account) */
      organization?: string
      /** Whether the repository should be private. Defaults to true (private) when omitted. */
      private?: boolean
    }
    /** Delete a file from a GitHub repository */
    mcp__github__delete_file: {
      /** Branch to delete the file from */
      branch: string
      /** Commit message */
      message: string
      /** Repository owner (username or organization) */
      owner: string
      /** Path to the file to delete */
      path: string
      /** Repository name */
      repo: string
    }
    /** Delete a GitHub repository after the user confirms the exact owner/repository name */
    mcp__github__delete_repository: {
      /** Repository owner (username or organization) */
      owner: string
      /** Repository name */
      repo: string
    }
    /** Fork a GitHub repository to your account or specified organization */
    mcp__github__fork_repository: {
      /** Organization to fork to */
      organization?: string
      /** Repository owner */
      owner: string
      /** Repository name */
      repo: string
    }
    /** Get details for a commit from a GitHub repository */
    mcp__github__get_commit: {
      /** Level of detail to include for changed files. "none" omits stats and files entirely. "stats" (default) includes per-file metadata: filename, status, and lines-of-code counts (additions, deletions, changes), with no patch content. "full_patch" additionally includes the unified diff content for each file and can be very large. */
      detail?: "none" | "stats" | "full_patch"
      /** Repository owner */
      owner: string
      /** Page number for pagination (min 1) */
      page?: number
      /** Results per page for pagination (min 1, max 100) */
      perPage?: number
      /** Repository name */
      repo: string
      /** Commit SHA, branch name, or tag name */
      sha: string
    }
    /** Get the contents of a file or directory from a GitHub repository */
    mcp__github__get_file_contents: {
      /** Subset of fields to return for each entry when the path is a directory. If omitted, all fields are returned. Ignored when the path is a single file. Use this to reduce response size when listing directories and you only need specific fields, e.g. just 'name' and 'type'. */
      fields?: Array<"type" | "name" | "path" | "size" | "sha" | "url" | "git_url" | "html_url" | "download_url">
      /** Repository owner (username or organization) */
      owner: string
      /** Path to file/directory */
      path?: string
      /** Accepts optional git refs such as `refs/tags/{tag}`, `refs/heads/{branch}` or `refs/pull/{pr_number}/head` */
      ref?: string
      /** Repository name */
      repo: string
      /** Accepts optional commit SHA. If specified, it will be used instead of ref */
      sha?: string
    }
    /** Get a specific label from a repository. */
    mcp__github__get_label: {
      /** Label name. */
      name: string
      /** Repository owner (username or organization name) */
      owner: string
      /** Repository name */
      repo: string
    }
    /** Get the latest release in a GitHub repository */
    mcp__github__get_latest_release: {
      /** Repository owner */
      owner: string
      /** Repository name */
      repo: string
    }
    /** Get details of the authenticated GitHub user. Use this when a request is about the user's own profile for GitHub. Or when information is missing to build other tool calls. */
    mcp__github__get_me: {}
    /** Get a specific release by its tag name in a GitHub repository */
    mcp__github__get_release_by_tag: {
      /** Repository owner */
      owner: string
      /** Repository name */
      repo: string
      /** Tag name (e.g., 'v1.0.0') */
      tag: string
    }
    /** Get details about a specific git tag in a GitHub repository */
    mcp__github__get_tag: {
      /** Repository owner */
      owner: string
      /** Repository name */
      repo: string
      /** Tag name */
      tag: string
    }
    /** Get member usernames of a specific team in an organization. Limited to organizations accessible with current credentials */
    mcp__github__get_team_members: {
      /** Organization login (owner) that contains the team. */
      org: string
      /** Team slug */
      team_slug: string
    }
    /** Get details of the teams the user is a member of. Limited to organizations accessible with current credentials */
    mcp__github__get_teams: {
      /** Username to get teams for. If not provided, uses the authenticated user. */
      user?: string
    }
    /** Get information about a specific issue in a GitHub repository. */
    mcp__github__issue_read: {
      /** The number of the issue */
      issue_number: number
      /** The read operation to perform on a single issue. Options are: 1. get - Get issue details. Also returns best-effort hierarchy flags (`has_parent`, `has_children`); `parent` and `sub_issues_summary` are optional relationship summaries, and `closed_by_pull_requests` summarizes the pull requests configured to close the issue as `total_count` plus up to 5 `references`. 2. get_comments - Get issue comments. 3. get_sub_issues - Get sub-issues (children) of the issue. 4. get_parent - Get the parent issue, if this issue is a sub-issue of another. 5. get_labels - Get labels assigned to the issue. */
      method: "get" | "get_comments" | "get_sub_issues" | "get_parent" | "get_labels"
      /** The owner of the repository */
      owner: string
      /** Page number for pagination (min 1) */
      page?: number
      /** Results per page for pagination (min 1, max 100) */
      perPage?: number
      /** The name of the repository */
      repo: string
    }
    /** Create a new or update an existing issue in a GitHub repository. */
    mcp__github__issue_write: {
      /** Usernames to assign to this issue */
      assignees?: string[]
      /** Issue body content */
      body?: string
      /** Issue number that this issue is a duplicate of. Required when state_reason is 'duplicate'. */
      duplicate_of?: number
      /** Issue field values to set or clear. Each item requires 'field_name' and exactly one of 'value', 'field_option_name', or 'delete: true'. */
      issue_fields?: Array<{
        /** Set to true to clear this field's current value on the issue. When false or omitted, this property is ignored. Cannot be true when 'value' or 'field_option_name' is provided. */
        delete?: boolean
        /** Issue field name (case-insensitive). Must match a field returned by list_issue_fields for this repository or its organization. */
        field_name: string
        /** Option name for single-select fields. Validated against the field's options before the API call. Cannot be combined with 'value' or 'delete: true'. */
        field_option_name?: string
        /** Value to set. Use for text, number, and date fields (date as YYYY-MM-DD). For single-select fields, prefer 'field_option_name' so the option is validated before the API call. Cannot be combined with 'field_option_name' or 'delete: true'. */
        value?: string | number | boolean
      }>
      /** Issue number to update */
      issue_number?: number
      /** Labels to apply to this issue */
      labels?: string[]
      /** Write operation to perform on a single issue. Options are: - 'create' - creates a new issue. - 'update' - updates an existing issue. */
      method: "create" | "update"
      /** Milestone number */
      milestone?: number
      /** Repository owner */
      owner: string
      /** Issue number of the parent issue. Only used when method is 'create' and cannot be combined with issue_fields. The new issue is created and attached to this parent in the same operation. */
      parent_issue_number?: number
      /** Repository owner of the parent issue. Must be provided with parent_repo. Omit both to use owner and repo. Only used when method is 'create' and parent_issue_number is provided. */
      parent_owner?: string
      /** Repository name of the parent issue. Must be provided with parent_owner. Omit both to use owner and repo. Only used when method is 'create' and parent_issue_number is provided. */
      parent_repo?: string
      /** Repository name */
      repo: string
      /** New state */
      state?: "open" | "closed"
      /** Reason for the state change. Ignored unless state is changed. */
      state_reason?: "completed" | "not_planned" | "duplicate"
      /** Issue title */
      title?: string
      /** Type of this issue. For updates, pass null to remove the current type. Only use if issue types are enabled for this repository. Use list_issue_types to get valid type values for this repository or its owner organization. If the repository doesn't support issue types, omit this parameter. */
      type?: string | null
    }
    /** List branches in a GitHub repository */
    mcp__github__list_branches: {
      /** Repository owner */
      owner: string
      /** Page number for pagination (min 1) */
      page?: number
      /** Results per page for pagination (min 1, max 100) */
      perPage?: number
      /** Repository name */
      repo: string
    }
    /** Get list of commits of a branch in a GitHub repository. Returns at least 30 results per page by default, but can return more if specified using the perPage parameter (up to 100). */
    mcp__github__list_commits: {
      /** Author username or email address to filter commits by */
      author?: string
      /** Subset of fields to return for each commit. If omitted, all fields are returned. Use this to reduce response size when you only need specific fields, e.g. just 'sha' and 'html_url'. */
      fields?: Array<"sha" | "html_url" | "commit" | "author" | "committer">
      /** Repository owner */
      owner: string
      /** Page number for pagination (min 1) */
      page?: number
      /** Only commits containing this file path will be returned */
      path?: string
      /** Results per page for pagination (min 1, max 100) */
      perPage?: number
      /** Repository name */
      repo: string
      /** Commit SHA, branch or tag name to list commits of. If not provided, uses the default branch of the repository. If a commit SHA is provided, will list commits up to that SHA. */
      sha?: string
      /** Only commits after this date will be returned (ISO 8601 format: YYYY-MM-DDTHH:MM:SSZ or YYYY-MM-DD) */
      since?: string
      /** Only commits before this date will be returned (ISO 8601 format: YYYY-MM-DDTHH:MM:SSZ or YYYY-MM-DD) */
      until?: string
    }
    /** List issue fields for a repository or organization. Returns field definitions including name, type (text, number, date, single_select), and for single_select fields the list of valid option names. When repo is omitted, returns org-level fields directly. */
    mcp__github__list_issue_fields: {
      /** The account owner of the repository or organization. The name is not case sensitive. */
      owner: string
      /** The name of the repository. When provided, returns fields for this specific repository (inherited from its organization). When omitted, returns org-level fields directly. */
      repo?: string
    }
    /** List supported issue types for a repository or its owner organization. When repo is omitted, returns org-level issue types directly. */
    mcp__github__list_issue_types: {
      /** The account owner of the repository or organization. */
      owner: string
      /** The name of the repository. When provided, returns issue types for this specific repository. When omitted, returns org-level issue types directly. */
      repo?: string
    }
    /** List issues in a GitHub repository. For pagination, use the 'endCursor' from the previous response's 'pageInfo' in the 'after' parameter. */
    mcp__github__list_issues: {
      /** Cursor for pagination. Use the cursor from the previous response. */
      after?: string
      /** Order direction. If provided, the 'orderBy' also needs to be provided. */
      direction?: "ASC" | "DESC"
      /** Filter by custom issue field values. Each entry takes a field_name and a value; the server looks up the field and coerces the value to its type (single-select option name, text, number, or YYYY-MM-DD date). */
      field_filters?: Array<{
        /** Name of the custom field (e.g. "Priority"). Case-insensitive. */
        field_name: string
        /** Value to filter on. For single-select fields, the option name (e.g. "P1"). For dates, YYYY-MM-DD. For numbers, the numeric value as a string. For text, the text value. */
        value: string
      }>
      /** Subset of fields to return for each issue. If omitted, all fields are returned. Use this to reduce response size when you only need specific fields; omitting 'body' and 'field_values' in particular drops the largest per-result data. */
      fields?: Array<"number" | "title" | "body" | "state" | "user" | "labels" | "assignees" | "comments" | "created_at" | "updated_at" | "field_values">
      /** Filter by labels */
      labels?: string[]
      /** Order issues by field. If provided, the 'direction' also needs to be provided. */
      orderBy?: "CREATED_AT" | "UPDATED_AT" | "COMMENTS"
      /** Repository owner */
      owner: string
      /** Results per page for pagination (min 1, max 100) */
      perPage?: number
      /** Repository name */
      repo: string
      /** Filter by date (ISO 8601 timestamp) */
      since?: string
      /** Filter by state, by default both open and closed issues are returned when not provided */
      state?: "OPEN" | "CLOSED"
    }
    /** List pull requests in a GitHub repository. If the user specifies an author, then DO NOT use this tool and use the search_pull_requests tool instead. */
    mcp__github__list_pull_requests: {
      /** Filter by base branch */
      base?: string
      /** Sort direction */
      direction?: "asc" | "desc"
      /** Subset of fields to return for each pull request. If omitted, all fields are returned. Use this to reduce response size when you only need specific fields; omitting 'body' in particular drops the largest per-result data. */
      fields?: Array<"number" | "title" | "body" | "state" | "draft" | "merged" | "mergeable_state" | "html_url" | "user" | "labels" | "assignees" | "requested_reviewers" | "merged_by" | "head" | "base" | "additions" | "deletions" | "changed_files" | "commits" | "comments" | "created_at" | "updated_at" | "closed_at" | "merged_at" | "milestone">
      /** Filter by head user/org and branch */
      head?: string
      /** Repository owner */
      owner: string
      /** Page number for pagination (min 1) */
      page?: number
      /** Results per page for pagination (min 1, max 100) */
      perPage?: number
      /** Repository name */
      repo: string
      /** Sort by */
      sort?: "created" | "updated" | "popularity" | "long-running"
      /** Filter by state */
      state?: "open" | "closed" | "all"
    }
    /** List releases in a GitHub repository */
    mcp__github__list_releases: {
      /** Subset of fields to return for each release. If omitted, all fields are returned. Use this to reduce response size when you only need specific fields; omitting 'body' in particular drops the largest per-release data. */
      fields?: Array<"id" | "tag_name" | "name" | "body" | "html_url" | "published_at" | "prerelease" | "draft" | "author">
      /** Repository owner */
      owner: string
      /** Page number for pagination (min 1) */
      page?: number
      /** Results per page for pagination (min 1, max 100) */
      perPage?: number
      /** Repository name */
      repo: string
    }
    /** List collaborators of a GitHub repository. Results are paginated; the response includes `nextPage`, `prevPage`, `firstPage`, and `lastPage` fields. To get the next page, use the `nextPage` value as the `page` parameter. */
    mcp__github__list_repository_collaborators: {
      /** Filter by affiliation. Can be one of: 'outside' (outside collaborators), 'direct' (all with permissions regardless of org membership), 'all' (all collaborators). Default: 'all' */
      affiliation?: "outside" | "direct" | "all"
      /** Repository owner */
      owner: string
      /** Page number for pagination (default 1, min 1) */
      page?: number
      /** Results per page for pagination (default 30, min 1, max 100) */
      perPage?: number
      /** Repository name */
      repo: string
    }
    /** List git tags in a GitHub repository */
    mcp__github__list_tags: {
      /** Repository owner */
      owner: string
      /** Page number for pagination (min 1) */
      page?: number
      /** Results per page for pagination (min 1, max 100) */
      perPage?: number
      /** Repository name */
      repo: string
    }
    /** Merge a pull request in a GitHub repository. */
    mcp__github__merge_pull_request: {
      /** Extra detail for merge commit */
      commit_message?: string
      /** Title for merge commit */
      commit_title?: string
      /** The expected SHA of the pull request's HEAD ref */
      expectedHeadSha?: string
      /** Merge method */
      merge_method?: "merge" | "squash" | "rebase"
      /** Repository owner */
      owner: string
      /** Pull request number */
      pullNumber: number
      /** Repository name */
      repo: string
    }
    /** Get information on a specific pull request in GitHub repository. */
    mcp__github__pull_request_read: {
      /** Cursor for pagination, used only by the get_review_comments method. Pass the endCursor from the previous page's PageInfo to fetch the next page. */
      after?: string
      /** Action to specify what pull request data needs to be retrieved from GitHub. Possible options: 1. get - Get details of a specific pull request. 2. get_diff - Get the diff of a pull request. 3. get_status - Get combined commit status of a head commit in a pull request. 4. get_files - Get the list of files changed in a pull request. Use with pagination parameters to control the number of results returned. 5. get_commits - Get the list of commits on a pull request. Use with pagination parameters to control the number of results returned. 6. get_review_comments - Get review threads on a pull request. Each thread contains logically grouped review comments made on the same code location during pull request reviews. Returns thread metadata and comments with nullable current and original line-range coordinates (line, start_line, original_line, original_start_line). Current coordinates are omitted when unavailable, such as for outdated comments. Use cursor-based pagination (perPage, after) to control results. 7. get_reviews - Get the reviews on a pull request. When asked for review comments, use get_review_comments method. Use with pagination parameters to control the number of results returned. 8. get_comments - Get comments on a pull request. Use this if user doesn't specifically want review comments. Use with pagination parameters to control the number of results returned. 9. get_check_runs - Get check runs for the head commit of a pull request. Check runs are the individual CI/CD jobs and checks that run on the PR. */
      method: "get" | "get_diff" | "get_status" | "get_files" | "get_commits" | "get_review_comments" | "get_reviews" | "get_comments" | "get_check_runs"
      /** Repository owner */
      owner: string
      /** Page number for pagination (min 1) */
      page?: number
      /** Results per page for pagination (min 1, max 100) */
      perPage?: number
      /** Pull request number */
      pullNumber: number
      /** Repository name */
      repo: string
    }
    /** Create and/or submit, delete review of a pull request. Available methods: - create: Create a new review of a pull request. If "event" parameter is provided, the review is submitted. If "event" is omitted, a pending review is created. - submit_pending: Submit an existing pending review of a pull request. This requires that a pending review exists for the current user on the specified pull request. The "body" and "event" parameters are used when submitting the review. - delete_pending: Delete an existing pending review of a pull request. This requires that a pending review exists for the current user on the specified pull request. - resolve_thread: Resolve a review thread. Requires only "threadId" parameter with the thread's node ID (e.g., PRRT_kwDOxxx). The owner, repo, and pullNumber parameters are not used for this method. Resolving an already-resolved thread is a no-op. - unresolve_thread: Unresolve a previously resolved review thread. Requires only "threadId" parameter. The owner, repo, and pullNumber parameters are not used for this method. Unresolving an already-unresolved thread is a no-op. */
    mcp__github__pull_request_review_write: {
      /** Review comment text */
      body?: string
      /** SHA of commit to review */
      commitID?: string
      /** Review action to perform. */
      event?: "APPROVE" | "REQUEST_CHANGES" | "COMMENT"
      /** The write operation to perform on pull request review. */
      method: "create" | "submit_pending" | "delete_pending" | "resolve_thread" | "unresolve_thread"
      /** Repository owner */
      owner: string
      /** Pull request number */
      pullNumber: number
      /** Repository name */
      repo: string
      /** The node ID of the review thread (e.g., PRRT_kwDOxxx). Required for resolve_thread and unresolve_thread methods. Get thread IDs from pull_request_read with method get_review_comments. */
      threadId?: string
    }
    /** Push multiple files to a GitHub repository in a single commit */
    mcp__github__push_files: {
      /** Branch to push to */
      branch: string
      /** Array of file objects to push, each object with path (string) and content (string) */
      files: Array<{
        /** file content */
        content: string
        /** path to the file */
        path: string
      }>
      /** Commit message */
      message: string
      /** Repository owner */
      owner: string
      /** Repository name */
      repo: string
    }
    /** Request a GitHub Copilot code review for a pull request. Use this for automated feedback on pull requests, usually before requesting a human reviewer. */
    mcp__github__request_copilot_review: {
      /** Repository owner */
      owner: string
      /** Pull request number */
      pullNumber: number
      /** Repository name */
      repo: string
    }
    /** Fast and precise code search across ALL GitHub repositories using GitHub's native search engine. Best for finding exact symbols, functions, classes, or specific code patterns. */
    mcp__github__search_code: {
      /** Subset of fields to return for each code search result. If omitted, all fields are returned. Use this to reduce response size when you only need specific fields; omitting 'repository' and 'text_matches' in particular drops the largest per-result data. */
      fields?: Array<"name" | "path" | "sha" | "repository" | "text_matches">
      /** Sort order for results */
      order?: "asc" | "desc"
      /** Page number for pagination (min 1) */
      page?: number
      /** Results per page for pagination (min 1, max 100) */
      perPage?: number
      /** Search query (GitHub code search REST). Implicit AND between terms; supports `OR`, `NOT`, and `"quoted phrase"` for exact match. Qualifiers: `repo:owner/repo`, `org:`, `user:`, `language:`, `path:dir` (prefix match), `filename:exact.ext`, `extension:`, `in:file`, `in:path`, `size:`, `is:archived`, `is:fork`. Max 256 chars. Examples: `WithContext language:go org:github`; `"package main" repo:o/r`; `func extension:go path:cmd repo:o/r`; `NOT TODO language:go repo:o/r`. */
      query: string
      /** Sort field ('indexed' only) */
      sort?: string
    }
    /** Search for commits across GitHub repositories using GitHub's commit search syntax. Useful for finding specific changes, authors, or messages across one or many repositories. Searches the default branch only. */
    mcp__github__search_commits: {
      /** Sort order */
      order?: "asc" | "desc"
      /** Page number for pagination (min 1) */
      page?: number
      /** Results per page for pagination (min 1, max 100) */
      perPage?: number
      /** Commit search query (GitHub commit search REST). Searches commit messages on the default branch only. Scope the search with `repo:owner/repo`, `org:`, or `user:` (queries without a scope qualifier match across all of GitHub and are usually not what you want). Other qualifiers: `author:`, `committer:`, `author-name:`, `committer-name:`, `author-email:`, `committer-email:`, `author-date:`, `committer-date:` (supports `>`, `<`, `>=`, `<=`, and `YYYY-MM-DD..YYYY-MM-DD` ranges), `merge:true|false`, `hash:`, `tree:`, `parent:`, `is:public`. Examples: `repo:owner/repo fix panic`; `org:github author:defunkt committer-date:>=2024-01-01`; `"refactor cache" repo:o/r`; `hash:abc1234 repo:o/r`. */
      query: string
      /** Sort by author or committer date (defaults to best match) */
      sort?: "author-date" | "committer-date"
    }
    /** Search issues using natural-language semantic matching. Best for conceptual or paraphrased queries (e.g. "login fails after password reset"). Already scoped to is:issue. */
    mcp__github__search_issues: {
      /** Subset of fields to return for each issue result. If omitted, all fields are returned. Use this to reduce response size when you only need specific fields; omitting 'body', 'reactions', and 'labels' in particular drops the largest per-result data. */
      fields?: Array<"number" | "title" | "body" | "state" | "state_reason" | "draft" | "locked" | "html_url" | "user" | "author_association" | "labels" | "assignee" | "assignees" | "milestone" | "comments" | "reactions" | "created_at" | "updated_at" | "closed_at" | "closed_by" | "type" | "repository_url" | "pull_request" | "field_values">
      /** Sort order */
      order?: "asc" | "desc"
      /** Optional repository owner. If provided with repo, only issues for this repository are listed. */
      owner?: string
      /** Page number for pagination (min 1) */
      page?: number
      /** Results per page for pagination (min 1, max 100) */
      perPage?: number
      /** The search query, as natural language. When the user gives alternative wordings, include them as plain words rather than joining them with OR. */
      query: string
      /** Optional repository name. If provided with owner, only issues for this repository are listed. */
      repo?: string
      /** Sort field by number of matches of categories, defaults to best match */
      sort?: "comments" | "reactions" | "reactions-+1" | "reactions--1" | "reactions-smile" | "reactions-thinking_face" | "reactions-heart" | "reactions-tada" | "interactions" | "created" | "updated"
    }
    /** Search for pull requests in GitHub repositories using issues search syntax already scoped to is:pr */
    mcp__github__search_pull_requests: {
      /** Subset of fields to return for each pull request result. If omitted, all fields are returned. Use this to reduce response size when you only need specific fields; omitting 'body', 'reactions', and 'labels' in particular drops the largest per-result data. */
      fields?: Array<"number" | "title" | "body" | "state" | "state_reason" | "draft" | "locked" | "html_url" | "user" | "author_association" | "labels" | "assignee" | "assignees" | "milestone" | "comments" | "reactions" | "created_at" | "updated_at" | "closed_at" | "closed_by" | "pull_request" | "repository_url">
      /** Sort order */
      order?: "asc" | "desc"
      /** Optional repository owner. If provided with repo, only pull requests for this repository are listed. */
      owner?: string
      /** Page number for pagination (min 1) */
      page?: number
      /** Results per page for pagination (min 1, max 100) */
      perPage?: number
      /** Search query using GitHub pull request search syntax */
      query: string
      /** Optional repository name. If provided with owner, only pull requests for this repository are listed. */
      repo?: string
      /** Sort field by number of matches of categories, defaults to best match */
      sort?: "comments" | "reactions" | "reactions-+1" | "reactions--1" | "reactions-smile" | "reactions-thinking_face" | "reactions-heart" | "reactions-tada" | "interactions" | "created" | "updated"
    }
    /** Find GitHub repositories by name, description, readme, topics, or other metadata. Perfect for discovering projects, finding examples, or locating specific repositories across GitHub. */
    mcp__github__search_repositories: {
      /** Return minimal repository information (default: true). When false, returns full GitHub API repository objects. */
      minimal_output?: boolean
      /** Sort order */
      order?: "asc" | "desc"
      /** Page number for pagination (min 1) */
      page?: number
      /** Results per page for pagination (min 1, max 100) */
      perPage?: number
      /** Repository search query. Examples: 'machine learning in:name stars:>1000 language:python', 'topic:react', 'user:facebook'. Supports advanced search syntax for precise filtering. */
      query: string
      /** Sort repositories by field, defaults to best match */
      sort?: "stars" | "forks" | "help-wanted-issues" | "updated"
    }
    /** Find GitHub users by username, real name, or other profile information. Useful for locating developers, contributors, or team members. */
    mcp__github__search_users: {
      /** Sort order */
      order?: "asc" | "desc"
      /** Page number for pagination (min 1) */
      page?: number
      /** Results per page for pagination (min 1, max 100) */
      perPage?: number
      /** User search query. Examples: 'john smith', 'location:seattle', 'followers:>100'. Search is automatically scoped to type:user. */
      query: string
      /** Sort users by number of followers or repositories, or when the person joined GitHub. */
      sort?: "followers" | "repositories" | "joined"
    }
    /** Add a sub-issue to a parent issue in a GitHub repository. */
    mcp__github__sub_issue_write: {
      /** The ID of the sub-issue to be prioritized after (either after_id OR before_id should be specified) */
      after_id?: number
      /** The ID of the sub-issue to be prioritized before (either after_id OR before_id should be specified) */
      before_id?: number
      /** The number of the parent issue */
      issue_number: number
      /** The action to perform on a single sub-issue Options are: - 'add' - add a sub-issue to a parent issue in a GitHub repository. - 'remove' - remove a sub-issue from a parent issue in a GitHub repository. - 'reprioritize' - change the order of sub-issues within a parent issue in a GitHub repository. Use either 'after_id' or 'before_id' to specify the new position. Writes issue hierarchy. To move a sub-issue to a new parent, use `add` with `replace_parent=true`; there is no writable parent field. */
      method: string
      /** Repository owner */
      owner: string
      /** When true, replaces the sub-issue's current parent issue. Use with 'add' method only. */
      replace_parent?: boolean
      /** Repository name */
      repo: string
      /** The ID of the sub-issue to add. ID is not the same as issue number */
      sub_issue_id: number
    }
    /** Update an existing pull request in a GitHub repository. */
    mcp__github__update_pull_request: {
      /** New base branch name */
      base?: string
      /** New description */
      body?: string
      /** Mark pull request as draft (true) or ready for review (false) */
      draft?: boolean
      /** Allow maintainer edits */
      maintainer_can_modify?: boolean
      /** Repository owner */
      owner: string
      /** Pull request number to update */
      pullNumber: number
      /** Repository name */
      repo: string
      /** GitHub usernames or ORG/team-slug team reviewers to request reviews from */
      reviewers?: string[]
      /** New state */
      state?: "open" | "closed"
      /** New title */
      title?: string
    }
    /** Update the branch of a pull request with the latest changes from the base branch. */
    mcp__github__update_pull_request_branch: {
      /** The expected SHA of the pull request's HEAD ref */
      expectedHeadSha?: string
      /** Repository owner */
      owner: string
      /** Pull request number */
      pullNumber: number
      /** Repository name */
      repo: string
    }
    /** Perform click on a web page */
    mcp__playwright__browser_click: {
      /** Human-readable element description used to obtain permission to interact with the element */
      element?: string
      /** Exact target element reference from the page snapshot, or a unique element selector */
      target: string
      /** Whether to perform a double click instead of a single click */
      doubleClick?: boolean
      /** Button to click, defaults to left */
      button?: "left" | "right" | "middle"
      /** Modifier keys to press */
      modifiers?: Array<"Alt" | "Control" | "ControlOrMeta" | "Meta" | "Shift">
    }
    /** Close the page */
    mcp__playwright__browser_close: {}
    /** Returns all console messages */
    mcp__playwright__browser_console_messages: {
      /** Level of the console messages to return. Each level includes the messages of more severe levels. Defaults to "info". */
      level: "error" | "warning" | "info" | "debug"
      /** Return all console messages since the beginning of the session, not just since the last navigation. Defaults to false. */
      all?: boolean
      /** File name to save the console messages to. Relative file names are resolved against the workspace root. If not provided, messages are returned as text. */
      filename?: string
    }
    /** Perform drag and drop between two elements */
    mcp__playwright__browser_drag: {
      /** Human-readable source element description used to obtain the permission to interact with the element */
      startElement?: string
      /** Exact target element reference from the page snapshot, or a unique element selector */
      startTarget: string
      /** Human-readable target element description used to obtain the permission to interact with the element */
      endElement?: string
      /** Exact target element reference from the page snapshot, or a unique element selector */
      endTarget: string
    }
    /** Drop files or MIME-typed data onto an element, as if dragged from outside the page. At least one of "paths" or "data" must be provided. */
    mcp__playwright__browser_drop: {
      /** Human-readable element description used to obtain permission to interact with the element */
      element?: string
      /** Exact target element reference from the page snapshot, or a unique element selector */
      target: string
      /** Absolute paths to files to drop onto the element. */
      paths?: string[]
      /** Data to drop, as a map of MIME type to string value (e.g. {"text/plain": "hello", "text/uri-list": "https://example.com"}). */
      data?: {}
    }
    /** Emulate CSS media features for the page, for example switch between the light and dark color scheme. Omitted parameters are left unchanged; null clears an override. */
    mcp__playwright__browser_emulate_media: {
      /** Emulates the prefers-color-scheme media feature */
      colorScheme?: "light" | "dark" | null
      /** Emulates the prefers-reduced-motion media feature */
      reducedMotion?: "reduce" | "no-preference" | null
      /** Emulates the forced-colors media feature */
      forcedColors?: "active" | "none" | null
      /** Emulates the prefers-contrast media feature */
      contrast?: "more" | "no-preference" | null
      /** Changes the CSS media type of the page */
      media?: "screen" | "print" | null
    }
    /** Evaluate JavaScript expression on page or element */
    mcp__playwright__browser_evaluate: {
      /** Human-readable element description used to obtain permission to interact with the element */
      element?: string
      /** Exact target element reference from the page snapshot, or a unique element selector */
      target?: string
      /** () => { /* code * / } or (element) => { /* code * / } when element is provided */
      function: string
      /** File name to save the result to. Relative file names are resolved against the workspace root. If not provided, result is returned as text. */
      filename?: string
    }
    /** Upload one or multiple files */
    mcp__playwright__browser_file_upload: {
      /** The absolute paths to the files to upload. Can be single file or multiple files. If omitted, file chooser is cancelled. */
      paths?: string[]
    }
    /** Fill multiple form fields */
    mcp__playwright__browser_fill_form: {
      /** Fields to fill in */
      fields: Array<{
        /** Human-readable element description used to obtain permission to interact with the element */
        element?: string
        /** Exact target element reference from the page snapshot, or a unique element selector */
        target: string
        /** Human-readable field name */
        name: string
        /** Type of the field */
        type: "textbox" | "checkbox" | "radio" | "combobox" | "slider"
        /** Value to fill in the field. If the field is a checkbox, the value should be `true` or `false`. If the field is a combobox, the value should be the text of the option. */
        value: string
      }>
    }
    /** Search the accessibility snapshot of the current page for text or a regular expression. Returns matching snapshot nodes with a few lines of surrounding context (like search snippets), each shown under its path from the root of the tree, which is cheaper than capturing the whole snapshot when you only need to locate an element and its ref. */
    mcp__playwright__browser_find: {
      /** Plain text to search for in the page snapshot (case-insensitive substring match). Provide either text or regex, not both. */
      text?: string
      /** Regular expression to search for in the page snapshot. Matching is case-sensitive by default; wrap the pattern in slashes to add flags, e.g. "/error/i" for case-insensitive. Provide either text or regex, not both. */
      regex?: string
      /** Save results to a file instead of returning them in the response. Relative file names are resolved against the workspace root. */
      filename?: string
    }
    /** Handle a dialog */
    mcp__playwright__browser_handle_dialog: {
      /** Whether to accept the dialog. */
      accept: boolean
      /** The text of the prompt in case of a prompt dialog. */
      promptText?: string
    }
    /** Hover over element on page */
    mcp__playwright__browser_hover: {
      /** Human-readable element description used to obtain permission to interact with the element */
      element?: string
      /** Exact target element reference from the page snapshot, or a unique element selector */
      target: string
    }
    /** Navigate to a URL */
    mcp__playwright__browser_navigate: {
      /** The URL to navigate to */
      url: string
    }
    /** Go back to the previous page in the history */
    mcp__playwright__browser_navigate_back: {}
    /** Returns full details (headers and body) of a single network request, or a single part if `part` is set. Use the number from browser_network_requests. */
    mcp__playwright__browser_network_request: {
      /** 1-based index of the request, as printed by browser_network_requests. */
      index: number
      /** Return only this part of the request. Omit to return full details. */
      part?: "request-headers" | "request-body" | "response-headers" | "response-body"
      /** File name to save the result to. Relative file names are resolved against the workspace root. If not provided, output is returned as text. */
      filename?: string
    }
    /** Returns a numbered list of network requests since loading the page. Use browser_network_request with the number to get full details. */
    mcp__playwright__browser_network_requests: {
      /** Whether to include successful static resources like images, fonts, scripts, etc. Defaults to false. */
      static: boolean
      /** Only return requests whose URL matches this regexp (e.g. "/api/.*user"). */
      filter?: string
      /** File name to save the network requests to. Relative file names are resolved against the workspace root. If not provided, requests are returned as text. */
      filename?: string
    }
    /** Press a key on the keyboard */
    mcp__playwright__browser_press_key: {
      /** Name of the key to press or a character to generate, such as `ArrowLeft` or `a` */
      key: string
    }
    /** Resize the browser window */
    mcp__playwright__browser_resize: {
      /** Width of the browser window */
      width: number
      /** Height of the browser window */
      height: number
    }
    /** Run a Playwright code snippet. Unsafe: executes arbitrary JavaScript in the Playwright server process and is RCE-equivalent. */
    mcp__playwright__browser_run_code_unsafe: {
      /** A JavaScript function containing Playwright code to execute. It will be invoked with a single argument, page, which you can use for any page interaction. For example: `async (page) => { await page.getByRole('button', { name: 'Submit' }).click(); return await page.title(); }` */
      code?: string
      /** Load code from the specified file. Relative file names are resolved against the workspace root. If both code and filename are provided, code will be ignored. */
      filename?: string
    }
    /** Select an option in a dropdown */
    mcp__playwright__browser_select_option: {
      /** Human-readable element description used to obtain permission to interact with the element */
      element?: string
      /** Exact target element reference from the page snapshot, or a unique element selector */
      target: string
      /** Array of values to select in the dropdown. This can be a single value or multiple values. */
      values: string[]
    }
    /** Capture accessibility snapshot of the current page, this is better than screenshot */
    mcp__playwright__browser_snapshot: {
      /** Exact target element reference from the page snapshot, or a unique element selector */
      target?: string
      /** Save snapshot to a file instead of returning it in the response. Relative file names are resolved against the workspace root. */
      filename?: string
      /** Limit the depth of the snapshot tree */
      depth?: number
      /** Include each element's bounding box as [box=x,y,width,height] in the snapshot. Coordinates are viewport-relative, in CSS pixels (Element.getBoundingClientRect) */
      boxes?: boolean
    }
    /** List, create, close, or select a browser tab. */
    mcp__playwright__browser_tabs: {
      /** Operation to perform */
      action: "list" | "new" | "close" | "select"
      /** Tab index, used for close/select. If omitted for close, current tab is closed. */
      index?: number
      /** URL to navigate to in the new tab, used for new. */
      url?: string
    }
    /** Take a screenshot of the current page. You can't perform actions based on the screenshot, use browser_snapshot for actions. */
    mcp__playwright__browser_take_screenshot: {
      /** Human-readable element description used to obtain permission to interact with the element */
      element?: string
      /** Exact target element reference from the page snapshot, or a unique element selector */
      target?: string
      /** Image format for the screenshot. If unset, inferred from the filename extension, otherwise png. */
      type?: "png" | "jpeg" | "webp"
      /** File name to save the screenshot to. Relative file names are resolved against the workspace root. If not specified, the screenshot is saved into the output directory as `page-{timestamp}.{png|jpeg|webp}`. */
      filename?: string
      /** When true, takes a screenshot of the full scrollable page, instead of the currently visible viewport. Cannot be used with element screenshots. */
      fullPage?: boolean
      /** Image resolution scale. "css" produces a screenshot sized in CSS pixels (smaller, consistent across devices). "device" produces a high-resolution screenshot using device pixels (larger, accounts for the device pixel ratio). Default is css. */
      scale: "css" | "device"
    }
    /** Type text into editable element */
    mcp__playwright__browser_type: {
      /** Human-readable element description used to obtain permission to interact with the element */
      element?: string
      /** Exact target element reference from the page snapshot, or a unique element selector */
      target: string
      /** Text to type into the element */
      text: string
      /** Whether to submit entered text (press Enter after) */
      submit?: boolean
      /** Whether to type one character at a time. Useful for triggering key handlers in the page. By default entire text is filled in at once. */
      slowly?: boolean
    }
    /** Wait for text to appear or disappear or a specified time to pass */
    mcp__playwright__browser_wait_for: {
      /** The time to wait in seconds, at most 30 */
      time?: number
      /** The text to wait for */
      text?: string
      /** The text to wait for to disappear */
      textGone?: string
    }
    /** Creates a new artboard (top-level frame) on the canvas. - Returns the node ID which you can then use with write_html({mode:'insert-children'}) to add content. - Use the styles property to set the artboard size and styles. - paper-gen:// URLs in styles (e.g. backgroundImage) generate AI images. ONLY if the user asked; read the "image-generation" guide first. - Artboards default to `display: "flex", flexDirection: "column"` - The artboard will always be placed in the best empty spot on the canvas. - Pass pageId to create the artboard on a specific page. Omit to use the page the user is viewing. - Use one of the default sizes below unless the user specifies a size. **Default sizes by device** (when the user doesn't specify a size): - **Desktop**: 1440 x 900px - **Tablet**: 768 x 1024px - **Mobile**: 390 x 844px — include a status bar at the top. Call `get_guide({ topic: "mobile-status-bar" })` for paste-ready markup; do not hand-draw one. The suggested device height is just a starting point to set the scene and understand how much space there is for the content above the fold. When wrapping up, if content clips, switch the artboard to `height: "fit-content"` via update_styles instead of guessing a new fixed height. */
    "mcp__plugin_paper-desktop_paper__create_artboard": {
      /** The page ID that the tool should operate on. When omitted the active page will be used. The active page can change between tool calls, prefer passing explicit page IDs. */
      pageId?: string
      /** Name for the artboard (shown in the layer tree). */
      name: string
      /** CSS styles for the artboard as a JSON object. Use camelCase property names. width and height are required — use whole pixel values. When positioning an artboard make sure to give 80px of space between artboards to avoid overlaps. Example: {"display": "flex", "flexDirection": "column", "width": "1440px", "height": "900px", "backgroundColor": "#f5f5f5", "padding": "20px"} */
      styles: {
        /** Width of the artboard as a whole pixel value (e.g. "1440px"). */
        width: string
        /** Height of the artboard as a whole pixel value (e.g. "900px"). */
        height: string
      }
      /** The file ID that the tool should operate on. */
      fileId: string
    }
    /** Create a new Paper file in the user's active team and returns the new file's ID. To start working in the new file, call open_file with the returned ID. */
    "mcp__plugin_paper-desktop_paper__create_file": {
      /** Optional file ID to clone from. If provided, the new file is a copy of this one. */
      cloneFileId?: string
      /** Optional display name for the new file. */
      name?: string
    }
    /** Creates a new page in the file and returns its ID. To work on the new page use the returned pageId in subsequent tool calls. */
    "mcp__plugin_paper-desktop_paper__create_page": {
      /** Optional display name for the new page (shown in the page list). Defaults to "Page N". */
      name?: string
      /** The file ID that the tool should operate on. */
      fileId: string
    }
    /** Create one or more design tokens. Each entry needs `type`, `name`, and `value`. Use `var(--other-token)` as the value to alias another design token. Returns one `{name, result: "created"}` (or `{result: "error", message}`) per input entry. Order is important. For color tokens define semantic colors before palette colors, with neutral colors first, then primary, secondary, and then accent colors. For all other design token types define them based on the size of the value, smallest first. Prefer reusing design tokens before creating new ones. */
    "mcp__plugin_paper-desktop_paper__create_tokens": {
      /** Design tokens to create. Each entry creates a new design token; duplicate names are allowed but discouraged. */
      tokens: Array<{
        /** Design token type/category. */
        type: "breakpoint" | "color" | "container" | "fontFamily" | "fontSize" | "fontWeight" | "letterSpacing" | "lineHeight" | "opacity" | "radius" | "spacing"
        /** CSS custom property name. E.g. "--color-primary". */
        name: string
        /** Design token value. For colors, use a CSS color string like "#ff0000" or "oklch(...)". For sizes (spacing, radius, fontSize, container, breakpoint), use a px string like "8px". For fontWeight, use a number (e.g. 400). For lineHeight/letterSpacing, use a string ("1.5px") or number. For opacity, use a 0–1 number (e.g. 0.5) or a percent string (e.g. "50%"). To alias another design token, use a CSS variable reference like "var(--color-red)". */
        value: string | number
        /** Optional human-readable description of what the design token is for and how it should be used. Max 1024 characters. */
        description?: string
      }>
      /** The file ID that the tool should operate on. */
      fileId: string
    }
    /** Delete one or more nodes from the design. Also deletes all descendants of the specified nodes. IMPORTANT: Before deleting nodes that you think have an incorrect parent verify using get_node_info first. */
    "mcp__plugin_paper-desktop_paper__delete_nodes": {
      /** Array of node IDs to delete. */
      nodeIds: string[]
      /** The file ID that the tool should operate on. */
      fileId: string
    }
    /** Duplicate one or more nodes in the design. Creates a deep clone of each node (including all descendants). Duplicated artboards are automatically positioned in a blank area to avoid overlap. Returns the source and new node IDs, plus a descendantIdMap that maps every original descendant ID to its cloned equivalent. Since you already know the source tree structure, you can use this map to immediately reference any cloned node (e.g. to call setTextContent) without any intermediate lookups. */
    "mcp__plugin_paper-desktop_paper__duplicate_nodes": {
      /** Array of nodes to duplicate. Each item specifies a node ID and optionally a parent ID for where to place the duplicate. If no parent ID is provided, duplicates are placed under the same parent as their source node. */
      nodes: Array<{
        /** The ID of the node to duplicate. */
        id: string
        /** Optional. The ID of the parent node to place the duplicate under. If omitted, the duplicate is placed under the same parent as the source node. */
        parentId?: string
      }>
      /** The file ID that the tool should operate on. */
      fileId: string
    }
    /** Export nodes as image or video files. Unless the user specifies, do not override the default export settings. */
    "mcp__plugin_paper-desktop_paper__export": {
      /** The page ID that the tool should operate on. When omitted the active page will be used. The active page can change between tool calls, prefer passing explicit page IDs. */
      pageId?: string
      /** Export type, defaults to "image". */
      type?: "image" | "video"
      nodes: "nodes-with-exports-only" | {}
      /** The file ID that the tool should operate on. */
      fileId: string
    }
    /** Export multiple nodes combined into a single PDF file, one page per node. Pages are auto-ordered by canvas position (top-to-bottom, then left-to-right). Use this instead of "export" when the user wants the nodes merged into one PDF rather than separate files. The quality and resampling used is the highest of any existing PDF export settings found on individual nodes. */
    "mcp__plugin_paper-desktop_paper__export_combined_pdf": {
      /** Node IDs to combine into a single PDF, one page per node. Pages are auto-ordered by top-to-bottom then left-to-right canvas position. */
      nodeIds: string[]
      /** The file ID that the tool should operate on. */
      fileId: string
    }
    /** Find nodes by computed style and/or text content — useful for locating everything using a given token, literal value, or piece of copy before a bulk update. Searches every page in the file by default. Pass pageId to search a whole page, or nodeId to search a node and its descendants; nodeId takes priority. Pass `filters`, `textValue`, or both (AND). `filters` are `{ styleName, styleValue }` matchers combined with AND (color is X AND fontSize is Y). `styleValue` may be a literal ("#ff0000", "16px") or a token ("--color-primary"). Both fields accept "*" wildcards and colors match by equivalence. A literal color query also finds token-bound usages (reported as the `var(--token)` reference), so to migrate a raw color to a token you can search the color directly. Omit one field to match any property or any value. `textValue` matches Text node content, case-insensitive, with "*" wildcards anchored to the whole value ("Submit", "Get *", "*started*"). Each result has its ID, name, component, and a `matched` array of the `{ styleName, styleValue }` / `{ textValue }` entries that satisfied the query; for a color or token found inside a composite value (gradient/border), `styleValue` is the matched fragment, not the whole value. */
    "mcp__plugin_paper-desktop_paper__find_nodes": {
      /** Optional. Search every node on this page. Omit (along with nodeId) to search every page in the file. Use get_basic_info to list the pages. */
      pageId?: string
      /** Optional. Search this node and its descendants instead of a whole page or the whole file. Takes priority over pageId. */
      nodeId?: string
      /** Match Text node content. Case-insensitive; "*" is a wildcard anchored to the whole value ("foo*", "*foo*", "foo*bar"). AND-combined with `filters`. */
      textValue?: string
      /** Style matchers combined with AND — a node must satisfy every one (plus `textValue`, if given). */
      filters?: Array<{
        /** CSS property to match, e.g. "background-color" or "fontSize". "*" wildcard ("border-*"). Omit to match any property. */
        styleName?: string
        /** Computed value to match: a literal ("#ff0000", "16px") or a token ("--color-primary" / "var(--color-primary)"). "*" wildcard; colors match by equivalence ("#ccc" == "rgb(204, 204, 204)"). A literal color also finds token-bound usages whose token resolves to it, reported as the var reference. Omit to match any value. */
        styleValue?: string
      }>
      /** The file ID that the tool should operate on. */
      fileId: string
    }
    /** MUST call this when done working. Remove the working indicator from artboards you were editing. Call with no arguments to release all working indicators at once. Pass specific artboard IDs if you want to release only some. Prefer calling with specific artboard IDs so you work better alongside other agents. */
    "mcp__plugin_paper-desktop_paper__finish_working_on_nodes": {
      /** Optional. Specific node IDs to release. If omitted, all working indicators are released. */
      nodeIds?: string[]
      /** The file ID that the tool should operate on. */
      fileId: string
    }
    /** Get essential context about the current design: file name, page name, node count, artboards with their dimensions, font families used, a compact list of design tokens. Call get_basic_info first to understand the canvas situation. - When no fileId is provided the file the user is viewing is used. - Pass pageId to inspect a specific page; omit to use the page the user is viewing. - worldX/worldY properties are the world position of the node - worldX/worldY/width/height are null when the size or position depends on layout (e.g. fit-content, flex children) and the node was not measured (i.e. the page is inactive) - pages lists every page in the file; the one with isActive is what the user sees and controls, and it can change while you work if the user switches pages - you can work on other pages without disrupting the user by passing their pageId to page-scoped tools (create_artboard, export, get_basic_info); tools that take a nodeId act on whichever page the node lives on */
    "mcp__plugin_paper-desktop_paper__get_basic_info": {
      /** The page ID that the tool should operate on. When omitted the active page will be used. The active page can change between tool calls, prefer passing explicit page IDs. */
      pageId?: string
      /** The file ID that the tool should operate on. When omitted the file the user is viewing is used. */
      fileId?: string
    }
    /** Get the direct children of a node. - Returns a list of child nodes with their IDs, names, component types, how many children each has, and each child's worldX/worldY (world position) and x/y (relative to parent) - x/y/worldX/worldY are null when the size or position depends on layout (e.g. fit-content, flex children) and the node was not measured (i.e. the page is inactive) - Returns an error if the node does not exist. */
    "mcp__plugin_paper-desktop_paper__get_children": {
      /** The ID of the parent node to get children from */
      nodeId: string
      /** The file ID that the tool should operate on. */
      fileId: string
    }
    /** Get full details for one visible comment thread, including its open/resolved status, all reply messages, reactions, attachments, page context, and pinned node context. Works for any status. Call list_comment_threads first when you do not already know the commentThreadId. Deleted threads/messages are never returned. */
    "mcp__plugin_paper-desktop_paper__get_comment_thread": {
      /** The ID of the comment thread to read. */
      commentThreadId: string
      /** The file ID that the tool should operate on. */
      fileId: string
    }
    /** Get the computed CSS styles for one or more nodes. Returns a map of nodeId to CSSProperties object. Supports batch requests. */
    "mcp__plugin_paper-desktop_paper__get_computed_styles": {
      /** Array of node IDs to get styles from */
      nodeIds: string[]
      /** The file ID that the tool should operate on. */
      fileId: string
    }
    /** Extract the image data from a node that has an image fill. Returns the image as base64-encoded JPEG data optimized for AI consumption. Large images are automatically resized to fit within API size limits. The original image URL is included in the metadata if you need the full-quality source. Returns an error if the node does not exist, or a message if the node has no image fill, is an SVG (use get_jsx), or the image is still generating (poll get_node_info to know when it completes). */
    "mcp__plugin_paper-desktop_paper__get_fill_image": {
      /** The ID of the node containing an image fill */
      nodeId: string
      /** The file ID that the tool should operate on. */
      fileId: string
    }
    /** Get information about whether a font family is available to the user and detailed information about all weights and styles in the family. This tool looks up fonts on the user's machine and Google Fonts. */
    "mcp__plugin_paper-desktop_paper__get_font_family_info": {
      /** Names of the font families to look up. */
      familyNames: string[]
    }
    /** Read a detailed guide on a specific topic. Call with topic "paper-mcp-instructions" before using other Paper tools for best results. Other topics: "mobile-status-bar", "figma-import", "image-generation". */
    "mcp__plugin_paper-desktop_paper__get_guide": {
      /** The guide topic to read. Available topics: "paper-mcp-instructions" — Step-by-step guide to using the Paper MCP server to its max power "mobile-status-bar" — Paste-ready status bar markup for mobile artboards "figma-import" — Step-by-step workflow for bringing Figma designs into Paper "image-generation" — How to generate AI images inside write_html, update_styles, and create_artboard via paper-gen:// URLs */
      topic: string
    }
    /** Get the JSX code representation of a node and its descendants. Supports two styling formats: Tailwind CSS classes (default) or inline styles. */
    "mcp__plugin_paper-desktop_paper__get_jsx": {
      /** The ID of the node to generate JSX from */
      nodeId: string
      /** Style format: "tailwind" (default) uses Tailwind classes with inline fallback, "inline-styles" uses pure inline styles */
      format?: "tailwind" | "inline-styles"
      /** The file ID that the tool should operate on. */
      fileId: string
    }
    /** Get detailed information about a specific node by ID, including its size, visibility, lock state, parent, children IDs, text content (for text nodes), and the node's worldX/worldY (world position) and x/y (relative to parent). - When the node has a generated image, also returns imageGeneration.status (processing / ready / error) and imageGeneration.output (raster / svg) — poll this to know when generation completes. - Raster fills are read with get_fill_image; SVG output is read with get_jsx. - x/y/worldX/worldY/width/height are null when the size or position depends on layout (e.g. fit-content, flex children) and the node was not measured (i.e. the page is inactive) - Returns an error if the node does not exist. */
    "mcp__plugin_paper-desktop_paper__get_node_info": {
      /** The ID of the node to inspect */
      nodeId: string
      /** The file ID that the tool should operate on. */
      fileId: string
    }
    /** Capture a screenshot of a specific node by ID. Returns the image as base64-encoded data. Images are automatically capped to fit API size limits. Defaults to 1x scale which is sufficient for verifying layout, spacing, and visual appearance. Use scale=2 only when you need to read small text or inspect fine visual details. Capture child nodes when needing higher resolution screenshots. */
    "mcp__plugin_paper-desktop_paper__get_screenshot": {
      /** The ID of the node to capture */
      nodeId: string
      /** Render scale factor. 1 (default) for layout checks and general visual understanding. 2 for reading small text or inspecting fine details. */
      scale?: number
      /** The file ID that the tool should operate on. */
      fileId: string
    }
    /** Get detailed information about the currently selected nodes, including IDs, names, component types, size, and which artboard they belong to. When no fileId is provided the file the user is viewing is used. */
    "mcp__plugin_paper-desktop_paper__get_selection": {
      /** The file ID that the tool should operate on. When omitted the file the user is viewing is used. */
      fileId?: string
    }
    /** List the file's design tokens (colors, spacing, typography, etc). */
    "mcp__plugin_paper-desktop_paper__get_tokens": {
      /** Filter by design token type(s). Omit to include all types. */
      types?: Array<"breakpoint" | "color" | "container" | "fontFamily" | "fontSize" | "fontWeight" | "letterSpacing" | "lineHeight" | "opacity" | "radius" | "spacing">
      /** Glob pattern matched against the full CSS variable name (case-insensitive). Use "*" as a wildcard. Examples: "--color-primary", "--color-*", "*-500", "*brand*". Omit to skip name filtering. */
      namePattern?: string
      /** Output format. "json" (default) returns structured tokens. "css" returns a vanilla `:root { ... }` stylesheet. "tailwind" returns a Tailwind v4 `@theme { ... }` block with namespaced variables. */
      format?: "json" | "css" | "tailwind"
      /** The file ID that the tool should operate on. */
      fileId: string
    }
    /** Get a compact text summary of a node's subtree hierarchy. - Returns an indented tree showing each node's component type, name, ID, and dimensions - Sizes are swapped with a question mark '?' when the size depends on layout and the node is not measured - Much cheaper than getJSX for understanding structure — use this for orientation before diving into specific nodes. - Returns an error if the node does not exist. */
    "mcp__plugin_paper-desktop_paper__get_tree_summary": {
      /** The ID of the root node to summarize */
      nodeId: string
      /** Maximum depth to traverse (default 3, max 10). Nodes beyond this depth show a child count hint instead. */
      depth?: number
      /** The file ID that the tool should operate on. */
      fileId: string
    }
    /** List every user who has started a comment thread or written a visible message in the open file, with their user ID, display name, activity counts, and last activity time. Use this to resolve a person's name to a userId before filtering list_comment_threads by participantUserId or threadAuthorUserId. Deleted threads/messages are never counted. */
    "mcp__plugin_paper-desktop_paper__list_comment_thread_authors": {
      /** Optional page ID to only count comment thread activity on that page. Omit to include all pages. */
      pageId?: string
      /** The file ID that the tool should operate on. */
      fileId: string
    }
    /** List visible comment threads in the open file as compact summaries. A comment thread is a conversation pinned to a node: a first message plus reply messages, each with its own author, and an "open" or "resolved" workflow status. Lists only open (unresolved) threads by default. Use this first to discover relevant discussion, then call get_comment_thread for full replies. If you are tasked and fully addressing a thread's feedback, mark it done with set_comment_thread_status. Supports page, node, status, author, search, sort, and pagination filters. User ID filters accept "current-user" for the signed-in user. Deleted threads/messages are never returned. */
    "mcp__plugin_paper-desktop_paper__list_comment_threads": {
      /** Optional page ID to list comment threads from. Omit to include all pages. */
      pageId?: string
      /** If true, list only comment threads on the current page. Ignored when pageId is provided. */
      currentPageOnly?: boolean
      /** Optional node ID to list comment threads pinned to. */
      nodeId?: string
      /** Filter by status. Defaults to "open": only unresolved comment threads, which are the ones still needing action. Pass "resolved" for finished threads or "all" for both. */
      status?: "open" | "resolved" | "all"
      /** Case-insensitive search over author display names and visible message text. */
      search?: string
      /** Search only the first visible message of each comment thread, or all visible messages. Defaults to "all-messages". */
      searchScope?: "first-message" | "all-messages"
      /** Only return comment threads where this user wrote at least one visible message (thread author or replier). Pass "current-user" for the signed-in user you are acting on behalf of. For anyone else, use an authorUserId from earlier results; never guess user IDs. */
      participantUserId?: string
      /** Only return comment threads started by this user (replies by them do not count; use participantUserId for that). Pass "current-user" for the signed-in user you are acting on behalf of. For anyone else, use an authorUserId from earlier results; never guess user IDs. */
      threadAuthorUserId?: string
      /** Field to sort by. Defaults to "page", matching the comment panel. */
      sortField?: "page" | "createdAt" | "updatedAt"
      /** Sort direction. Defaults to "asc". */
      sortDirection?: "asc" | "desc"
      /** Maximum comment threads to return. Defaults to 50. */
      limit?: number
      /** Number of matching comment threads to skip. Defaults to 0. */
      offset?: number
      /** Maximum characters for each first-message preview. Defaults to 240. */
      previewLength?: number
      /** The file ID that the tool should operate on. */
      fileId: string
    }
    /** Lists files and folders. Each item has type "file" or "folder" and parentId, omitted for a top-level folder and for an open file that is not in the active team’s resources. Open files are listed first. `open` means the file is a desktop tab. `active` means that tab is in the foreground. Both apply only to files. `draft` means the item is in the user’s drafts. Then files and folders recently updated in the active team. Timestamps are omitted when an open file is not in the active team’s resources. Pass a higher limit until truncated is absent before treating the list as the whole tree. */
    "mcp__plugin_paper-desktop_paper__list_resources": {
      /** Maximum number of files and folders to return. Defaults to 50. Sorted by updatedAt, most recent first. */
      limit?: number
    }
    /** Move one or more existing nodes. Preserves node identity (IDs stay the same), so any references you are holding continue to work. Prefer this over duplicate+delete or rewriting HTML when you just want to reposition or reparent existing layers. Each move uses one of two shapes: 1. Sibling-relative: { nodeId, before: siblingId } or { nodeId, after: siblingId }. The destination parent is inferred from the sibling. 2. Parent-absolute: { nodeId, parentId, index? }. The node is placed at the given index under parentId, or appended if index is omitted. index is clamped to [0, childCount] — use 0 for first. Pass parentId: 'root' as a shortcut for the page root of the page the node currently lives on. Use shape sibling-relative shape 1 when you already know a neighbor; use parent-absolute shape 2 when you want to move into a specific parent (or to the end of one). Notes: - Moves apply sequentially; later moves in the same batch see earlier changes. - For flex/flow parents this changes visual order. For freeform parents this changes stacking (last child renders on top) and does not move the node's world position. - When moving to a new parent, Paper may adjust layout-related styles (width/height intents like filling available space) may be adjusted so the node does not collapse to zero size in the new parent. - You can move nodes between pages - Cannot move the root. Cannot target a node that cannot have children. Cannot move a node under itself or any of its own descendants. For before/after, the sibling cannot be the moved node itself. Returns resolved parentId and index for each successful move, plus affectedParents — the post-batch children list of every parent whose order changed (both sources and destinations, deduplicated). Use affectedParents to refresh your mental model of the tree without a follow-up get_children. */
    "mcp__plugin_paper-desktop_paper__move_nodes": {
      /** Move operations, applied sequentially. Each operation sees the updated tree from prior operations. */
      moves: Array<{
        /** The ID of the node to move. */
        nodeId: string
        /** Place the node immediately before this sibling. The target parent is inferred from the sibling. */
        before: string
      } | {
        /** The ID of the node to move. */
        nodeId: string
        /** Place the node immediately after this sibling. The target parent is inferred from the sibling. */
        after: string
      } | {
        /** The ID of the node to move. */
        nodeId: string
        /** The ID of the destination parent. Must be able to have children (e.g. Frames). Pass the string `'root'` as a shortcut for the page root of the page the node currently lives on (same as that page's rootNodeId from get_basic_info). */
        parentId: string
        /** The final index among the destination parent's children. Clamped to [0, childCount]. Use 0 for first, or omit to append at the end. */
        index?: number
      }>
      /** The file ID that the tool should operate on. */
      fileId: string
    }
    /** Opens a Paper file by its ID or URL. Optional pageId is applied only on the initial open; if the file is already open the page will not switch. Returns a get_basic_info response. */
    "mcp__plugin_paper-desktop_paper__open_file": {
      /** The Paper file ID to open. Accepts a bare ID, a /file/<id> route path, or the files URL. */
      fileId: string
      /** Optional page ID to open. Only applied when the file is not already open — if the file is already open the current page is left unchanged so the user is not pulled away from what they are looking at. A page ID in a /file/<id>/<pageId> URL passed as fileId is also accepted. */
      pageId?: string
    }
    /** Rename one or more layers in the design. Sets the display name shown in the layer tree. Names longer than 50 characters are automatically truncated. Supports batch renames in a single call. */
    "mcp__plugin_paper-desktop_paper__rename_nodes": {
      /** Array of rename updates. Each item specifies a node ID and its new name. */
      updates: Array<{
        /** The ID of the node to rename. */
        nodeId: string
        /** The new display name for the layer. */
        name: string
      }>
      /** The file ID that the tool should operate on. */
      fileId: string
    }
    /** Rename one or more pages in the file. Sets the display name shown in the page list. Does not switch which page the user is viewing. Supports batch renames in a single call. */
    "mcp__plugin_paper-desktop_paper__rename_pages": {
      /** Array of rename updates. Each item specifies a page ID and its new name. */
      updates: Array<{
        /** The ID of the page to rename. Use get_basic_info to list pages. */
        pageId: string
        /** The new display name for the page (shown in the page list). */
        name: string
      }>
      /** The file ID that the tool should operate on. */
      fileId: string
    }
    /** Rename a file or folder. Sets the display name shown in the file browser. Pass the file or folder ID. The stored name is trimmed and capped at 500 characters. An empty name leaves the current name unchanged. Returns the stored name and whether the resource is a file or a folder. */
    "mcp__plugin_paper-desktop_paper__rename_resource": {
      /** The ID of the file or folder to rename. */
      resourceId: string
      /** The new display name for the file or folder. */
      name: string
    }
    /** Set the workflow status of one comment thread to "resolved" or "open". Resolve a thread once its feedback has been fully addressed in the design — this is how you mark review comments as done. Reopen a resolved thread if more work turns out to be needed. Use list_comment_threads or get_comment_thread to find the commentThreadId. */
    "mcp__plugin_paper-desktop_paper__set_comment_thread_status": {
      /** The ID of the comment thread to update. */
      commentThreadId: string
      /** The new workflow status. Set "resolved" once the feedback is fully addressed; set "open" to reopen. */
      status: "open" | "resolved"
      /** The file ID that the tool should operate on. */
      fileId: string
    }
    /** Set the text content of one or more Text nodes. Only works on nodes with component type "Text". Use this instead of writeHTML replace when you only need to change text. Supports batch updates in a single call. */
    "mcp__plugin_paper-desktop_paper__set_text_content": {
      /** Array of text updates to apply. Each item specifies a node ID and its new text content. */
      updates: Array<{
        /** The ID of the Text node to update. */
        nodeId: string
        /** The new text content. */
        textContent: string
      }>
      /** The file ID that the tool should operate on. */
      fileId: string
    }
    /** Update or delete existing design tokens by their full CSS variable name. Each entry needs `name`; any of `newName`, `value`, `delete` are optional. - Rename: set `newName`. - Update value: set `value`. Use `var(--other-token)` to alias. - Delete the design token: set `delete: true`. Returns one result per input entry. Per-entry errors are reported in-band. */
    "mcp__plugin_paper-desktop_paper__set_tokens": {
      /** Design tokens to update or delete, applied sequentially. */
      tokens: Array<{
        /** Target design token by its full CSS custom property name (e.g. "--color-primary"). */
        name: string
        /** Optional. Rename the design token. Provide the full CSS custom property name (e.g. "--color-primary-strong"). */
        newName?: string
        /** Optional. New value. */
        value?: string | number
        /** Optional human-readable description of what the design token is for and how it should be used. Max 1024 characters. Pass an empty string to clear. */
        description?: string
        /** Optional. If true, deletes the design token entirely. */
        delete?: boolean
      }>
      /** The file ID that the tool should operate on. */
      fileId: string
    }
    /** Update styles on one or more nodes. Use this for targeted style changes. Supports design tokens as CSS variables. Supports batch updates in a single call. - Setting the top / left styles of an artboard changes its position on the canvas. - Anywhere urls are accepted, paper-gen:// URLs can be used to generate images with AI. ONLY use when the user explicitly asked for image generation. Read "image-generation" guide first via get_guide. - Styles you set that are inert in the node's context are dropped rather than applied; their keys are returned under the ignoredStyles property. */
    "mcp__plugin_paper-desktop_paper__update_styles": {
      /** Array of style updates to apply. Each item specifies node IDs and styles to apply to all of them. */
      updates: Array<{
        /** The IDs of the nodes to update. */
        nodeIds: string[]
        /** Styles as a JSON object with camelCase property names (e.g. {"backgroundColor": "#fff", "padding": "20px"}), like React.CSSProperties. */
        styles: {}
      }>
      /** The file ID that the tool should operate on. */
      fileId: string
    }
    /** IMPORTANT: Write incrementally. The user sees you write on the canvas in real-time. Show them visual progress every few seconds. Each write_html call should create one visual item: a header, a single list row, a button bar, or a paragraph block. Even simple components should be incremental: a card = container/header, then each row, then the footer. IMPORTANT: Prefer cloning instead of remaking existing Paper nodes using `<x-paper-clone node-id="A-01" style="..." />`. For repeated elements: create the container first, then add each item as a separate write_html call into the container or use the duplicate tool on the first child. HTML and CSS rules: - Always use inline styles (style="..") - Enforce consistency with design tokens as CSS variables if available - All Google Fonts and locally installed fonts are available in font-family - All CSS color formats are supported: hex, rgb(a), hsl(a), oklch, oklab etc - Use flex as the primary layout mode. Flexbox, padding, and gap are the core layout tools in Paper's interface - Absolute position is fully supported. Use it for decorative elements. Avoid covering the entire artboard with a single absolute element, it blocks cursor interaction underneath - Do NOT use: margin, display: inline, display: grid, HTML tables. Use padding and gap for spacing - display: block is acceptable for simple elements (text, decorative shapes) but not for layout containers - Assume border-box sizing everywhere - Use <pre> or white-space: pre for code blocks or indented text - Do NOT use emojis as icons. Use SVG icons or images - Rich text isn't supported in Paper; code snippets should be a single element with one text color and pre whitespace - Use the layer-name attribute to set names on elements in the Paper layer tree, e.g. <div layer-name="Hero"> - Local images MUST use absolute paths in an img starting with paper-asset:// e.g. <img src="paper-asset:///Users/name/image.svg"> - paper-gen:// URLs generate AI images. ONLY if the user asked; read the "image-generation" guide first */
    "mcp__plugin_paper-desktop_paper__write_html": {
      /** HTML string to parse into design nodes. Supports standard HTML elements with inline CSS styles. */
      html: string
      /** The ID of the target node. In "insert-children" mode, new nodes are added as children of this node. In "replace" mode, this node is removed and replaced by the parsed HTML. */
      targetNodeId: string
      /** "insert-children" adds the HTML as children of the target node. "replace" removes the target node and puts the parsed HTML in its place. */
      mode: "insert-children" | "replace"
      /** The file ID that the tool should operate on. */
      fileId: string
    }
    /** Run a read-only SQL query */
    mcp__postgres__query: {
      sql?: string
    }
  }
}
