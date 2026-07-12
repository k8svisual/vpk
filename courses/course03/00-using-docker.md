---
id: docker-03-using-docker
title: Using Docker
description: Build and run container images with the docker CLI — the layer underneath the images your Kubernetes workloads run.
difficulty: 1
prereqs: [getting-started-00-cluster]
estimatedMinutes: 30
---

This course uses the `docker` CLI directly — not `kubectl`, not `oc`. Docker builds and runs container
images; Kubernetes/OpenShift schedule and run *those same images* across a cluster, but talking to Kubernetes
never involves the `docker` command. This course is about the layer underneath — where the images your
Deployments reference actually come from.

> **This is reference/practice content, not a live-checked lesson.** VpK's in-app terminal only runs the one
> kubectl-compatible CLI a course is configured for (`kubectl` or `oc`) — it deliberately doesn't run arbitrary
> commands, `docker` included. Run everything in this course in your own terminal. Nothing here is graded;
> work through it, compare against the example output, and move on when it makes sense.
>
> You'll need Docker actually installed and running — Docker Desktop covers this on macOS/Windows; minikube's
> own Docker driver has one already, reachable via `minikube docker-env` (or `minikube ssh`) if you'd rather
> use the daemon inside minikube instead of a separate Docker install.

Each task describes a challenge. Work out the command yourself; **Hint** gives a nudge, **Step-by-step** gives
the full answer with example output.

## Info

View your Docker daemon's configuration.

<details><summary>Hint</summary>

`docker info`.

</details>

<details><summary>Step-by-step</summary>

```
docker info
```

Output includes server version, storage driver, number of containers/images, total CPU/memory, and more —
useful for confirming what you're actually talking to before anything else in this course.

</details>

## Pull

Pull the image `nginx:1.25` from Docker Hub.

<details><summary>Hint</summary>

Use the full `name:tag` so you know exactly which image you got.

</details>

<details><summary>Step-by-step</summary>

```
docker pull nginx:1.25
```

```
Trying to pull repository docker.io/nginx ...
1.25: Pulling from docker.io/nginx
Status: Downloaded newer image for nginx:1.25
```

</details>

## Dockerfile

Create a file named `Dockerfile` (capital D) with the following content:

```
FROM nginx:1.25
RUN echo 'hello from my image' > /usr/share/nginx/html/index.html
```

<details><summary>Hint</summary>

A heredoc writes multi-line content to a file in one command — paste the whole block, including the closing
`EOF`, and press enter.

</details>

<details><summary>Step-by-step</summary>

```
cat > Dockerfile << EOF
FROM nginx:1.25
RUN echo 'hello from my image' > /usr/share/nginx/html/index.html
EOF
```

Confirm it saved correctly:

```
cat Dockerfile
```

</details>

## Build

Build an image from that Dockerfile, tagged `my-course-image:latest`.

<details><summary>Hint</summary>

`docker build -t <name>:<tag> .` — the trailing ` .` (space, then a period) tells Docker to use the
Dockerfile in the current directory. It's easy to drop by accident; the build will fail immediately without it.

</details>

<details><summary>Step-by-step</summary>

```
docker build -t my-course-image:latest .
```

```
Sending build context to Docker daemon  2.048kB
Step 1/2 : FROM nginx:1.25
 ---> 9aa0517519d0
Step 2/2 : RUN echo 'hello from my image' > /usr/share/nginx/html/index.html
 ---> Running in 440a305ce1f1
Successfully built c7df42e07a95
Successfully tagged my-course-image:latest
```

</details>

## Run

Run the image you just built, publishing container port 80 to host port 8080.

<details><summary>Hint</summary>

`-p <host-port>:<container-port>` maps a host port to a container port. `-d` runs it in the background so
your terminal isn't attached to it.

</details>

<details><summary>Step-by-step</summary>

```
docker run -d -p 8080:80 my-course-image:latest
```

Then check it's actually serving your custom page:

```
curl localhost:8080
```

Should print `hello from my image`.

</details>

## History

Show the image's build history, including the full (non-truncated) command for each layer.

<details><summary>Hint</summary>

`--no-trunc` is the flag that keeps each layer's command from being cut off.

</details>

<details><summary>Step-by-step</summary>

```
docker history my-course-image:latest --no-trunc
```

One row per layer, oldest at the bottom — you can see exactly which Dockerfile instruction produced each one.

</details>

## Stats

View live CPU/memory/network stats for running containers.

<details><summary>Hint</summary>

`docker stats` streams continuously until you stop it — this is exactly the kind of command that has to run
in your own terminal (see the note at the top of this course). Ctrl-C to exit.

</details>

<details><summary>Step-by-step</summary>

```
docker stats
```

```
CONTAINER   CPU %   MEM USAGE / LIMIT   MEM %   NET I/O          BLOCK I/O   PIDS
8e1efc7ddb08   0.00%   4MiB / 15.51GiB     0.00%   1.31kB / 698B    0B / 0B     2
```

Refreshes in place every second or so until you Ctrl-C.

</details>

## Inspect

Inspect your image's full metadata (JSON).

<details><summary>Hint</summary>

`docker inspect <image>`. Output is a JSON array — pipe to `less` or `jq` if you want to page through it.

</details>

<details><summary>Step-by-step</summary>

```
docker inspect my-course-image:latest
```

Returns architecture, layer digests, environment, working directory, and the full config used to build it —
one JSON object per image/container you inspect.

</details>

## Events

Watch the Docker daemon's live event stream (container create/start/stop, network connects, etc.).

<details><summary>Hint</summary>

Like `docker stats`, this streams indefinitely — run it in your own terminal, not the in-app one. Events only
appear as they happen; if nothing's changing, the output stays empty. `--since` replays events from a past
timestamp instead of only watching forward.

</details>

<details><summary>Step-by-step</summary>

```
docker events
```

Trigger something in another terminal (e.g. `docker run --rm alpine echo hi`) and watch the corresponding
`create`/`attach`/`start`/`die` events appear here in real time. Ctrl-C to stop watching.

</details>

That's the Docker layer end to end — building an image, running it, and inspecting what's actually inside it.
Everything you did here becomes the `image:` field of a Pod spec once you're back to working with Kubernetes.
