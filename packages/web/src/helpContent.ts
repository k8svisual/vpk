/**
 * In-app Help content — shown in HelpPanel.tsx (the right-hand slide-out opened from the header's Help icon).
 * Mirrors cliEquivalents.ts's shape/spirit (hand-written, static, no server round-trip) but isn't keyed
 * strictly to ViewId — `screen` is a plain string matching a ViewId value for the ~16 per-screen topics, left
 * loose (not `import type { ViewId }`) so this file has no dependency on App.tsx and can't create an import
 * cycle. General topics (no `screen`) cover app-shell features that aren't any one view — the snapshot
 * picker, Settings, and reference material like "Creating Test Clusters".
 */

export interface HelpField {
  /** The control's own visible label/name (e.g. "namespace", "Capture from cluster"). */
  label: string;
  description: string;
}

export interface HelpLink {
  label: string;
  url: string;
}

export interface HelpCommand {
  description: string;
  /** One or more shell lines — same shape as CliCommand in cliEquivalents.ts. */
  command: string;
}

export interface HelpTopic {
  id: string;
  title: string;
  /** Present for the ~16 per-screen topics — HelpPanel uses this to pin/auto-expand the current view's topic
   *  when the panel opens with no active search. Matches a ViewId string value. */
  screen?: string;
  summary: string;
  fields?: HelpField[];
  commands?: HelpCommand[];
  links?: HelpLink[];
}

export const HELP_TOPICS: HelpTopic[] = [
  // ---- General / app-shell topics (no `screen` — not tied to one view) ----
  {
    id: 'getting-started',
    title: 'Getting started',
    summary:
      'VpK visualizes a Kubernetes cluster from a snapshot — a point-in-time capture of every resource, stored as a JSON file. Load one with "Capture from cluster" ' +
      '(reads live from whatever kubectl context is active) or pick an existing snapshot from the dropdown in the top-left of the header. Once a snapshot is loaded, ' +
      'every view in the left-hand nav rail explores it from a different angle — 3D layout, ownership trees, RBAC, network topology, and more. Nothing you do in VpK ' +
      'changes your cluster: every view (outside the opt-in Training Course mode) is strictly read-only.',
  },
  {
    id: 'snapshots-and-capture',
    title: 'Snapshots & capturing',
    summary:
      'The header\'s "snapshot" dropdown picks which captured cluster state every view reads from. "Capture from cluster" runs your kubectl-compatible CLI against ' +
      'whatever context is currently active and saves a fresh snapshot — it does not modify the cluster, only reads from it. Switching snapshots re-fetches every ' +
      'open view against the newly selected one.',
    fields: [
      { label: 'snapshot', description: 'Dropdown of every snapshot file found in the configured snapshot directory. Re-reads the directory each time you open it.' },
      {
        label: 'Capture from cluster',
        description:
          'Opens a modal: enter a base name/description, choose Secret/ConfigMap redaction, the CLI command to use (default kubectl), and scope (core built-in kinds, or every API-discoverable kind). Streams live per-kind progress, ending in a summary or an error/cancelled state — a real, live READ against your current kubeconfig context that writes a new timestamped snapshot; it never modifies the cluster.',
      },
    ],
  },
  {
    id: 'settings',
    title: 'Settings',
    summary:
      'The gear icon in the top-right opens Settings, across six tabs — theme, per-Kind colors, icon overrides, network detection catalogs, Training Course ' +
      'options, and which nav items are visible.',
    fields: [
      {
        label: 'Snapshot',
        description:
          'Snapshot directory path, "Redact Secrets" (hide values in the definition viewer, data still stored), and "Disable pulling Secrets" (never save Secret data at capture time at all — overrides Redact).',
      },
      { label: 'UI', description: 'Theme (Light/Dark/Forest/Ocean), Font Size, Depth fog toggle, Grid floor toggle (the last two affect the 3D view only).' },
      {
        label: 'Colors',
        description: "Per-Kind color overrides (grouped by category, with a color picker + reset per row) and per-API-group color overrides for the 3D Wheel's resource plane walls.",
      },
      { label: 'Vendor Icons', description: 'Manage custom icon mappings by apiVersion/vendor.' },
      { label: 'Network Identification', description: "Edit the CNI and Service Mesh detection catalogs that drive the Network view's Plane/Edge labeling." },
      {
        label: 'Education',
        description: 'Course resources directory, menu-visibility toggles (Course / Course Catalog / Teacher tools), Terminal CLI override (Auto / kubectl / oc), terminal theme, terminal font size.',
      },
    ],
  },
  {
    id: 'training-course-visibility',
    title: 'Training Course mode',
    summary:
      "VpK has an opt-in Training Course mode — a live, interactive Kubernetes learning environment with real lessons run against a real cluster " +
      '(Catalog to pick a lesson, Course to run it, Teacher to author lesson content). It\'s the one part of VpK that can modify anything — running real ' +
      "kubectl/oc commands you type — everywhere else in VpK is strictly read-only. If you don't see Catalog / Course / Teacher in the left nav, they've " +
      'been individually hidden; open Settings > Education and re-enable "Show Course", "Show Course Catalog", and/or "Show Teacher tools" (all on by default).',
  },
  {
    id: 'cli-equivalent',
    title: 'CLI Equivalent',
    summary:
      'Most views have a "CLI Equivalent" button in their header — it shows hand-picked kubectl/jq one-liners that get roughly the same information the view is ' +
      'showing, for when you want to reproduce something at a terminal instead. These are starting points, not a formal guarantee of an identical result, since VpK ' +
      'often cross-references multiple resource kinds in ways a single kubectl call can\'t.',
  },
  {
    id: 'statistics-and-logs',
    title: 'Statistics & Logs',
    summary:
      "The bar-chart icon opens Statistics — read-only diagnostics (System: platform/Node version/memory/uptime; Application: port/snapshot dir/current " +
      "snapshot/redaction state/counts; Snapshot file: path/size/per-Kind breakdown), refetched fresh every time it's opened. The scroll icon opens Logs — " +
      "VpK's own in-memory server activity log (startup, snapshot loads, capture lifecycle — not cluster/container logs), polling every 2 seconds while open.",
    fields: [
      { label: 'Auto-scroll', description: 'Logs modal — keeps the view pinned to the newest entry as it grows.' },
      {
        label: 'Download Diagnostics',
        description: "Logs modal — bundles the server's own /diagnostics plus browser info (name/version/user agent/theme/viewport/heap) into a downloadable JSON file for bug reports; never includes captured resource contents like Secret/ConfigMap data.",
      },
      { label: 'Clear', description: 'Logs modal — empties the in-memory log.' },
    ],
  },
  {
    id: 'creating-test-clusters',
    title: 'Creating test clusters',
    summary:
      'VpK needs a real (or locally simulated) Kubernetes cluster to capture from. If you don\'t have one handy, here\'s how to spin up a small local multi-node ' +
      'cluster with each of the four most common local tools. All four commands below create a 3-node cluster with roughly 1GB of memory per node — enough for a ' +
      'quick demo, though most of these tools recommend 2GB+ per node for anything beyond light use (etcd + kube-apiserver on the control-plane node are memory-hungry).',
    commands: [
      {
        description: 'minikube — native flags for both node count and per-node memory',
        command: 'minikube start --nodes 3 --memory 1024mb --driver=docker',
      },
      {
        description:
          'kind — node count comes from a config file, saved here as kind-config.yaml (that name is not required by kind itself — ' +
          "--config always takes an explicit path, so it's just the conventional choice; name it anything as long as both commands agree). " +
          "kind has no memory flag, so memory is applied to the underlying Docker containers afterward",
        command:
          'cat <<EOF > kind-config.yaml\nkind: Cluster\napiVersion: kind.x-k8s.io/v1alpha4\nnodes:\n- role: control-plane\n- role: worker\n- role: worker\nEOF\n\n' +
          'kind create cluster --name vpk-test --config kind-config.yaml\n\n' +
          '# constrain each node container directly via Docker\nfor c in $(docker ps --filter "name=vpk-test" --format "{{.Names}}"); do\n  docker update --memory=1g --memory-swap=1g "$c"\ndone',
      },
      {
        description: 'k3d — native per-role memory flags (--servers-memory for control-plane, --agents-memory for workers)',
        command: 'k3d cluster create vpk-test --servers 1 --agents 2 --servers-memory 1024m --agents-memory 1024m',
      },
      {
        description: "MicroK8s — not container-based like the others; a multi-node cluster means multiple VMs joined together (via multipass here). The join token is generated at runtime, so this can't be a single copy-paste block — run add-node, copy the printed join command, then run it on the next VM, once per additional node.",
        command:
          '# 3 VMs, 1GB memory each\nfor i in 1 2 3; do\n  multipass launch --name mk8s-$i --memory 1G --disk 5G\n  multipass exec mk8s-$i -- sudo snap install microk8s --classic\ndone\n\n' +
          '# on the first node, generate a join command (token is single-use — repeat add-node per additional node)\nmultipass exec mk8s-1 -- sudo microk8s add-node\n' +
          '# copy the printed "microk8s join <ip>:<port>/<token>" line, then run it on the next node:\nmultipass exec mk8s-2 -- sudo <paste the join command here>\n\n' +
          'multipass exec mk8s-1 -- sudo microk8s add-node\nmultipass exec mk8s-3 -- sudo <paste the new join command here>\n\n' +
          '# verify\nmultipass exec mk8s-1 -- sudo microk8s kubectl get nodes',
      },
    ],
    links: [
      { label: 'minikube — Get Started', url: 'https://minikube.sigs.k8s.io/docs/start/' },
      { label: 'minikube — start command reference', url: 'https://minikube.sigs.k8s.io/docs/commands/start/' },
      { label: 'kind — Quick Start', url: 'https://kind.sigs.k8s.io/docs/user/quick-start/' },
      { label: 'kind — Configuration reference', url: 'https://kind.sigs.k8s.io/docs/user/configuration/' },
      { label: 'k3d — cluster create reference', url: 'https://k3d.io/stable/usage/commands/k3d_cluster_create/' },
      { label: 'MicroK8s — Clustering', url: 'https://microk8s.io/docs/clustering' },
      { label: 'Multipass docs', url: 'https://multipass.run/docs' },
    ],
  },

  // ---- Per-screen topics (one per ViewId — `screen` pins/auto-expands these when that view is active) ----
  {
    id: 'view-search',
    title: 'Search',
    screen: 'search',
    summary:
      "A flat, filterable table of every resource in the loaded snapshot, across all namespaces and kinds — the general-purpose \"find anything\" screen for " +
      "when you know roughly what you're looking for but don't want to navigate a specific view. Clicking a row opens that resource's definition. Arriving " +
      'from the 3D view\'s per-Kind sphere "Search" button pre-scopes the Kind filter and shows a "← Return to 3D view" pill.',
    fields: [
      { label: '+ kind…', description: 'Adds a Kind filter chip — multi-select, OR logic (Pod + Deployment shows either).' },
      { label: '+ namespace…', description: 'Adds a namespace filter chip; includes a "(cluster-scoped)" option for resources with no namespace.' },
      { label: 'search…', description: 'Free-text filter across the visible table.' },
      { label: 'metadata (label) filter', description: 'Matches label keys/values — supports key, value, or key=value syntax.' },
      { label: 'annotation filter', description: 'Same syntax as the label filter, against annotations instead.' },
      { label: 'Sortable columns', description: 'Kind, Namespace, Name, Created — click a header to sort; paginated 25 rows/page.' },
    ],
  },
  {
    id: 'view-cluster3d',
    title: '3D Cluster',
    screen: 'cluster3d',
    summary:
      "An interactive 3D visualization of the cluster with three sub-modes reached via buttons top-left — the app's flagship view, best for spatial/" +
      'relational exploration rather than precise data lookup.',
    fields: [
      {
        label: 'Field',
        description:
          'Every Node as a labeled, capacity-sized box in a grid, colored by role. "Filter" opens the Node Filter panel (role, health, hardware, OS, taints, labels); "Hide excluded" removes non-matching nodes instead of just marking them; "View in Wheel" jumps to Wheel scoped to the included nodes.',
      },
      {
        label: 'Wheel',
        description:
          'The full cluster as concentric rings around a control-plane hub — Nodes on the outer ring, Pods near their Node, plus tiers for Network, Storage, CSI, and Control Plane. "Filter" opens namespace/status/category/label filters. Clicking an item opens a Properties panel (editor, schematic, owner-ref graph, search, repository view).',
      },
      {
        label: 'Timelapse',
        description:
          'A Wheel-only toggle that replays the cluster\'s creation history over time — play/pause, step, scrubber, speed (0.5x–4x), and a "Changes (N)" list of that interval\'s creations/deletions. Its own "Filter" button toggles which categories appear during playback.',
      },
    ],
  },
  {
    id: 'view-schematic',
    title: 'Schematic',
    screen: 'schematic',
    summary:
      "A detailed, server-rendered diagram of a single Pod's place in the cluster — its owner chain, config, network, storage, and security connections — " +
      'good for "everything connected to this one Pod" at a glance. Also has a Container sub-diagram (containers + shared volumes in detail).',
    fields: [
      { label: 'Namespace / Pod dropdowns', description: 'Manual picker when arriving directly rather than via a link from another view.' },
      { label: 'View Container Schematic ▸', description: 'Switches to the per-container diagram; "← Return to Deployment Schematic" switches back.' },
      { label: 'RBAC ▸ pill', description: "On the Security box — jumps to the RBAC view scoped to the Pod's ServiceAccount." },
      { label: 'has Events badge', description: 'Purple badge — jumps to Events view filtered to this exact Pod.' },
      { label: 'Icon-group tooltips', description: 'Hovering a count (e.g. "secret (4)") then clicking opens a Resources list modal; Secrets can be decoded from there.' },
    ],
  },
  {
    id: 'view-network',
    title: 'Network',
    screen: 'network',
    summary: 'Networking overview with four tabbed sub-modes: Services-To-Pods, Node & Pod IPs, Diagrams, and Ports.',
    fields: [
      {
        label: 'Services-To-Pods',
        description: 'Collapsible cards, one per Service, showing ClusterIP/ports and a tree of backing Pods with their IP and Node. Namespace dropdown filters the list.',
      },
      { label: 'Node & Pod IPs', description: 'One card per Node with its internal IP/podCIDR, and Pod IPs grouped by /24 subnet (or "host" for hostNetwork pods).' },
      {
        label: 'Diagrams',
        description:
          'Five diagram types — Client → Service → Pods flow, Ingress Path, Service × Nodes, Cluster Topology, and Network Layers (a live-counted CNI/mesh stack breakdown). Flow/Ingress/Nodes scope to one selected Service; Topology/Layers are cluster-wide.',
      },
      {
        label: 'Ports',
        description:
          'Every declared port usage (ClusterIP/NodePort/LoadBalancer/containerPort/hostPort) — By port (aggregated, click for every usage) or All usages (flat searchable table). Host-level exposures are flagged with a red dot.',
      },
      {
        label: 'Network Identification (Settings)',
        description: "The Settings > Network Identification tab edits the CNI/service-mesh detection catalogs these views' diagrams and Layers tab use to label the cluster's Network Plane/Edge.",
      },
    ],
  },
  {
    id: 'view-security',
    title: 'Security',
    screen: 'security',
    summary:
      'A read-only, grouped list of every RBAC subject (User, Group, ServiceAccount) and what they\'re bound to, grouped by subject kind then subject — good ' +
      'for browsing "who has access to what" without running a specific query. Each subject expands to show its bindings and the rules each role grants.',
    fields: [{ label: 'diagram pill', description: 'Next to each subject — opens the RBAC view scoped to that subject.' }],
  },
  {
    id: 'view-rbac',
    title: 'RBAC',
    screen: 'rbac',
    summary:
      'A single-subject RBAC schematic — pick (or arrive pre-scoped to) one subject and see exactly what it can do: its bindings, roles, and resulting ' +
      'permission rules. The "drill into one identity" complement to the broader Security view.',
    fields: [
      { label: 'Subject dropdown', description: 'Grouped by kind (User/Group/ServiceAccount/etc.) — selects which subject\'s diagram to render.' },
      { label: '← Return pill', description: 'Shown when entered from Schematic, Security, or Who Can — label adapts to the origin.' },
    ],
  },
  {
    id: 'view-whocan',
    title: 'Who Can',
    screen: 'whocan',
    summary:
      'A reverse-RBAC query tool: pick one or more verbs and/or resources (and optionally a namespace), and see every subject granted that access — answers ' +
      '"who can delete Secrets in production" style questions that Security/RBAC don\'t directly support.',
    fields: [
      { label: 'Verbs / Resources multi-select', description: 'Blank means "any." Resources show as "resource (apiGroup)".' },
      { label: 'Namespace dropdown', description: 'Scopes the query; blank means any namespace.' },
      { label: 'Match: any selected / all selected', description: 'AND vs OR semantics when multiple verbs/resources are picked.' },
      {
        label: 'diagram pill',
        description: "On each result row — opens that subject's RBAC view. Italic subjects mean the grant is limited to specific named objects.",
      },
    ],
  },
  {
    id: 'view-storage',
    title: 'Storage',
    screen: 'storage',
    summary: 'Storage relationships and aggregate counts, with four sub-views: a SC / PV / PVC hierarchy tree, and three "Counts by..." dimensions.',
    fields: [
      {
        label: 'SC / PV / PVC',
        description:
          'Two collapsible trees — StorageClass → PV → PVC → Pod, and CSIDriver → VolumeAttachment → PV → PVC → Pod — each row showing a capacity bar, biggest-first.',
      },
      {
        label: 'Counts by Volume Type / Cluster Node / Namespace',
        description: 'A breadcrumb drill-down over every pod volume mount, down to a leaf list of Pods. Click a row to drill in, a breadcrumb segment to jump back.',
      },
    ],
  },
  {
    id: 'view-ownerref',
    title: 'OwnerRef',
    screen: 'ownerref',
    summary:
      'A server-rendered ownership graph ("what owns this, and what does it own") for any one resource — e.g. Pod ← ReplicaSet ← Deployment. Unlike ' +
      'Schematic (always a Pod), this works for any resource with owner references.',
    fields: [
      { label: 'Namespace / Resource dropdowns', description: 'Manual two-step picker when arriving directly.' },
      { label: '← Return to 3D view', description: 'Shown when entered via the 3D view\'s "View OwnerRef" button, which pre-focuses one specific resource.' },
    ],
  },
  {
    id: 'view-images',
    title: 'Container Images',
    screen: 'images',
    summary:
      'Every container image reference used across the cluster, browsable as a Tree (Repository → Image → Namespace → Kind → Container) or a flat sortable ' +
      'Table — good for auditing what images/registries/tags are actually in use.',
    fields: [
      { label: 'Tree / Table toggle', description: 'Switches the browsing layout.' },
      { label: 'Registry / Repository dropdowns', description: 'Filters to one registry, then one repo path within it.' },
    ],
  },
  {
    id: 'view-events',
    title: 'Events',
    screen: 'events',
    summary:
      'Kubernetes Events (a point-in-time capture, not a live stream), with two tabs: Graph (a volume-over-time histogram) and Messages (tabular event lists).',
    fields: [
      {
        label: 'Graph',
        description:
          'A windowed, pageable stacked-bar histogram (Normal/Warning/Failed) with a scrubbable minimap, namespace filter, and a "skip interval" width control. Clicking a bar jumps to Messages filtered to that window.',
      },
      { label: 'Messages — By object', description: 'Aggregated per involved-object with warning counts; click to see all events for that object.' },
      {
        label: 'Messages — All events',
        description: 'Flat, searchable, sortable table with namespace/pod filters and independent Normal/Warning/Failed checkboxes.',
      },
    ],
  },
  {
    id: 'view-resources',
    title: 'Resources',
    screen: 'resources',
    summary:
      'Browse every resource scoped to a chosen Namespace or Node — generalizes "click Namespace, see everything in it" to also work for Nodes ("click ' +
      'Node, see every Pod scheduled there").',
    fields: [
      { label: 'Namespace / Node scope toggle', description: 'Chooses which kind of scope to browse.' },
      { label: 'Sort groups by: Name / Count', description: 'Namespace scope only — controls per-Kind group ordering.' },
      { label: 'Pods without requests only', description: 'Filters to Pods missing CPU/Memory requests — a cluster-hygiene signal.' },
    ],
  },
  {
    id: 'view-catalog',
    title: 'Course Catalog',
    screen: 'catalog',
    summary:
      'The picker screen for Training Course mode — lists every available lesson (grouped by course), with difficulty, estimated time, and a progress ' +
      'badge. Selecting a card starts that lesson in the Course view.',
  },
  {
    id: 'view-course',
    title: 'Course',
    screen: 'course',
    summary:
      'The lesson-taking experience: a split-pane layout with lesson content (prose, hints, checks, tasks) on one side and a live terminal running real CLI ' +
      "commands against your cluster on the other. This is VpK's one opt-in mutating mode — everywhere else in VpK is strictly read-only.",
    fields: [
      { label: 'Check cards', description: '"Run check" streams a pass/fail/error result with feedback.' },
      {
        label: 'Task cards',
        description: '"Start"/"Complete" — manual tasks are self-attested; auto tasks poll a server-side check in the background until it passes or times out.',
      },
      {
        label: 'Terminal pane',
        description: "A real command input restricted to the lesson's allowed verbs; ↑/↓ recall, clear/cls. Stack/Side-by-side toggles layout; the divider is drag-resizable.",
      },
      {
        label: 'Pop out',
        description: 'Opens the terminal in its own browser window, freeing full width for the lesson content. Closing that window (or clicking "Bring it back") returns it to the embedded pane — the whole session (what you\'ve typed, the full run history/output, and ↑/↓ recall) carries over both ways, so nothing is lost by popping in or out.',
      },
      {
        label: 'Allowed',
        description: 'Opens a popover listing exactly which commands work in this terminal — the CLI, each allowed verb with a one-line description of what it does, and the two rules that are always blocked no matter what\'s allowed (deleting a Node; any mutating verb combined with -A/--all-namespaces).',
      },
      { label: 'Header controls', description: 'Print (with/without answers), Progress, Stop (pauses and saves), a countdown clock, and an X/Y tasks-complete counter.' },
    ],
  },
  {
    id: 'view-teacher',
    title: 'Teacher',
    screen: 'teacher',
    summary:
      'An authoring tool for course content — edit lesson markdown files directly in the browser (frontmatter + prose + typed blocks like vpk-check/' +
      'vpk-task), with live save/validate against the server, plus a per-course Resources file panel.',
    fields: [
      { label: 'Courses sidebar', description: 'List of lesson files; "New" creates a fresh lesson from a starter template.' },
      { label: 'Reference', description: 'Opens a static field/syntax reference (frontmatter fields, block syntax, examples).' },
      {
        label: 'Validate / Save',
        description: 'Validate parses the current source server-side without saving; Save validates then writes — a malformed edit is rejected rather than corrupting the lesson.',
      },
      { label: 'Content / Resources tabs', description: 'Content is the markdown textarea; Resources manages per-course image/sample files.' },
    ],
  },
  {
    id: 'view-demo',
    title: 'Demo Data',
    screen: 'demo',
    summary:
      'A synthetic-cluster generator for building demo/test snapshots without a real cluster. Stage resources into a working set — by individual Kind, or ' +
      'cross-Kind "Bundles" — then "Finish" merges the staged set into a real snapshot file.',
    fields: [
      {
        label: 'Bundles panel',
        description:
          'Cross-Kind generators (Namespaces, System Pods, RBAC team, ConfigMaps/Secrets, StorageClasses, DaemonSets, Workloads, Services, and more), each with inline count/percent fields and a live estimated resource-count range. "Generate" runs every checked bundle in dependency order.',
      },
      {
        label: 'Individual resources grid',
        description:
          'One button per Kind — a Count field plus a pattern-per-placeholder form (supports {n}, {from-to}, {from-to,Random}, {guid}, {image}, {namespace} tokens). "Validate" previews without staging.',
      },
      {
        label: 'Working set panel',
        description: 'Lists staged counts per Kind, a "Simulate pod churn" option (for Timelapse demo data), a snapshot-name field, and Finish → Snapshot.',
      },
    ],
  },
];

/** Naive case-insensitive substring search across every field of every topic, with a simple relevance
 *  ordering (title match ranks above a match found only in body/fields/commands/links) — no fuzzy matching,
 *  no index: HELP_TOPICS is small enough (~20 entries) that a linear scan on every keystroke is invisible. */
export function searchHelp(query: string): HelpTopic[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const scored: { topic: HelpTopic; score: number }[] = [];
  for (const topic of HELP_TOPICS) {
    let score = 0;
    if (topic.title.toLowerCase().includes(q)) score += 10;
    if (topic.summary.toLowerCase().includes(q)) score += 3;
    for (const f of topic.fields ?? []) {
      if (f.label.toLowerCase().includes(q)) score += 5;
      if (f.description.toLowerCase().includes(q)) score += 2;
    }
    for (const c of topic.commands ?? []) {
      if (c.description.toLowerCase().includes(q)) score += 2;
      if (c.command.toLowerCase().includes(q)) score += 1;
    }
    for (const l of topic.links ?? []) {
      if (l.label.toLowerCase().includes(q)) score += 1;
    }
    if (score > 0) scored.push({ topic, score });
  }
  return scored.sort((a, b) => b.score - a.score).map((s) => s.topic);
}
