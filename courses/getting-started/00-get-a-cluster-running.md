---
id: getting-started-00-cluster
title: Get a Cluster Running
difficulty: 1
provisioning: true
passWhen: functional
floor: loose
timeoutMs: 300000
pollMs: 5000
allow: [get]
---

Before you can do anything with Kubernetes, you need a cluster to point at. This lesson gets one running on
your own machine and confirms your tools can reach it — nothing here touches a namespace, because there isn't
one yet.

```vpk-detect
tools: [kubectl, minikube, k3d, microk8s, docker-desktop]
```

Based on what's detected above, here's what to do:

- **Nothing found?** Install [minikube](https://minikube.sigs.k8s.io/docs/start/) — it's the recommended
  starting point for this course and works the same way on macOS, Linux, and Windows.
- **Docker Desktop's built-in Kubernetes only?** That's fine for single-node lessons, but this course uses
  multi-node exercises later, and Docker Desktop's Kubernetes can only ever run one node. Install minikube
  alongside it rather than trying to make Docker Desktop do something it can't.
- **minikube, k3d, or MicroK8s already installed?** Great — use it. You don't need to install anything new
  just because a different tool is "recommended."

The rest of this lesson assumes minikube; swap in the equivalent command for your tool if you're using
something else.

Open a terminal and start a two-node cluster:

```
minikube start --nodes 2
```

This can take a few minutes the first time — minikube is downloading a VM image and bootstrapping Kubernetes
itself. Let it run.

```vpk-check
id: nodes-ready
describe: At least 2 nodes Ready
kind: cluster
assert:
  nodesReady: 2
hint: minikube start can take a few minutes on a first run. This check polls automatically — no need to refresh or re-run anything, just let it finish.
```

Once your nodes are up, confirm `kubectl` is actually configured to talk to them (not some other cluster you
might have configured earlier):

```
kubectl get nodes
```

You should see your node(s) listed with status `Ready`.

```vpk-check
id: context-reachable
describe: kubectl can reach the cluster
kind: cluster
assert: contextReachable
```

That's it — you have a real, running Kubernetes cluster, and the tools to talk to it. Everything from here on
happens against it directly: every command you type, every resource you create, is real. Take a look at what
you just built in the 3D view before moving on to the next lesson.
