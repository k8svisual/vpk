<img style="float: center;" src="https://raw.githubusercontent.com/k8svisual/viewk8s/main/public/docs/docimages/vpk.png" width="70" height="70">


## VpK - Visually presented Kubernetes

An application that presents Kubernetes resources and configurations in a visual and graphic fashion.
VpK can be installed and run on a local computer (requires Node.js and NPM) or run from a Docker container.  Refer to the appropriate section for installing the software.  


### VpK key points

- VpK is designed to capture a point-in-time snapshot of the cluster.

- VpK provides the ability to view the captured snapshot in a disconnected fashion.  Once the snapshot is created the user no longer needs to be connected to the cluster.

- VpK will __not__ modify a Kubernetes cluster.  It is designed as read-only.

- VpK is __not__ a real-time monitoring tool.


### Application features

- VpK accesses a Kubernetes cluster via an established kubectl CLI and saves query results, called a __snapshot__, in a local directory. 

- The locally stored __snapshot__ can be reused. This snapshot enables disconnected use of VpK to review the K8s resource data.  Once a snapshot is created VpK does not require connecting to the K8s cluster to view the collected data.
 
- A interactive 3D view of the K8s cluster.  This view supports zoom, rotate, tilt, and filtering of resources.

- Timelapse view of the 3D cluster to show the sequence of resource creation and removal.  The timelapse can be paused and viewed second-by-second along with interacting with the 3D view.

- Schematic views of workloads deployed in the cluster.  Interact with the schematic and view detail resource definitions.  Mouse over items and drill down to view detail resource information.

- View storage defined for the cluster by StorageClass, PV, PVC, CSI, along with node related storage.  

- View network IP addresses and address ranges for services, pods, and nodes. 

- View defined security roles, bindings, and subjects for the cluster or namespaces.

- View Owner References chains for K8s resources defined in the cluster.

- View event message statistics and timeline.

- View container image repositories and associated images.

- Search K8s resources with the ability to filter by namespaces, kinds, labels, resource names, and annotations.

--- 

### VpK 3D cluster view

The following is a screenshot of the 3D view feature:

<img style="float: center;" src="https://raw.githubusercontent.com/k8svisual/vpk-docs/master/docs/images/tab_cluster.png" width="1024">

<br>

---

## VpK Schematic view

The following a screenshot of the Workload Schematic view

<img style="float: center;" src="https://raw.githubusercontent.com/k8svisual/vpk-docs/master/docs/images/tab_workloadschematics.png" width="1024">

<br>

---

### Vpk online documentation

The online documenation website is available here:

![Documentation](https://k8svisual.github.io/vpk-docs/)

<br>

---

### VpK - Architecture diagram

<img style="float: center;" src="https://raw.githubusercontent.com/k8svisual/vpk-docs/master/docs/images/overview_local.png" width="1024">

<br>

---

## VpK - Contributors

Dave Weilert   
VJ Landon   
Dave Krier   


## License

Copyright (c) 2018-2024 Dave Weilert

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the
"Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish,
distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to
the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE
LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION
WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.


