<topicKey overview/>
<topicBack id="topicNext" link="snapshot"/>
<topicNext id="topicBack" link="generalusage"/>

<a style="float: right;" href="javascript:docNextTopic()">&nbsp;&nbsp;Next&nbsp;<i class="fas fa-lg fa-arrow-right"></i></a>
<a style="float: right;" href="javascript:docNextTopic('toc')">&nbsp;&nbsp;TOC&nbsp;&nbsp;</a>
<a style="float: right;" href="javascript:docPrevTopic()"><i class="fas fa-lg fa-arrow-left"></i>&nbsp;Prev&nbsp;&nbsp;</a>

###### Overview and architecture

---

Overview video of VpK.  

<div style="margin-left: 150px;">
    <iframe width="700" height="390" src="https://www.youtube.com/embed/xYWIyCwp99Y">
    </iframe>
</div>

---

VpK was created as the result of wanting a tool to aid in understanding what is defined in Kubernetes.   

VpK is comprised of a server and browser components.  The server component is a node.js application that communictes with running instances of K8 using the kubectl CLI application.  When using K8 versions that require a custom CLI tool to query Kubernets, e.g. OpenShift, MicroK8s, etc. the associated tool is used to query the cluster.  Using the kubectl api-resource command, a list of all known resources can be obtained.  Using this information all K8 resources support the 'get' verb are quired using kubectl get.  The output from the get requests used to create a seperate file for each unique resource.  These files are created on the user laptop.  At this point VpK no longer communicates with the K8 instance. 

The user interface (UI), browser component, provides graphical and tabular views of resources defined and deployed in the cluster.

What is VpK? 

- VpK is designed to capture a point-in-time snapshot of the cluster.
- Vpk provides the ability to view the captured snapshot in a disconnected fashion.  Once the snapshot is created the user no longer needs to be connected to the cluster.
- Vpk will __not__ modify a K8 cluster.  It is designed as read-only.
- VpK is __not__ a realtime monitoring tool.  


<img style="float: center;" src="docs/docimages/architecture.png" width="1024" height="542">


Application features include:

- Access running K8 instances via CLI and saving results in locally stored directory.

- The locally stored K8 query results allow disconnected use of VpK once a successful retrieval of K8 resource information.
 
- Tabular viewing of resources with the abilty to filter by namespaces, kinds, labels, and resource names.

- Fully expanded or collapsible hierarchial views of K8 resources.  

- Circlepack view of K8 resouces.  

- Schematic views of running workloads in the cluster.

- Views of roles, bindings, and subject used to define RBAC.

- Usage of RBAC definitions.

- Create and view custom cross reference information of K8 resource elements.

---

<a style="float: right;" href="javascript:docNextTopic()">&nbsp;&nbsp;Next&nbsp;<i class="fas fa-lg fa-arrow-right"></i></a>
<a style="float: right;" href="javascript:docNextTopic('toc')">&nbsp;&nbsp;TOC&nbsp;&nbsp;</a>
<a style="float: right;" href="javascript:docPrevTopic()"><i class="fas fa-lg fa-arrow-left"></i>&nbsp;Prev&nbsp;&nbsp;</a>
