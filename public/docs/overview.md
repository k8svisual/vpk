<topicKey overview/>
<topicBack id="topicNext" link="snapshot"/>
<topicNext id="topicBack" link="generalusage"/>

<a style="float: right;" href="javascript:docNextTopic()">&nbsp;&nbsp;Next&nbsp;<i class="fas fa-lg fa-arrow-right"></i></a>
<a style="float: right;" href="javascript:docNextTopic('toc')">&nbsp;&nbsp;TOC&nbsp;&nbsp;</a>
<a style="float: right;" href="javascript:docPrevTopic()"><i class="fas fa-lg fa-arrow-left"></i>&nbsp;Prev&nbsp;&nbsp;</a>

#### VpK Overview and Architecture


<!-- Overview video of VpK.   -->

<!-- <div style="margin-left: 150px;">
    <iframe width="700" height="390" src="https://www.youtube.com/embed/xYWIyCwp99Y">
    </iframe>
</div> -->

---
##### What is VpK? 

VpK (Visually presented Kubernetes) was created to aid in understanding what is defined in a specific Kubernetes cluster.   

VpK is comprised of a server and browser components.  The server component is a node.js application that communicates with running instances of K8s using the __kubectl__ CLI.  The use of other CLI tools other than __kubectl__ is supported.  

To obtain the k8s resource information the user must connect to the desired Kubernetes cluster with the CLI before retrieving the data.  If no Kubernetes connection has been established no data will be obtained.

When getting data from the cluster the kubectl CLI (or other configured CLI) is used to get the defined api-resources.  Using this list of defined Kubernetes api resources, the CLI will use the 'get' option to obtain the k8s data for each resource type. The output from the get request is used to create a file (__snapshot__) that is saved and can be reused without connecting to the k8s cluster for this and future sessions.  View the snapshot topic in the documentation for additional information on snapshots. 

At this point VpK no longer requires any communication with the Kubernetes cluster. 

- VpK is designed to capture a point-in-time snapshot of the cluster.
- Vpk provides the ability to view the captured snapshot in a disconnected fashion.  Once the snapshot is created the user no longer needs to be connected to the Kubernetes cluster.
- Vpk will __not__ modify a Kubernetes cluster.  VpK is designed as read-only.
- VpK is __not__ a real-time monitoring tool.  


##### Application features

- Access a Kubernetes instance via CLI and save results (__snapshot__) in local directory. This information can be reused.

- The locally stored __snapshot__ allows disconnected use of VpK once a successful retrieval of k8s resource information.
 
- 3D interactive view of the k8s cluster.

- Schematic views of workloads deployed in the cluster.  Interact with the schematic and view detail resource definitions.

- View fully expanded or collapsible hierarchical graphs of k8s resources for the cluster or selected namespaces.  

- View a CirclePack graph of k8s resources for the cluster or selected namespaces.

- Views requested storage for StorageClass, Persistent Volume, and Persistent Volume Claims.

- View defined security roles, bindings, and subjects for the cluster or namespaces.

- Search k8s resources with the ability to filter by namespaces, kinds, labels, resource names, and annotations.

- View Owner References chains for resources defined in the k8s cluster.
  
<br>

##### Overview diagram

<br>

<img style="float: center;" src="docs/docimages/architecture.png" width="1024" height="542">



---

