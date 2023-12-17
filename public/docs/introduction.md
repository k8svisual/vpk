<topicKey introduction/>
<topicBack id="topicNext" link="installing"/>
<topicNext id="topicBack" link="toc"/>

<a style="float: right;" href="javascript:docNextTopic()">&nbsp;&nbsp;Next&nbsp;<i class="fa fa-lg fa-arrow-right"></i></a>
<a style="float: right;" href="javascript:docNextTopic('toc')">&nbsp;&nbsp;TOC&nbsp;&nbsp;</a>
<a style="float: right;" href="javascript:docPrevTopic()"><i class="fa fa-lg fa-arrow-left"></i>&nbsp;Prev&nbsp;&nbsp;</a>

### Introduction

VpK (Visually presented Kubernetes) was created to aid in understanding what is defined in a specific Kubernetes cluster.   

VpK is comprised of a server and browser application components.  The server component is a node.js application that communicates with running instances of Kubernetes using the __kubectl__ CLI.  The use of other CLI tools other than kubectl is supported.  

For VpK to obtain the K8s resource information an existing kubectl CLI connection must be established with the target Kubernetes cluster. The kubectl CLI connection must be completed by the user outside of VpK. If no kubectl CLI connection has been established no K8s resource data will be obtained.

The output from the kubectl CLI is processed to create multiple files that are collectively called a __snapshot__.  This snapshot is saved in a directory and can be reused without connecting to the K8s cluster for future sessions.  Once a snapshot has been created VpK no longer requires any communication with the Kubernetes cluster. 

__Note:__

    VpK is designed as read-only and will not modify a Kubernetes cluster and
    is not a real-time monitoring tool.  


### Overview diagram

<p align="center">
  <img style="float: center;" src="docs/docimages/overview_local.png" width="1024">
</p>

<hr style="border:1px solid #aaaaaa">

### Application features

- VpK will access a Kubernetes cluster via an established kubectl CLI and save query results, called a __snapshot__, in a local directory. 

- The locally stored __snapshot__ can be reused. This supports fully disconnected use of the K8s resource data without connecting to the K8s cluster.
 
- A interactive 3D view of the K8s cluster.  This view supports zoom, rotate, tilt, and filtering of resources.

- Schematic views of workloads deployed in the cluster.  Interact with the schematic and view detail resource definitions.

- View fully expanded or collapsible hierarchical graphs of K8s resources for the cluster or selected namespaces.  

- View a CirclePack graph of K8s resources for the cluster or selected namespaces.

- Views requested storage for StorageClass, Persistent Volume, and Persistent Volume Claims.

- View defined security roles, bindings, and subjects for the cluster or namespaces.

- Search K8s resources with the ability to filter by namespaces, kinds, labels, resource names, and annotations.

- View Owner References chains for K8s resources defined in the cluster.
  
<hr style="border:1px solid #aaaaaa">

