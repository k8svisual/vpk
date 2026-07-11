---
id: openshift-02-using-oc
title: Using the oc CLI
difficulty: 2
prereqs: [getting-started-00-cluster]
estimatedMinutes: 45
passWhen: functional
floor: standard
allow: [get, describe, adm, config, api-resources, create, label, annotate, patch, exec, cp, delete, run]
cli: [oc]
---

This course uses the OpenShift `oc` CLI. `oc` is a superset of `kubectl` — every standard verb
(`get`/`describe`/`exec`/`logs`/…) works the same way — plus its own OpenShift-specific commands and object
types.

Each task describes a challenge. Work out the command yourself; if you get stuck, open **Hint** for a nudge,
or **Step-by-step** for the full answer with example output.

> **A few of these tasks (Routes, Projects, SecurityContextConstraints, `oc adm policy`) use real OpenShift
> concepts that don't exist on a plain Kubernetes cluster (minikube/k3d/etc.) — even with `oc` installed and
> pointed at one, those specific commands will come back empty or error, because the underlying API types
> genuinely aren't there. That's expected outside a real OpenShift/OKD cluster; the rest of this course works
> everywhere `oc` does.
>
> Also: this terminal runs one command and waits for it to exit — it can't usefully run something that streams
> forever, like `--watch` or an interactive shell session. Where a task below needs that, run it in your own
> terminal instead of this one.

## Explore the CLI

What are the categories of commands `oc` provides — Basic, Build and Deploy, Application Management,
Troubleshooting and Debugging, Advanced, Settings, Other?

<details><summary>Hint</summary>

`oc --help` prints every command grouped by category.

</details>

<details><summary>Step-by-step</summary>

```
oc --help
```

The output groups commands under headers like `Basic Commands:`, `Application Management Commands:`,
`Troubleshooting and Debugging Commands:`, and so on — skim each section to see what's available before diving
into the rest of this course.

</details>

## Nodes

What are the node names in the cluster? Include the `-o wide` parameter (lowercase letter O) for the extended
view.

<details><summary>Hint</summary>

`oc get nodes`, then again with `-o wide`.

</details>

<details><summary>Step-by-step</summary>

```
oc get nodes
oc get nodes -o wide
```

`-o wide` adds internal/external IP, OS image, kernel version, and container runtime columns.

</details>

What's the Allocatable CPU count for one of your nodes? `oc describe`'s output is meant for humans, not
scripts — it doesn't support `-o`.

<details><summary>Hint</summary>

`oc describe node <name>`, then look for the `Allocatable:` section.

</details>

<details><summary>Step-by-step</summary>

```
oc describe node <node-name>
```

Scroll to the `Allocatable:` block — it lists `cpu`, `memory`, `pods`, etc. separately from `Capacity:`
(allocatable is capacity minus what's reserved for the system/kubelet).

</details>

Show live CPU/memory usage for nodes, then for pods across every namespace.

<details><summary>Hint</summary>

`top` lives under `oc adm`. Requires a metrics source (metrics-server) to be running in the cluster — if
you get an error about the metrics API, that's why, not a mistake in your command.

</details>

<details><summary>Step-by-step</summary>

```
oc adm top nodes
oc adm top pods --all-namespaces
```

</details>

## OpenShift-only concepts (real OpenShift/OKD cluster required)

What routes exist across every namespace?

<details><summary>Hint</summary>

`oc get routes --all-namespaces`.

</details>

<details><summary>Step-by-step</summary>

```
oc get routes --all-namespaces
```

A Route is OpenShift's Ingress-equivalent — there's no Route object on plain Kubernetes.

</details>

Pick a project (OpenShift's namespace-equivalent) and describe it. What's its
`openshift.io/sa.scc.uid-range` annotation? That range is where the user IDs for pods in that project come
from.

<details><summary>Hint</summary>

`oc get projects`, then `oc describe project <name>`.

</details>

<details><summary>Step-by-step</summary>

```
oc get projects
oc describe project default
```

Look for `openshift.io/sa.scc.uid-range=` under `Annotations:`.

</details>

Who can `get` pods, cluster-wide?

<details><summary>Hint</summary>

`oc adm policy --help` — look in the "who-can" area.

</details>

<details><summary>Step-by-step</summary>

```
oc adm policy who-can get pods
```

</details>

## Session and cluster info

View your current `oc` session configuration.

<details><summary>Hint</summary>

`oc config --help`.

</details>

<details><summary>Step-by-step</summary>

```
oc config view
```

</details>

What resources exist in the `default` namespace — all of them?

<details><summary>Hint</summary>

`oc get all`, scoped to the namespace.

</details>

<details><summary>Step-by-step</summary>

```
oc get all -n default
```

</details>

List every API resource the server supports, with the verbs each one permits (`-o wide`).

<details><summary>Hint</summary>

Covered under `oc --help`'s "Advanced Commands" section.

</details>

<details><summary>Step-by-step</summary>

```
oc api-resources -o wide
```

</details>

```vpk-check
id: oc-context-reachable
describe: oc can reach the cluster
kind: cluster
assert: contextReachable
```

## Build, break, and fix a pod

Create a Deployment named `oc-course-web` running image `nginx:1.25`, with a `oc-course` label on the pod
template, requesting 50m CPU / 50Mi memory. Use `oc create -f` against a YAML file you write yourself.

<details><summary>Hint</summary>

Deployment → Pod template → containers is a YAML **array** — array entries need a leading hyphen. A
`containers:` block that's a map instead of a list is the single most common typo in a hand-written
Deployment.

</details>

<details><summary>Step-by-step</summary>

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: oc-course-web
  labels:
    app: oc-course
spec:
  replicas: 1
  selector:
    matchLabels:
      app: oc-course
  template:
    metadata:
      labels:
        app: oc-course
    spec:
      containers:
      - name: web
        image: nginx:1.25
        resources:
          requests:
            cpu: 50m
            memory: 50Mi
```

Save as `oc-course-web.yaml`, then:

```
oc create -f oc-course-web.yaml
oc get pods -l app=oc-course
```

If `containers:` is written as a map instead of an array (missing the `-`), `oc create` fails immediately with
a validation error naming the exact field — read it, it tells you precisely what's wrong.

</details>

```vpk-check
id: oc-deployment-created
describe: oc-course-web Deployment exists and is Ready
kind: inventory
namespace: default
expect: { source: literal, value: { Deployment: 1 } }
```

This task also demonstrates the auto-validation Start/Complete lifecycle: click **Start** and this card polls
in the background (roughly every few seconds) for the Deployment to report one ready replica, then flips to
Complete on its own — no need to come back and click anything. If it's still not ready after a while, it
pauses and the **Progress** button in the header lets you re-check when you're ready.

```vpk-task
id: oc-deployment-rollout
describe: oc-course-web rollout finishes (auto-checked)
completion: auto
estimatedMinutes: 3
check:
  verb: get
  args: [deployment, oc-course-web, -n, default, -o, json]
  expect:
    path: .status.readyReplicas
    op: '=='
    value: 1
```

Get an interactive shell inside the pod you just created, look around, then exit.

<details><summary>Hint</summary>

`oc rsh <pod-name>` opens a shell. This is an interactive session — run it in your own terminal, not this
app's (see the note at the top of this course).

</details>

<details><summary>Step-by-step</summary>

```
oc get pods -l app=oc-course
oc rsh <pod-name>
```

You'll land on a shell prompt inside the container. `exit` when you're done.

</details>

Without an interactive shell, list the contents of `/etc/nginx` inside the same pod.

<details><summary>Hint</summary>

`oc exec <pod> -- <command>` runs one command inside the container and returns its output — no shell
session needed.

</details>

<details><summary>Step-by-step</summary>

```
oc exec <pod-name> -- ls -la /etc/nginx
```

</details>

Add the label `work: training` to the pod (not the Deployment) using `oc edit`, then confirm it with
`oc describe`.

<details><summary>Hint</summary>

`oc edit po <pod-name>` opens the pod's live definition in your default editor — edit the `labels:` block
under `metadata`, save, and the editor closing applies the change. This is interactive too; use your own
terminal.

</details>

<details><summary>Step-by-step</summary>

```
oc edit po <pod-name>
```

Add under `metadata.labels`:

```yaml
    work: training
```

Save and close the editor, then:

```
oc describe po <pod-name>
```

`Labels:` should now include `work=training` alongside the Deployment's own `app=oc-course` label.

</details>

Now add an annotation — not a label — using `oc patch` instead of `oc edit`. Add `play: gaming`.

<details><summary>Hint</summary>

`oc patch po <pod> -p '<json>'` applies a JSON merge patch without opening an editor.

</details>

<details><summary>Step-by-step</summary>

```
oc patch po <pod-name> -p '{"metadata":{"annotations":{"play":"gaming"}}}'
oc describe po <pod-name>
```

`Annotations:` should now include `play=gaming`.

</details>

```vpk-check
id: oc-pod-labeled-annotated
describe: Pod has work=training label and play=gaming annotation
kind: fields
namespace: default
expect:
  source: literal
  value:
    - select: { kind: Pod, labels: { app: oc-course } }
      paths: ['.metadata.labels.work', '.metadata.annotations.play']
```

Create a file with your name in it, copy it into the pod at `/tmp`, then list `/tmp` inside the pod to confirm.

<details><summary>Hint</summary>

`oc cp <local-file> <pod>:<path>` copies a file into a running container. Use the `oc exec ... -- ls`
pattern from earlier to verify.

</details>

<details><summary>Step-by-step</summary>

```
echo "your name" > me.txt
oc cp me.txt <pod-name>:/tmp
oc exec <pod-name> -- ls -la /tmp
```

</details>

Delete the pod directly, then get pods again immediately. Notice a new one appears — why? Then find and delete
the actual owning resource (not just the pod) so nothing comes back.

<details><summary>Hint</summary>

A bare `oc delete po` only removes that one Pod — the Deployment (via its ReplicaSet) immediately creates a
replacement to satisfy the desired replica count. `oc get all -l app=oc-course` shows every resource type
involved; delete the Deployment itself to stop the replacement cycle.

</details>

<details><summary>Step-by-step</summary>

```
oc get pods -l app=oc-course
oc delete po <pod-name>
oc get pods -l app=oc-course
```

A new pod appears almost immediately — the Deployment's ReplicaSet noticed one replica short and created
another.

```
oc get all -l app=oc-course
oc delete deployment oc-course-web
oc get pods -l app=oc-course
```

With the Deployment gone, no replacement is created — the namespace is clean.

</details>

```vpk-check
id: oc-cleanup-complete
describe: oc-course-web Deployment removed (no lingering pods)
kind: inventory
namespace: default
expect: { source: literal, value: {} }
```

That's `oc` end to end — read-only exploration, OpenShift-specific concepts, and a full create → inspect →
label → patch → copy → delete cycle against a resource you built and owned yourself.
