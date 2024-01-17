<topicKey introduction/>
<topicBack id="topicNext" link="installing"/>
<topicNext id="topicBack" link="toc"/>

<a style="float: right;" href="javascript:docNextTopic()">&nbsp;&nbsp;Next&nbsp;<i class="fa fa-lg fa-arrow-right"></i></a>
<a style="float: right;" href="javascript:docNextTopic('toc')">&nbsp;&nbsp;TOC&nbsp;&nbsp;</a>
<a style="float: right;" href="javascript:docPrevTopic()"><i class="fa fa-lg fa-arrow-left"></i>&nbsp;Prev&nbsp;&nbsp;</a>

### Introduction

VpK (Visually presented Kubernetes) was created to aid in understanding and learning about Kubernetes.   

VpK is comprised of a server component along with a browser application component.  The server component is a node.js application that can communicate with a running instance of a Kubernetes cluster using the __kubectl__ CLI.  The use of other CLI tools other than kubectl is supported.  

VpK requires what is called a 'snapshot'.  This is a collection of files that contain information obtained from a running Kubernetes cluster. For VpK to obtain the K8s resource information an existing kubectl CLI connection must be established with the target Kubernetes cluster from where data will be retrieved. 

The kubectl CLI connection must be established by the user outside of VpK. If no kubectl CLI connection has been established, then no K8s resource data will be retrieved. A series of 'kubectl get' commands are issued to obtain the cluster data.

The output from the kubectl CLI is processed to create files that are collectively called a __snapshot__.  This snapshot is saved in a directory and can be reused without connecting to the K8s cluster for future sessions.  

Once a snapshot has been created VpK no longer requires any communication with the Kubernetes cluster. 

!!! Note

    VpK is designed as read-only and will __not__ modify a Kubernetes cluster and is __not__ a real-time monitoring tool.  

### VpK overview diagram

The following diagram shows the major components and the interactions and storage of the snapshot files.  Note this diagram is when VpK is running locally and not in a Docker container.  Refer to the SNAPSHOTS topic for a description of both local and Docker container runtime differences.

<p align="center">
  <img style="float: center;" src="docs/docimages/overview_local.png" width="1024">

</p>

<hr style="border:1px solid #aaaaaa">

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

<hr style="border:1px solid #aaaaaa">


