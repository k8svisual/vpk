/**
 * "How would I get this with a plain CLI?" reference, per graphical/list view — the header's "CLI Equivalent"
 * button (App.tsx) looks a view up here and shows it in CliEquivalentModal. Purely static documentation, no
 * server round-trip: these are hand-picked kubectl/oc/jq/grep/awk one-liners and short scripts that get
 * roughly the same information the view renders, for someone at a terminal instead of VpK. Not every command
 * is a perfect match (VpK cross-references live data across kinds in ways a single kubectl call can't), and
 * that's fine — the goal is "close enough to be useful," not a formal equivalence proof. Views with no
 * meaningful CLI analogue (Demo Data, Course/Catalog/Teacher — nothing here talks to a real cluster) simply
 * have no entry and the button doesn't render for them (see App.tsx's CLI_EQUIVALENTS[view] guard).
 */

export interface CliCommand {
  /** What this command shows / why you'd run it. */
  description: string;
  /** One or more shell lines — a script, not always a single command. */
  command: string;
}

export interface CliEquivalent {
  /** Shown as the modal's intro line — one or two sentences on what the view shows and the general CLI
   *  strategy for getting the same picture (e.g. "list namespaces, then loop over pods per namespace"). */
  intro: string;
  commands: CliCommand[];
}

export const CLI_EQUIVALENTS: Partial<Record<string, CliEquivalent>> = {
  search: {
    intro:
      'Search lists every resource across every namespace with a live text/kind filter. The CLI equivalent is ' +
      '"get everything, then grep/filter" — there is no single kubectl verb that searches by free text.',
    commands: [
      { description: 'Every resource kubectl knows how to list, across all namespaces', command: 'kubectl get all -A' },
      {
        description: 'Every resource of every API-discoverable kind (broader than "all") — namespaced kinds only',
        command:
          "kubectl api-resources --verbs=list --namespaced -o name | \\\n  xargs -n1 -I{} kubectl get {} -A --ignore-not-found -o wide",
      },
      { description: 'Filter by a name substring across everything', command: 'kubectl get all -A | grep -i "<search-term>"' },
      {
        description: 'Filter to one kind by label',
        command: 'kubectl get pods -A -l app=<name> -o wide',
      },
    ],
  },

  cluster3d: {
    intro:
      'The 3D Cluster view lays out every Node and the Pods scheduled on it. Equivalent CLI approach: list ' +
      'nodes, then list pods sorted/grouped by which node they landed on.',
    commands: [
      { description: 'Nodes with capacity/OS/kernel/runtime info', command: 'kubectl get nodes -o wide' },
      { description: 'Node resource requests/limits and conditions', command: 'kubectl describe node <node-name>' },
      { description: 'Live CPU/memory usage per node (needs metrics-server)', command: 'kubectl top nodes' },
      {
        description: 'Every pod across every namespace, grouped by node',
        command: "kubectl get pods -A -o wide --sort-by=.spec.nodeName",
      },
      {
        description: 'Just the pods on one specific node',
        command: "kubectl get pods -A -o wide --field-selector spec.nodeName=<node-name>",
      },
    ],
  },

  schematic: {
    intro:
      'Schematic renders one Pod: its containers, the ConfigMaps/Secrets it mounts or reads env from, its ' +
      'volumes, and the Service(s)/ports that route to it. Equivalent CLI: describe the pod, then resolve each ' +
      'reference it names.',
    commands: [
      { description: 'Full pod spec/status (containers, volumes, env-from references)', command: 'kubectl get pod <pod> -n <namespace> -o yaml' },
      { description: 'Human-readable summary — events, mounts, restarts', command: 'kubectl describe pod <pod> -n <namespace>' },
      {
        description: 'Just the container names and images',
        command: "kubectl get pod <pod> -n <namespace> -o jsonpath='{range .spec.containers[*]}{.name}{\"\\t\"}{.image}{\"\\n\"}{end}'",
      },
      {
        description: 'ConfigMaps/Secrets this pod actually references (envFrom + volumes)',
        command:
          "kubectl get pod <pod> -n <namespace> -o json | \\\n  jq -r '[.spec.containers[].envFrom[]?.configMapRef.name, .spec.containers[].envFrom[]?.secretRef.name, .spec.volumes[]?.configMap.name, .spec.volumes[]?.secret.secretName] | flatten | map(select(. != null)) | unique[]'",
      },
      {
        description: 'Which Service(s) route to this pod (matches its labels)',
        command:
          "kubectl get svc -n <namespace> -o json | \\\n  jq --argjson labels \"$(kubectl get pod <pod> -n <namespace> -o json | jq .metadata.labels)\" \\\n  -r '.items[] | select(.spec.selector as $s | $s and ($s | to_entries | all(. as $e | $labels[$e.key] == $e.value))) | .metadata.name'",
      },
    ],
  },

  network: {
    intro:
      'Network shows Services, their Endpoints/EndpointSlices, and Ingress/Route objects that front them. ' +
      'Equivalent CLI: list each kind, then cross-reference by name/selector.',
    commands: [
      { description: 'Services, Endpoints, and Ingress in one namespace', command: 'kubectl get svc,endpoints,ingress -n <namespace>' },
      { description: 'Same, across every namespace', command: 'kubectl get svc,endpoints,ingress -A' },
      { description: 'Modern endpoint tracking (what EndpointSlices actually back a Service)', command: 'kubectl get endpointslices -n <namespace> -l kubernetes.io/service-name=<service>' },
      { description: 'Full Service detail — ports, selector, endpoints, events', command: 'kubectl describe svc <service> -n <namespace>' },
      { description: 'OpenShift Routes (if applicable — no plain-Kubernetes equivalent)', command: 'oc get routes -A' },
    ],
  },

  security: {
    intro:
      'Security aggregates every subject (ServiceAccount/User/Group) with the RBAC rules bound to it, ' +
      'resolved from Roles/ClusterRoles via their bindings. Equivalent CLI: list bindings, then resolve each ' +
      'one\'s role and rules.',
    commands: [
      { description: 'Every ServiceAccount across the cluster', command: 'kubectl get serviceaccounts -A' },
      { description: 'Every RoleBinding/ClusterRoleBinding and which role+subjects they connect', command: 'kubectl get rolebindings,clusterrolebindings -A -o wide' },
      { description: 'The actual permission rules for one role', command: 'kubectl get role <role> -n <namespace> -o yaml   # or: kubectl get clusterrole <role> -o yaml' },
      {
        description: "What one ServiceAccount can actually do (kubectl's own resolved-permissions check)",
        command: 'kubectl auth can-i --list --as=system:serviceaccount:<namespace>:<sa-name>',
      },
      { description: 'Secret objects (types, not contents) — often part of the security picture', command: 'kubectl get secrets -A -o wide' },
    ],
  },

  rbac: {
    intro:
      'RBAC renders one subject\'s full grant graph: which Roles/ClusterRoles it\'s bound to, and what rules ' +
      'those roles carry. Equivalent CLI: find the bindings naming that subject, then read each bound role.',
    commands: [
      { description: 'All Role/ClusterRole/RoleBinding/ClusterRoleBinding objects', command: 'kubectl get roles,clusterroles,rolebindings,clusterrolebindings -A' },
      {
        description: 'Bindings that name a specific subject (grep the yaml, since kubectl has no --subject filter)',
        command: "kubectl get rolebindings,clusterrolebindings -A -o yaml | \\\n  yq -r 'select(.subjects[]?.name == \"<subject-name>\")'  # or grep -B5 <subject-name>",
      },
      { description: 'The rules a specific ClusterRole grants', command: 'kubectl describe clusterrole <role-name>' },
      { description: 'The rules a specific Role grants (namespaced)', command: 'kubectl describe role <role-name> -n <namespace>' },
    ],
  },

  whocan: {
    intro:
      'Who Can answers "who is allowed to <verb> <resource>?" — the reverse direction from RBAC\'s "what can ' +
      'this subject do?". kubectl has no native reverse-lookup; the practical approach is auth can-i per ' +
      'candidate subject, or a third-party tool.',
    commands: [
      { description: 'Can a specific user/SA do a specific thing right now', command: 'kubectl auth can-i <verb> <resource> -n <namespace> --as=<user-or-system:serviceaccount:ns:name>' },
      { description: 'Everything a user/SA can do', command: 'kubectl auth can-i --list --as=<user-or-system:serviceaccount:ns:name>' },
      {
        description: 'krew plugin built exactly for this reverse question (who-can)',
        command: 'kubectl krew install access-matrix   # then:\nkubectl who-can <verb> <resource>',
      },
      {
        description: 'Manual reverse search: list bindings, grep for role names granting the verb/resource',
        command: "kubectl get rolebindings,clusterrolebindings -A -o wide",
      },
    ],
  },

  storage: {
    intro:
      'Storage lists PersistentVolumeClaims, their bound PersistentVolumes, and the StorageClasses behind ' +
      'them. Equivalent CLI: list all three and cross-reference by name.',
    commands: [
      { description: 'PVCs, PVs, and StorageClasses in one shot', command: 'kubectl get pvc,pv,storageclass -A' },
      { description: 'Full detail on one PVC — bound volume, capacity, access modes, events', command: 'kubectl describe pvc <pvc> -n <namespace>' },
      { description: 'Which pods actually mount a given PVC', command: "kubectl get pods -A -o json | jq -r '.items[] | select(.spec.volumes[]?.persistentVolumeClaim.claimName == \"<pvc>\") | .metadata.namespace + \"/\" + .metadata.name'" },
      { description: 'Default StorageClass (used when a PVC omits storageClassName)', command: "kubectl get storageclass -o jsonpath='{range .items[?(@.metadata.annotations.storageclass\\.kubernetes\\.io/is-default-class==\"true\")]}{.metadata.name}{\"\\n\"}{end}'" },
    ],
  },

  ownerref: {
    intro:
      'OwnerRef walks one resource\'s ownership chain (who owns it, what it owns) — e.g. Pod ← ReplicaSet ← ' +
      'Deployment. kubectl exposes ownerReferences on any object; there is no built-in graph walker, so this ' +
      'is usually a short jq loop.',
    commands: [
      { description: "A resource's direct owner(s)", command: 'kubectl get <kind> <name> -n <namespace> -o jsonpath=\'{.metadata.ownerReferences}\' | jq' },
      { description: 'Everything a Deployment ultimately owns (its ReplicaSets, then their Pods)', command: 'kubectl get replicasets -n <namespace> -o json | jq -r \'.items[] | select(.metadata.ownerReferences[]?.name=="<deployment>") | .metadata.name\'\nkubectl get pods -n <namespace> -o json | jq -r \'.items[] | select(.metadata.ownerReferences[]?.name=="<replicaset>") | .metadata.name\'' },
      { description: 'One-liner walking up from a Pod to its controller', command: "kubectl get pod <pod> -n <namespace> -o jsonpath='{.metadata.ownerReferences[0].kind}/{.metadata.ownerReferences[0].name}'" },
    ],
  },

  images: {
    intro:
      'Container Images lists every distinct image in use, and which pods/namespaces run it. Equivalent CLI: ' +
      'pull every pod\'s container images and dedupe.',
    commands: [
      {
        description: 'Every distinct image running in the cluster',
        command: "kubectl get pods -A -o jsonpath='{range .items[*]}{range .spec.containers[*]}{.image}{\"\\n\"}{end}{end}' | sort -u",
      },
      {
        description: 'Same, with jq — also covers initContainers',
        command: "kubectl get pods -A -o json | \\\n  jq -r '.items[] | .spec.containers[], (.spec.initContainers // [])[] | .image' | sort -u",
      },
      {
        description: 'Which pods run a specific image',
        command: "kubectl get pods -A -o json | jq -r '.items[] | select(.spec.containers[].image == \"<image>\") | .metadata.namespace + \"/\" + .metadata.name'",
      },
      { description: 'Image ID/digest actually pulled (vs. the tag requested)', command: "kubectl get pod <pod> -n <namespace> -o jsonpath='{.status.containerStatuses[*].imageID}'" },
    ],
  },

  events: {
    intro: 'Events lists cluster Event objects, newest first, optionally scoped to a namespace/pod. Direct kubectl equivalent.',
    commands: [
      { description: 'All events, most recent last', command: 'kubectl get events -A --sort-by=.lastTimestamp' },
      { description: 'Events for one namespace', command: 'kubectl get events -n <namespace> --sort-by=.lastTimestamp' },
      { description: 'Events for one specific object', command: "kubectl get events -n <namespace> --field-selector involvedObject.name=<pod-name>" },
      { description: 'Live-follow new events as they happen', command: 'kubectl get events -A --watch' },
      { description: 'Warnings only', command: "kubectl get events -A --field-selector type=Warning --sort-by=.lastTimestamp" },
    ],
  },

  resources: {
    intro: 'Resources is a generic per-kind/per-namespace resource table. Direct kubectl equivalent.',
    commands: [
      { description: 'List one kind across all namespaces, wide output', command: 'kubectl get <kind> -A -o wide' },
      { description: 'List one kind in one namespace', command: 'kubectl get <kind> -n <namespace> -o wide' },
      { description: 'Every kind the API server exposes, with the verbs each supports', command: 'kubectl api-resources -o wide' },
      { description: 'Field/status detail kubectl documents for a kind (matches this view\'s "Explain" panel)', command: 'kubectl explain <kind> --recursive' },
      { description: 'Pods scheduled on one specific node', command: "kubectl get pods -A -o wide --field-selector spec.nodeName=<node-name>" },
    ],
  },
};
