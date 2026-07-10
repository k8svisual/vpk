---
id: troubleshooting-04-diagnose-and-fix
title: Troubleshooting Kubernetes
difficulty: 3
prereqs: [openshift-02-using-oc]
estimatedMinutes: 90
passWhen: functional
floor: standard
allow: [get, describe, logs, edit, patch, delete, create, exec, adm, port-forward]
cli: [oc]
---

Every lab below deploys something that's already broken, or breaks after one edit. Your job: **diagnose it
yourself** using `oc get`/`oc describe`/`oc logs`/`oc get events` — don't peek at Step-by-step until you've
actually looked. Once you've found the root cause, fix it and confirm the resource comes up healthy.

> The original version of this course used IBM-internal Docker Hub images (`ibmicpcoc/*`) that may no longer
> be available. Every lab below uses `nginx`/`busybox` instead, adapted to trigger the same category of bug —
> the diagnosis skill transfers regardless of which image is broken. A couple of labs (Storage, Stateful) are
> adapted from the original's NFS-backed static storage to minikube's built-in dynamic StorageClass, since a
> solo learner's cluster has no NFS server. Routes is OpenShift-only content with no live check (needs a real
> OpenShift/OKD cluster, not just `oc` pointed at any cluster) — read it as reference. Forward (`port-forward`)
> streams indefinitely like `--watch` — run it in your own terminal, not the in-app one; there's no automated
> check for it either.

```vpk-check
id: t-context-reachable
describe: oc can reach the cluster
kind: cluster
assert: contextReachable
```

## Lab 1 — Create

Deploy a Deployment named `t-create` running `nginx:1.25`, 50m CPU / 50Mi memory, in the `default` namespace.
Nothing tricky here — this is the baseline every later lab in this course builds on top of.

<details><summary>Hint</summary>

`oc create -f <file>.yaml`, then `oc get pods -l app=t-create` to confirm it deployed.

</details>

<details><summary>Step-by-step</summary>

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: t-create
  labels: { app: t-create }
spec:
  replicas: 1
  selector: { matchLabels: { app: t-create } }
  template:
    metadata: { labels: { app: t-create } }
    spec:
      containers:
      - name: web
        image: nginx:1.25
        resources: { requests: { cpu: 50m, memory: 50Mi } }
```

```
oc create -f t-create.yaml
oc get pods -l app=t-create
```

</details>

```vpk-check
id: t-create-deployed
describe: t-create Deployment exists and is Ready
kind: inventory
namespace: default
expect: { source: literal, value: { Deployment: 1 } }
```

## Lab 2 — Syntax

Deploy this Deployment as-is. It will fail to create at all.

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: t-syntax
spec:
  replicas: 1
  selector: { matchLabels: { app: t-syntax } }
  template:
    metadata: { labels: { app: t-syntax } }
    spec:
      containers:
        name: web
        image: nginx:1.25
```

<details><summary>Hint</summary>

`containers` is supposed to be a **list** — each entry needs a leading `-`. Compare against Lab 1's
Deployment.

</details>

<details><summary>Step-by-step</summary>

`oc create -f` fails immediately:

```
error validating data: ValidationError(Deployment.spec.template.spec.containers): invalid type for
io.k8s.api.core.v1.PodSpec.containers: got "map", expected "array"
```

Fix: add the hyphen.

```yaml
      containers:
      - name: web
        image: nginx:1.25
```

</details>

```vpk-check
id: t-syntax-deployed
describe: t-syntax Deployment exists and is Ready
kind: inventory
namespace: default
expect: { source: literal, value: { Deployment: 1 } }
```

## Lab 3 — Resources

Deploy this Deployment. It creates successfully but the pod never starts.

```yaml
        resources:
          requests:
            cpu: "8"        # 8 whole CPUs
            memory: 100Mi
```

<details><summary>Hint</summary>

`oc describe po <pod>` → `Events`. A single CPU is `1000m`; check what your node can actually offer with
`oc describe node`.

</details>

<details><summary>Step-by-step</summary>

```
oc get pods -l app=t-resources
```

```
NAME                          READY   STATUS    RESTARTS   AGE
t-resources-5c96bc649-tjnhb   0/1     Pending   0          2m
```

```
oc describe po t-resources-5c96bc649-tjnhb
```

```
Events:
  Warning  FailedScheduling  58s (x121 over 5m)  default-scheduler  0/1 nodes are available: 1 Insufficient cpu.
```

The request (`8` full CPUs) is more than the node has. Edit the Deployment, drop it to `100m` (a tenth of a
CPU), and it schedules immediately.

</details>

```vpk-check
id: t-resources-healthy
describe: t-resources Deployment is Ready (not stuck Pending)
kind: inventory
namespace: default
expect: { source: literal, value: { Deployment: 1 } }
```

## Lab 4 — Images

Deploy this Deployment. It creates, but the pod never becomes Ready.

```yaml
        image: nginx:1.does-not-exist
```

<details><summary>Hint</summary>

`oc describe po` → `Events` — one of the `Warning`/`Failed` messages names the exact problem.

</details>

<details><summary>Step-by-step</summary>

```
oc get pods -l app=t-images
```

```
NAME                        READY   STATUS             RESTARTS   AGE
t-images-78b7f6598d-p8kvf   0/1     ImagePullBackOff   0          10m
```

```
Events:
  Warning  Failed  27s (x2 over 43s)  kubelet  Failed to pull image "nginx:1.does-not-exist": ... manifest unknown
```

The tag doesn't exist. Edit the Deployment, fix the tag to `nginx:1.25`.

</details>

```vpk-check
id: t-images-healthy
describe: t-images Deployment is Ready (image pulls successfully)
kind: inventory
namespace: default
expect: { source: literal, value: { Deployment: 1 } }
```

## Lab 5 — Starting

Deploy this Deployment, overriding the image's default entrypoint with nothing useful to run:

```yaml
        image: busybox:latest
        command: ["/bin/sh", "-c", "exit 0"]
```

<details><summary>Hint</summary>

The container starts, does its one thing, and exits immediately — every time it's restarted. `oc describe
po` → `Events` names the pattern; `oc get pods` shows the status directly.

</details>

<details><summary>Step-by-step</summary>

```
oc get pods -l app=t-starting
```

```
NAME                          READY   STATUS             RESTARTS   AGE
t-starting-75d79787b7-88pnr   0/1     CrashLoopBackOff   4          2m
```

A container with no long-running process just exits — the kubelet keeps restarting it, backing off longer
each time. Fix: give it something to actually run and keep running.

```yaml
        command: ["/bin/sh", "-c", "while true; do sleep 3600; done"]
```

</details>

```vpk-check
id: t-starting-healthy
describe: t-starting Deployment is Ready (not CrashLoopBackOff)
kind: inventory
namespace: default
expect: { source: literal, value: { Deployment: 1 } }
```

## Lab 6 — Liveness

Deploy this Deployment — it starts, but restarts constantly.

```yaml
        image: nginx:1.25
        ports: [{ containerPort: 80 }]
        livenessProbe:
          httpGet: { path: /, port: 80 }
          initialDelaySeconds: 0
          periodSeconds: 1
          failureThreshold: 1
```

<details><summary>Hint</summary>

How long does nginx actually take to be ready to answer a request, versus how long the probe waits before
its first check?

</details>

<details><summary>Step-by-step</summary>

```
oc describe po t-liveness-...
```

```
Events:
  Warning  Unhealthy  ...  Liveness probe failed: Get "http://...:80/": dial tcp ...: connect: connection refused
  Normal   Killing    ...  Container failed liveness probe. Container will be killed and recreated.
```

`initialDelaySeconds: 0` means the FIRST check fires before nginx has even started listening — one failure
(`failureThreshold: 1`) is enough to kill it, forever, before it ever gets a chance. Give it a few seconds:

```yaml
          initialDelaySeconds: 5
          failureThreshold: 3
```

</details>

```vpk-check
id: t-liveness-healthy
describe: t-liveness Deployment is Ready (not restart-looping)
kind: inventory
namespace: default
expect: { source: literal, value: { Deployment: 1 } }
```

## Lab 7 — Root User

Deploy this Deployment. It crashes trying to write to a path it can't.

```yaml
        image: busybox:latest
        command: ["/bin/sh", "-c", "echo hi > /etc/readonly-test.txt && sleep 3600"]
        securityContext:
          runAsNonRoot: true
          runAsUser: 1000
```

<details><summary>Hint</summary>

`oc logs` on a crashed container shows the last thing it tried to do before exiting.

</details>

<details><summary>Step-by-step</summary>

```
oc logs t-rootuser-... 
```

```
/bin/sh: can't create /etc/readonly-test.txt: Permission denied
```

Running as a non-root UID (correctly, for security) means it can't write to `/etc` — that's expected, not a
bug in the security policy. Fix the APPLICATION's target path instead of loosening security:

```yaml
        command: ["/bin/sh", "-c", "echo hi > /tmp/readonly-test.txt && sleep 3600"]
```

`/tmp` is writable by any UID. (If a real workload genuinely needs `/etc/*`, an OpenShift cluster's answer
is `oc adm policy add-scc-to-user anyuid -z <serviceaccount>` — loosen the constraint deliberately, not by
accident.)

</details>

```vpk-check
id: t-rootuser-healthy
describe: t-rootuser Deployment is Ready
kind: inventory
namespace: default
expect: { source: literal, value: { Deployment: 1 } }
```

## Lab 8 — Init Containers

Deploy this Deployment. The main container expects a file that was never created.

```yaml
      containers:
      - name: web
        image: busybox:latest
        command: ["/bin/sh", "-c", "cat /data/ready.txt && sleep 3600"]
        volumeMounts:
        - { name: data, mountPath: /data }
      volumes:
      - { name: data, emptyDir: {} }
```

<details><summary>Hint</summary>

Nothing ever wrote `/data/ready.txt` — an `emptyDir` starts genuinely empty. An `initContainers:` entry runs
to completion *before* the main container starts, and can share the same volume.

</details>

<details><summary>Step-by-step</summary>

```
oc logs t-init-...
```

```
cat: can't open '/data/ready.txt': No such file or directory
```

Add an init container that creates the file first:

```yaml
      initContainers:
      - name: seed
        image: busybox:latest
        command: ["/bin/sh", "-c", "echo ready > /data/ready.txt"]
        volumeMounts:
        - { name: data, mountPath: /data }
```

`oc describe po` afterward shows an `Init Containers:` section with `State: Terminated, Reason: Completed`
before the main container ever starts.

</details>

```vpk-check
id: t-init-healthy
describe: t-init Deployment is Ready
kind: inventory
namespace: default
expect: { source: literal, value: { Deployment: 1 } }
```

## Lab 9 — Config

Deploy this Deployment. It never leaves `ContainerCreating`.

```yaml
        volumeMounts:
        - { name: cfg, mountPath: /etc/cfg }
      volumes:
      - name: cfg
        configMap: { name: t-config-missing }
```

<details><summary>Hint</summary>

`oc describe po` → `Events` — a `FailedMount` warning names exactly which resource is missing.

</details>

<details><summary>Step-by-step</summary>

```
Events:
  Warning  FailedMount  ...  MountVolume.SetUp failed for volume "cfg" : configmaps "t-config-missing" not found
```

The ConfigMap the volume references was never created. Create it, matching the name the Deployment expects:

```
oc create configmap t-config-missing --from-literal=hello=world
```

The pod picks it up on its next scheduling attempt without needing the Deployment itself re-created.

</details>

```vpk-check
id: t-config-healthy
describe: t-config Deployment is Ready (ConfigMap volume mounts)
kind: inventory
namespace: default
expect: { source: literal, value: { Deployment: 1 } }
```

## Lab 10 — Networking

Deploy both of these. The Service exists, has endpoints, and traffic still doesn't reach the pod.

```yaml
apiVersion: apps/v1
kind: Deployment
metadata: { name: t-networking }
spec:
  replicas: 1
  selector: { matchLabels: { app: t-networking } }
  template:
    metadata: { labels: { app: t-networking } }
    spec:
      containers:
      - { name: web, image: nginx:1.25, ports: [{ containerPort: 80 }] }
---
apiVersion: v1
kind: Service
metadata: { name: t-networking }
spec:
  selector: { app: t-networking }
  ports: [{ port: 80, targetPort: 8080 }]
```

<details><summary>Hint</summary>

The Service's `Endpoints`/`EndpointSlice` will show the pod as a healthy backend — the selector matches
fine. The bug is more specific than "not connected": compare the Deployment's `containerPort` against the
Service's `targetPort`.

</details>

<details><summary>Step-by-step</summary>

```
oc describe svc t-networking
```

```
Port:         80/TCP
TargetPort:   8080/TCP
Endpoints:    10.244.0.12:8080
```

nginx is listening on `80`, not `8080` — the Service is faithfully forwarding to a port nothing's listening
on. Fix the Service's `targetPort` to `80` (matching the container), not the Deployment.

</details>

```vpk-check
id: t-networking-port-correct
describe: Service targetPort matches the container's actual port
kind: value
namespace: default
assert:
  - { select: { kind: Service, name: t-networking }, path: '.spec.ports[*].targetPort', op: '==', value: 80 }
```

## Lab 11 — Storage

Deploy this PVC and Deployment. *(Adapted from the original's static NFS storage — this uses minikube's
built-in default StorageClass instead, since a solo learner's cluster has no NFS server to point at.)*

```yaml
apiVersion: v1
kind: PersistentVolumeClaim
metadata: { name: t-storage-clam }   # deliberate typo
spec:
  accessModes: [ReadWriteOnce]
  resources: { requests: { storage: 1Mi } }
---
apiVersion: apps/v1
kind: Deployment
metadata: { name: t-storage }
spec:
  replicas: 1
  selector: { matchLabels: { app: t-storage } }
  template:
    metadata: { labels: { app: t-storage } }
    spec:
      containers:
      - name: web
        image: nginx:1.25
        volumeMounts: [{ name: data, mountPath: /data }]
      volumes:
      - name: data
        persistentVolumeClaim: { claimName: t-storage-claim }   # doesn't match the PVC's real name
```

<details><summary>Hint</summary>

`oc describe po` → `Events`. The PVC name in the Deployment's `volumes:` has to match the PVC's actual
`metadata.name` exactly.

</details>

<details><summary>Step-by-step</summary>

```
Events:
  Warning  FailedScheduling  ...  persistentvolumeclaim "t-storage-claim" not found
```

The Deployment references `t-storage-claim`, but the PVC is actually named `t-storage-clam` (typo). Fix
either name so they match — easiest is renaming the PVC to `t-storage-claim` and re-creating it.

</details>

```vpk-check
id: t-storage-healthy
describe: t-storage Deployment is Ready (PVC bound and mounted)
kind: inventory
namespace: default
expect: { source: literal, value: { Deployment: 1, PersistentVolumeClaim: 1 } }
```

## Lab 12 — Stateful

Deploy this StatefulSet. It fails to create pods at all.

```yaml
apiVersion: apps/v1
kind: StatefulSet
metadata: { name: t-stateful }
spec:
  serviceName: t-stateful
  replicas: 1
  selector: { matchLabels: { app: t-stateful } }
  template:
    metadata: { labels: { app: t-stateful } }
    spec:
      containers:
      - name: web
        image: nginx:1.25
        volumeMounts: [{ name: wrong-name, mountPath: /data }]
  volumeClaimTemplates:
  - metadata: { name: data }
    spec:
      accessModes: [ReadWriteOnce]
      resources: { requests: { storage: 1Mi } }
```

<details><summary>Hint</summary>

The container's `volumeMounts[].name` has to match a `volumeClaimTemplates[].metadata.name` exactly — a
StatefulSet doesn't have a separate `volumes:` block like a Deployment does; the claim template *is* the
volume.

</details>

<details><summary>Step-by-step</summary>

```
oc describe statefulset t-stateful
```

```
Events:
  Warning  FailedCreate  ...  Pod "t-stateful-0" is invalid: spec.containers[0].volumeMounts[0].name: Not found: "wrong-name"
```

Fix the mount name to match the claim template:

```yaml
        volumeMounts: [{ name: data, mountPath: /data }]
```

</details>

```vpk-check
id: t-stateful-healthy
describe: t-stateful StatefulSet's pod exists and volume is claimed
kind: inventory
namespace: default
expect: { source: literal, value: { StatefulSet: 1, Pod: 1 } }
```

## Lab 13 — Cross-Namespace DNS

Create a `backend` namespace with an nginx Deployment + Service in it. Then deploy this pod in `default`,
which tries to reach that Service:

```yaml
apiVersion: v1
kind: Pod
metadata: { name: t-crossns }
spec:
  containers:
  - name: probe
    image: busybox:latest
    command: ["/bin/sh", "-c", "wget -T 3 -O- http://backend-svc || sleep 3600"]
```

<details><summary>Hint</summary>

A bare Service name (`http://backend-svc`) only resolves within its OWN namespace's DNS search path. From a
different namespace, you need the namespace qualified in.

</details>

<details><summary>Step-by-step</summary>

```
oc logs t-crossns
```

```
wget: bad address 'backend-svc'
```

`backend-svc` only resolves inside the `backend` namespace. From `default`, it needs to be
`backend-svc.backend` (or the full `backend-svc.backend.svc.cluster.local`):

```yaml
    command: ["/bin/sh", "-c", "wget -T 3 -O- http://backend-svc.backend || sleep 3600"]
```

</details>

```vpk-check
id: t-crossns-resolved
describe: t-crossns pod is Running (cross-namespace DNS resolves)
kind: fields
namespace: default
expect:
  source: literal
  value:
    - select: { kind: Pod, name: t-crossns }
      paths: ['.spec.containers[*].command']
```

## Lab 14 — Routes (OpenShift only, reference — no live check)

> This lab needs a real OpenShift/OKD cluster — Route is an OpenShift CRD with no equivalent on plain
> Kubernetes, even with `oc` pointed at a non-OpenShift cluster. Read this as reference material.

A pod is up and healthy, but the application logs an error trying to reach its own externally-facing Route —
because the Route object was never actually created; only a Service was.

<details><summary>Hint</summary>

`oc get routes` in the app's namespace — is there one at all?

</details>

<details><summary>Step-by-step</summary>

```yaml
apiVersion: route.openshift.io/v1
kind: Route
metadata:
  name: my-app
spec:
  host: my-app.<cluster-apps-domain>
  port: { targetPort: my-app }
  to: { kind: Service, name: my-app, weight: 100 }
  wildcardPolicy: None
```

`oc create -f route.yaml`, then confirm with `oc get routes` — the app's own health check (if it makes an
outbound call to its own Route) should stop erroring once it exists and resolves.

</details>

## Lab 15 — Downward API

Deploy this Deployment — the container reads its own resource limits via the Downward API and refuses to
start if they disagree with each other.

```yaml
        resources:
          requests: { memory: 32Mi, cpu: 125m }
          limits: { memory: 64Mi, cpu: 250m }
        volumeMounts: [{ name: podinfo, mountPath: /etc/podinfo }]
        command:
          - /bin/sh
          - -c
          - |
            req=$(cat /etc/podinfo/mem_request); lim=$(cat /etc/podinfo/mem_limit)
            if [ "$req" != "$lim" ]; then echo "mem_request ($req) != mem_limit ($lim)"; exit 1; fi
            sleep 3600
      volumes:
      - name: podinfo
        downwardAPI:
          items:
            - { path: mem_request, resourceFieldRef: { containerName: web, resource: requests.memory } }
            - { path: mem_limit, resourceFieldRef: { containerName: web, resource: limits.memory } }
```

<details><summary>Hint</summary>

The Downward API is faithfully reporting real values from the container spec — the fix is in
`resources:`, not the volume definition.

</details>

<details><summary>Step-by-step</summary>

```
oc logs t-downward-...
```

```
mem_request (33554432) != mem_limit (67108864)
```

`requests.memory` and `limits.memory` genuinely differ (32Mi vs 64Mi) — this app deliberately treats that as
a misconfiguration. Make them equal:

```yaml
          requests: { memory: 64Mi, cpu: 125m }
          limits: { memory: 64Mi, cpu: 250m }
```

</details>

```vpk-check
id: t-downward-healthy
describe: t-downward Deployment is Ready (memory request equals limit)
kind: value
namespace: default
assert:
  - { select: { kind: Deployment, name: t-downward }, path: '.spec.template.spec.containers[*].resources.requests.memory', op: '==', value: '64Mi' }
  - { select: { kind: Deployment, name: t-downward }, path: '.spec.template.spec.containers[*].resources.limits.memory', op: '==', value: '64Mi' }
```

## Lab 16 — Port Forward (run in your own terminal — no live check)

> `oc port-forward` streams until you Ctrl-C it — the in-app terminal can't run it (same reason `--watch`
> can't). Run this in your own terminal.

Forward a local port to the `t-networking` pod from Lab 10 (once its Service/port fix is in place), and
confirm you can reach it directly, bypassing the Service entirely.

<details><summary>Hint</summary>

`oc port-forward <pod> <local-port>:<container-port>`. Leave that terminal running, then `curl` from a
second one.

</details>

<details><summary>Step-by-step</summary>

```
oc port-forward t-networking-... 8081:80
```

```
Forwarding from 127.0.0.1:8081 -> 80
```

In a second terminal:

```
curl http://127.0.0.1:8081
```

You should get nginx's default welcome page — proof the container itself is healthy and listening,
independent of whatever the Service's routing does or doesn't do. `port-forward` is one of the best "is the
CONTAINER actually the problem, or is it something upstream" diagnostic tools you have.

</details>

That's the full diagnostic toolkit: reading `describe`/`events`/`logs` to find the real error, and the most
common root causes behind Pending, ImagePullBackOff, CrashLoopBackOff, ContainerCreating, and "running but
unreachable."
