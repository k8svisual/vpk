/**
 * In-app Help content — shown in HelpPanel.tsx (the right-hand slide-out opened from the header's Help icon).
 * Hand-written and static (no server round-trip), same spirit as cliEquivalents.ts. `screen` is a plain string
 * matching a ViewId value for the per-screen topics, left loose (not `import type { ViewId }`) so this file has
 * no dependency on App.tsx and can't create an import cycle. General topics (no `screen`) cover app-shell
 * features that aren't any one view — the snapshot picker, Settings, Statistics/Logs, and reference material.
 *
 * A topic's body is built from optional pieces, rendered in this order by TopicCard: `summary` (always) →
 * `sections` (a heading + prose + its own field list, for the multi-mode views whose depth doesn't fit a
 * single flat list — 3D's Field/Wheel/Timelapse, Schematic's two levels, etc.) → top-level `fields` (a flat
 * label→description list, for the simpler views) → `crossLinks` (navigation OUT to other screens and the
 * RETURN link back — surfaced as its own labelled group since cross-navigation is a first-class thing to
 * document) → `commands` → `links`. Most topics use only some of these.
 */

export interface HelpField {
  /** The control's own visible label/name (e.g. "namespace", "Capture from cluster"), or a sub-feature name. */
  label: string;
  description: string;
}

/** A captured figure shown in a help topic/section — a real server-rendered Schematic SVG or a 3D-scene PNG,
 *  under packages/web/public/help/ (served at /help/… in dev and embedded into the compiled binary the same
 *  way the rest of the web assets are). Kept small and figure-framed so it reads as an illustration in the
 *  narrow panel regardless of the viewer's theme. */
export interface HelpImage {
  src: string;
  alt: string;
  caption?: string;
}

/** A major sub-section of a screen that has more than one mode/level (e.g. the 3D view's Field/Wheel/
 *  Timelapse). Rendered as a bold heading, an optional paragraph, an optional figure, and an optional nested
 *  field list. */
export interface HelpSection {
  heading: string;
  body?: string;
  images?: HelpImage[];
  fields?: HelpField[];
}

/** A navigation edge documented for a screen — either a link OUT to another screen (with the return path back)
 *  or the return pill this screen shows when reached from elsewhere. */
export interface HelpCrossLink {
  /** The control you click, e.g. `"View Schematic" (Pod Properties)`. */
  from: string;
  /** Where it takes you and what carries over / how to get back. */
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
  /** Present for the per-screen topics — HelpPanel uses this to pin/auto-expand the current view's topic and
   *  to group it under "Screens" in the table of contents. Matches a ViewId string value. */
  screen?: string;
  summary: string;
  images?: HelpImage[];
  sections?: HelpSection[];
  fields?: HelpField[];
  crossLinks?: HelpCrossLink[];
  commands?: HelpCommand[];
  links?: HelpLink[];
}

export const HELP_TOPICS: HelpTopic[] = [
  // ============================================================================
  // General / app-shell topics (no `screen`) — grouped under "General & reference"
  // ============================================================================
  {
    id: 'getting-started',
    title: 'Getting started',
    summary:
      'VpK visualizes a Kubernetes cluster from a snapshot — a point-in-time capture of every resource, stored as a JSON file. Load one with "Capture from cluster" ' +
      '(a live, read-only pull from whatever kubectl context is active) or pick an existing snapshot from the dropdown at the top-left of the header. Once a snapshot ' +
      'is loaded, every view in the left-hand nav rail explores that same captured state from a different angle — 3D layout, ownership graphs, RBAC, network topology, ' +
      'storage, events, and more. Views constantly cross-link: clicking a resource almost anywhere opens its full definition, and many views hand off to another view ' +
      '(scoped to what you clicked) with a "← Return" pill to bring you back.',
    sections: [
      {
        heading: 'The one exception to read-only',
        body:
          'Everything in VpK is strictly read-only — capturing, browsing, the 3D scene, Demo Data — with a single deliberate exception: Training Course mode (Catalog / ' +
          'Course / Teacher). Its terminal and auto-graded task checks run real kubectl/oc commands against your cluster, so that is the only place VpK can change anything.',
      },
      {
        heading: 'How to read this Help',
        body:
          'The Contents index below jumps to any screen or reference topic. The current screen\'s help is pinned and expanded right under the index. The search box at the ' +
          'top searches every topic (titles, descriptions, fields, commands) — so you can look up help for a screen other than the one you\'re on.',
      },
    ],
  },
  {
    id: 'snapshots-and-capture',
    title: 'Snapshots & capturing',
    summary:
      'The header\'s "snapshot" dropdown picks which captured cluster state every view reads from. Switching snapshots re-fetches every open view against the newly ' +
      'selected one. When the configured snapshot directory has no snapshot files, the header shows "none found in <dir>" in red so you know where VpK is looking.',
    fields: [
      { label: 'snapshot', description: 'Dropdown of every snapshot file in the configured directory. Re-reads the directory each time you open it, so a fresh capture shows up without a reload.' },
      {
        label: 'Capture from cluster',
        description:
          'Opens a modal that runs a live, read-only pull against your current kubeconfig context and writes a new timestamped snapshot — it never modifies the cluster.',
      },
    ],
    sections: [
      {
        heading: 'Inside the Capture modal',
        fields: [
          { label: 'Snapshot name', description: 'Base name, prefixed onto a timestamped directory (e.g. name-2026-07-11-20h-32m-04s/).' },
          { label: 'Description', description: 'Free text, saved beside the snapshot as desc.json.' },
          { label: 'CLI command', description: 'Default kubectl; e.g. "oc" for OpenShift or "kubectl --context foo". A Validate button confirms the CLI resolves before you run.' },
          { label: 'Resource scope', description: 'Core resources (the curated set VpK understands best) vs All discoverable resources (every readable kind including CRDs — thorough but can be much slower).' },
          { label: 'Redact Secrets / Redact ConfigMap data', description: 'Permanently discard those payloads at capture time. The objects themselves (name, type, metadata) are always captured either way — these only control the data payload.' },
          { label: 'Progress & result', description: 'Streams live per-kind progress (✓ counts, ⚠ skipped kinds), is cancellable mid-run, and ends in a "Saved <snapshot> — N objects" summary or a Try Again on failure.' },
        ],
      },
    ],
  },
  {
    id: 'settings',
    title: 'Settings',
    summary:
      'The gear icon (top-right) opens Settings across six tabs. Most fields are enforced server-side (they change what gets captured or listed); appearance, color, and ' +
      'terminal preferences apply instantly and are stored per-browser.',
    fields: [
      {
        label: 'Snapshot',
        description:
          'The snapshot directory path (with Save), plus "Redact Secrets" (hide values in the definition viewer; data still stored) and "Disable pulling Secrets" (never save Secret data at capture time at all — overrides Redact).',
      },
      { label: 'UI', description: 'Appearance theme (Light / Dark / Forest / Ocean), Font Size, and two 3D-only toggles: Depth fog (off by default) and Grid floor (on by default).' },
      {
        label: 'Colors',
        description:
          'Per-Kind color overrides (grouped by category, with a picker + reset per row; apply instantly) and per-API-group colors for the 3D Wheel\'s resource-plane walls (apply on the Wheel\'s next load). Each section has a Reset all.',
      },
      { label: 'Vendor Icons', description: 'Custom icon overrides keyed by apiVersion/vendor, persisted server-side.' },
      { label: 'Network Identification', description: "Edit the CNI and Service Mesh detection catalogs that drive the Network view's Plane/Edge labels (see the Network topic)." },
      {
        label: 'Education',
        description:
          'Everything for Training Course mode — see the sub-section below. (The old "Course resources directory" field is gone; resources now live inside each course\'s own folder.)',
      },
    ],
    sections: [
      {
        heading: 'Settings > Education, in detail',
        fields: [
          { label: 'Menu visibility', description: 'Show Course / Show Course Catalog / Show Teacher tools — three toggles (all on by default) that hide those nav items for deployments that don\'t use Training mode.' },
          { label: 'Terminal CLI override', description: 'Auto (each lesson\'s own cli) / Always kubectl / Always oc — forces which CLI the terminal and probes run regardless of what a lesson authored (handy if you only have oc installed).' },
          {
            label: 'Additional terminal commands',
            description:
              'Add extra kubectl/oc VERBS (e.g. exec, apply) that work in the terminal on every lesson, on top of each lesson\'s own allow-list. Each has a "Test" that runs `<cli> <verb> --help` (never touches a cluster) and reports Works / not-recognized / CLI-not-on-PATH, with a Details view and an inline path-fixer. Only affects what you can type — not a lesson\'s auto-graded checks.',
          },
          {
            label: 'Additional standalone commands',
            description:
              'Add whole standalone BINARIES (e.g. grep, jq, curl) the terminal may run directly as their own program — something it otherwise never allows (it only runs the one configured CLI, never a shell). Each has a "Test" reporting Found on PATH / at <path> / Not found, with a Details view and inline path-fixer.',
          },
          { label: 'Terminal CLI path', description: 'Per-CLI (kubectl, oc) path status with a "Test path" tester (and Clear for an override) — confirm they resolve now rather than discovering a missing binary mid-lesson.' },
          { label: 'Terminal appearance / font size', description: 'Dark or Light terminal background, and terminal font size (10–22px).' },
        ],
      },
    ],
  },
  {
    id: 'training-course-visibility',
    title: 'Training Course mode',
    summary:
      "VpK has an opt-in Training Course mode — a live, interactive Kubernetes learning environment with real lessons run against a real cluster: Catalog to pick a " +
      'lesson, Course to run it, Teacher to author lesson content. It is the one part of VpK that can modify anything (it runs real kubectl/oc commands you type or that ' +
      'a task-check validates) — everywhere else is strictly read-only. If you don\'t see Catalog / Course / Teacher in the left nav they\'ve been individually hidden; ' +
      'open Settings > Education and re-enable "Show Course", "Show Course Catalog", and/or "Show Teacher tools" (all on by default).',
  },
  {
    id: 'cli-equivalent',
    title: 'CLI Equivalent button',
    summary:
      'Most views have a "CLI Equivalent" button in the second header row — it opens a modal of hand-picked kubectl/jq one-liners that get roughly the same information ' +
      'the view is showing, for when you\'d rather reproduce something at your own terminal. These are documentation only — VpK never runs them (unlike the Training ' +
      'terminal). They\'re starting points, not a guarantee of identical output, since VpK often cross-references several resource kinds in ways one kubectl call can\'t. ' +
      'Replace any <placeholders>; some commands assume jq or a krew plugin.',
  },
  {
    id: 'statistics-and-logs',
    title: 'Statistics, Logs & About',
    summary:
      'Three small header tools, plus the About box on the nav-rail logo.',
    fields: [
      {
        label: 'Statistics (bar-chart icon)',
        description:
          'Read-only diagnostics, refetched each open: System (platform/arch, Node version, memory, uptime); Application (port, snapshot dir, current snapshot, redaction state, resource/edge counts); Snapshot file (path, size, per-Kind count breakdown).',
      },
      {
        label: 'Logs (scroll icon)',
        description:
          "VpK's own in-memory server activity log (startup, snapshot loads, capture lifecycle — not cluster or container logs), polling every 2s while open. Auto-scroll pins to newest; Download Diagnostics bundles /diagnostics + browser info into a JSON file for bug reports (never includes captured resource contents); Clear empties the log.",
      },
      { label: 'About (VpK logo, top of nav rail)', description: 'Branding, license, and the running app version (e.g. v0.1.0).' },
      { label: 'Stop the VpK server (red X)', description: 'Confirms, then shuts the local server down and shows a "You can close this tab" message.' },
    ],
  },
  {
    id: 'creating-test-clusters',
    title: 'Creating test clusters',
    summary:
      'VpK needs a real (or locally simulated) Kubernetes cluster to capture from. If you don\'t have one handy, here\'s how to spin up a small local multi-node cluster ' +
      'with each of the four most common local tools. All four commands below create a 3-node cluster with roughly 1GB of memory per node — enough for a quick demo, ' +
      'though most of these tools recommend 2GB+ per node for anything beyond light use (etcd + kube-apiserver on the control-plane node are memory-hungry).',
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

  // ============================================================================
  // Per-screen topics (one per ViewId) — grouped under "Screens"
  // ============================================================================
  {
    id: 'view-cluster3d',
    title: '3D Cluster',
    screen: 'cluster3d',
    summary:
      "The flagship view — your snapshot rendered as an interactive WebGL scene, best for spatial and relational exploration rather than precise data lookup. A button " +
      'row at the top-left switches sub-modes (Filter, Field, Wheel, and — in Wheel — Timelapse and Clear). The canvas stays resident, so switching modes or leaving and ' +
      'returning keeps your camera and selection. Orbit with drag, zoom with scroll, pan with right-drag or two fingers. If WebGL is unavailable the view says so instead ' +
      'of rendering.',
    sections: [
      {
        heading: 'Field mode — the node fleet',
        body:
          'Every Node is a box on a flat grid. Its footprint grows with CPU capacity and its height with memory; fill color is role (master = dark red, worker = grey); ' +
          'a floating label shows running/capacity pods. The box BORDER shows filter status — green = included, red = excluded — so a filter\'s effect is visible across the ' +
          'whole fleet at once before you hide anything.',
        images: [{ src: '/help/3d-field.png', alt: 'Field mode showing node boxes on a grid', caption: 'Field mode: a master node (dark red) and worker nodes (grey), each with a green "included" border.' }],
        fields: [
          { label: 'Filter → "Filter Nodes" panel', description: 'Every dimension gets an include/exclude toggle: Role, Health, Schedulability (cordoned), Taints (key=value:effect), full OS group (Architecture / OS / OS Image / Kernel), runtime group (Kubelet / Kube-Proxy / Container Runtime versions), a numeric Hardware group (CPU/Memory/Ephemeral-storage/Pod capacity & allocatable, pods running — min/max boxes), and Label/Annotation "contains" text matches. Fields where every node shares a value collapse to "same on every node".' },
          { label: 'Hide excluded / Reset view', description: 'Hide excluded removes the red-bordered nodes from the scene entirely (vs just marking them); Reset view brings them back. A live "N shown · N hidden · N total · N in Wheel" bar sits top-right.' },
        ],
      },
      {
        heading: 'Wheel mode — the whole cluster, radially',
        body:
          'The cluster laid out in concentric tiers around a central control-plane hub. Outer ring: Node boxes (with optional CPU/Memory bars). Above each node: its Pods as ' +
          'hexagonal pucks, linked up to their Services. Then tiers for Network (Service/Endpoint/Ingress/Route/HTTPRoute spheres), Storage (PVC → PV → StorageClass → ' +
          'VolumeAttachment cylinders), a structural CSI ring, and per-node local storage. The hub holds the Control Plane ring, Kubelet/Kube-Proxy dots, API Server / ' +
          'Scheduler / Controller Manager / etcd, kubectl, the image-registry stack, and 10 API-group "planes" (a translucent wall per group with one sphere per Kind in it). ' +
          'Picking Wheel directly always shows the full cluster; only Field\'s "View in Wheel" narrows it to a node subset.',
        images: [{ src: '/help/3d-wheel.png', alt: 'Wheel mode: concentric rings around the control-plane hub', caption: 'Wheel mode: the Control Plane ring (purple) and node ring (orange) around the hub, nodes (grey/red boxes), pods in columns above them, and the API-group panes at right.' }],
        fields: [
          { label: 'Filter → "Filter 3D view" panel', description: 'Collapsible sections with color swatches matching the scene: Nodes (incl. CPU/Memory/Storage bars), Network, Storage (CSI/PVC/PV/SC/VolumeAttachment), Pods (by status + DaemonSet + "Show replica" sibling rings + CPU/Memory bars), Control Plane (ring, kubelet, components, kubectl, registries, and a per-resource-pane Resources sub-list), a Namespace dropdown, Label/Annotation contains, a selection Sound toggle, and "Save current filter settings as default" (per-browser).' },
          { label: 'Properties panel (click any item)', description: 'A top-right popup whose contents depend on what you clicked — see "Cross-navigation" below. Closing it does NOT clear the selection ring; use Clear for that.' },
        ],
      },
      {
        heading: 'Timelapse mode — replay the cluster\'s history',
        body:
          'A toggle available only in Wheel mode. It reuses the wheel geometry and fades each item in as its creation timestamp is reached, replaying how the cluster was ' +
          'built. A bottom-center transport bar drives it.',
        images: [{ src: '/help/3d-timelapse.png', alt: 'Timelapse mid-replay, the wheel partially built', caption: 'Timelapse mid-replay — resources fade in as their creation time is reached. A bottom transport bar (play, scrubber, speed) and a "Changes (N)" list drive playback.' }],
        fields: [
          { label: 'Transport', description: 'Step back / Play-Pause / Step forward, a live timestamp readout, an "N of M" position counter, a step-snapped scrubber, and a speed selector (0.5x / 1x / 2x / 4x — 1x is one second per interval; it\'s a steady-pace replay, not literal real-time).' },
          { label: 'Changes (N)', description: 'Opens a "Changes this interval" popover listing each resource created (green) or deleted (red) in that step, with its time — click a row to jump straight to that resource\'s source editor.' },
          { label: 'Filter (timelapse\'s own)', description: 'A separate "Filter timelapse" panel controlling which categories animate; the per-resource-pane spheres are off by default (they\'re aggregate counts with no single creation time).' },
        ],
      },
      {
        heading: 'Reading the scene',
        fields: [
          { label: 'Shapes', description: 'Box = Node; hexagonal puck = Pod; sphere = a network/endpoint/ingress item, a CSIDriver, or a per-Kind pane summary; short cylinder = a storage item, node-local storage, or an image registry; translucent wall = an API-group plane; torus = the Control Plane ring or CSI ring.' },
          { label: 'Colors', description: 'Nodes by role (master dark red / worker grey); Pods by status (Running green, Warning amber, Failed red, Succeeded blue, DaemonSet grey); network/storage items by Kubernetes kind; plane walls by API group. Kind and API-group colors are customizable in Settings > Colors.' },
          { label: 'Selection rings', description: 'Pulsing rings — red = your selection, grey = "Show replica" ReplicaSet siblings, cyan/magenta = a selected Pod\'s associated components (node, services, storage lineage).' },
          { label: 'Depth fog / Grid floor', description: 'Both toggled in Settings > UI. Depth fog fades distant objects for a stronger depth cue (off by default — it can fade out distant nodes on a huge cluster); Grid floor is the ground grid (on by default).' },
        ],
      },
    ],
    crossLinks: [
      { from: 'View Schematic (Pod Properties)', description: 'Opens the Schematic view focused on that Pod. Schematic shows a "← Return to 3D view" pill back.' },
      { from: 'View OwnerRef (Properties, resources with owner refs)', description: 'Opens the OwnerRef graph focused on that resource, with a "← Return to 3D view" pill back.' },
      { from: 'Search (a per-Kind pane sphere)', description: 'Opens the Search view pre-scoped to that Kind, with a "← Return to 3D view" pill back.' },
      { from: 'View Repository (image-registry stack)', description: 'Opens Container Images scoped to that registry hostname, with a "← Return to 3D view" pill back.' },
      { from: 'View source (Properties / Control-Plane component)', description: 'Opens the definition editor as a modal overlay — stays in the 3D view, so there is no return pill.' },
    ],
  },
  {
    id: 'view-schematic',
    title: 'Schematic',
    screen: 'schematic',
    summary:
      "A detailed, server-rendered diagram of a single Pod's whole world — its owner chain, configuration, network, storage, security, and namespace policies — good for " +
      '"everything connected to this one Pod" at a glance. It has two levels: the Pod/Deployment schematic (the default) and a Container drill-down. Arrow legend: solid ' +
      'black = "references", dashed red = "creates". Any icon opens the underlying YAML; an aggregate icon shows a "(N)" count.',
    sections: [
      {
        heading: 'Level 1 — the Pod/Deployment schematic',
        body:
          'The Pod sits at the center inside two banner-headed boxes ("Namespace Level" and "Cluster Level"), surrounded by dashed category boxes that appear only when that ' +
          'data exists. The central Pod card shows phase, condition dots, and a status row per init/normal container (each clickable to that container\'s spec).',
        images: [{ src: '/help/schematic-pod.svg', alt: 'Pod-level schematic diagram', caption: 'A real Pod schematic: the Pod at center, its owner chain, configuration, network, storage (continuing into the Cluster Level box), security, and namespace policies.' }],
        fields: [
          { label: 'Configuration (yellow)', description: 'ConfigMaps and Secrets the Pod consumes.' },
          { label: 'Generator OwnerRefs (red)', description: 'The owner chain (Pod ← ReplicaSet ← Deployment) with dashed "creates" arrows; custom-resource owners get a lettered badge linking to their CRD in the Cluster Level box.' },
          { label: 'Network (blue)', description: 'The backing Service and its Endpoints/EndpointSlice.' },
          { label: 'Security (green)', description: "The Pod's ServiceAccount, plus the RBAC ▸ pill (see cross-navigation)." },
          { label: 'Storage (orange)', description: 'PVC in the namespace, continuing across the gap into the Cluster Level box for the bound PV, its StorageClass, and any VolumeAttachment/CSIDriver.' },
          { label: 'Policies (purple)', description: 'Namespace governance that applies to this Pod: matching NetworkPolicy, ResourceQuota, LimitRange, and the RoleBinding naming its ServiceAccount.' },
        ],
      },
      {
        heading: 'Level 2 — the Container schematic (drill-down)',
        body:
          'Click "View Container Schematic ▸" on the Pod card to open the Pod up into per-container detail; "← Return to Deployment Schematic" goes back. Inside a Pod ' +
          'boundary it stacks initContainers / containers / ephemeralContainers (debug, in purple), each a detail card with image, ports, resources, probes, restart count, ' +
          'and mounts, over a shared volumes box. Services sit to the left, Config to the right.',
        images: [{ src: '/help/schematic-container.svg', alt: 'Container-level schematic diagram', caption: 'The container drill-down: per-container detail cards over a shared volumes box. Select a container\'s radio to trace only its ports-to-Services and mounts-to-volumes.' }],
        fields: [
          { label: 'Per-container radio', description: 'Selecting a container\'s radio traces ONLY its edges — ports to the Services that route to them, mounts to the volume tiles it uses — greying out everything else. A declared port no Service routes to gets a "no Service" marker; a volume shared by multiple containers draws a dashed "shares volume" edge.' },
          { label: 'Click a volume tile', description: 'Renders that volume\'s storage-implementation sub-diagram in the right column — node-local chain for configMap/secret/emptyDir/hostPath, or PVC → PV → StorageClass (→ VolumeAttachment → CSIDriver) for a persistent volume.' },
        ],
      },
      {
        heading: 'Choosing a Pod',
        fields: [
          { label: 'Namespace / Pod dropdowns', description: 'The manual picker shown on a nav-rail visit (Pod dropdown is disabled until a namespace is chosen). Your selection survives round-trips out to RBAC/Events and back.' },
          { label: 'Aggregate "(N)" icons → Resources modal', description: 'Clicking a multi-item icon opens a "Resources" list modal (one row per item, a button per row to open its definition); Secret rows also get a "Decode" button that base64-decodes the values into a "Decoded: <name>" modal (honoring the Redact Secrets setting).' },
        ],
      },
    ],
    crossLinks: [
      { from: 'RBAC ▸ (Security box)', description: "Opens RBAC scoped to the Pod's ServiceAccount; RBAC shows a \"← Return to Schematic\" pill." },
      { from: 'has Events badge (purple, top-left)', description: 'Shown only when the Pod has Event history (with a warning count). Opens Events filtered to this exact Pod (by id), with a "← Return to Schematic" pill.' },
      { from: '← Return to 3D view', description: 'Shown when you arrived from the 3D view\'s Properties panel; the manual picker is hidden in that case.' },
    ],
  },
  {
    id: 'view-ownerref',
    title: 'OwnerRef',
    screen: 'ownerref',
    summary:
      'A clean, server-rendered ownership graph — "what owns this, and what does it own" — for any one resource (e.g. Pod ← ReplicaSet ← Deployment). Unlike Schematic ' +
      '(always centered on a Pod, with config/network/storage/security detail), OwnerRef works for ANY resource that has owner references and shows purely the ownership ' +
      'chain. The resource you started from gets a bold red halo; an owner missing from the snapshot appears dashed as "<not defined>". Clicking any node opens its YAML.',
    fields: [
      { label: 'Namespace / Resource dropdowns', description: 'A two-step manual picker (the resource list shows only resources that actually have owner references, as "name (Kind)"). Resets when you load a different snapshot.' },
    ],
    crossLinks: [
      { from: '← Return to 3D view', description: 'Shown when entered via the 3D Wheel\'s Properties "View OwnerRef" button, which pre-focuses one resource and hides the picker.' },
    ],
  },
  {
    id: 'view-search',
    title: 'Search',
    screen: 'search',
    summary:
      "The general-purpose \"find anything\" screen — one flat, filterable, sortable, paginated table of every resource in the snapshot, across all namespaces and kinds. " +
      'Best when you roughly know what you\'re after but don\'t want to navigate a specific view. Click any row to open that resource\'s definition. Placeholder resources ' +
      '(referenced but not fully captured) render dimmed.',
    fields: [
      { label: '+ kind…', description: 'Multi-select Kind filter chips — OR logic (Pod + Deployment shows either).' },
      { label: '+ namespace…', description: 'Multi-select namespace chips (also OR), including a "(cluster-scoped)" option that matches only resources with no namespace.' },
      { label: 'search…', description: 'Free-text filter across the visible table.' },
      { label: 'metadata (label) filter', description: 'Matches label keys/values — key, value, or key=value syntax (case-insensitive).' },
      { label: 'annotation filter', description: 'Same syntax, against annotations instead.' },
      { label: 'Columns & paging', description: 'Sortable Kind / Namespace / Name / Created columns (default Kind ascending); 25 rows per page with prev/next.' },
    ],
    crossLinks: [
      { from: '← Return to 3D view', description: 'Shown when you arrived via a per-Kind sphere\'s "Search" button in the 3D view, which pre-scopes the Kind filter.' },
    ],
  },
  {
    id: 'view-network',
    title: 'Network',
    screen: 'network',
    summary:
      'The cluster\'s networking, across four tabbed sub-modes: Services-To-Pods, Node & Pod IPs, Diagrams, and Ports. Clicking any resource opens its definition.',
    sections: [
      {
        heading: 'Services-To-Pods',
        body:
          'One collapsible card per Service (default namespace kube-system; a namespace dropdown incl. "All namespaces" filters the list). Each header shows the Service name, ' +
          'namespace, ClusterIP, and port list; expanding shows the backing Pods as a tree, each with its Pod IP and the node (name + IP) it runs on. A Service with no ' +
          'endpoints reads "no backing pods".',
      },
      {
        heading: 'Node & Pod IPs',
        body:
          'One card per Node (internal IP, podCIDR, pod count). Under each, Pod IPs are grouped by /24 subnet (labelled a.b.c.0/24); host-networked Pods — those whose IP ' +
          'equals the node IP — are pulled into a distinct "host <ip>" group instead of a subnet.',
      },
      {
        heading: 'Diagrams',
        body: 'Five diagram types. The first three scope to one selected Service (pick namespace + service); the last two are cluster-wide.',
        fields: [
          { label: 'Client → Service → Pods (scoped)', description: 'The basic request path: external client → the Service\'s ClusterIP/selector → its backing Pods.' },
          { label: 'Ingress Path (scoped)', description: 'The north-south chain: External User → LoadBalancer/Ingress/Route → Service → EndpointSlice → Pods. Clicking the EndpointSlice card opens a modal of every slice backing the Service.' },
          { label: 'Service × Nodes (scoped)', description: 'The Service\'s backing Pods grouped by the node each runs on — how the Service is physically distributed.' },
          { label: 'Cluster Topology (cluster-wide)', description: 'Every node\'s Pod CIDR/IPs and the connecting overlay (labelled generically — encapsulation isn\'t in a snapshot). Clicking a node opens its full, uncapped Pod list.' },
          { label: 'Network Layers (cluster-wide)', description: 'The Kubernetes networking stack top-to-bottom (Application → Ingress/Gateway → Service Mesh → Service Discovery → Node Data Plane → CNI → Physical/Cloud), each layer showing live counts from the snapshot; inferred values are marked "inferred · <evidence>".' },
        ],
      },
      {
        heading: 'Ports',
        body:
          'Every declared port usage. "By port" aggregates one row per port/protocol with per-source counts (ClusterIP / NodePort / LoadBalancer / containerPort / hostPort) ' +
          '— click a row for every individual use. "All usages" is a flat, filterable table. A red ● flags host-level exposure (NodePort / LoadBalancer / hostPort — reachable ' +
          'from outside the Pod network); source chips are warm for host-level, cool for cluster-internal.',
      },
      {
        heading: 'Settings tie-in — Network Identification',
        body:
          'The CNI/service-mesh names in the Diagrams (Network Layers, the Topology overlay) come from detection catalogs you can edit under Settings > Network ' +
          'Identification — DaemonSet names, CRD groups, node-annotation prefixes, sidecar container names, and namespaces per known CNI/mesh, each entry taggable and resettable.',
      },
    ],
  },
  {
    id: 'view-security',
    title: 'Security',
    screen: 'security',
    summary:
      'A read-only roster of every RBAC subject (User, Group, ServiceAccount) and where its access comes from — grouped by subject kind, then by subject. Good for browsing ' +
      '"who has access to what" without a specific query. Expanding a subject lists each binding it has, the role that binding references, and a bulleted summary of the ' +
      'resulting rules (as "verbs groups/resources"; an empty API group shows as "core", a missing role shows red as "(not in snapshot)").',
    crossLinks: [
      { from: 'diagram pill (per subject)', description: 'Opens the RBAC view scoped to that exact subject identity — works even for User/Group subjects with no backing object. RBAC shows a "← Return to Security" pill.' },
    ],
  },
  {
    id: 'view-rbac',
    title: 'RBAC',
    screen: 'rbac',
    summary:
      'A single-subject RBAC schematic — pick (or arrive pre-scoped to) one subject and see exactly what granted its access and what it can do: its bindings, the roles ' +
      'they point to, and the resulting permission rules, as a connected diagram. This is the "drill into one identity" complement to the broader Security roster. Click a ' +
      'binding or role node to open it; hover a node to see the underlying names.',
    fields: [
      { label: 'Subject dropdown', description: 'Grouped by kind (User / Group / ServiceAccount / …); options show namespace/name when namespaced.' },
    ],
    crossLinks: [
      { from: '← Return pill (label adapts to origin)', description: 'Shown only when you entered from another view: "← Return to Schematic", "← Return to Security", or "← Return to Who Can". A Who Can round-trip restores your exact query.' },
    ],
  },
  {
    id: 'view-whocan',
    title: 'Who Can',
    screen: 'whocan',
    summary:
      'The reverse of RBAC: start from a permission and list every subject that has it — answers "who can delete Secrets in production?" style questions. Pick one or more ' +
      'verbs and/or resources (blank = any) and optionally a namespace; the query runs automatically. Results show each matching subject and the bindings/roles that grant ' +
      'it; an italic subject means the grant is limited to specific named objects (listed as "— only: …").',
    fields: [
      { label: 'Verbs / Resources multi-select', description: 'Removable chips; resources read as "name (group)" for non-core groups.' },
      { label: 'Namespace', description: 'Restricts the query to access granted in one namespace; default "Any namespace".' },
      { label: 'Match: any selected / all selected', description: 'OR vs AND across your selected verb×resource combinations — only meaningful (and only enabled) with more than one combination.' },
    ],
    crossLinks: [
      { from: 'diagram pill (per result)', description: "Opens that subject's RBAC view; your whole Who Can query is preserved and restored when you return (\"← Return to Who Can\")." },
    ],
  },
  {
    id: 'view-storage',
    title: 'Storage',
    screen: 'storage',
    summary:
      'Storage relationships and aggregate counts, across four sub-views selected by a button row (nothing is shown until you pick one). Byte sizes format to B/KB/MB/…/PB.',
    sections: [
      {
        heading: 'SC / PV / PVC hierarchy',
        body:
          'Two independent, collapsible trees, each ordered biggest-capacity-first with a magnitude bar per row. Tree 1: StorageClass → PV → PVC → Pod. Tree 2 (when volume ' +
          'attachments exist): CSIDriver → VolumeAttachment → PV → PVC → Pod — a separate tree because a PV reaches its CSIDriver via VolumeAttachment, not via its ' +
          'StorageClass. Names/chips are clickable when the object resolved (an unclaimed PV shows a muted "unclaimed" chip).',
      },
      {
        heading: 'Counts by Volume Type / Cluster Node / Namespace',
        body:
          'Three entry points into one breadcrumb drill-down over every Pod volume mount, each with its own fixed sequence down to a leaf Pod list: Volume Type → Node → ' +
          'Namespace → Pod; Cluster Node → Type → Namespace → Pod; Namespace → Type → Pod (this one skips Node). Click a row to drill in, any breadcrumb segment to jump back; ' +
          'the leaf lists the distinct Pods (with a per-Pod mount count), each clickable to its definition.',
      },
    ],
  },
  {
    id: 'view-images',
    title: 'Container Images',
    screen: 'images',
    summary:
      'Every container image reference used across the cluster — good for auditing which registries, repositories, and tags are actually in use, and exactly which ' +
      'workloads/containers pull each one. Browse as a Tree or a flat Table; clicking a leaf/row opens the resource focused on that container (init containers are marked).',
    fields: [
      { label: 'Tree / Table toggle', description: 'Tree nests Repository → Image → Namespace → Kind → Container (each level counted); Table is a flat sortable Repository / Image / Namespace / Kind / Resource / Container.' },
      { label: 'Registry / Repository dropdowns', description: 'Filter to one registry (images with no explicit registry are attributed to docker.io), then one repository within it. A direct visit asks you to pick a repository first.' },
    ],
    crossLinks: [
      { from: '← Return to 3D view', description: 'Shown when you arrived via an image-registry stack\'s "View Repository" button in the 3D view, which pre-filters to that registry.' },
    ],
  },
  {
    id: 'view-events',
    title: 'Events',
    screen: 'events',
    summary:
      'Kubernetes Events — a point-in-time capture, not a live stream. VpK adds a third category, Failed (carved out of Warning by reason text like FailedScheduling/' +
      'FailedMount), alongside the real Normal/Warning. Events referencing an object already deleted at capture render de-emphasized and non-clickable. Two tabs, Graph and ' +
      'Messages (neither preselected on a plain visit).',
    sections: [
      {
        heading: 'Graph tab',
        body:
          'A windowed, pageable stacked-bar histogram (5-minute buckets, Normal/Warning/Failed stacked). A header shows the snapshot\'s START/END/ELAPSED span and a total ' +
          'breakdown. Back/Forward page one window at a time; a "skip interval" stepper sets the window width; a scrubbable minimap ("Position in full range") shows where the ' +
          'window sits in the whole domain and lets you click/drag to jump. Clicking a bar jumps to Messages > All events filtered to exactly that 5-minute window. "Keep in ' +
          'sync with the top message in the list" instead makes the window follow the Messages list as you scroll it.',
      },
      {
        heading: 'Messages tab',
        body:
          'Namespace is set on the Graph tab; here you add a Pod filter and independent Normal/Warning/Failed checkboxes (default Warning+Failed on). "By object" aggregates ' +
          'one row per involved object (Total / Warning / Last reason / Last seen, sortable) — click a row for a modal of every Event for that object. "All events" is a flat, ' +
          'filterable table; its Object cell opens the object the Event is about, while the Message cell\'s Event icon opens that Event\'s own raw source.',
      },
    ],
    crossLinks: [
      { from: '← Return to Schematic', description: 'Shown when you arrived from a Schematic Pod\'s "has Events" badge — it pins the view to that exact Pod (Messages > All events, all three categories on).' },
    ],
  },
  {
    id: 'view-resources',
    title: 'Resources',
    screen: 'resources',
    summary:
      'Browse every resource scoped to a chosen Namespace, or every Pod scheduled on a chosen Node — a scope toggle switches between the two. Namespace scope groups ' +
      'resources by Kind (each group has a count and an "Explain" description button); Node scope lists that node\'s Pods (DaemonSet pods included) with status and ' +
      'CPU/Memory requests. Click any row to open the resource.',
    fields: [
      { label: 'Namespace / Node scope toggle', description: 'Chooses which kind of scope to browse.' },
      { label: 'Sort groups by: Name / Count', description: 'Namespace scope only — orders the per-Kind groups alphabetically or most-resources-first.' },
      { label: 'Pods without requests only', description: 'A hygiene filter (both scopes) narrowing to Pods with no CPU/Memory requests set.' },
    ],
  },
  {
    id: 'view-catalog',
    title: 'Course Catalog',
    screen: 'catalog',
    summary:
      'The picker for Training Course mode — lists every available lesson grouped by course, each card showing difficulty, estimated time, and a live progress badge ' +
      '(Not started / In progress with an X/Y task count / Completed). Selecting a card starts that lesson in the Course view. If no lessons are found, the empty state ' +
      'names the exact directory the server is scanning (~/.vpk/courses in the packaged app) so you know where to add content.',
  },
  {
    id: 'view-course',
    title: 'Course',
    screen: 'course',
    summary:
      "The lesson-taking experience: a split pane with lesson content on one side and a live terminal on the other. This is VpK's ONE mutating mode — the terminal and " +
      'auto-graded checks run real commands against your cluster; everywhere else in VpK is read-only. If you open Course with no lessons installed, you get a "No courses ' +
      'yet" screen (naming the courses directory) with a still-usable blank terminal beside it.',
    sections: [
      {
        heading: 'Lesson content',
        fields: [
          { label: 'Detected environment card', description: 'Probes the cluster and shows Context, Provisioner, Nodes (ready/total), Server version, and multi-node capability.' },
          { label: 'Check cards', description: '"Run check" streams a live pass / fail / error with a strictness level and feedback (blockers in red); becomes "Run again" after. These are what the header\'s X/Y counter tracks.' },
          { label: 'Task cards (Start / Complete)', description: 'Manual tasks are self-attested (Start → Complete). Auto tasks arm background polling on Start ("Checking in the background…"), flip to Complete on success, or become "Paused — see Progress" if they exceed their deadline (re-triggered from the Progress modal).' },
          { label: 'Auto-validation banner', description: 'If an auto-task\'s command can\'t run yet (binary missing, or the verb hasn\'t been granted server-auto-run), a dismissible banner offers "Configure" (enter a path, then approve the verb for this course or all courses). It never blocks the lesson — unresolved tasks just fall back to manual "Run check".' },
        ],
      },
      {
        heading: 'The terminal pane',
        body:
          'A real command input that runs the lesson\'s CLI (kubectl by default, or oc / whatever its frontmatter declares). Only the lesson\'s allowed verbs — plus any you ' +
          'added in Settings — can be typed; everything else is rejected before it runs.',
        fields: [
          { label: 'Standalone commands', description: 'Whole extra binaries you opt into in Settings > Education (grep, jq, curl, …) run here directly as their own program; the caption adds "(plus grep, jq, …)". The terminal is never a shell.' },
          { label: 'Recall & clear', description: '↑/↓ walk previously typed commands (your in-progress draft is preserved); "clear"/"cls" wipes the visible transcript but keeps recall history.' },
          { label: 'Allowed popover', description: 'Lists exactly what works here — the CLI, every allowed verb with a plain-English description (verbs you added tagged "(added by you)"), and any standalone commands. Destructive operations aren\'t held back (this is a training tool for a real cluster) — but running a "delete" asks you to confirm first.' },
          { label: 'Delete confirmation', description: 'Because the terminal runs against a real cluster, a "delete" command shows the exact command and a "Run delete" / "Cancel" prompt first, so a stray keystroke can\'t wipe something out. A lesson can turn this off (frontmatter "confirmDelete: false") for delete-heavy courses where the prompt would just be in the way.' },
          { label: 'Layout & resize', description: 'A Stack / Side-by-side button switches content-beside vs content-above; drag the divider to resize.' },
          { label: 'Pop out', description: 'Opens the terminal in its own browser window, freeing full width for the lesson. The whole session — input line, full run history/output, and ↑/↓ recall — carries over both ways, so nothing is lost popping in or out; closing that window brings it back.' },
          { label: 'Missing-CLI fixer', description: 'If the CLI (or any command) isn\'t found on PATH, an inline path-fixer lets you point VpK at the binary right there.' },
        ],
      },
      {
        heading: 'Header controls',
        fields: [
          { label: 'Print', description: 'Print with answers (forces every Hint / Step-by-step open) or without (hides them — for handing a printed copy to a student).' },
          { label: 'Progress', description: 'A modal listing every Start/Complete task\'s status, with "Check again" for any that timed out.' },
          { label: 'Stop', description: 'Pauses and leaves the course (progress is saved continuously); returns to the Catalog.' },
          { label: 'Clock & counter', description: 'A countdown clock (time left, or time over in red — hidden if the author set showCountdown:false) and an X/Y check counter.' },
        ],
      },
    ],
  },
  {
    id: 'view-teacher',
    title: 'Teacher',
    screen: 'teacher',
    summary:
      'An authoring tool for course content — create and edit lesson markdown files (frontmatter + prose + typed vpk-check / vpk-task blocks) directly in the browser, with ' +
      'live validate/save against the server, plus a per-course file manager.',
    fields: [
      { label: 'Courses sidebar', description: 'Lists every lesson; "New" prompts for a path (relative to courses/, ending in .md) and seeds a starter template.' },
      { label: 'Reference', description: 'A static field & syntax reference — every frontmatter field (id/title/difficulty/estimatedMinutes/allow/cli/passWhen/floor/…), the Hint & Step-by-step <details> convention, and the vpk-check / vpk-task / vpk-detect block formats.' },
      { label: 'Validate / Save', description: 'Validate parses the source without writing (reporting block counts + warnings); Save validates then writes — a malformed edit is rejected rather than corrupting the file.' },
      { label: 'Content / Resources tabs', description: 'Content is the raw-markdown textarea. Resources is a drag-and-drop file manager (upload/rename/delete images & samples) stored inside the course\'s own folder — <coursesDir>/<course>/resources/ — referenced from a lesson as /course-resources/<course>/<filename>.' },
    ],
  },
  {
    id: 'view-demo',
    title: 'Demo Data',
    screen: 'demo',
    summary:
      'A synthetic-cluster generator for building demo/test snapshots with no real cluster (it needs no capture). Stage resources into a working set — by cross-Kind ' +
      'Bundles or by individual Kind — then Finish merges the staged set into a real snapshot file (with ordered, staggered creation timestamps so e.g. Nodes predate Pods).',
    sections: [
      {
        heading: 'Building a working set',
        fields: [
          { label: 'Bundles panel', description: 'Cross-Kind generators (Namespaces, System Pods, an RBAC team, ConfigMaps/Secrets, StorageClasses, DaemonSets, Pods-per-Node, Services, PVCs/PVs, Events, Gateways, NetworkPolicies, and more), each with inline count/percent fields. "Generate" runs every checked bundle in dependency order; "Clear generated resources" wipes what they produced so you can adjust and re-run cleanly.' },
          { label: 'Individual resources grid', description: 'One button per Kind (badge = currently staged). Each opens a modal with a Count and a pattern per placeholder field, supporting tokens {n}, {from-to}, {from-to,step}, {from-to,Random}, {guid}, {image}, {namespace}. "Validate" previews resolved values without staging; "Add N to working set" stages them.' },
          { label: 'Working set panel', description: 'Staged counts per Kind, a "Simulate pod churn" option (adds synthetic replacement events so Wheel Timelapse isn\'t just monotonic growth), a snapshot-name field, and Finish → Snapshot. Save/Load buttons persist your bundle + per-Kind form settings.' },
        ],
      },
    ],
  },
];

/** Naive case-insensitive substring search across every part of every topic, with a simple relevance ordering
 *  (a title match ranks above a match found only in a section/field/command) — no fuzzy matching, no index:
 *  HELP_TOPICS is small enough that a linear scan on every keystroke is invisible. */
export function searchHelp(query: string): HelpTopic[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const scored: { topic: HelpTopic; score: number }[] = [];
  for (const topic of HELP_TOPICS) {
    let score = 0;
    if (topic.title.toLowerCase().includes(q)) score += 10;
    if (topic.summary.toLowerCase().includes(q)) score += 3;
    for (const img of topic.images ?? []) {
      if (img.alt.toLowerCase().includes(q) || img.caption?.toLowerCase().includes(q)) score += 1;
    }
    for (const s of topic.sections ?? []) {
      if (s.heading.toLowerCase().includes(q)) score += 4;
      if (s.body?.toLowerCase().includes(q)) score += 2;
      for (const f of s.fields ?? []) {
        if (f.label.toLowerCase().includes(q)) score += 4;
        if (f.description.toLowerCase().includes(q)) score += 2;
      }
      for (const img of s.images ?? []) {
        if (img.alt.toLowerCase().includes(q) || img.caption?.toLowerCase().includes(q)) score += 1;
      }
    }
    for (const f of topic.fields ?? []) {
      if (f.label.toLowerCase().includes(q)) score += 5;
      if (f.description.toLowerCase().includes(q)) score += 2;
    }
    for (const c of topic.crossLinks ?? []) {
      if (c.from.toLowerCase().includes(q)) score += 3;
      if (c.description.toLowerCase().includes(q)) score += 1;
    }
    for (const c of topic.commands ?? []) {
      if (c.description.toLowerCase().includes(q)) score += 2;
      if (c.command.toLowerCase().includes(q)) score += 1;
    }
    for (const l of topic.links ?? []) {
      if (l.label.toLowerCase().includes(q) || l.url.toLowerCase().includes(q)) score += 1;
    }
    if (score > 0) scored.push({ topic, score });
  }
  return scored.sort((a, b) => b.score - a.score).map((s) => s.topic);
}
